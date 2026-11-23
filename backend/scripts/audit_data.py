
"""
SotorkoBangladesh - Safe source data audit.

Reads every row from BUET and news CSV files.
Does not modify the database or source files.
"""

from pathlib import Path
import hashlib
import json
import re

import pandas as pd


ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
REPORT_DIR = ROOT / "reports"

BUET_FILE = DATA_DIR / "buet_clean.csv"
NEWS_FILE = DATA_DIR / "accidents_v2.csv"

DEFAULT_BUET_DATE = "2024-02-14"

DISTRICT_ALIASES = {
    "coxs bazar": "Cox's Bazar",
    "jhalakathi": "Jhalokati",
    "nawabganj": "Chapainawabganj",
    "bogra": "Bogura",
    "comilla": "Cumilla",
    "jessore": "Jashore",
    "jhenidah": "Jhenaidah",
    "netrakona": "Netrokona",
    "barisal": "Barishal",
    "chittagong": "Chattogram",
    "chattagram": "Chattogram",
}


def clean(value):
    if pd.isna(value):
        return None

    value = str(value).strip()

    if not value or value.lower() in {"nan", "none", "null"}:
        return None

    return value


def truthy(value):
    return str(value).strip().lower() in {
        "true", "1", "yes", "y"
    }


def normalize_district(value):
    value = clean(value)

    if not value:
        return "Unknown"

    normalized = value.lower().replace("’", "'")

    return DISTRICT_ALIASES.get(normalized, value)


def valid_coordinate(lat, lon):
    try:
        lat = float(lat)
        lon = float(lon)

        return (
            20.5 <= lat <= 26.7
            and 88.0 <= lon <= 92.8
        )
    except (TypeError, ValueError):
        return False


def valid_month(value):
    try:
        month = int(float(value))
        return month if 1 <= month <= 12 else None
    except (TypeError, ValueError):
        return None


def valid_hour(value):
    try:
        hour = int(float(value))
        return hour if 0 <= hour <= 23 else None
    except (TypeError, ValueError):
        return None


def parse_year(value):
    value = clean(value)

    if not value:
        return None

    match = re.search(r"(19|20)\d{2}", value)

    return int(match.group()) if match else None


def fingerprint(source, row):
    """
    Stable fingerprint for audit comparison.
    Does not assume accident_id is unique.
    """

    if source == "buet":
        values = [
            clean(row.get("date")),
            clean(row.get("location")),
            clean(row.get("deaths")),
            clean(row.get("injuries")),
            clean(row.get("hour")),
            clean(row.get("month")),
            clean(row.get("latitude")),
            clean(row.get("longitude")),
        ]
    else:
        values = [
            clean(row.get("event_date")),
            clean(row.get("title")),
            normalize_district(row.get("district")),
            clean(row.get("road_name")),
            clean(row.get("fatalities")),
            clean(row.get("injuries")),
            clean(row.get("source_url")),
        ]

    raw = json.dumps(
        [source, values],
        ensure_ascii=False,
        separators=(",", ":"),
    )

    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def audit_buet():
    if not BUET_FILE.exists():
        raise FileNotFoundError(BUET_FILE)

    df = pd.read_csv(BUET_FILE, low_memory=False)

    print(f"\n[BUET] Source rows: {len(df):,}")

    default_date = 0
    default_hour = 0
    genuine_coords = 0
    placeholder_coords = 0
    invalid_coords = 0
    missing_date = 0
    valid_dates = 0

    fingerprints = set()
    duplicate_candidates = 0
    district_counts = {}

    for _, row in df.iterrows():
        date_value = clean(row.get("date"))

        is_default_date = (
            date_value == DEFAULT_BUET_DATE
        )

        if is_default_date:
            default_date += 1

        if not date_value:
            missing_date += 1
        elif not is_default_date and parse_year(date_value):
            valid_dates += 1

        if truthy(row.get("hour_is_default")):
            default_hour += 1

        lat = row.get("latitude")
        lon = row.get("longitude")

        source_placeholder = truthy(
            row.get("coord_is_placeholder")
        )

        if not valid_coordinate(lat, lon):
            invalid_coords += 1
            placeholder_coords += 1
        elif source_placeholder:
            placeholder_coords += 1
        else:
            genuine_coords += 1

        # Keep every row; Unknown is a coverage category.
        district = "Unknown"

        location = clean(row.get("location"))

        if location:
            # Do not infer district from arbitrary substring matches.
            district = "Dhaka" if "dhaka" in location.lower() else "Unknown"

        district_counts[district] = (
            district_counts.get(district, 0) + 1
        )

        key = fingerprint("buet", row)

        if key in fingerprints:
            duplicate_candidates += 1
        else:
            fingerprints.add(key)

    return {
        "source": "BUET",
        "rows": len(df),
        "default_date_rows": default_date,
        "default_hour_rows": default_hour,
        "missing_date_rows": missing_date,
        "usable_date_rows": valid_dates,
        "genuine_coordinate_rows": genuine_coords,
        "placeholder_coordinate_rows": placeholder_coords,
        "invalid_coordinate_rows": invalid_coords,
        "duplicate_candidates": duplicate_candidates,
        "district_coverage": district_counts,
    }


