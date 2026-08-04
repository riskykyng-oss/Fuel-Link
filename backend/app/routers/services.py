from fastapi import APIRouter

from ..models import ServiceType
from .orders import CALLOUT_FEES

router = APIRouter(prefix="/api", tags=["services"])

CATALOGUE = [
    {
        "id": ServiceType.FUEL,
        "name": "Emergency fuel",
        "blurb": "Petrol or diesel brought to your pin.",
        "icon": "nozzle",
        "unit": "per litre + distance",
    },
    {
        "id": ServiceType.TOWING,
        "name": "Towing",
        "blurb": "Flatbed or hook recovery to a garage you choose.",
        "icon": "tow",
        "unit": "callout + distance",
    },
    {
        "id": ServiceType.JUMP_START,
        "name": "Jump start",
        "blurb": "Booster pack for a flat battery.",
        "icon": "battery",
        "unit": "callout + distance",
    },
    {
        "id": ServiceType.TYRE_CHANGE,
        "name": "Tyre change",
        "blurb": "Spare fitted, or your wheel taken for a plug.",
        "icon": "tyre",
        "unit": "callout + distance",
    },
    {
        "id": ServiceType.LOCKOUT,
        "name": "Lockout",
        "blurb": "Keys locked in? A technician opens it without damage.",
        "icon": "key",
        "unit": "callout + distance",
    },
    {
        "id": ServiceType.MECHANIC,
        "name": "Roadside mechanic",
        "blurb": "On-the-spot diagnosis for a car that will not start.",
        "icon": "wrench",
        "unit": "callout + distance",
    },
]


@router.get("/services")
def list_services() -> list[dict]:
    return [{**item, "callout_fee": CALLOUT_FEES.get(item["id"], 0.0)} for item in CATALOGUE]
