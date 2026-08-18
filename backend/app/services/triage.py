"""Symptom triage: resolve the motorist's description to exactly one service.

The client keeps this table mirrored so the follow-up question can be shown
without a round trip; the server is the source of truth for the mapping. Both
the reported symptom AND the resolved service are persisted on the order so
dispatch accuracy can be measured later.
"""

from ..models import ServiceType, SymptomType

# Which follow-up question to ask for a symptom (a "branch"), keyed by answer.
# Answers are small machine tokens ("lights_yes", "spare_no", ...) so matching
# stays stable across the client/server boundary.
BRANCHES: dict[str, str] = {
    SymptomType.WONT_START: "Do the lights come on?",
    SymptomType.FLAT_TYRE: "Do you have a spare wheel?",
}

ANSWER_TO_SERVICE: dict[str, ServiceType] = {
    "lights_yes": ServiceType.MECHANIC,
    "lights_no": ServiceType.JUMP_START,
    "spare_yes": ServiceType.TYRE_CHANGE,
    "spare_no": ServiceType.TOWING,
}

# Symptoms with no follow-up resolve straight to a service.
DIRECT: dict[str, ServiceType] = {
    SymptomType.OUT_OF_FUEL: ServiceType.FUEL,
    SymptomType.CANT_MOVE: ServiceType.TOWING,
    SymptomType.LOCKED_OUT: ServiceType.LOCKOUT,
    SymptomType.SOMETHING_ELSE: ServiceType.MECHANIC,
}


def follow_up_question(symptom: str | None) -> str | None:
    if symptom is None:
        return None
    return BRANCHES.get(symptom)


def resolve_service(symptom: str | None, answer: str | None) -> ServiceType:
    """Symptom + answer → exactly one service type.

    Unknown or missing inputs fall back to generic assistance rather than
    erroring out mid-flow; the direct service grid sends no symptom at all.
    """
    if symptom in DIRECT:
        return DIRECT[symptom]
    if symptom in BRANCHES:
        return ANSWER_TO_SERVICE.get(answer or "", ServiceType.MECHANIC)
    return ServiceType.MECHANIC
