import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models import (
    Order,
    OrderStatus,
    PaymentStatus,
    Role,
    ServiceType,
    Station,
    SupplierProfile,
    User,
)
from ..schemas import (
    LocationPing,
    OnlineToggle,
    OrderCreate,
    OrderOut,
    OrderStatusUpdate,
    QuoteOut,
    QuoteRequest,
    RatingIn,
    StationOut,
)
from ..security import get_current_user, require_role
from ..services.fuel_prices import current_unit_price, fetch_live_prices
from ..services.geo import eta_minutes, road_distance_km

router = APIRouter(prefix="/api", tags=["orders"])

# Callout fee for non-fuel roadside work, charged on top of the distance fee.
CALLOUT_FEES: dict[str, float] = {
    ServiceType.TOWING: 25.00,
    ServiceType.JUMP_START: 8.00,
    ServiceType.TYRE_CHANGE: 10.00,
    ServiceType.LOCKOUT: 12.00,
    ServiceType.MECHANIC: 15.00,
    ServiceType.FUEL: 0.00,
}

ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    OrderStatus.PENDING: {OrderStatus.ACCEPTED, OrderStatus.CANCELLED},
    OrderStatus.ACCEPTED: {OrderStatus.IN_TRANSIT, OrderStatus.CANCELLED},
    OrderStatus.IN_TRANSIT: {OrderStatus.ARRIVED, OrderStatus.CANCELLED},
    OrderStatus.ARRIVED: {OrderStatus.DELIVERED},
    OrderStatus.DELIVERED: set(),
    OrderStatus.CANCELLED: set(),
}


def _origin_for(db: Session, req: QuoteRequest) -> tuple[float, float, Station | None]:
    """Where the supplier travels from. A chosen station, else the nearest one."""
    station: Station | None = None
    if req.station_id:
        station = db.get(Station, req.station_id)
        if station is None:
            raise HTTPException(status_code=404, detail="That station is not on file.")
    else:
        best: tuple[float, Station] | None = None
        for candidate in db.query(Station).all():
            d = road_distance_km(req.pickup_lat, req.pickup_lng, candidate.lat, candidate.lng)
            if best is None or d < best[0]:
                best = (d, candidate)
        station = best[1] if best else None

    if station is None:
        # No stations seeded: fall back to the pickup point so quoting still works.
        return req.pickup_lat, req.pickup_lng, None
    return station.lat, station.lng, station


async def build_quote(db: Session, req: QuoteRequest) -> QuoteOut:
    origin_lat, origin_lng, station = _origin_for(db, req)
    distance = road_distance_km(origin_lat, origin_lng, req.pickup_lat, req.pickup_lng)

    if distance > settings.fuellink_search_radius_km:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"No supplier within {settings.fuellink_search_radius_km:.0f} km of that pin. "
                "Move the pin closer to town or call the emergency line."
            ),
        )

    snapshot = await fetch_live_prices(db)
    unit_price = current_unit_price(snapshot, req.fuel_type)

    fuel_cost = 0.0
    if req.service_type == ServiceType.FUEL:
        if req.quantity_litres <= 0:
            raise HTTPException(status_code=422, detail="Choose how many litres you need.")
        fuel_cost = round(req.quantity_litres * unit_price, 2)

    delivery_fee = round(distance * settings.fuellink_delivery_rate_multiplier, 2)
    service_fee = CALLOUT_FEES.get(req.service_type, 0.0)
    total = round(fuel_cost + delivery_fee + service_fee, 2)

    station_out = None
    if station is not None:
        station_out = StationOut.model_validate(station)
        station_out.distance_km = distance
        station_out.petrol_price = round(snapshot.petrol_price + (station.petrol_price or 0), 3)
        station_out.diesel_price = round(snapshot.diesel_price + (station.diesel_price or 0), 3)

    note = (
        f"{distance:.2f} km x ${settings.fuellink_delivery_rate_multiplier:.0f}/km "
        f"= ${delivery_fee:.2f} delivery"
    )
    if service_fee:
        note += f" + ${service_fee:.2f} callout"

    return QuoteOut(
        distance_km=distance,
        unit_price=unit_price,
        fuel_cost=fuel_cost,
        delivery_fee=delivery_fee,
        service_fee=service_fee,
        total_amount=total,
        eta_minutes=eta_minutes(distance),
        breakdown_note=note,
        station=station_out,
    )


