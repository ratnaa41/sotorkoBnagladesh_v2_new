
"""
Dhaka City hotspot model training.

Input:
    backend/data/buet_clean.csv

Outputs (separate from existing district models):
    backend/ml_models/dhaka_hotspots.json
    backend/ml_models/dhaka_metrics.json
    backend/ml_models/dhaka_severity_model.joblib

Only non-placeholder coordinates inside the preliminary Dhaka bounding box
are used. This is a historical hotspot analysis, not a future accident
probability prediction.
"""

import argparse
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.cluster import DBSCAN
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder


BASE_DIR = Path(__file__).resolve().parent.parent
DEFAULT_CSV = BASE_DIR / "data" / "buet_clean.csv"
MODEL_DIR = BASE_DIR / "ml_models"

# Preliminary geographic filter only; not an official administrative boundary.
DHaka_BOUNDS = {
    "min_lat": 23.62,
    "max_lat": 23.92,
    "min_lon": 90.32,
    "max_lon": 90.52,
}

FEATURES = [
    "hour",
    "month",
    "weekday",
    "weather",
    "light",
    "road_surface",
    "road_class",
    "place_type",
    "junction",
    "traffic_control",
    "victim_category",
    "vehicle_count",
    "driver_age_group",
]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", default=str(DEFAULT_CSV))
    args = parser.parse_args()

    csv_path = Path(args.csv)
    if not csv_path.exists():
        raise FileNotFoundError(f"CSV not found: {csv_path}")

    print(f"Reading: {csv_path}")
    df = pd.read_csv(csv_path)

    required = {
        "latitude", "longitude", "coord_is_placeholder",
        "severity", "hour", "month", "weekday",
    }
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Missing required columns: {sorted(missing)}")

    # Convert coordinate fields safely.
    df["latitude"] = pd.to_numeric(df["latitude"], errors="coerce")
    df["longitude"] = pd.to_numeric(df["longitude"], errors="coerce")

    placeholder = df["coord_is_placeholder"].astype(str).str.lower().isin(
        ["true", "1", "yes"]
    )

    b = DHaka_BOUNDS
    in_dhaka = (
        df["latitude"].between(b["min_lat"], b["max_lat"])
        & df["longitude"].between(b["min_lon"], b["max_lon"])
    )

    geo = df.loc[
        (~placeholder) & in_dhaka
        & df["latitude"].notna()
        & df["longitude"].notna()
    ].copy()

    if len(geo) < 20:
        raise ValueError(
            f"Only {len(geo)} usable Dhaka coordinate rows; "
            "at least 20 are required."
        )

    print(f"Usable Dhaka coordinate records: {len(geo)}")

    # Cluster coordinates. DBSCAN uses haversine distance in radians.
    earth_radius_km = 6371.0088
    coords_rad = np.radians(geo[["latitude", "longitude"]].to_numpy())

    clusterer = DBSCAN(
        eps=0.5 / earth_radius_km,  # 500 metres
        min_samples=5,
        metric="haversine",
    )
    geo["cluster_id"] = clusterer.fit_predict(coords_rad)

    hotspots = []
    for cluster_id, group in geo[geo["cluster_id"] >= 0].groupby("cluster_id"):
        hotspots.append({
            "cluster_id": int(cluster_id),
            "latitude": round(float(group["latitude"].mean()), 6),
            "longitude": round(float(group["longitude"].mean()), 6),
            "accident_records": int(len(group)),
            "unique_locations": int(group["location"].nunique())
                if "location" in group.columns else None,
            "severity_counts": {
                str(k): int(v)
                for k, v in group["severity"].value_counts().items()
            },
            "fatalities": int(
                pd.to_numeric(group.get("deaths", 0), errors="coerce")
                .fillna(0).sum()
            ),
            "injuries": int(
                pd.to_numeric(group.get("injuries", 0), errors="coerce")
                .fillna(0).sum()
            ),
        })

    hotspots.sort(
        key=lambda item: item["accident_records"],
        reverse=True,
    )

    # Train a severity classifier on the Dhaka geocoded subset.
    # Exclude deaths/injuries: they are outcomes, not pre-event features.
    available_features = [c for c in FEATURES if c in geo.columns]
    model_df = geo.dropna(subset=["severity"]).copy()

    if len(model_df) < 30 or model_df["severity"].nunique() < 2:
        raise ValueError(
            "Not enough labelled Dhaka records to train severity classifier."
        )

    X = model_df[available_features].copy()
    encoders = {}

    for col in available_features:
        if X[col].dtype == "object" or str(X[col].dtype) == "bool":
            X[col] = X[col].fillna("Unknown").astype(str)
            encoder = LabelEncoder()
            X[col] = encoder.fit_transform(X[col])
            encoders[col] = encoder
        else:
            X[col] = pd.to_numeric(X[col], errors="coerce")
            X[col] = X[col].fillna(X[col].median())

    y_encoder = LabelEncoder()
    y = y_encoder.fit_transform(model_df["severity"].astype(str))

    class_counts = pd.Series(y).value_counts()
    stratify = y if class_counts.min() >= 2 else None

    X_train, X_test, y_train, y_test = train_test_split(
        X, y,
        test_size=0.2,
        random_state=42,
        stratify=stratify,
    )

    model = RandomForestClassifier(
        n_estimators=200,
        max_depth=10,
        min_samples_leaf=2,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X_train, y_train)
    predictions = model.predict(X_test)

    accuracy = float(accuracy_score(y_test, predictions))
    report = classification_report(
        y_test,
        predictions,
        labels=np.arange(len(y_encoder.classes_)),
        target_names=[str(c) for c in y_encoder.classes_],
        output_dict=True,
        zero_division=0,
    )

    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    # Save only to new filenames. Existing models are not overwritten.
    joblib.dump(
        {
            "model": model,
            "feature_columns": available_features,
            "encoders": encoders,
            "target_encoder": y_encoder,
        },
        MODEL_DIR / "dhaka_severity_model.joblib",
    )

    hotspot_payload = {
        "scope": "Dhaka City preliminary bounding box",
        "boundary_note": (
            "Approximate coordinate filter, not an official administrative boundary."
        ),
        "coordinate_filter": b,
        "clustering": {
            "algorithm": "DBSCAN",
            "radius_metres": 500,
            "minimum_records": 5,
        },
        "source": "BUET",
        "records_used": int(len(geo)),
        "noise_records": int((geo["cluster_id"] == -1).sum()),
        "hotspot_count": len(hotspots),
        "hotspots": hotspots,
    }

    with open(MODEL_DIR / "dhaka_hotspots.json", "w", encoding="utf-8") as f:
        json.dump(hotspot_payload, f, indent=2, ensure_ascii=False)

    metrics = {
        "model_type": "RandomForestClassifier",
        "target": "BUET accident severity category",
        "records_used": int(len(model_df)),
        "training_records": int(len(X_train)),
        "testing_records": int(len(X_test)),
        "features": available_features,
        "classes": [str(c) for c in y_encoder.classes_],
        "accuracy": round(accuracy, 4),
        "classification_report": report,
        "note": (
            "Severity classification, not prediction of whether or where "
            "a future accident will occur."
        ),
    }

    with open(MODEL_DIR / "dhaka_metrics.json", "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2, ensure_ascii=False)

    print("\nTraining completed.")
    print(f"Dhaka records: {len(geo)}")
    print(f"Hotspot clusters: {len(hotspots)}")
    print(f"Severity classifier accuracy: {accuracy:.4f}")
    print(f"Saved files in: {MODEL_DIR}")
    print("Existing district model files were not modified.")


if __name__ == "__main__":
    main()
