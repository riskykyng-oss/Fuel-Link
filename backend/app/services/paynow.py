"""Payment adapter.

Zimbabwean mobile money (EcoCash, OneMoney, InnBucks) is not exposed as a direct
public API by the mobile network operators. Merchants integrate through an
aggregator, and Paynow is the standard one. This module speaks the Paynow
Express Checkout / Web Redirect protocol.

Without merchant credentials the adapter runs in MOCK mode: it produces the same
response shape and marks the payment as settled locally, so the whole order
lifecycle is testable end to end before any account exists. Set
PAYNOW_INTEGRATION_ID and PAYNOW_INTEGRATION_KEY in .env to switch to live.
"""

import hashlib
import secrets
from urllib.parse import parse_qs, urlencode

import httpx

from ..config import settings

INITIATE_URL = "https://www.paynow.co.zw/interface/initiatetransaction"
REMOTE_URL = "https://www.paynow.co.zw/interface/remotetransaction"

# Express Checkout method codes recognised by Paynow.
MOBILE_METHODS = {"ecocash": "ecocash", "onemoney": "onemoney", "innbucks": "innbucks"}

METHODS = [
    {
        "id": "ecocash",
        "name": "EcoCash",
        "kind": "mobile_money",
        "requires_phone": True,
        "prefixes": ["077", "078"],
        "note": "You will get a PIN prompt on your handset.",
    },
    {
        "id": "onemoney",
        "name": "OneMoney",
        "kind": "mobile_money",
        "requires_phone": True,
        "prefixes": ["071"],
        "note": "You will get a PIN prompt on your handset.",
    },
    {
        "id": "innbucks",
        "name": "InnBucks",
        "kind": "mobile_money",
        "requires_phone": True,
        "prefixes": ["078", "077", "071"],
        "note": "Approve the collection in your InnBucks app.",
    },
    {
        "id": "zipit",
        "name": "Card / ZIPIT",
        "kind": "redirect",
        "requires_phone": False,
        "prefixes": [],
        "note": "Opens the secure Paynow checkout page.",
    },
]


class PaymentResult:
    def __init__(
        self,
        ok: bool,
        status: str,
        reference: str,
        poll_url: str | None = None,
        redirect_url: str | None = None,
        instructions: str = "",
    ) -> None:
        self.ok = ok
        self.status = status
        self.reference = reference
        self.poll_url = poll_url
        self.redirect_url = redirect_url
        self.instructions = instructions


def _hash(values: dict[str, str]) -> str:
    concat = "".join(str(v) for k, v in values.items() if k.lower() != "hash")
    concat += settings.paynow_integration_key
    return hashlib.sha512(concat.encode("utf-8")).hexdigest().upper()


def _decode(body: str) -> dict[str, str]:
    return {k.lower(): v[0] for k, v in parse_qs(body).items()}


async def initiate(
    *, reference: str, amount: float, method: str, payer_phone: str | None, email: str
) -> PaymentResult:
    if not settings.paynow_live:
        return PaymentResult(
            ok=True,
            status="paid",
            reference=f"MOCK-{secrets.token_hex(5).upper()}",
            instructions=(
                "Mock payment mode: no money moved. Add Paynow merchant credentials "
                "to .env to process real transactions."
            ),
        )

    payload = {
        "id": settings.paynow_integration_id,
        "reference": reference,
        "amount": f"{amount:.2f}",
        "additionalinfo": f"FuelLink order {reference}",
        "returnurl": settings.paynow_return_url,
        "resulturl": settings.paynow_result_url,
        "authemail": email,
        "status": "Message",
    }
    url = INITIATE_URL
    if method in MOBILE_METHODS:
        payload["phone"] = payer_phone or ""
        payload["method"] = MOBILE_METHODS[method]
        url = REMOTE_URL

    payload["hash"] = _hash(payload)

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                url,
                content=urlencode(payload),
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            resp.raise_for_status()
        data = _decode(resp.text)
    except Exception as exc:
        return PaymentResult(
            ok=False,
            status="failed",
            reference=reference,
            instructions=f"Could not reach Paynow: {exc}",
        )

    if data.get("status", "").lower() != "ok":
        return PaymentResult(
            ok=False,
            status="failed",
            reference=reference,
            instructions=data.get("error", "Paynow rejected the transaction."),
        )

    return PaymentResult(
        ok=True,
        status="awaiting_confirmation",
        reference=reference,
        poll_url=data.get("pollurl"),
        redirect_url=data.get("browserurl"),
        instructions=data.get("instructions", "Complete the prompt on your phone."),
    )


async def poll(poll_url: str) -> str:
    """Return one of: paid, awaiting_confirmation, failed."""
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(poll_url)
            resp.raise_for_status()
        data = _decode(resp.text)
    except Exception:
        return "awaiting_confirmation"

    state = data.get("status", "").lower()
    if state in {"paid", "awaiting delivery", "delivered"}:
        return "paid"
    if state in {"cancelled", "failed", "disputed", "refunded"}:
        return "failed"
    return "awaiting_confirmation"
