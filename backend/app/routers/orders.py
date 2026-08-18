import asyncio
import json
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..config import settings
from ..database import SessionLocal, get_db
from ..models import (
    Dispute,
    DisputeStatus,
    Order,
    OrderStatus,
    Payment,
    PaymentStatus,
    PayoutStatus,
    Role,
    SealedContainer,
    ServiceType,
    ShiftState,
    Staff,
    Station,
    SupplierProfile,
    User,
    Vehicle,
    VerificationStatus,
)
from ..schemas import (
    LocationPing,
    OnlineToggle,
    OrderCreate,
    OrderOut,
    OrderStatusUpdate,
    QuoteOut,
    QuoteProviderOut,
    QuoteRequest,
    RatingIn,
    ReceiptOut,
    StationOut,
    SupplierVerificationIn,
    UserOut,
)
from ..security import get_current_user, mask_phone, require_role
from ..services.fuel_prices import (
    CACHE_TTL,
    COLD_START_DIESEL,
    COLD_START_PETROL,
    _latest,
    current_unit_price,
    fetch_live_prices,
)
from ..services.geo import eta_minutes, road_distance_km
from ..services.triage import resolve_service
from ..services import paynow

router = APIRouter(prefix="/api", tags=["orders"])

# Callout fee for non-fuel roadside work, charged on top of the distance fee.
# Garage providers override this with their profile.callout_fee.
CALLOUT_FEES: dict[str, float] = {
    ServiceType.TOWING: 25.00,
    ServiceType.JUMP_START: 8.00,
    ServiceType.TYRE_CHANGE: 10.00,
    ServiceType.LOCKOUT: 12.00,
    ServiceType.MECHANIC: 15.00,
    ServiceType.FUEL: 0.00,
}

ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    OrderStatus.PENDING: {OrderStatus.OFFERED, OrderStatus.BIDDING, OrderStatus.CANCELLED},
    OrderStatus.BIDDING: {OrderStatus.ACCEPTED, OrderStatus.CANCELLED},
    OrderStatus.OFFERED: {OrderStatus.ACCEPTED, OrderStatus.CANCELLED},
    OrderStatus.ACCEPTED: {OrderStatus.IN_TRANSIT, OrderStatus.CANCELLED},
    OrderStatus.IN_TRANSIT: {OrderStatus.ARRIVED, OrderStatus.CANCELLED},
    OrderStatus.ARRIVED: {OrderStatus.DELIVERED},
    OrderStatus.DELIVERED: set(),
    OrderStatus.CANCELLED: set(),
    OrderStatus.DECLINED: set(),
}

NEAREST_LIMIT = 3


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


def _ranked_providers(
    db: Session, service_type: str, fuel_type: str | None, lat: float, lng: float
) -> list[tuple[SupplierProfile, User, float, int]]:
    """Offerable suppliers, ranked by ETA.

    Offerable means: online, verified, offering the resolved service, and
    inside the search radius (invariant #5: unverified providers get no
    offers). Coverage now means a real offer can actually be dispatched, so a
    bare station without an account is no longer treated as a provider.
    """
    radius = settings.fuellink_search_radius_km
    ranked: list[tuple[SupplierProfile, User, float, int]] = []
    for profile in (
        db.query(SupplierProfile)
        .filter(SupplierProfile.is_online.is_(True), SupplierProfile.is_verified.is_(True))
        .all()
    ):
        offered = {s.strip() for s in (profile.services_offered or "").split(",")}
        if service_type not in offered:
            continue
        if profile.current_lat is None or profile.current_lng is None:
            continue
        distance = road_distance_km(profile.current_lat, profile.current_lng, lat, lng)
        if distance <= radius:
            ranked.append((profile, profile.user, distance, eta_minutes(distance)))

    ranked.sort(key=lambda pair: pair[3])
    return ranked


def _provider_out(pair: tuple[SupplierProfile, User, float, int]) -> QuoteProviderOut:
    profile, user, distance, eta = pair
    return QuoteProviderOut(
        provider_id=user.id,
        name=profile.company_name,
        distance_km=distance,
        eta_minutes=eta,
        is_verified=profile.is_verified,
        rating=profile.rating,
    )


