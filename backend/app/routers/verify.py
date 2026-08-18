"""Phone verification codes (FR-2, FR-3, FR-4).

Flow: request a code → verify it. Purpose "signup" marks the phone verified on
a customer account; purpose "reset" issues a short-lived token that the
password-reset endpoint swaps for a new password.

Without an SMS provider the app runs in mock mode (like Paynow): the generated
code is returned as `dev_code` so the whole flow is testable end to end.
"""

import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models import User, VerificationCode
from ..schemas import CodeRequest, CodeVerify, PasswordReset, Token
from ..security import (
    ALGORITHM,
    create_reset_token,
    hash_password,
    normalise_phone,
    verify_password,
)
from ..services.ratelimit import SlidingWindow

router = APIRouter(prefix="/api/auth/code", tags=["auth"])

_phone_limiter = SlidingWindow(
    settings.verification_rate_phone_window_seconds, settings.verification_rate_phone_max
)
_ip_limiter = SlidingWindow(
    settings.verification_rate_ip_window_seconds, settings.verification_rate_ip_max
)


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def _active_code(db: Session, phone: str, purpose: str) -> VerificationCode | None:
    return (
        db.query(VerificationCode)
        .filter(
            VerificationCode.phone_number == phone,
            VerificationCode.purpose == purpose,
            VerificationCode.consumed.is_(False),
        )
        .order_by(VerificationCode.created_at.desc())
        .first()
    )


@router.post("/request")
def request_code(
    payload: CodeRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> dict:
    phone = normalise_phone(payload.phone_number)
    user = db.query(User).filter(User.phone_number == phone).first()

    if payload.purpose == "signup":
        if user and user.phone_verified:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="That number is already verified. Sign in instead.",
            )
    elif payload.purpose == "reset":
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No account uses that number.",
            )
    else:
        raise HTTPException(status_code=422, detail="Unknown purpose.")

    if not _phone_limiter.hit(f"phone:{phone}"):
        raise HTTPException(
            status_code=429, detail="Too many codes for this number. Try again later."
        )
    if not _ip_limiter.hit(f"ip:{_client_ip(request)}"):
        raise HTTPException(
            status_code=429, detail="Too many requests from this device. Try again later."
        )

    active = _active_code(db, phone, payload.purpose)
    if active:
        age = datetime.now(timezone.utc) - active.created_at.replace(tzinfo=timezone.utc)
        if age < timedelta(seconds=settings.verification_resend_seconds):
            raise HTTPException(
                status_code=429,
                detail=(
                    f"Wait {max(1, settings.verification_resend_seconds - int(age.total_seconds()))}"
                    " seconds before requesting another code."
                ),
            )

    # Invalidate any earlier outstanding codes so only the newest one works.
    for old in db.query(VerificationCode).filter(
        VerificationCode.phone_number == phone,
        VerificationCode.purpose == payload.purpose,
        VerificationCode.consumed.is_(False),
    ):
        old.consumed = True

    code = f"{secrets.randbelow(1_000_000):06d}"
    db.add(
        VerificationCode(
            phone_number=phone,
            purpose=payload.purpose,
            code_hash=hash_password(code),
            expires_at=datetime.now(timezone.utc)
            + timedelta(minutes=settings.verification_code_ttl_minutes),
        )
    )
    db.commit()

    result: dict = {
        "message": "Verification code sent by SMS.",
        "lifetime_s": settings.verification_code_ttl_minutes * 60,
        "resend_after_s": settings.verification_resend_seconds,
    }
    if settings.fuellink_sms_mode == "mock":
        result["dev_code"] = code
        result["message"] += " (mock mode: code shown for development)"
    return result


@router.post("/verify")
def verify_code(payload: CodeVerify, db: Session = Depends(get_db)) -> dict:
    phone = normalise_phone(payload.phone_number)
    code = _active_code(db, phone, payload.purpose)
    if code is None:
        raise HTTPException(status_code=422, detail="Request a new code first.")

    if datetime.now(timezone.utc) > code.expires_at.replace(tzinfo=timezone.utc):
        code.consumed = True
        db.commit()
        raise HTTPException(status_code=422, detail="That code has expired. Request a new one.")

    if code.attempts >= settings.verification_code_max_attempts:
        code.consumed = True
        db.commit()
        raise HTTPException(status_code=429, detail="Too many attempts. Request a new code.")

    if not verify_password(payload.code, code.code_hash):
        code.attempts += 1
        db.commit()
        raise HTTPException(status_code=422, detail="That code is wrong.")

    code.consumed = True
    db.commit()

    user = db.query(User).filter(User.phone_number == phone).first()
    if payload.purpose == "signup":
        if user is None:
            raise HTTPException(status_code=422, detail="Finish creating your account first.")
        user.phone_verified = True
        db.commit()
        return {"verified": True, "purpose": "signup"}

    if user is None:
        raise HTTPException(status_code=404, detail="No account uses that number.")
    return {"verified": True, "purpose": "reset", "reset_token": create_reset_token(user.id, user.role)}


@router.post("/password-reset", response_model=Token)
def password_reset(payload: PasswordReset, db: Session = Depends(get_db)) -> Token:
    try:
        data = jwt.decode(payload.reset_token, settings.fuellink_secret_key, algorithms=[ALGORITHM])
        if data.get("purpose") != "password_reset":
            raise ValueError
        user_id = int(data.get("sub", 0))
    except (JWTError, ValueError):
        raise HTTPException(status_code=403, detail="That reset link has expired. Try again.")

    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="No account found.")

    user.hashed_password = hash_password(payload.new_password)
    db.commit()
    db.refresh(user)

    from ..routers.auth import _issue

    return _issue(user)
