"""Fuel price resolution.

Zimbabwe pump prices are capped monthly by ZERA (Zimbabwe Energy Regulatory
Authority). There is no public JSON API, so this module scrapes the published
figures and caches the last good result in the database.

If the network is unavailable or the page layout changes, the app degrades to
the last cached snapshot and marks it `is_live=False` so the UI can say so
honestly rather than presenting a stale number as current.
"""

import re
from datetime import datetime, timedelta, timezone

import httpx
from sqlalchemy import desc
from sqlalchemy.orm import Session

from ..models import PriceSnapshot

ZERA_URL = "https://www.zera.co.zw/fuel-pricing/"
CACHE_TTL = timedelta(hours=12)

# Used only on a completely cold database with no network. Clearly flagged as
# not live so the interface never claims it is a current figure.
COLD_START_PETROL = 1.57
COLD_START_DIESEL = 1.54

_PRICE_RE = re.compile(
    r"(blend|petrol|unleaded|diesel)[^0-9$]{0,80}\$?\s*([0-9]\.[0-9]{2,4})",
    re.IGNORECASE,
)


def _parse(html: str) -> tuple[float, float] | None:
    petrol: float | None = None
    diesel: float | None = None
    for label, value in _PRICE_RE.findall(html):
        price = float(value)
        if not 0.30 <= price <= 5.00:
            continue
        if label.lower() == "diesel" and diesel is None:
            diesel = price
        elif label.lower() != "diesel" and petrol is None:
            petrol = price
    if petrol is None or diesel is None:
        return None
    return petrol, diesel


def _latest(db: Session) -> PriceSnapshot | None:
    return db.query(PriceSnapshot).order_by(desc(PriceSnapshot.fetched_at)).first()


async def fetch_live_prices(db: Session, force: bool = False) -> PriceSnapshot:
    cached = _latest(db)
    if cached and not force:
        age = datetime.now(timezone.utc) - cached.fetched_at.replace(tzinfo=timezone.utc)
        if age < CACHE_TTL and cached.is_live:
            return cached

    try:
        async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
            resp = await client.get(ZERA_URL, headers={"User-Agent": "FuelLink/1.0"})
            resp.raise_for_status()
        parsed = _parse(resp.text)
    except Exception:
        parsed = None

    if parsed:
        petrol, diesel = parsed
        snapshot = PriceSnapshot(
            petrol_price=petrol,
            diesel_price=diesel,
            source="ZERA fuel pricing page",
            source_url=ZERA_URL,
            is_live=True,
            effective_period=datetime.now(timezone.utc).strftime("%B %Y"),
        )
        db.add(snapshot)
        db.commit()
        db.refresh(snapshot)
        return snapshot

    if cached:
        return cached

    snapshot = PriceSnapshot(
        petrol_price=COLD_START_PETROL,
        diesel_price=COLD_START_DIESEL,
        source="Bundled fallback - not a live figure",
        source_url=ZERA_URL,
        is_live=False,
        effective_period="unverified",
    )
    db.add(snapshot)
    db.commit()
    db.refresh(snapshot)
    return snapshot


def current_unit_price(snapshot: PriceSnapshot, fuel_type: str | None) -> float:
    return snapshot.diesel_price if (fuel_type or "").lower() == "diesel" else snapshot.petrol_price
