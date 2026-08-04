from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Role, SupplierProfile, User, Vehicle
from ..schemas import (
    CustomerRegister,
    LoginRequest,
    SupplierRegister,
    ThemeUpdate,
    Token,
    UserOut,
)
from ..security import create_access_token, get_current_user, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _normalise_phone(raw: str) -> str:
    digits = "".join(ch for ch in raw if ch.isdigit() or ch == "+")
    if digits.startswith("+263"):
        return "0" + digits[4:]
    if digits.startswith("263"):
        return "0" + digits[3:]
    return digits


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
    phone = _normalise_phone(payload.phone_number)
    _reject_duplicate(db, phone, payload.email)

    user = User(
        full_name=payload.full_name.strip(),
        phone_number=phone,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role=Role.CUSTOMER,
        avatar_seed=payload.full_name.strip().lower().replace(" ", "-"),
    )
    user.vehicles.append(
        Vehicle(
            make=payload.vehicle_make.strip(),
            model=payload.vehicle_model.strip(),
            plate_number=payload.plate_number.strip().upper(),
            fuel_type=payload.fuel_type,
            tank_capacity_litres=payload.tank_capacity_litres,
        )
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _issue(user)


@router.post("/register/supplier", response_model=Token, status_code=201)
def register_supplier(payload: SupplierRegister, db: Session = Depends(get_db)) -> Token:
    phone = _normalise_phone(payload.phone_number)
    _reject_duplicate(db, phone, payload.email)

    user = User(
        full_name=payload.full_name.strip(),
        phone_number=phone,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role=Role.SUPPLIER,
        avatar_seed=payload.company_name.strip().lower().replace(" ", "-"),
    )
    user.supplier_profile = SupplierProfile(
        company_name=payload.company_name.strip(),
        zera_licence_number=payload.zera_licence_number.strip().upper(),
        vehicle_registration=payload.vehicle_registration.strip().upper(),
        tanker_capacity_litres=payload.tanker_capacity_litres,
        services_offered=",".join(payload.services_offered) or "fuel",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _issue(user)


@router.post("/login", response_model=Token)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> Token:
    phone = _normalise_phone(payload.phone_number)
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
