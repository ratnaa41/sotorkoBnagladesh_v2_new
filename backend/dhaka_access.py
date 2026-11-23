import json
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from auth import get_current_user
import models

router = APIRouter(prefix="/api/dhaka", tags=["Dhaka Hotspots"])

MODEL_DIR = Path(__file__).resolve().parent / "ml_models"


def require_dhaka_user(current_user: models.User):
    district = (getattr(current_user, "preferred_district", "") or "").strip().casefold()

    if district != "dhaka":
        raise HTTPException(
            status_code=403,
            detail="Dhaka City hotspot access is available only to users whose preferred district is Dhaka."
        )


def read_model_json(filename: str):
    file_path = MODEL_DIR / filename

    if not file_path.is_file():
        raise HTTPException(
            status_code=503,
            detail=f"Required Dhaka model file is missing: {filename}"
        )

    try:
        with file_path.open("r", encoding="utf-8") as file:
            return json.load(file)
    except (json.JSONDecodeError, OSError):
        raise HTTPException(
            status_code=500,
            detail=f"Could not read Dhaka model file: {filename}"
        )


@router.get("/hotspots")
def get_dhaka_hotspots(
    current_user: models.User = Depends(get_current_user)
):
    require_dhaka_user(current_user)
    return read_model_json("dhaka_hotspots.json")


@router.get("/metrics")
def get_dhaka_metrics(
    current_user: models.User = Depends(get_current_user)
):
    require_dhaka_user(current_user)
    return read_model_json("dhaka_metrics.json")