def _nearest_stations(db: Session, snapshot, lat: float, lng: float) -> list[StationOut]:
    ranked: list[tuple[float, Station]] = []
    for station in db.query(Station).all():
        ranked.append((road_distance_km(lat, lng, station.lat, station.lng), station))
    ranked.sort(key=lambda pair: pair[0])

    out: list[StationOut] = []
    for distance, station in ranked[:NEAREST_LIMIT]:
        item = StationOut.model_validate(station)
        item.distance_km = distance
        item.petrol_price = round(snapshot.petrol_price + (station.petrol_price or 0), 3)
        item.diesel_price = round(snapshot.diesel_price + (station.diesel_price or 0), 3)
        out.append(item)
    return out


async def build_quote(db: Session, req: QuoteRequest) -> QuoteOut:
    service_type = req.service_type or resolve_service(req.symptom, req.symptom_answer)
    origin_lat, origin_lng, station = _origin_for(db, req)
    distance = road_distance_km(origin_lat, origin_lng, req.pickup_lat, req.pickup_lng)

    snapshot = await fetch_live_prices(db)
    cap = current_unit_price(snapshot, req.fuel_type)

    fuel_cost = 0.0
    if service_type == ServiceType.FUEL:
        if req.quantity_litres <= 0:
            raise HTTPException(status_code=422, detail="Choose how many litres you need.")

    # ZERA fail-closed: never quote fuel above the national ceiling (FR-27).
    # A station explicitly chosen over the cap is rejected outright; an
    # auto-picked origin is clamped so the app keeps working with good data.
    if station is not None and service_type == ServiceType.FUEL:
        offset = (
            station.diesel_price or 0 if (req.fuel_type or "petrol").lower() == "diesel"
            else station.petrol_price or 0
        )
        raw_unit = cap + offset
        if req.station_id is not None and raw_unit > cap:
            raise HTTPException(
                status_code=422,
                detail=(
                    f"{station.name} is charging above the ZERA ceiling "
                    f"(${cap:.2f}). Pick another station."
                ),
            )
        unit_price = min(raw_unit, cap)
    else:
        unit_price = cap

    if service_type == ServiceType.FUEL:
        fuel_cost = round(req.quantity_litres * unit_price, 2)

    delivery_fee = round(distance * settings.fuellink_delivery_rate_multiplier, 2)
    service_fee = CALLOUT_FEES.get(service_type, 0.0)
    total = round(fuel_cost + delivery_fee + service_fee, 2)

    providers = [_provider_out(p) for p in _ranked_providers(db, service_type, req.fuel_type, req.pickup_lat, req.pickup_lng)]
    covered = bool(providers)

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
    if service_type == ServiceType.FUEL:
        note += f" @ ${unit_price:.2f}/L"

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
        coverage=covered,
        providers=providers,
        nearest_stations=[] if covered else _nearest_stations(
            db, snapshot, req.pickup_lat, req.pickup_lng
        ),
    )


def _shape(order: Order, viewer: User | None = None) -> OrderOut:
    out = OrderOut.model_validate(order)
    out.payment_status = order.payment.status if order.payment else None
    out.payout_status = order.payment.payout_status if order.payment else None
    out.offer_expires_at = order.offer_expires_at
    # The courier's live position and staff id are only for ACTIVE orders.
    # Once the job is over the motorist's history must not keep showing where
    # the provider is now — that is their location outside an active order.
    live = {
        OrderStatus.PENDING,
        OrderStatus.BIDDING,
        OrderStatus.OFFERED,
        OrderStatus.ACCEPTED,
        OrderStatus.IN_TRANSIT,
        OrderStatus.ARRIVED,
    }
    if order.supplier and order.supplier.supplier_profile and order.status in live:
        profile = order.supplier.supplier_profile
        out.supplier_lat = profile.current_lat
        out.supplier_lng = profile.current_lng
    # The real staff badge of the assigned executor (or their raw id until one
    # is rostered), never a fabricated SS- number.
    if order.staff:
        out.provider_staff_id = order.staff.staff_id
    elif order.supplier and order.supplier.supplier_profile:
        out.provider_staff_id = f"OWN-{order.supplier.supplier_profile.id:04d}"
    # The issued sealed-container serial: both seal scans must match this
    # before a fuel handover releases the payout.
    if order.service_type == ServiceType.FUEL and order.seal_id:
        out.sealed_container_id = order.seal_id

    is_customer = viewer is not None and (
        viewer.role == Role.CUSTOMER or viewer.id == order.customer_id
    )
    is_admin = viewer is not None and viewer.role == Role.ADMIN

    # Masked offer (master spec §6): an outstanding offer shows the service,
    # symptom, distance, ETA and payout — never the exact pin/address or the
    # motorist's full line.
    if order.status in (OrderStatus.OFFERED, OrderStatus.BIDDING) and not is_customer and not is_admin:
        out.pickup_lat = None
        out.pickup_lng = None
        out.pickup_address = None
        if order.customer:
            out.customer.phone_number = mask_phone(order.customer.phone_number)

    # Handover reversal (master spec §3/§7): the motorist SEES the read-only
    # code and reads it aloud; the staff member types it into their app. The
    # provider never receives the code over their own feed.
    if is_customer or is_admin:
        out.handover_code = order.handover_code
    else:
        out.handover_code = None
    return out


