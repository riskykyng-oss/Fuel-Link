from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models import Station
from ..schemas import FuelPriceOut, StationOut
from ..services.fuel_prices import fetch_live_prices
from ..services.geo import road_distance_km

router = APIRouter(prefix="/api", tags=["stations"])


@router.get("/stations/nearby", response_model=list[StationOut])
async def nearby_stations(
    lat: float = Query(ge=-90, le=90),
    lng: float = Query(ge=-180, le=180),
    radius_km: float = Query(default=0, ge=0, le=200),
    fuel_type: str | None = None,
    db: Session = Depends(get_db),
) -> list[StationOut]:
    radius = radius_km or settings.fuellink_search_radius_km
    snapshot = await fetch_live_prices(db)

    results: list[StationOut] = []
    for station in db.query(Station).all():
        if fuel_type == "petrol" and not station.has_petrol:
            continue
        if fuel_type == "diesel" and not station.has_diesel:
            continue

        distance = road_distance_km(lat, lng, station.lat, station.lng)
        if distance > radius:
            continue

        item = StationOut.model_validate(station)
        item.distance_km = distance
        # Station-level prices are seeded offsets from the national cap; refresh
        # them against the latest snapshot so the list never drifts stale.
        item.petrol_price = round(snapshot.petrol_price + (station.petrol_price or 0), 3)
        item.diesel_price = round(snapshot.diesel_price + (station.diesel_price or 0), 3)
        results.append(item)

    results.sort(key=lambda s: s.distance_km)
    return results


@router.get("/stations/{station_id}", response_model=StationOut)
def get_station(station_id: int, db: Session = Depends(get_db)) -> Station:
    station = db.get(Station, station_id)
    if station is None:
        raise HTTPException(status_code=404, detail="That station is not on file.")
    return station


@router.get("/fuel-prices", response_model=FuelPriceOut)
async def fuel_prices(refresh: bool = False, db: Session = Depends(get_db)) -> FuelPriceOut:
    snapshot = await fetch_live_prices(db, force=refresh)
    return FuelPriceOut(
        petrol_price=snapshot.petrol_price,
        diesel_price=snapshot.diesel_price,
        currency=snapshot.currency,
        source=snapshot.source,
        source_url=snapshot.source_url,
        is_live=snapshot.is_live,
        effective_period=snapshot.effective_period,
        fetched_at=snapshot.fetched_at,
    )
