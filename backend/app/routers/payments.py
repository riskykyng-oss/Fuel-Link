from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models import Order, Payment, PaymentStatus, Role, User
from ..routers.orders import dispatch_pending_order
from ..schemas import PaymentInit, PaymentMethodOut, PaymentOut
from ..security import require_role
from ..services import paynow

router = APIRouter(prefix="/api/payments", tags=["payments"])


@router.get("/methods", response_model=list[PaymentMethodOut])
def methods() -> list[PaymentMethodOut]:
    # Digital only (master spec §10): EcoCash via Paynow. Cash is not a method.
    return [PaymentMethodOut(**m, live=settings.paynow_live) for m in paynow.METHODS]


@router.post("/initiate", response_model=PaymentOut)
async def initiate(
    payload: PaymentInit,
    user: User = Depends(require_role(Role.CUSTOMER)),
    db: Session = Depends(get_db),
) -> Payment:
    order = db.get(Order, payload.order_id)
    if order is None or order.customer_id != user.id:
        raise HTTPException(status_code=404, detail="Order not found.")
    if order.payment and order.payment.status == PaymentStatus.PAID:
        raise HTTPException(status_code=409, detail="This order is already paid.")

    valid = {m["id"] for m in paynow.METHODS}
    if payload.method not in valid:
        raise HTTPException(status_code=422, detail="Pick one of the listed payment methods.")

    requires_phone = next(m["requires_phone"] for m in paynow.METHODS if m["id"] == payload.method)
    phone = payload.payer_phone or user.phone_number
    if requires_phone and not phone:
        raise HTTPException(status_code=422, detail="Enter the number to charge.")

    result = await paynow.initiate(
        reference=order.reference,
        amount=order.total_amount,
        method=payload.method,
        payer_phone=phone,
        email=user.email or f"{user.phone_number}@fuellink.local",
    )

    payment = order.payment or Payment(order_id=order.id, amount=order.total_amount)
    payment.method = payload.method
    payment.amount = order.total_amount
    payment.status = result.status
    payment.provider_reference = result.reference
    payment.poll_url = result.poll_url
    payment.redirect_url = result.redirect_url
    payment.instructions = result.instructions
    if result.status == PaymentStatus.PAID:
        payment.paid_at = datetime.now(timezone.utc)

    db.add(payment)
    db.commit()
    db.refresh(payment)

    # Funds secured -> fire the first 60s dispatch offer if the order was
    # still waiting in PENDING for payment.
    db.refresh(order)
    if result.ok and dispatch_pending_order(db, order):
        db.commit()

    if not result.ok:
        raise HTTPException(status_code=502, detail=result.instructions)
    return payment


@router.get("/{order_id}/status", response_model=PaymentOut)
async def check_status(
    order_id: int,
    user: User = Depends(require_role(Role.CUSTOMER)),
    db: Session = Depends(get_db),
) -> Payment:
    order = db.get(Order, order_id)
    if order is None or order.customer_id != user.id or order.payment is None:
        raise HTTPException(status_code=404, detail="No payment started for that order.")

    payment = order.payment
    if payment.status == PaymentStatus.AWAITING_CONFIRMATION and payment.poll_url:
        state = await paynow.poll(payment.poll_url)
        if state != payment.status:
            payment.status = state
            if state == PaymentStatus.PAID:
                payment.paid_at = datetime.now(timezone.utc)
            db.commit()
            db.refresh(payment)
    return payment


@router.post("/paynow/callback")
async def paynow_callback(request: Request, db: Session = Depends(get_db)) -> dict:
    """Server-to-server result URL hit by Paynow when a transaction settles."""
    form = dict(await request.form())
    reference = str(form.get("reference", ""))
    state = str(form.get("status", "")).lower()

    order = db.query(Order).filter(Order.reference == reference).first()
    if order is None or order.payment is None:
        return {"received": True, "matched": False}

    if state in {"paid", "awaiting delivery", "delivered"}:
        order.payment.status = PaymentStatus.PAID
        order.payment.paid_at = datetime.now(timezone.utc)
    elif state in {"cancelled", "failed", "disputed", "refunded"}:
        order.payment.status = PaymentStatus.FAILED
    db.commit()
    return {"received": True, "matched": True}