# ---------- timed offer cascade (master spec §6) ----------


def _offer_deadline() -> datetime:
    return datetime.now(timezone.utc) + timedelta(seconds=settings.fuellink_offer_ttl_seconds)


def _issue_offer(db: Session, order: Order, queue: list[int], index: int) -> None:
    """Point the order's single outstanding offer at queue[index]."""
    order.offer_queue = json.dumps(queue)
    order.offer_index = index
    if index < len(queue):
        order.offered_supplier_id = queue[index]
        order.offer_expires_at = _offer_deadline()
    else:
        order.offered_supplier_id = None
        order.offer_expires_at = None


def _cascade(db: Session, order: Order, *, penalise: bool, actor_id: int | None = None) -> None:
    """Move to the next-ranked provider. Explicit decline is free and
    unpenalised; a timeout auto-declines and counts against the response rate.

    When the queue is exhausted the order lands in the DECLINED terminal — no
    charge, motorist re-requests.
    """
    if penalise and actor_id is not None:
        profile = db.query(SupplierProfile).filter_by(user_id=actor_id).first()
        if profile:
            profile.rejected_jobs += 1

    queue: list[int] = json.loads(order.offer_queue) if order.offer_queue else []
    _issue_offer(db, order, queue, order.offer_index + 1)
    if order.offered_supplier_id is None:
        order.status = OrderStatus.DECLINED


def _expire_offers(db: Session) -> int:
    """Lazily re-resolve every OFFERED order whose deadline has passed."""
    now = datetime.now(timezone.utc)
    swept = 0
    orders = (
        db.query(Order)
        .filter(Order.status == OrderStatus.OFFERED, Order.offer_expires_at.isnot(None))
        .all()
    )
    for order in orders:
        if order.offer_expires_at and order.offer_expires_at.replace(tzinfo=timezone.utc) <= now:
            _cascade(
                db,
                order,
                penalise=True,
                actor_id=order.offered_supplier_id,
            )
            swept += 1
    if swept:
        db.commit()
    return swept


def dispatch_pending_order(db: Session, order: Order) -> bool:
    """Start the timed-offer cascade once an order's funds are secured.

    Called from the payment router: an order created without a payment method
    sits in PENDING; the moment payment settles, the first offer fires.
    """
    if order.status != OrderStatus.PENDING or order.supplier_id is not None:
        return False
    if order.payment is None or order.payment.status == PaymentStatus.FAILED:
        return False
    ranked = _ranked_providers(
        db, order.service_type, order.fuel_type, order.pickup_lat, order.pickup_lng
    )
    queue_ids = [u.id for _, u, _, _ in ranked]
    if not queue_ids:
        return False
    _issue_offer(db, order, queue_ids, 0)
    order.status = OrderStatus.OFFERED
    return True


async def offer_sweeper() -> None:
    """Lifetime background task: re-resolve expired offers every second.

    A timeout auto-declines the current provider (counting against their
    response rate) and cascades to the next-ranked provider. Cancelled on app
    shutdown; every read path also re-resolves lazily, so a missed tick can
    never leave a stale offer visible.
    """
    while True:
        await asyncio.sleep(settings.fuellink_offer_sweep_seconds)
        db = SessionLocal()
        try:
            _expire_offers(db)
        finally:
            db.close()


@router.post("/quote", response_model=QuoteOut)
async def quote(req: QuoteRequest, db: Session = Depends(get_db)) -> QuoteOut:
    return await build_quote(db, req)


