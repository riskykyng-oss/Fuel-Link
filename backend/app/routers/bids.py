"""Bid/negotiation endpoints for the inDrive-style flow.

Customers create requests that go to BIDDING status. Suppliers see pending
requests and can bid with their proposed price. Customers review bids and
accept one, which triggers the payment + accept flow.
"""

import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import (
    Bid,
    BidStatus,
    Order,
    OrderStatus,
    Role,
    SealedContainer,
    ServiceType,
    ShiftState,
    Staff,
    SupplierProfile,
    User,
)
from ..schemas import BidCreate, BidOut, OrderOut
from ..security import mask_phone, require_role
from ..services.geo import eta_minutes, road_distance_km

router = APIRouter(prefix="/api", tags=["bids"])


def _bid_out(bid: Bid, db: Session) -> BidOut:
    supplier = db.get(User, bid.supplier_id)
    profile = supplier.supplier_profile if supplier else None
    return BidOut(
        id=bid.id,
        order_id=bid.order_id,
        supplier_id=bid.supplier_id,
        proposed_amount=bid.proposed_amount,
        note=bid.note,
        distance_km=bid.distance_km,
        status=bid.status,
        created_at=bid.created_at,
        supplier_name=supplier.full_name if supplier else None,
        supplier_company=profile.company_name if profile else None,
        supplier_verified=profile.is_verified if profile else False,
        supplier_rating=profile.rating if profile else None,
    )


@router.get("/orders/{order_id}/bids", response_model=list[BidOut])
def list_bids(
    order_id: int,
    user: User = Depends(require_role(Role.CUSTOMER)),
    db: Session = Depends(get_db),
) -> list[BidOut]:
    """Customer views all bids on their order."""
    order = db.get(Order, order_id)
    if order is None or order.customer_id != user.id:
        raise HTTPException(status_code=404, detail="Order not found.")
    if order.status != OrderStatus.BIDDING:
        raise HTTPException(status_code=409, detail="This order is no longer accepting bids.")
    bids = (
        db.query(Bid)
        .filter(Bid.order_id == order_id, Bid.status == BidStatus.PENDING)
        .order_by(Bid.created_at.desc())
        .all()
    )
    return [_bid_out(b, db) for b in bids]


