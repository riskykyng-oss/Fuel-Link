from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import (
    Order,
    OrderStatus,
    Role,
    SupplierProfile,
    User,
    Vehicle,
    VerificationStatus,
)
from ..schemas import (
    CustomerRegister,
    LoginRequest,
    ProfileUpdate,
    SupplierRegister,
    SupplierProfileUpdate,
    ThemeUpdate,
    Token,
    UserOut,
)
from ..security import (
    create_access_token,
    get_current_user,
    hash_password,
    normalise_phone,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _reject_duplicate(db: Session, phone: str, email: str | None) -> None:
    if db.query(User).filter(User.phone_number == phone).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="That number is already registered. Sign in instead.",
        )
    if email and db.query(User).filter(User.email == email).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="That email is already registered."
        )


def _issue(user: User) -> Token:
    return Token(
        access_token=create_access_token(user.id, user.role),
        user=UserOut.model_validate(user),
    )


@router.post("/register/customer", response_model=Token, status_code=201)
def register_customer(payload: CustomerRegister, db: Session = Depends(get_db)) -> Token:
    phone = normalise_phone(payload.phone_number)
    _reject_duplicate(db, phone, payload.email)

    user = User(
        full_name=payload.full_name.strip(),
        phone_number=phone,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role=Role.CUSTOMER,
        avatar_seed=payload.full_name.strip().lower().replace(" ", "-"),
    )
    if payload.vehicle_make and payload.vehicle_model and payload.plate_number:
        user.vehicles.append(
            Vehicle(
                make=payload.vehicle_make.strip(),
                model=payload.vehicle_model.strip(),
                plate_number=payload.plate_number.strip().upper(),
                fuel_type=payload.fuel_type,
                tank_capacity_litres=payload.tank_capacity_litres or 50.0,
            )
        )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _issue(user)


@router.post("/register/supplier", response_model=Token, status_code=201)
def register_supplier(payload: SupplierRegister, db: Session = Depends(get_db)) -> Token:
    phone = normalise_phone(payload.phone_number)
    _reject_duplicate(db, phone, payload.email)

    user = User(
        full_name=payload.full_name.strip(),
        phone_number=phone,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role=Role.SUPPLIER,
        phone_verified=True,
        avatar_seed=payload.company_name.strip().lower().replace(" ", "-"),
    )
    user.supplier_profile = SupplierProfile(
        company_name=payload.company_name.strip(),
        zera_licence_number=payload.zera_licence_number.strip().upper(),
        vehicle_registration=payload.vehicle_registration.strip().upper(),
        tanker_capacity_litres=payload.tanker_capacity_litres,
        services_offered=",".join(payload.services_offered) or "fuel",
        provider_type=payload.provider_type.value,
        callout_fee=payload.callout_fee,
        labour_rate=payload.labour_rate,
        # New registrations enter the admin verification queue. Unverified
        # providers get no offers (invariant #5).
        verification_status=VerificationStatus.PENDING,
        is_verified=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _issue(user)


@router.post("/login", response_model=Token)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> Token:
    phone = normalise_phone(payload.phone_number)
    user = db.query(User).filter(User.phone_number == phone).first()

    if user is None or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Number or password is wrong."
        )
    if user.role != payload.role.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"That number is registered as a {user.role}. Switch tabs and try again.",
        )
    return _issue(user)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> User:
    return user


@router.patch("/me/theme", response_model=UserOut)
def set_theme(
    payload: ThemeUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    user.theme = payload.theme
    db.commit()
    db.refresh(user)
    return user


@router.patch("/me", response_model=UserOut)
def update_profile(
    payload: ProfileUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """The only editable identity fields. Phone and role are immutable —
    changing either would break the audit trail that keys on them."""
    if payload.email is not None and payload.email != user.email:
        existing = db.query(User).filter(User.email == payload.email).first()
        if existing is not None and existing.id != user.id:
            raise HTTPException(
                status_code=409, detail="That email is already in use on another account."
            )
        user.email = payload.email or None
    if payload.full_name is not None:
        user.full_name = payload.full_name.strip()
    db.commit()
    db.refresh(user)
    return user


@router.patch("/me/supplier", response_model=UserOut)
def update_supplier_profile(
    payload: SupplierProfileUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    if user.role != Role.SUPPLIER:
        raise HTTPException(status_code=403, detail="Only suppliers can update this profile.")
    profile = db.query(SupplierProfile).filter(SupplierProfile.user_id == user.id).first()
    if profile is None:
        raise HTTPException(status_code=404, detail="Supplier profile not found.")
    if payload.services_offered is not None:
        profile.services_offered = ",".join(payload.services_offered) or "fuel"
    if payload.callout_fee is not None:
        profile.callout_fee = payload.callout_fee
    if payload.labour_rate is not None:
        profile.labour_rate = payload.labour_rate
    db.commit()
    db.refresh(user)
    return user


@router.delete("/me", status_code=204)
def delete_account(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    """Soft-delete: the account stops working but every audit row (orders,
    payments, disputes, contacts) stays intact and immutable. Account
    deletion must never erase order history."""
    open_order = (
        db.query(Order)
        .filter(
            Order.customer_id == user.id,
            Order.status.in_(
                [
                    OrderStatus.PENDING,
                    OrderStatus.OFFERED,
                    OrderStatus.ACCEPTED,
                    OrderStatus.IN_TRANSIT,
                    OrderStatus.ARRIVED,
                ]
            ),
        )
        .first()
    )
    if open_order is not None:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Order {open_order.reference} is still running. "
                "Finish or cancel it before deleting your account."
            ),
        )
    user.is_active = False
    db.commit()