def _shape(order: Order) -> OrderOut:
    out = OrderOut.model_validate(order)
    out.payment_status = order.payment.status if order.payment else None
    if order.supplier and order.supplier.supplier_profile:
        out.supplier_lat = order.supplier.supplier_profile.current_lat
        out.supplier_lng = order.supplier.supplier_profile.current_lng
    return out


@router.post("/quote", response_model=QuoteOut)
async def quote(req: QuoteRequest, db: Session = Depends(get_db)) -> QuoteOut:
    return await build_quote(db, req)


@router.post("/orders", response_model=OrderOut, status_code=201)
async def create_order(
    payload: OrderCreate,
    user: User = Depends(require_role(Role.CUSTOMER)),
    db: Session = Depends(get_db),
) -> OrderOut:
    open_order = (
        db.query(Order)
        .filter(
            Order.customer_id == user.id,
            Order.status.in_(
                [
                    OrderStatus.PENDING,
                    OrderStatus.ACCEPTED,
                    OrderStatus.IN_TRANSIT,
                    OrderStatus.ARRIVED,
                ]
            ),
        )
        .first()
    )
    if open_order:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Order {open_order.reference} is still running. Finish or cancel it first.",
        )

    q = await build_quote(db, payload)
    order = Order(
        reference=f"FL{secrets.token_hex(3).upper()}",
        customer_id=user.id,
        station_id=q.station.id if q.station else None,
        service_type=payload.service_type,
        fuel_type=payload.fuel_type if payload.service_type == ServiceType.FUEL else None,
        quantity_litres=payload.quantity_litres,
        pickup_lat=payload.pickup_lat,
        pickup_lng=payload.pickup_lng,
        pickup_address=payload.pickup_address,
        notes=payload.notes,
        distance_km=q.distance_km,
        fuel_cost=q.fuel_cost,
        delivery_fee=q.delivery_fee,
        service_fee=q.service_fee,
        total_amount=q.total_amount,
        eta_minutes=q.eta_minutes,
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return _shape(order)


@router.get("/orders", response_model=list[OrderOut])
def my_orders(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[OrderOut]:
    query = db.query(Order)
    if user.role == Role.CUSTOMER:
        query = query.filter(Order.customer_id == user.id)
    elif user.role == Role.SUPPLIER:
        query = query.filter(Order.supplier_id == user.id)
    orders = query.order_by(Order.created_at.desc()).limit(100).all()
    return [_shape(o) for o in orders]


@router.get("/orders/active", response_model=OrderOut | None)
def active_order(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> OrderOut | None:
    live = [OrderStatus.PENDING, OrderStatus.ACCEPTED, OrderStatus.IN_TRANSIT, OrderStatus.ARRIVED]
    query = db.query(Order).filter(Order.status.in_(live))
    query = (
        query.filter(Order.customer_id == user.id)
        if user.role == Role.CUSTOMER
        else query.filter(Order.supplier_id == user.id)
    )
    order = query.order_by(Order.created_at.desc()).first()
    return _shape(order) if order else None


@router.get("/orders/available", response_model=list[OrderOut])
def available_jobs(
    user: User = Depends(require_role(Role.SUPPLIER)), db: Session = Depends(get_db)
) -> list[OrderOut]:
    profile = user.supplier_profile
    orders = (
        db.query(Order)
        .filter(Order.status == OrderStatus.PENDING, Order.supplier_id.is_(None))
        .order_by(Order.created_at.desc())
        .all()
    )
    if profile and profile.current_lat is not None and profile.current_lng is not None:
        orders = [
            o
            for o in orders
            if road_distance_km(profile.current_lat, profile.current_lng, o.pickup_lat, o.pickup_lng)
            <= settings.fuellink_search_radius_km
        ]
    return [_shape(o) for o in orders]


@router.get("/orders/{order_id}", response_model=OrderOut)
def get_order(
    order_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> OrderOut:
    order = db.get(Order, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found.")
    if user.role != Role.ADMIN and user.id not in {order.customer_id, order.supplier_id}:
        raise HTTPException(status_code=403, detail="That order belongs to someone else.")
    return _shape(order)


@router.post("/orders/{order_id}/accept", response_model=OrderOut)
def accept_order(
    order_id: int,
    user: User = Depends(require_role(Role.SUPPLIER)),
    db: Session = Depends(get_db),
) -> OrderOut:
    order = db.get(Order, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found.")
    if order.supplier_id is not None or order.status != OrderStatus.PENDING:
        raise HTTPException(status_code=409, detail="Another supplier already took this job.")

    order.supplier_id = user.id
    order.status = OrderStatus.ACCEPTED
    order.accepted_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(order)
    return _shape(order)


@router.patch("/orders/{order_id}/status", response_model=OrderOut)
def update_status(
    order_id: int,
    payload: OrderStatusUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> OrderOut:
    order = db.get(Order, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found.")
    if user.id not in {order.customer_id, order.supplier_id}:
        raise HTTPException(status_code=403, detail="That order belongs to someone else.")

    target = payload.status.value
    if target not in ALLOWED_TRANSITIONS[order.status]:
        raise HTTPException(
            status_code=409, detail=f"Cannot move an order from {order.status} to {target}."
        )
    if target != OrderStatus.CANCELLED and user.id != order.supplier_id:
        raise HTTPException(status_code=403, detail="Only the supplier can advance this job.")

    if target == OrderStatus.DELIVERED:
        if order.payment is None or order.payment.status != PaymentStatus.PAID:
            if order.payment and order.payment.method == "cash":
                order.payment.status = PaymentStatus.PAID
                order.payment.paid_at = datetime.now(timezone.utc)
            else:
                raise HTTPException(
                    status_code=409, detail="Payment is not settled yet. Confirm it first."
                )
        order.delivered_at = datetime.now(timezone.utc)
        profile = db.query(SupplierProfile).filter_by(user_id=order.supplier_id).first()
        if profile:
            profile.completed_jobs += 1
            profile.total_earnings = round(
                profile.total_earnings + order.delivery_fee + order.service_fee, 2
            )

    order.status = target
    db.commit()
    db.refresh(order)
    return _shape(order)


@router.post("/orders/{order_id}/rate", response_model=OrderOut)
def rate_order(
    order_id: int,
    payload: RatingIn,
    user: User = Depends(require_role(Role.CUSTOMER)),
    db: Session = Depends(get_db),
) -> OrderOut:
    order = db.get(Order, order_id)
    if order is None or order.customer_id != user.id:
        raise HTTPException(status_code=404, detail="Order not found.")
    if order.status != OrderStatus.DELIVERED:
        raise HTTPException(status_code=409, detail="Rate the job once it is delivered.")

    order.rating = payload.rating
    profile = db.query(SupplierProfile).filter_by(user_id=order.supplier_id).first()
    if profile:
        rated = (
            db.query(Order)
            .filter(Order.supplier_id == order.supplier_id, Order.rating.isnot(None))
            .all()
        )
        profile.rating = round(sum(o.rating for o in rated) / max(len(rated), 1), 2)
    db.commit()
    db.refresh(order)
    return _shape(order)


# ---------- supplier presence ----------


@router.post("/supplier/location", status_code=204)
def push_location(
    payload: LocationPing,
    user: User = Depends(require_role(Role.SUPPLIER)),
    db: Session = Depends(get_db),
) -> None:
    profile = user.supplier_profile
    if profile is None:
        raise HTTPException(status_code=404, detail="Supplier profile missing.")
    profile.current_lat = payload.lat
    profile.current_lng = payload.lng
    profile.location_updated_at = datetime.now(timezone.utc)
    db.commit()


@router.post("/supplier/online", status_code=204)
def set_online(
    payload: OnlineToggle,
    user: User = Depends(require_role(Role.SUPPLIER)),
    db: Session = Depends(get_db),
) -> None:
    profile = user.supplier_profile
    if profile is None:
        raise HTTPException(status_code=404, detail="Supplier profile missing.")
    profile.is_online = payload.is_online
    db.commit()


@router.get("/supplier/summary")
def supplier_summary(
    user: User = Depends(require_role(Role.SUPPLIER)), db: Session = Depends(get_db)
) -> dict:
    profile = user.supplier_profile
    delivered = (
        db.query(Order)
        .filter(Order.supplier_id == user.id, Order.status == OrderStatus.DELIVERED)
        .all()
    )
    litres = sum(o.quantity_litres for o in delivered)
    return {
        "is_online": bool(profile and profile.is_online),
        "is_verified": bool(profile and profile.is_verified),
        "rating": profile.rating if profile else 5.0,
        "completed_jobs": len(delivered),
        "total_earnings": round(sum(o.delivery_fee + o.service_fee for o in delivered), 2),
        "litres_delivered": round(litres, 1),
        "open_requests": db.query(Order)
        .filter(Order.status == OrderStatus.PENDING, Order.supplier_id.is_(None))
        .count(),
    }
