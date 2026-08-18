"""Staff app: the people who actually execute jobs.

Provider staff (couriers, mechanics, tow drivers) sign in through the staff
app only. Their tokens never reach dashboard routes (invariant #6) — the
`sub` of a staff token is a staff id, which `get_current_user` cannot resolve.
The provider owner manages the roster; each staff member toggles their own
shift and advances only the jobs assigned to them.
"""

import secrets

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import (
    Order,
    OrderStatus,
    Role,
    SealedContainer,
    ShiftState,
    Staff,
    User,
)
from ..schemas import (
    OrderOut,
    OrderStatusUpdate,
    StaffCreate,
    StaffLogin,
    StaffOut,
    StaffShift,
    StaffToken,
    StaffUpdate,
)
from ..security import (
    create_access_token,
    get_current_staff,
    hash_password,
    normalise_phone,
    require_role,
    verify_password,
)
from .orders import _shape, _transition

router = APIRouter(tags=["staff"])

LIVE = [
    OrderStatus.ACCEPTED,
    OrderStatus.IN_TRANSIT,
    OrderStatus.ARRIVED,
]


def _fresh_staff_id(db: Session) -> str:
    while True:
        candidate = f"ST-{secrets.token_hex(3).upper()}"
        if db.query(Staff).filter(Staff.staff_id == candidate).first() is None:
            return candidate


@router.post("/api/staff/login", response_model=StaffToken)
def staff_login(payload: StaffLogin, db: Session = Depends(get_db)) -> StaffToken:
    phone = normalise_phone(payload.phone_number)
    staff = db.query(Staff).filter(Staff.phone_number == phone).first()
    if staff is None or not verify_password(payload.password, staff.hashed_password):
        raise HTTPException(status_code=401, detail="Number or password is wrong.")
    if not staff.is_active:
        raise HTTPException(status_code=403, detail="This staff account has been deactivated.")
    return StaffToken(
        access_token=create_access_token(staff.id, Role.STAFF.value),
        staff=StaffOut.model_validate(staff),
    )


@router.get("/api/staff/me", response_model=StaffOut)
def staff_me(staff: Staff = Depends(get_current_staff)) -> Staff:
    return staff


@router.patch("/api/staff/me/shift", response_model=StaffOut)
def staff_shift(
    payload: StaffShift,
    staff: Staff = Depends(get_current_staff),
    db: Session = Depends(get_db),
) -> Staff:
    if staff.shift_state == ShiftState.ON_JOB:
        raise HTTPException(
            status_code=409, detail="Finish your current job before toggling shift."
        )
    staff.shift_state = payload.shift_state
    db.commit()
    db.refresh(staff)
    return staff


@router.get("/api/staff/jobs", response_model=list[OrderOut])
def staff_jobs(
    staff: Staff = Depends(get_current_staff), db: Session = Depends(get_db)
) -> list[OrderOut]:
    orders = (
        db.query(Order)
        .filter(Order.staff_id == staff.id, Order.status.in_(LIVE))
        .order_by(Order.created_at.desc())
        .all()
    )
    return [_shape(o) for o in orders]


@router.get("/api/staff/orders/{order_id}", response_model=OrderOut)
def staff_order(
    order_id: int,
    staff: Staff = Depends(get_current_staff),
    db: Session = Depends(get_db),
) -> OrderOut:
    order = db.get(Order, order_id)
    if order is None or order.staff_id != staff.id:
        raise HTTPException(status_code=404, detail="Order not found.")
    return _shape(order)


@router.patch("/api/staff/orders/{order_id}/status", response_model=OrderOut)
def staff_advance(
    order_id: int,
    payload: OrderStatusUpdate,
    staff: Staff = Depends(get_current_staff),
    db: Session = Depends(get_db),
) -> OrderOut:
    order = db.get(Order, order_id)
    if order is None or order.staff_id != staff.id:
        raise HTTPException(status_code=404, detail="Order not found.")
    _transition(db, order, payload, actor="staff", actor_id=staff.id)
    db.commit()
    db.refresh(order)
    return _shape(order)


# ---------- provider roster management ----------