@router.post("/orders", response_model=OrderOut, status_code=201)
async def create_order(
    payload: OrderCreate,
    response: Response,
    user: User = Depends(require_role(Role.CUSTOMER)),
    db: Session = Depends(get_db),
) -> OrderOut:
    # FR-3: phone must be verified before the first request is submitted.
    if not user.phone_verified:
        raise HTTPException(
            status_code=403,
            detail="Verify your number with the SMS code before requesting help.",
        )

    # FR-14: at least one vehicle before submitting.
    vehicles = db.query(Vehicle).filter(Vehicle.owner_id == user.id).all()
    if not vehicles:
        raise HTTPException(status_code=422, detail="Add a vehicle before requesting help.")
    if payload.vehicle_id is not None:
        if not any(v.id == payload.vehicle_id for v in vehicles):
            raise HTTPException(status_code=422, detail="Pick one of your own vehicles.")
    else:
        default = next((v for v in vehicles if v.is_default), vehicles[0])
        payload.vehicle_id = default.id

    # NFR-5: idempotent submission. A retry with the same key returns the
    # existing order instead of creating a duplicate.
    if payload.client_request_id:
        existing = (
            db.query(Order)
            .filter(
                Order.client_request_id == payload.client_request_id,
                Order.customer_id == user.id,
            )
            .first()
        )
        if existing:
            response.status_code = 200
            return _shape(existing, viewer=user)

    open_order = (
        db.query(Order)
        .filter(
            Order.customer_id == user.id,
            Order.status.in_(
                [
                    OrderStatus.PENDING,
                    OrderStatus.BIDDING,
                    OrderStatus.OFFERED,
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
    if not q.coverage:
        raise HTTPException(
            status_code=422,
            detail=(
                "No service provider is available near that pin right now. "
                "Move the pin or call the emergency line."
            ),
        )

    service_type = payload.service_type or resolve_service(payload.symptom, payload.symptom_answer)
    # Ranked offer queue. The motorist's chosen provider leads; otherwise the
    # top-ranked provider gets the first 60s offer (master spec §6).
    ranked = _ranked_providers(db, service_type, payload.fuel_type, payload.pickup_lat, payload.pickup_lng)
    queue_ids = [u.id for _, u, _, _ in ranked]
    if payload.provider_id is not None:
        if payload.provider_id not in queue_ids:
            raise HTTPException(
                status_code=422, detail="Pick one of the listed providers."
            )
        queue_ids = [payload.provider_id] + [i for i in queue_ids if i != payload.provider_id]

    order = Order(
        reference=f"FL{secrets.token_hex(3).upper()}",
        customer_id=user.id,
        station_id=q.station.id if q.station else None,
        service_type=service_type,
        fuel_type=payload.fuel_type if service_type == ServiceType.FUEL else None,
        quantity_litres=payload.quantity_litres,
        symptom=payload.symptom.value if payload.symptom else None,
        symptom_answer=payload.symptom_answer,
        vehicle_id=payload.vehicle_id,
        client_request_id=payload.client_request_id,
        pickup_lat=payload.pickup_lat,
        pickup_lng=payload.pickup_lng,
        pickup_address=payload.pickup_address,
        notes=payload.notes,
        photo_url=payload.photo_url,
        distance_km=q.distance_km,
        fuel_cost=q.fuel_cost,
        delivery_fee=q.delivery_fee,
        service_fee=q.service_fee,
        total_amount=q.total_amount,
        eta_minutes=q.eta_minutes,
    )
    db.add(order)
    db.flush()

    # All orders start in BIDDING — suppliers bid on the request and the
    # customer picks the best one.  Payment is collected after the customer
    # accepts a bid.
    order.status = OrderStatus.BIDDING
    db.commit()
    db.refresh(order)
    return _shape(order, viewer=user)


@router.get("/orders", response_model=list[OrderOut])
def my_orders(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[OrderOut]:
    query = db.query(Order)
    if user.role == Role.CUSTOMER:
        query = query.filter(Order.customer_id == user.id)
    elif user.role == Role.SUPPLIER:
        query = query.filter(
            or_(Order.supplier_id == user.id, Order.offered_supplier_id == user.id)
        )
    orders = query.order_by(Order.created_at.desc()).limit(100).all()
    return [_shape(o, viewer=user) for o in orders]


@router.get("/orders/active", response_model=OrderOut | None)
def active_order(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> OrderOut | None:
    _expire_offers(db)
    live = [
        OrderStatus.PENDING,
        OrderStatus.OFFERED,
        OrderStatus.ACCEPTED,
        OrderStatus.IN_TRANSIT,
        OrderStatus.ARRIVED,
    ]
    query = db.query(Order).filter(Order.status.in_(live))
    if user.role == Role.CUSTOMER:
        query = query.filter(Order.customer_id == user.id)
    else:
        query = query.filter(
            or_(Order.supplier_id == user.id, Order.offered_supplier_id == user.id)
        )
    order = query.order_by(Order.created_at.desc()).first()
    return _shape(order, viewer=user) if order else None


@router.get("/orders/available", response_model=list[OrderOut])
@router.get("/orders/offers", response_model=list[OrderOut])
def available_jobs(
    user: User = Depends(require_role(Role.SUPPLIER)), db: Session = Depends(get_db)
) -> list[OrderOut]:
    """The offers currently outstanding for THIS provider (master spec §6).

    The payload is masked: service, symptom, distance, ETA and payout — never
    the exact pin/address or the motorist's full number. Expired offers are
    re-resolved lazily so a poll always sees a live countdown or nothing.
    """
    _expire_offers(db)
    orders = (
        db.query(Order)
        .filter(Order.status == OrderStatus.OFFERED, Order.offered_supplier_id == user.id)
        .order_by(Order.created_at.desc())
        .all()
    )
    return [_shape(o, viewer=user) for o in orders]


@router.get("/orders/{order_id}", response_model=OrderOut)
def get_order(
    order_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> OrderOut:
    order = db.get(Order, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found.")
    if user.role != Role.ADMIN and user.id not in {
        order.customer_id,
        order.supplier_id,
        order.offered_supplier_id,
    }:
        raise HTTPException(status_code=403, detail="That order belongs to someone else.")
    return _shape(order, viewer=user)


@router.post("/orders/{order_id}/accept", response_model=OrderOut)
def accept_order(
    order_id: int,
    user: User = Depends(require_role(Role.SUPPLIER)),
    db: Session = Depends(get_db),
) -> OrderOut:
    """Accept the outstanding offer. Eligibility is re-checked server-side at
    accept, not trusted from the quote (invariant #5): verified + online +
    offering the service + a rostered executor on shift. Fuel dispatch issues
    a sealed container (invariant #2)."""
    _expire_offers(db)
    order = db.get(Order, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found.")
    if order.status != OrderStatus.OFFERED or order.offered_supplier_id != user.id:
        raise HTTPException(status_code=409, detail="This offer is no longer available.")

    profile = user.supplier_profile
    if profile is None or not profile.is_verified or not profile.is_online:
        raise HTTPException(
            status_code=403,
            detail="Your account must be verified and online before you can accept jobs.",
        )
    offered = {s.strip() for s in (profile.services_offered or "").split(",")}
    if order.service_type not in offered:
        raise HTTPException(
            status_code=403, detail="You are not verified to provide this service."
        )

    has_roster = db.query(Staff).filter(Staff.provider_id == user.id).first() is not None
    staff = None
    if has_roster:
        staff = (
            db.query(Staff)
            .filter(
                Staff.provider_id == user.id,
                Staff.is_active.is_(True),
                Staff.shift_state == ShiftState.AVAILABLE,
            )
            .order_by(Staff.id)
            .first()
        )
        if staff is None:
            raise HTTPException(
                status_code=409,
                detail="Every staff member is off shift. Put at least one on shift to dispatch.",
            )

    if order.service_type == ServiceType.FUEL:
        # A returned container is back in the reusable pool (master spec §7):
        # it was scanned back in after its last verified handover, so it is
        # just as dispatch-ready as one that never left the shelf.
        container = (
            db.query(SealedContainer)
            .filter(
                SealedContainer.provider_id == user.id,
                SealedContainer.status.in_(["available", "returned"]),
            )
            .order_by(SealedContainer.id)
            .first()
        )
        if container is None:
            raise HTTPException(
                status_code=409,
                detail="No sealed container is ready. Restock your batches first.",
            )
        container.status = "in_use"
        order.seal_id = container.serial

    if staff:
        staff.shift_state = ShiftState.ON_JOB
        order.staff_id = staff.id

    order.supplier_id = user.id
    order.offered_supplier_id = None
    order.offer_expires_at = None
    order.status = OrderStatus.ACCEPTED
    order.accepted_at = datetime.now(timezone.utc)
    # Issued at acceptance; shown READ-ONLY to the motorist, who reads it out
    # to the courier at handover. Never exposed to the provider's own feed.
    order.handover_code = f"{secrets.randbelow(10_000):04d}"
    db.commit()
    db.refresh(order)
    return _shape(order, viewer=user)


@router.post("/orders/{order_id}/reject", response_model=OrderOut)
def reject_order(
    order_id: int,
    user: User = Depends(require_role(Role.SUPPLIER)),
    db: Session = Depends(get_db),
) -> OrderOut:
    """Decline an outstanding offer. Free and unpenalised — the offer cascades
    to the next-ranked provider (master spec §6). Only a timeout counts against
    the response rate."""
    _expire_offers(db)
    order = db.get(Order, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found.")
    if order.status != OrderStatus.OFFERED or order.offered_supplier_id != user.id:
        raise HTTPException(status_code=409, detail="This offer is no longer available.")
    _cascade(db, order, penalise=False, actor_id=user.id)
    db.commit()
    db.refresh(order)
    return _shape(order, viewer=user)


def _transition(
    db: Session, order: Order, payload: OrderStatusUpdate, actor: str, actor_id: int
) -> None:
    """The one state machine, shared by the dashboard and staff routers.

    ``actor`` is ``customer`` | ``supplier`` | ``staff``. The handover is a
    PROVIDER action (master spec §3/§7): the staff member types the code the
    motorist read out, and fuel additionally requires both seal scans to match
    the serial issued to the order. Only then does the payout ledger flip
    HELD -> RELEASED, server-side.
    """
    target = payload.status.value
    if target not in ALLOWED_TRANSITIONS[order.status]:
        raise HTTPException(
            status_code=409, detail=f"Cannot move an order from {order.status} to {target}."
        )

    if target == OrderStatus.CANCELLED:
        if actor == "customer":
            if actor_id != order.customer_id:
                raise HTTPException(status_code=403, detail="Only the motorist can cancel this request.")
            if order.status not in {OrderStatus.PENDING, OrderStatus.OFFERED, OrderStatus.BIDDING}:
                raise HTTPException(
                    status_code=409,
                    detail=(
                        "A provider is already assigned. Cancel is only free before "
                        "acceptance — open a dispute to raise a problem with this job."
                    ),
                )
        elif actor not in {"supplier", "staff"}:
            raise HTTPException(status_code=403, detail="Only the motorist can cancel this request.")
        # Return any issued executor and sealed container to the pool.
        if order.staff:
            order.staff.shift_state = ShiftState.AVAILABLE
        if order.seal_id:
            container = (
                db.query(SealedContainer)
                .filter(SealedContainer.serial == order.seal_id)
                .first()
            )
            if container:
                container.status = "returned"
    elif target == OrderStatus.DELIVERED:
        if actor not in {"supplier", "staff"}:
            raise HTTPException(
                status_code=403,
                detail=(
                    "Only the provider completes a handover. Read your 4-digit code "
                    "to the courier — they enter it on their side."
                ),
            )
    elif actor == "customer":
        raise HTTPException(status_code=403, detail="Only the provider can advance this job.")

    if actor == "staff" and order.staff_id != actor_id:
        raise HTTPException(status_code=403, detail="This job is assigned to another staff member.")

    # Dispatch seal scan: the scanned serial must match the container issued at
    # acceptance (invariant #2 — the dispatch/arrival pair).
    if target == OrderStatus.IN_TRANSIT and order.service_type == ServiceType.FUEL:
        if order.seal_id is None:
            raise HTTPException(status_code=409, detail="No sealed container issued for this job.")
        if not payload.seal_id or payload.seal_id != order.seal_id:
            raise HTTPException(
                status_code=403, detail="Seal scan does not match the issued container."
            )
        order.seal_dispatched_at = datetime.now(timezone.utc)

    if target == OrderStatus.DELIVERED:
        if order.status != OrderStatus.ARRIVED:
            raise HTTPException(status_code=409, detail="Confirm the handover once the provider has arrived.")
        if order.service_type == ServiceType.FUEL:
            if order.seal_dispatched_at is None:
                raise HTTPException(status_code=409, detail="The seal was not scanned at dispatch.")
            if not order.seal_id or not payload.seal_id or payload.seal_id != order.seal_id:
                raise HTTPException(
                    status_code=403,
                    detail="Arrival seal scan does not match the issued container.",
                )
            order.seal_arrived_at = datetime.now(timezone.utc)
        if not order.handover_code:
            raise HTTPException(status_code=403, detail="No handover code issued for this job.")
        if not payload.handover_code or payload.handover_code != order.handover_code:
            raise HTTPException(
                status_code=403, detail="That code doesn't match. Ask the motorist to read it again."
            )
        if order.payment is None or order.payment.status != PaymentStatus.PAID:
            raise HTTPException(status_code=409, detail="Payment is not settled yet. Confirm it first.")

        order.delivered_at = datetime.now(timezone.utc)
        # Escrow ledger: release only here, only after the verified handover.
        order.payment.payout_status = PayoutStatus.RELEASED
        order.payment.payout_at = order.delivered_at

        profile = db.query(SupplierProfile).filter_by(user_id=order.supplier_id).first()
        if profile:
            profile.completed_jobs += 1
            profile.total_earnings = round(
                profile.total_earnings + order.delivery_fee + order.service_fee, 2
            )
            if order.service_type == ServiceType.FUEL and order.fuel_type:
                if order.fuel_type == "diesel":
                    profile.fuel_stock_diesel = max(
                        0.0, round(profile.fuel_stock_diesel - order.quantity_litres, 1)
                    )
                else:
                    profile.fuel_stock_petrol = max(
                        0.0, round(profile.fuel_stock_petrol - order.quantity_litres, 1)
                    )
        # Executor back on shift; the sealed container returns to the pool.
        if order.staff:
            order.staff.shift_state = ShiftState.AVAILABLE
        if order.seal_id:
            container = (
                db.query(SealedContainer)
                .filter(SealedContainer.serial == order.seal_id)
                .first()
            )
            if container:
                container.status = "returned"

    order.status = target


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

    if user.id == order.customer_id:
        actor = "customer"
    elif user.id == order.supplier_id or user.id == order.offered_supplier_id:
        actor = "supplier"
    else:
        # Staff advance their own jobs through the staff router.
        raise HTTPException(status_code=403, detail="That order belongs to someone else.")

    _transition(db, order, payload, actor, user.id)
    db.commit()
    db.refresh(order)
    return _shape(order, viewer=user)


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
    if order.rating is not None:
        raise HTTPException(
            status_code=409,
            detail="You have already rated this order. One rating per job.",
        )

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
    return _shape(order, viewer=user)


@router.get("/orders/{order_id}/receipt", response_model=ReceiptOut)
def order_receipt(
    order_id: int,
    user: User = Depends(require_role(Role.CUSTOMER)),
    db: Session = Depends(get_db),
) -> ReceiptOut:
    """Itemised receipt for the motorist's own completed order.

    Immutable by construction: every figure is read from the stored order,
    never recomputed, and there is no way to edit it. Audit data is not
    deletable or mutable by the client.
    """
    order = db.get(Order, order_id)
    if order is None or order.customer_id != user.id:
        raise HTTPException(status_code=404, detail="Order not found.")
    if order.status not in {OrderStatus.DELIVERED, OrderStatus.CANCELLED}:
        raise HTTPException(status_code=409, detail="The receipt appears once the order closes.")

    return ReceiptOut(
        order_id=order.id,
        reference=order.reference,
        service_type=order.service_type,
        fuel_type=order.fuel_type,
        quantity_litres=order.quantity_litres,
        unit_price=round(order.fuel_cost / order.quantity_litres, 3)
        if order.quantity_litres
        else 0.0,
        fuel_cost=order.fuel_cost,
        delivery_fee=order.delivery_fee,
        service_fee=order.service_fee,
        total_amount=order.total_amount,
        pickup_address=order.pickup_address,
        payment_method=order.payment.method if order.payment else None,
        payment_status=order.payment.status if order.payment else None,
        paid_at=order.payment.paid_at if order.payment else None,
        created_at=order.created_at,
        delivered_at=order.delivered_at,
    )


# ---------- supplier presence ----------


@router.post("/supplier/verification", response_model=UserOut)
def resubmit_verification(
    _: SupplierVerificationIn,
    user: User = Depends(require_role(Role.SUPPLIER)),
    db: Session = Depends(get_db),
) -> User:
    """A rejected provider resubmits; the account returns to the admin's
    verification queue (pending). Resubmission never self-verifies."""
    profile = user.supplier_profile
    if profile is None:
        raise HTTPException(status_code=404, detail="Supplier profile missing.")
    profile.verification_status = VerificationStatus.PENDING
    profile.rejection_reason = None
    profile.is_verified = False
    db.commit()
    db.refresh(user)
    return user


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
    today = datetime.now(timezone.utc).date()
    earnings_today = round(
        sum(
            o.delivery_fee + o.service_fee
            for o in delivered
            if o.delivered_at and o.delivered_at.date() == today
        ),
        2,
    )
    completed = len(delivered)
    rejected = profile.rejected_jobs if profile else 0
    response_rate = (
        round(completed / (completed + rejected) * 100, 1)
        if (completed + rejected) > 0
        else 100.0
    )

    # Compliance price: the station's cap offset applied to the live (or last
    # good) snapshot — the exact source the stock card reads, so the two cards
    # can never contradict each other.
    snapshot = _latest(db)
    base = profile.base_station if profile else None
    cap_petrol = snapshot.petrol_price if snapshot else COLD_START_PETROL
    cap_diesel = snapshot.diesel_price if snapshot else COLD_START_DIESEL
    petrol_price = round(cap_petrol + (base.petrol_price if base else 0.0), 3)
    diesel_price = round(cap_diesel + (base.diesel_price if base else 0.0), 3)
    price_is_live = False
    price_verified_at = None
    if snapshot:
        fetched = snapshot.fetched_at.replace(tzinfo=timezone.utc)
        price_is_live = (datetime.now(timezone.utc) - fetched) < CACHE_TTL and bool(snapshot.is_live)
        price_verified_at = fetched

    # Staff roster health — how many of the team are actually working right now.
    staff_on_shift = (
        db.query(Staff)
        .filter(Staff.provider_id == user.id, Staff.is_active.is_(True))
        .count()
    )
    staff_available = (
        db.query(Staff)
        .filter(
            Staff.provider_id == user.id,
            Staff.is_active.is_(True),
            Staff.shift_state == ShiftState.AVAILABLE,
        )
        .count()
    )

    # Sealed-container fleet: the reusable pool plus what is out on a job.
    containers = (
        db.query(SealedContainer).filter(SealedContainer.provider_id == user.id).all()
    )
    containers_ready = sum(c.status in ("available", "returned") for c in containers)
    containers_in_use = sum(c.status == "in_use" for c in containers)

    # Escrow ledger per payout state (master spec §10) across the supplier's
    # settled jobs — the raw material for the earnings/disputes entry point.
    payouts = [o.payment for o in delivered if o.payment]
    payout_held = round(sum(p.amount for p in payouts if p.payout_status == PayoutStatus.HELD), 2)
    payout_released = round(
        sum(p.amount for p in payouts if p.payout_status == PayoutStatus.RELEASED), 2
    )
    payout_disputed = round(
        sum(p.amount for p in payouts if p.payout_status == PayoutStatus.DISPUTED), 2
    )
    disputes_open = (
        db.query(Dispute)
        .join(Order, Dispute.order_id == Order.id)
        .filter(Order.supplier_id == user.id, Dispute.status == DisputeStatus.OPEN)
        .count()
    )

    return {
        "is_online": bool(profile and profile.is_online),
        "is_verified": bool(profile and profile.is_verified),
        "rating": profile.rating if profile else 5.0,
        "completed_jobs": completed,
        "total_earnings": round(sum(o.delivery_fee + o.service_fee for o in delivered), 2),
        "earnings_today": earnings_today,
        "litres_delivered": round(litres, 1),
        "fuel_stock_petrol": round(profile.fuel_stock_petrol, 1) if profile else 0.0,
        "fuel_stock_diesel": round(profile.fuel_stock_diesel, 1) if profile else 0.0,
        "tanker_capacity_litres": profile.tanker_capacity_litres if profile else 0.0,
        "response_rate": response_rate,
        "open_requests": db.query(Order)
        .filter(Order.status == OrderStatus.OFFERED, Order.offered_supplier_id == user.id)
        .count(),
        "petrol_price": petrol_price,
        "diesel_price": diesel_price,
        "cap_petrol": cap_petrol,
        "cap_diesel": cap_diesel,
        "price_verified_at": price_verified_at,
        "price_is_live": price_is_live,
        "staff_on_shift": staff_on_shift,
        "staff_available": staff_available,
        "containers_ready": containers_ready,
        "containers_in_use": containers_in_use,
        "containers_total": len(containers),
        "payout_held": payout_held,
        "payout_released": payout_released,
        "payout_disputed": payout_disputed,
        "disputes_open": disputes_open,
    }


# NOTE: no /customer/wallet. Master spec §3 removed the wallet — payment is
# per order (EcoCash via Paynow), there is no stored balance.
