from pathlib import Path
import json
import time
import urllib.parse
import urllib.request
import urllib.error

BASE = Path(__file__).resolve().parents[1]
SOURCE = BASE / "ml_models" / "dhaka_hotspots.json"
OUTPUT = BASE / "ml_models" / "dhaka_hotspot_names.json"

data = json.loads(SOURCE.read_text(encoding="utf-8"))
hotspots = data.get("hotspots", [])

if OUTPUT.exists():
    results = json.loads(OUTPUT.read_text(encoding="utf-8"))
else:
    results = {}

def get_area_name(address):
    for key in (
        "neighbourhood", "suburb", "city_district",
        "borough", "quarter", "residential",
        "village", "town"
    ):
        if address.get(key):
            return address[key]

    if address.get("road"):
        return "Near " + address["road"]

    return "Area name unavailable"

for index, item in enumerate(hotspots):
    cluster_id = str(item.get("cluster_id"))
    if cluster_id in results and results[cluster_id].get("area_name"):
        print(f"Cached: Cluster {cluster_id} - {results[cluster_id]['area_name']}")
        continue

    lat = item.get("latitude")
    lon = item.get("longitude")
    if lat is None or lon is None:
        results[cluster_id] = {"area_name": "Area name unavailable"}
        continue

    params = urllib.parse.urlencode({
        "lat": lat,
        "lon": lon,
        "format": "jsonv2",
        "addressdetails": 1,
        "zoom": 16
    })
    url = "https://nominatim.openstreetmap.org/reverse?" + params
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "SotorkoBangladesh/1.0 (educational project)"}
    )

    try:
        if index > 0:
            time.sleep(1.1)

        with urllib.request.urlopen(request, timeout=20) as response:
            place = json.loads(response.read().decode("utf-8"))

        address = place.get("address", {})
        results[cluster_id] = {
            "area_name": get_area_name(address),
            "display_name": place.get("display_name", ""),
            "latitude": lat,
            "longitude": lon
        }
        print(f"Found: Cluster {cluster_id} - {results[cluster_id]['area_name']}")

    except (urllib.error.URLError, TimeoutError, ValueError) as exc:
        results[cluster_id] = {
            "area_name": "Area name unavailable",
            "error": str(exc),
            "latitude": lat,
            "longitude": lon
        }
        print(f"Could not resolve cluster {cluster_id}: {exc}")

    OUTPUT.write_text(
        json.dumps(results, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )

OUTPUT.write_text(
    json.dumps(results, ensure_ascii=False, indent=2),
    encoding="utf-8"
)
print(f"\nDONE: {len(results)} cluster names saved to {OUTPUT}")
