import asyncio
import contextlib

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from ..config import settings
from ..database import SessionLocal, get_db
from ..models import Order, OrderStatus, Role, User
from ..security import ALGORITHM, mask_phone, require_role
from ..services.geo import eta_minutes, road_distance_km

router = APIRouter(tags=["tracking"])

PUSH_INTERVAL_SECONDS = 3


def _snapshot(db: Session, order_id: int, viewer_id: int) -> dict | None:
    order = db.get(Order, order_id)
    if order is None:
        return None

    lat = lng = None
    profile = order.supplier.supplier_profile if order.supplier else None
    if profile:
        lat = profile.current_lat
        lng = profile.current_lng

    remaining = order.distance_km
    if lat is not None and lng is not None:
        remaining = road_distance_km(lat, lng, order.pickup_lat, order.pickup_lng)

    return {
        "order_id": order.id,
        "reference": order.reference,
        "status": order.status,
        "payment_status": order.payment.status if order.payment else None,
        "supplier_lat": lat,
        "supplier_lng": lng,
        "pickup_lat": order.pickup_lat,
        "pickup_lng": order.pickup_lng,
        "remaining_km": round(remaining, 2),
        "eta_minutes": eta_minutes(remaining) if order.status != OrderStatus.DELIVERED else 0,
        "supplier_name": order.supplier.full_name if order.supplier else None,
        # The courier's line is only ever shown MASKED — any call must route
        # through the app relay, never the motorist's dialler directly.
        "supplier_phone": mask_phone(order.supplier.phone_number) if order.supplier else None,
        "provider_verified": bool(profile and profile.is_verified),
        "provider_staff_id": order.staff.staff_id if order.staff else None,
        # Handover reversal (master spec §3/§7): the motorist sees the
        # read-only code and reads it out; the provider never receives it.
        "handover_code": order.handover_code if viewer_id == order.customer_id else None,
    }


@router.websocket("/ws/orders/{order_id}")
async def track_order(websocket: WebSocket, order_id: int, token: str = "") -> None:
    await websocket.accept()
    try:
        payload = jwt.decode(token, settings.fuellink_secret_key, algorithms=[ALGORITHM])
        user_id = int(payload.get("sub", 0))
    except (JWTError, ValueError):
        await websocket.close(code=4401)
        return

    last: dict | None = None
    try:
        while True:
            # Short-lived session per push: the pooled SQLite connection is
            # returned between polls instead of being held for the life of the
            # socket. Without this, a handful of open tracking tabs exhausts
            # the connection pool and takes the whole API down.
            db = SessionLocal()
            try:
                order = db.get(Order, order_id)
                if order is None or user_id not in {order.customer_id, order.supplier_id}:
                    await websocket.close(code=4403)
                    return
                current = _snapshot(db, order_id, viewer_id=user_id)
            finally:
                db.close()

            if current is None:
                break
            if current != last:
                await websocket.send_json(current)
                last = current
            if current["status"] in {OrderStatus.DELIVERED, OrderStatus.CANCELLED}:
                break
            await asyncio.sleep(PUSH_INTERVAL_SECONDS)
    except WebSocketDisconnect:
        pass
    finally:
        with contextlib.suppress(Exception):
            await websocket.close()


@router.get("/api/orders/{order_id}/poll")
def poll_order(
    order_id: int,
    user: User = Depends(require_role(Role.CUSTOMER, Role.SUPPLIER)),
    db: Session = Depends(get_db),
) -> dict:
    """HTTP polling fallback for tracking when WebSockets are unavailable (e.g. Vercel)."""
    order = db.get(Order, order_id)
    if order is None or user.id not in {order.customer_id, order.supplier_id}:
        raise HTTPException(status_code=404, detail="Order not found.")
    snap = _snapshot(db, order_id, viewer_id=user.id)
    if snap is None:
        raise HTTPException(status_code=404, detail="Order not found.")
    return snap


@router.post("/api/supplier/demo-drive/{order_id}")
def demo_drive(
    order_id: int,
    user: User = Depends(require_role(Role.SUPPLIER)),
    db: Session = Depends(get_db),
) -> dict:
    """Advance the supplier marker one step toward the pickup pin.

    Testing aid only. It moves a simulated vehicle so the live map can be
    demonstrated without driving. Real deployments use POST /api/supplier/location
    fed by the device GPS.
    """
    order = db.get(Order, order_id)
    if order is None or order.supplier_id != user.id:
        raise HTTPException(status_code=404, detail="Order not found.")

    profile = user.supplier_profile
    if profile is None:
        raise HTTPException(status_code=404, detail="Supplier profile missing.")

    if profile.current_lat is None or profile.current_lng is None:
        origin = order.station
        profile.current_lat = origin.lat if origin else order.pickup_lat + 0.05
        profile.current_lng = origin.lng if origin else order.pickup_lng + 0.05

    step = 0.18  # fraction of the remaining gap covered per call
    profile.current_lat += (order.pickup_lat - profile.current_lat) * step
    profile.current_lng += (order.pickup_lng - profile.current_lng) * step
    db.commit()

    remaining = road_distance_km(
        profile.current_lat, profile.current_lng, order.pickup_lat, order.pickup_lng
    )
    return {"lat": profile.current_lat, "lng": profile.current_lng, "remaining_km": remaining}