@router.post("/orders/{order_id}/bids", response_model=BidOut, status_code=201)
def create_bid(
    order_id: int,
    payload: BidCreate,
    user: User = Depends(require_role(Role.SUPPLIER)),
    db: Session = Depends(get_db),
) -> BidOut:
    """Supplier places a bid on a customer's request."""
    order = db.get(Order, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found.")
    if order.status != OrderStatus.BIDDING:
        raise HTTPException(status_code=409, detail="This order is no longer accepting bids.")

    profile = user.supplier_profile
    if profile is None or not profile.is_verified:
        raise HTTPException(status_code=403, detail="Your account must be verified to place bids.")
    offered = {s.strip() for s in (profile.services_offered or "").split(",")}
    if order.service_type not in offered:
        raise HTTPException(status_code=403, detail="You don't offer this service.")

    existing = (
        db.query(Bid)
        .filter(Bid.order_id == order_id, Bid.supplier_id == user.id, Bid.status == BidStatus.PENDING)
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="You already have an active bid on this request.")

    distance = 0.0
    if profile.current_lat is not None and profile.current_lng is not None:
        distance = road_distance_km(profile.current_lat, profile.current_lng, order.pickup_lat, order.pickup_lng)

    bid = Bid(
        order_id=order_id,
        supplier_id=user.id,
        proposed_amount=payload.proposed_amount,
        note=payload.note,
        distance_km=round(distance, 1),
    )
    db.add(bid)
    db.commit()
    db.refresh(bid)
    return _bid_out(bid, db)


@router.post("/orders/{order_id}/bids/{bid_id}/accept", response_model=OrderOut)
def accept_bid(
    order_id: int,
    bid_id: int,
    user: User = Depends(require_role(Role.CUSTOMER)),
    db: Session = Depends(get_db),
) -> OrderOut:
    """Customer accepts a supplier's bid. This locks in the supplier and price,
    then transitions the order to ACCEPTED (payment is expected separately)."""
    order = db.get(Order, order_id)
    if order is None or order.customer_id != user.id:
        raise HTTPException(status_code=404, detail="Order not found.")
    if order.status != OrderStatus.BIDDING:
        raise HTTPException(status_code=409, detail="This order is no longer accepting bids.")

    bid = db.get(Bid, bid_id)
    if bid is None or bid.order_id != order_id or bid.status != BidStatus.PENDING:
        raise HTTPException(status_code=404, detail="Bid not found or already resolved.")

    supplier = db.get(User, bid.supplier_id)
    if supplier is None:
        raise HTTPException(status_code=404, detail="Supplier not found.")

    profile = supplier.supplier_profile
    if profile is None or not profile.is_verified:
        raise HTTPException(status_code=403, detail="Supplier is no longer verified.")
    if not profile.is_online:
        raise HTTPException(status_code=403, detail="Supplier went offline.")

    has_roster = db.query(Staff).filter(Staff.provider_id == supplier.id).first() is not None
    staff = None
    if has_roster:
        staff = (
            db.query(Staff)
            .filter(
                Staff.provider_id == supplier.id,
                Staff.is_active.is_(True),
                Staff.shift_state == ShiftState.AVAILABLE,
            )
            .order_by(Staff.id)
            .first()
        )
        if staff is None:
            raise HTTPException(status_code=409, detail="Supplier has no staff on shift.")

    if order.service_type == ServiceType.FUEL:
        container = (
            db.query(SealedContainer)
            .filter(
                SealedContainer.provider_id == supplier.id,
                SealedContainer.status.in_(["available", "returned"]),
            )
            .order_by(SealedContainer.id)
            .first()
        )
        if container is None:
            raise HTTPException(status_code=409, detail="Supplier has no sealed containers ready.")
        container.status = "in_use"
        order.seal_id = container.serial

    if staff:
        staff.shift_state = ShiftState.ON_JOB
        order.staff_id = staff.id

    bid.status = BidStatus.ACCEPTED
    db.query(Bid).filter(
        Bid.order_id == order_id, Bid.status == BidStatus.PENDING
    ).update({"status": BidStatus.EXPIRED})

    order.supplier_id = supplier.id
    order.total_amount = bid.proposed_amount
    order.status = OrderStatus.ACCEPTED
    order.accepted_at = datetime.now(timezone.utc)
    order.handover_code = f"{secrets.randbelow(10_000):04d}"
    db.commit()
    db.refresh(order)

    out = OrderOut.model_validate(order)
    out.payment_status = order.payment.status if order.payment else None
    out.payout_status = order.payment.payout_status if order.payment else None
    return out


@router.get("/supplier/pending-requests", response_model=list[OrderOut])
def pending_requests(
    user: User = Depends(require_role(Role.SUPPLIER)),
    db: Session = Depends(get_db),
) -> list[OrderOut]:
    """Suppliers see customer requests in BIDDING status."""
    profile = user.supplier_profile
    if profile is None:
        return []

    radius = 50.0  # generous radius for bids
    orders = (
        db.query(Order)
        .filter(Order.status == OrderStatus.BIDDING)
        .order_by(Order.created_at.desc())
        .all()
    )
    result = []
    for order in orders:
        if profile.current_lat is not None and profile.current_lng is not None:
            dist = road_distance_km(profile.current_lat, profile.current_lng, order.pickup_lat, order.pickup_lng)
            if dist > radius:
                continue
        else:
            dist = 0.0

        out = OrderOut.model_validate(order)
        out.customer.phone_number = mask_phone(order.customer.phone_number)
        out.pickup_address = None
        out.pickup_lat = None
        out.pickup_lng = None
        out.supplier_lat = profile.current_lat
        out.supplier_lng = profile.current_lng
        result.append(out)

    result.sort(key=lambda o: o.distance_km)
    return result