def audit_news():
    if not NEWS_FILE.exists():
        raise FileNotFoundError(NEWS_FILE)

    df = pd.read_csv(NEWS_FILE, low_memory=False)

    print(f"\n[NEWS] Source rows: {len(df):,}")

    fingerprints = set()
    duplicate_candidates = 0
    missing_district = 0
    missing_date = 0
    valid_coords = 0
    missing_coords = 0

    district_counts = {}
    verification_counts = {}

    for _, row in df.iterrows():
        district = normalize_district(row.get("district"))

        if district == "Unknown":
            missing_district += 1

        district_counts[district] = (
            district_counts.get(district, 0) + 1
        )

        date_value = clean(row.get("event_date"))

        if not date_value:
            missing_date += 1

        if valid_coordinate(
            row.get("latitude"),
            row.get("longitude"),
        ):
            valid_coords += 1
        else:
            missing_coords += 1

        verification = (
            clean(row.get("verification_status"))
            or "unknown"
        )

        verification_counts[verification] = (
            verification_counts.get(verification, 0) + 1
        )

        key = fingerprint("news", row)

        if key in fingerprints:
            duplicate_candidates += 1
        else:
            fingerprints.add(key)

    return {
        "source": "News",
        "rows": len(df),
        "missing_district_rows": missing_district,
        "missing_date_rows": missing_date,
        "valid_coordinate_rows": valid_coords,
        "missing_or_invalid_coordinate_rows": missing_coords,
        "duplicate_candidates": duplicate_candidates,
        "district_coverage": district_counts,
        "verification_status": verification_counts,
    }


def main():
    REPORT_DIR.mkdir(parents=True, exist_ok=True)

    print("=" * 60)
    print("SOTORKOBANGLADESH - SAFE DATA AUDIT")
    print("READ ONLY: DATABASE AND CSV FILES WILL NOT BE MODIFIED")
    print("=" * 60)

    buet_report = audit_buet()
    news_report = audit_news()

    report = {
        "project": "SotorkoBangladesh",
        "mode": "read_only_audit",
        "buet": buet_report,
        "news": news_report,
        "total_source_rows": (
            buet_report["rows"] + news_report["rows"]
        ),
    }

    output = REPORT_DIR / "source_data_audit.json"

    output.write_text(
        json.dumps(report, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    print("\n" + "=" * 60)
    print("AUDIT SUMMARY")
    print("=" * 60)

    for item in (buet_report, news_report):
        print(f"\n{item['source']}")
        for key, value in item.items():
            if key != "source":
                print(f"  {key}: {value}")

    print("\nTotal source rows:", report["total_source_rows"])
    print("Report saved:", output)
    print("\nNo database or source data was changed.")


if __name__ == "__main__":
    main()