@router.post("/api/supplier/staff", response_model=StaffOut, status_code=201)
def add_staff(
    payload: StaffCreate,
    user: User = Depends(require_role(Role.SUPPLIER)),
    db: Session = Depends(get_db),
) -> Staff:
    phone = normalise_phone(payload.phone_number)
    if db.query(Staff).filter(Staff.phone_number == phone).first() is not None:
        raise HTTPException(
            status_code=409, detail="That number is already on a staff account."
        )
    staff = Staff(
        provider_id=user.id,
        full_name=payload.full_name.strip(),
        phone_number=phone,
        staff_id=_fresh_staff_id(db),
        hashed_password=hash_password(payload.password),
        role_label=payload.role_label.value,
        shift_state=ShiftState.OFFLINE,
    )
    db.add(staff)
    db.commit()
    db.refresh(staff)
    return staff


@router.get("/api/supplier/staff", response_model=list[StaffOut])
def list_staff(
    user: User = Depends(require_role(Role.SUPPLIER)), db: Session = Depends(get_db)
) -> list[Staff]:
    return (
        db.query(Staff)
        .filter(Staff.provider_id == user.id)
        .order_by(Staff.id)
        .all()
    )


@router.get("/api/supplier/containers")
def list_containers(
    user: User = Depends(require_role(Role.SUPPLIER)), db: Session = Depends(get_db)
) -> dict:
    """The sealed-container fleet (master spec §7): serial, capacity and whether
    each is ready, out on a job, or marked unusable."""
    containers = (
        db.query(SealedContainer)
        .filter(SealedContainer.provider_id == user.id)
        .order_by(SealedContainer.serial)
        .all()
    )
    return {
        "containers": [
            {
                "serial": c.serial,
                "capacity_litres": c.capacity_litres,
                "status": c.status,
            }
            for c in containers
        ]
    }


@router.patch("/api/supplier/staff/{staff_id}/active", response_model=StaffOut)
def set_staff_active(
    staff_id: int,
    payload: dict,
    user: User = Depends(require_role(Role.SUPPLIER)),
    db: Session = Depends(get_db),
) -> Staff:
    staff = db.get(Staff, staff_id)
    if staff is None or staff.provider_id != user.id:
        raise HTTPException(status_code=404, detail="Staff member not found.")
    is_active = bool(payload.get("is_active"))
    if not is_active and staff.shift_state == ShiftState.ON_JOB:
        raise HTTPException(
            status_code=409, detail="Finish the staff member's current job first."
        )
    staff.is_active = is_active
    if not is_active:
        staff.shift_state = ShiftState.OFFLINE
    db.commit()
    db.refresh(staff)
    return staff


@router.patch("/api/supplier/staff/{staff_id}", response_model=StaffOut)
def update_staff(
    staff_id: int,
    payload: StaffUpdate,
    user: User = Depends(require_role(Role.SUPPLIER)),
    db: Session = Depends(get_db),
) -> Staff:
    staff = db.get(Staff, staff_id)
    if staff is None or staff.provider_id != user.id:
        raise HTTPException(status_code=404, detail="Staff member not found.")
    if staff.shift_state == ShiftState.ON_JOB:
        raise HTTPException(status_code=409, detail="Finish this staff member's current job first.")
    if payload.full_name is not None:
        staff.full_name = payload.full_name.strip()
    if payload.phone_number is not None:
        phone = normalise_phone(payload.phone_number)
        existing = db.query(Staff).filter(Staff.phone_number == phone, Staff.id != staff.id).first()
        if existing:
            raise HTTPException(status_code=409, detail="That phone number is already used by another staff member.")
        staff.phone_number = phone
    if payload.role_label is not None:
        staff.role_label = payload.role_label.value
    db.commit()
    db.refresh(staff)
    return staff


@router.delete("/api/supplier/staff/{staff_id}", status_code=204)
def delete_staff(
    staff_id: int,
    user: User = Depends(require_role(Role.SUPPLIER)),
    db: Session = Depends(get_db),
) -> None:
    staff = db.get(Staff, staff_id)
    if staff is None or staff.provider_id != user.id:
        raise HTTPException(status_code=404, detail="Staff member not found.")
    if staff.shift_state == ShiftState.ON_JOB:
        raise HTTPException(status_code=409, detail="Finish this staff member's current job first.")
    db.delete(staff)
    db.commit()
