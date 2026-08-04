"""Distance and ETA helpers.

Uses the haversine great-circle distance with a road-network correction factor,
so no external routing API key is required for the app to function.
"""

from math import asin, cos, radians, sin, sqrt

# Great-circle distance under-reports real driving distance. 1.35 is the commonly
# used urban detour index; it is an approximation, not a routed distance.
ROAD_DETOUR_FACTOR = 1.35
AVERAGE_URBAN_SPEED_KMH = 32.0
DISPATCH_OVERHEAD_MINUTES = 6


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0088
    dlat = radians(lat2 - lat1)
    dlng = radians(lng2 - lng1)
    a = (
        sin(dlat / 2) ** 2
        + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng / 2) ** 2
    )
    return 2 * r * asin(sqrt(a))


def road_distance_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    return round(haversine_km(lat1, lng1, lat2, lng2) * ROAD_DETOUR_FACTOR, 2)


def eta_minutes(distance_km: float) -> int:
    return int(round(distance_km / AVERAGE_URBAN_SPEED_KMH * 60 + DISPATCH_OVERHEAD_MINUTES))
