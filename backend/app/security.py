from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from .config import settings
from .database import get_db
from .models import Role, Staff, User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer(auto_error=False)
ALGORITHM = "HS256"


def hash_password(raw: str) -> str:
    return pwd_context.hash(raw)


def verify_password(raw: str, hashed: str) -> bool:
    return pwd_context.verify(raw, hashed)


def normalise_phone(raw: str) -> str:
    """+2637XXXXXXXX and 2637XXXXXXXX both become 07XXXXXXXX."""
    digits = "".join(ch for ch in raw if ch.isdigit() or ch == "+")
    if digits.startswith("+263"):
        return "0" + digits[4:]
    if digits.startswith("263"):
        return "0" + digits[3:]
    return digits


def mask_phone(raw: str | None) -> str | None:
    """A dial-display form of a Zimbabwean number with the middle masked.

    The motorist can see that the courier's line is a real 07XXXXXXXX number,
    but not the full number — any call must go through the app's relay, never
    direct. None passes through so callers can skip the mask when absent.
    """
    if raw is None:
        return None
    digits = "".join(ch for ch in raw if ch.isdigit())
    if len(digits) < 5:
        return raw
    return f"{digits[:2]}{'*' * (len(digits) - 4)}{digits[-2:]}"


def create_access_token(user_id: int, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {"sub": str(user_id), "role": role, "exp": expire}
    return jwt.encode(payload, settings.fuellink_secret_key, algorithm=ALGORITHM)


def create_reset_token(user_id: int, role: str) -> str:
    """Short-lived token that proves a phone was verified for password reset."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=10)
    payload = {"sub": str(user_id), "role": role, "purpose": "password_reset", "exp": expire}
    return jwt.encode(payload, settings.fuellink_secret_key, algorithm=ALGORITHM)


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Sign in again to continue.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if creds is None:
        raise unauthorized
    try:
        payload = jwt.decode(
            creds.credentials, settings.fuellink_secret_key, algorithms=[ALGORITHM]
        )
        user_id = int(payload.get("sub", 0))
    except (JWTError, ValueError):
        raise unauthorized from None

    # Invariant #6: a staff token must never resolve to a User row — the two
    # tables share an id space, so this role check is what actually keeps the
    # staff world out of the dashboard world.
    if payload.get("role") == Role.STAFF.value:
        raise unauthorized

    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise unauthorized
    return user


def require_role(*roles: Role):
    def dependency(user: User = Depends(get_current_user)) -> User:
        if user.role not in {r.value for r in roles}:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This action is not available for your account type.",
            )
        return user

    return dependency


def get_current_staff(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> Staff:
    """Staff-app identity. The token's `sub` is a staff id, not a user id.

    Invariant #6: a staff token carries role="staff" and `sub` = staff id,
    which `db.get(User, ...)` can never resolve, so staff tokens are refused by
    every dashboard route via get_current_user. Conversely staff routes only
    accept staff tokens. The two worlds never cross.
    """
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Sign in to the staff app to continue.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if creds is None:
        raise unauthorized
    try:
        payload = jwt.decode(
            creds.credentials, settings.fuellink_secret_key, algorithms=[ALGORITHM]
        )
        staff_id = int(payload.get("sub", 0))
    except (JWTError, ValueError):
        raise unauthorized from None

    if payload.get("role") != Role.STAFF.value:
        raise unauthorized

    staff = db.get(Staff, staff_id)
    if staff is None or not staff.is_active:
        raise unauthorized
    return staff
