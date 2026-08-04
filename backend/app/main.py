from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import Base, SessionLocal, engine
from .routers import auth, orders, payments, services, stations, tracking
from .seed import seed_if_empty


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_if_empty(db)
    finally:
        db.close()
    yield


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

for module in (auth, stations, orders, payments, services, tracking):
    app.include_router(module.router)


@app.get("/api/health", tags=["meta"])
def health() -> dict:
    return {
        "status": "ok",
        "payments_mode": "live" if settings.paynow_live else "mock",
        "delivery_rate_per_km": settings.fuellink_delivery_rate_multiplier,
        "search_radius_km": settings.fuellink_search_radius_km,
    }
