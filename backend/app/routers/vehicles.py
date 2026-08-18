"""Vehicle CRUD for motorists (FR-12, FR-13, FR-14)."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Role, User, Vehicle
from ..schemas import VehicleIn, VehicleOut
from ..security import require_role

router = APIRouter(prefix="/api/vehicles", tags=["vehicles"])


def _owned(db: Session, user: User, vehicle_id: int) -> Vehicle:
    vehicle = db.get(Vehicle, vehicle_id)
    if vehicle is None or vehicle.owner_id != user.id:
        raise HTTPException(status_code=404, detail="That vehicle is not on your account.")
    return vehicle


def _clear_defaults(db: Session, user: User) -> None:
    for v in db.query(Vehicle).filter(Vehicle.owner_id == user.id, Vehicle.is_default.is_(True)):
        v.is_default = False


@router.get("", response_model=list[VehicleOut])
def list_vehicles(
    user: User = Depends(require_role(Role.CUSTOMER)), db: Session = Depends(get_db)
) -> list[Vehicle]:
    return (
        db.query(Vehicle)
        .filter(Vehicle.owner_id == user.id)
        .order_by(Vehicle.is_default.desc(), Vehicle.id.desc())
        .all()
    )


@router.post("", response_model=VehicleOut, status_code=201)
def create_vehicle(
    payload: VehicleIn,
    user: User = Depends(require_role(Role.CUSTOMER)),
    db: Session = Depends(get_db),
) -> Vehicle:
    existing = db.query(Vehicle).filter(Vehicle.owner_id == user.id).count()
    make_default = payload.is_default or existing == 0
    if make_default:
        _clear_defaults(db, user)
    vehicle = Vehicle(
        owner_id=user.id,
        make=payload.make.strip(),
        model=payload.model.strip(),
        plate_number=payload.plate_number.strip().upper(),
        fuel_type=payload.fuel_type,
        tank_capacity_litres=payload.tank_capacity_litres or 50.0,
        is_default=make_default,
    )
    db.add(vehicle)
    db.commit()
    db.refresh(vehicle)
    return vehicle


@router.patch("/{vehicle_id}", response_model=VehicleOut)
def update_vehicle(
    vehicle_id: int,
    payload: VehicleIn,
    user: User = Depends(require_role(Role.CUSTOMER)),
    db: Session = Depends(get_db),
) -> Vehicle:
    vehicle = _owned(db, user, vehicle_id)
    if payload.is_default:
        _clear_defaults(db, user)
        vehicle.is_default = True
    if payload.make:
        vehicle.make = payload.make.strip()
    if payload.model:
        vehicle.model = payload.model.strip()
    if payload.plate_number:
        vehicle.plate_number = payload.plate_number.strip().upper()
    vehicle.fuel_type = payload.fuel_type
    if payload.tank_capacity_litres:
        vehicle.tank_capacity_litres = payload.tank_capacity_litres
    db.commit()
    db.refresh(vehicle)
    return vehicle


@router.delete("/{vehicle_id}", status_code=204)
def delete_vehicle(
    vehicle_id: int,
    user: User = Depends(require_role(Role.CUSTOMER)),
    db: Session = Depends(get_db),
) -> None:
    vehicle = _owned(db, user, vehicle_id)
    was_default = vehicle.is_default
    db.delete(vehicle)
    db.commit()
    # Keep exactly one default when the only default was removed (FR-13).
    if was_default:
        remaining = (
            db.query(Vehicle).filter(Vehicle.owner_id == user.id).order_by(Vehicle.id).first()
        )
        if remaining:
            remaining.is_default = True
            db.commit()
