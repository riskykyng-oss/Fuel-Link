"""Service-area coverage check, available WITHOUT an account (FR-1).

A stranded first-time user must be able to learn whether help exists near them
before being asked to register. This mirrors the quote's radius gate but only
reports what is reachable; it never fabricates an ETA.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models import Station
from ..schemas import CoverageIn, CoverageOut, StationOut
from ..services.fuel_prices import fetch_live_prices
from ..services.geo import eta_minutes, road_distance_km

router = APIRouter(prefix="/api", tags=["coverage"])

NEAREST_LIMIT = 3


@router.post("/coverage", response_model=CoverageOut)
async def coverage(payload: CoverageIn, db: Session = Depends(get_db)) -> CoverageOut:
    snapshot = await fetch_live_prices(db)

    def to_out(station: Station, distance: float) -> StationOut:
        item = StationOut.model_validate(station)
        item.distance_km = distance
        item.petrol_price = round(snapshot.petrol_price + (station.petrol_price or 0), 3)
        item.diesel_price = round(snapshot.diesel_price + (station.diesel_price or 0), 3)
        return item

    ranked: list[tuple[float, Station]] = []
    for station in db.query(Station).all():
        d = road_distance_km(payload.lat, payload.lng, station.lat, station.lng)
        ranked.append((d, station))
    ranked.sort(key=lambda pair: pair[0])

    in_radius = [pair for pair in ranked if pair[0] <= settings.fuellink_search_radius_km]
    if in_radius:
        nearest, station = in_radius[0]
        return CoverageOut(
            covered=True,
            message=(
                f"Help is available near you. Closest response is about "
                f"{eta_minutes(nearest)} minutes away."
            ),
            est_response_min=eta_minutes(nearest),
            stations=[to_out(s, d) for d, s in in_radius[:NEAREST_LIMIT]],
        )

    nearest, station = ranked[0]
    return CoverageOut(
        covered=False,
        message=(
            "No service provider is inside your area right now. "
            "Here are the nearest stations, or call the emergency line."
        ),
        est_response_min=None,
        stations=[to_out(s, d) for d, s in ranked[:NEAREST_LIMIT]],
    )
