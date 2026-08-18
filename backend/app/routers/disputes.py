"""Disputes — the motorist's after-acceptance recourse (and the provider's
response to it).

Immutable by design: a dispute can be opened and messaged by the two parties
on the order, and resolved or closed by them, but nothing is ever edited or
deleted afterwards. The thread is part of the audit trail, so there is no
update or delete path for either side.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import (
    Dispute,
    DisputeMessage,
    DisputeStatus,
    Order,
    OrderStatus,
    Role,
    User,
)
from ..schemas import (
    DisputeCreate,
    DisputeMessageIn,
    DisputeMessageOut,
    DisputeOut,
    DisputeStatusUpdate,
)
from ..security import get_current_user, require_role

router = APIRouter(prefix="/api", tags=["disputes"])


def _participant(user: User, order: Order) -> bool:
    return user.id == order.customer_id or user.id == order.supplier_id


def _shape(dispute: Dispute) -> DisputeOut:
    return DisputeOut(
        id=dispute.id,
        order_id=dispute.order_id,
        reference=dispute.order.reference if dispute.order else None,
        reason=dispute.reason,
        status=dispute.status,
        created_at=dispute.created_at,
        resolved_at=dispute.resolved_at,
        messages=[
            DisputeMessageOut(
                id=m.id,
                sender_id=m.sender_id,
                sender_name=m.sender.full_name if m.sender else None,
                sender_role=m.sender.role if m.sender else None,
                body=m.body,
                created_at=m.created_at,
            )
            for m in sorted(dispute.messages, key=lambda m: m.created_at)
        ],
    )


def _order_ok_for_dispute(order: Order) -> None:
    """A dispute is the recourse once the job is underway or over. Before
    acceptance the motorist cancels for free instead; a cancelled job is a
    closed record with nothing to dispute."""
    if order.status in {OrderStatus.PENDING, OrderStatus.OFFERED}:
        raise HTTPException(
            status_code=409,
            detail="This job has not been accepted yet — cancel it for free instead.",
        )
    if order.status == OrderStatus.CANCELLED:
        raise HTTPException(status_code=409, detail="A cancelled job cannot be disputed.")


@router.post("/orders/{order_id}/dispute", response_model=DisputeOut, status_code=201)
def open_dispute(
    order_id: int,
    payload: DisputeCreate,
    user: User = Depends(require_role(Role.CUSTOMER)),
    db: Session = Depends(get_db),
) -> DisputeOut:
    order = db.get(Order, order_id)
    if order is None or order.customer_id != user.id:
        raise HTTPException(status_code=404, detail="Order not found.")
    _order_ok_for_dispute(order)
    if order.dispute is not None:
        raise HTTPException(
            status_code=409,
            detail=(
                f"A dispute already exists for {order.reference}. "
                "Reply inside it instead of opening another."
            ),
        )

    dispute = Dispute(order_id=order.id, customer_id=user.id, reason=payload.reason.strip())
    db.add(dispute)
    db.flush()
    db.add(
        DisputeMessage(
            dispute_id=dispute.id,
            sender_id=user.id,
            body=payload.reason.strip(),
        )
    )
    db.commit()
    db.refresh(dispute)
    return _shape(dispute)


@router.get("/orders/{order_id}/dispute", response_model=DisputeOut)
def read_dispute(
    order_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DisputeOut:
    order = db.get(Order, order_id)
    if order is None or not _participant(user, order):
        raise HTTPException(status_code=404, detail="Order not found.")
    if order.dispute is None:
        raise HTTPException(status_code=404, detail="No dispute has been opened for this order.")
    return _shape(order.dispute)


@router.get("/disputes/mine", response_model=list[DisputeOut])
def my_disputes(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[DisputeOut]:
    """Every dispute on the caller's own orders — history, not a feed of
    strangers' complaints."""
    if user.role == Role.SUPPLIER:
        order_ids = [
            o.id for o in db.query(Order.id).filter(Order.supplier_id == user.id).all()
        ]
    else:
        order_ids = [
            o.id for o in db.query(Order.id).filter(Order.customer_id == user.id).all()
        ]
    disputes = (
        db.query(Dispute)
        .filter(Dispute.order_id.in_(order_ids))
        .order_by(Dispute.created_at.desc())
        .all()
    )
    return [_shape(d) for d in disputes]


@router.post("/disputes/{dispute_id}/messages", response_model=DisputeOut)
def reply_to_dispute(
    dispute_id: int,
    payload: DisputeMessageIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DisputeOut:
    dispute = db.get(Dispute, dispute_id)
    if dispute is None:
        raise HTTPException(status_code=404, detail="Dispute not found.")
    order = dispute.order
    if order is None or not _participant(user, order):
        raise HTTPException(status_code=403, detail="That dispute belongs to someone else.")
    if dispute.status != DisputeStatus.OPEN:
        raise HTTPException(
            status_code=409,
            detail="This dispute is closed. Resolved records are immutable.",
        )

    db.add(
        DisputeMessage(dispute_id=dispute.id, sender_id=user.id, body=payload.body.strip())
    )
    db.commit()
    db.refresh(dispute)
    return _shape(dispute)


@router.patch("/disputes/{dispute_id}/status", response_model=DisputeOut)
def set_dispute_status(
    dispute_id: int,
    payload: DisputeStatusUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DisputeOut:
    dispute = db.get(Dispute, dispute_id)
    if dispute is None:
        raise HTTPException(status_code=404, detail="Dispute not found.")
    order = dispute.order
    if order is None or not _participant(user, order):
        raise HTTPException(status_code=403, detail="That dispute belongs to someone else.")

    # The provider resolves; the motorist closes. Both ends are participants,
    # and once the record is CLOSED it is locked for good. Role is checked
    # before the state so a wrong-role caller sees 403, not a leaky 409.
    if payload.status == DisputeStatus.RESOLVED and user.id != order.supplier_id:
        raise HTTPException(
            status_code=403, detail="Only the assigned provider can mark a dispute resolved."
        )
    if payload.status == DisputeStatus.CLOSED and user.id != order.customer_id:
        raise HTTPException(
            status_code=403, detail="Only the motorist can close a dispute."
        )
    if dispute.status == DisputeStatus.CLOSED:
        raise HTTPException(status_code=409, detail="This dispute is already closed.")
    if dispute.status == DisputeStatus.RESOLVED and payload.status == DisputeStatus.RESOLVED:
        raise HTTPException(status_code=409, detail="This dispute is already resolved.")

    dispute.status = payload.status
    dispute.resolved_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(dispute)
    return _shape(dispute)
