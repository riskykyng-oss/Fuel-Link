import asyncio
import contextlib
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import Base, SessionLocal, engine, migrate
from .routers import (
    auth,
    bids,
    coverage,
    disputes,
    emergency,
    orders,
    payments,
    services,
    staff,
    stations,
    tracking,
    vehicles,
    verify,
)
from .seed import seed_if_empty


@asynccontextmanager
async def lifespan(_: FastAPI):
    import logging, traceback
    _log = logging.getLogger("fuellink.lifespan")
    try:
        Base.metadata.create_all(bind=engine)
        migrate()
        db = SessionLocal()
        try:
            seed_if_empty(db)
        finally:
            db.close()
    except Exception:
        _log.warning("DB init failed — continuing without seed data:\n%s", traceback.format_exc())
    sweeper = asyncio.create_task(orders.offer_sweeper())
    yield
    sweeper.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await sweeper


app = FastAPI(
    title="FuelLink API",
    version="1.0.0",
    description="Geolocation-based emergency fuel and roadside assistance dispatch.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for module in (
    auth,
    verify,
    stations,
    coverage,
    orders,
    vehicles,
    payments,
    services,
    tracking,
    disputes,
    emergency,
    staff,
    bids,
):
    app.include_router(module.router)


@app.get("/api/health", tags=["meta"])
def health() -> dict:
    return {
        "status": "ok",
        "payments_mode": "live" if settings.paynow_live else "mock",
        "sms_mode": settings.fuellink_sms_mode,
        "delivery_rate_per_km": settings.fuellink_delivery_rate_multiplier,
        "search_radius_km": settings.fuellink_search_radius_km,
    }
