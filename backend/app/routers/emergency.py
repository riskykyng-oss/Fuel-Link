"""Emergency contacts — the people who receive the trip-share link when a
motorist is stranded.

They belong to the motorist's own account only: every read is scoped to the
caller, so one user can never enumerate another's people.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import EmergencyContact, Role, User
from ..schemas import EmergencyContactIn, EmergencyContactOut
from ..security import normalise_phone, require_role

router = APIRouter(prefix="/api/emergency-contacts", tags=["contacts"])


def _owned(db: Session, user: User, contact_id: int) -> EmergencyContact:
    contact = db.get(EmergencyContact, contact_id)
    if contact is None or contact.owner_id != user.id:
        raise HTTPException(
            status_code=404, detail="That contact is not on your account."
        )
    return contact


@router.get("", response_model=list[EmergencyContactOut])
def list_contacts(
    user: User = Depends(require_role(Role.CUSTOMER)),
    db: Session = Depends(get_db),
) -> list[EmergencyContact]:
    return (
        db.query(EmergencyContact)
        .filter(EmergencyContact.owner_id == user.id)
        .order_by(EmergencyContact.created_at.desc())
        .all()
    )


@router.post("", response_model=EmergencyContactOut, status_code=201)
def create_contact(
    payload: EmergencyContactIn,
    user: User = Depends(require_role(Role.CUSTOMER)),
    db: Session = Depends(get_db),
) -> EmergencyContact:
    contact = EmergencyContact(
        owner_id=user.id,
        full_name=payload.full_name.strip(),
        phone_number=normalise_phone(payload.phone_number),
        relationship=payload.relationship.strip() if payload.relationship else None,
    )
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return contact


@router.patch("/{contact_id}", response_model=EmergencyContactOut)
def update_contact(
    contact_id: int,
    payload: EmergencyContactIn,
    user: User = Depends(require_role(Role.CUSTOMER)),
    db: Session = Depends(get_db),
) -> EmergencyContact:
    contact = _owned(db, user, contact_id)
    contact.full_name = payload.full_name.strip()
    contact.phone_number = normalise_phone(payload.phone_number)
    contact.relationship = payload.relationship.strip() if payload.relationship else None
    db.commit()
    db.refresh(contact)
    return contact


@router.delete("/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_contact(
    contact_id: int,
    user: User = Depends(require_role(Role.CUSTOMER)),
    db: Session = Depends(get_db),
) -> None:
    contact = _owned(db, user, contact_id)
    db.delete(contact)
    db.commit()
