"""End-to-end check of the whole dispatch lifecycle.

Run with:  python smoke_test.py
Exits non-zero on the first failure so it can gate a commit.
"""

import sys

from fastapi.testclient import TestClient

from app.main import app

PICKUP = {"pickup_lat": -17.8300, "pickup_lng": 31.0500}
passed = 0


def check(label: str, condition: bool, detail: str = "") -> None:
    global passed
    if condition:
        passed += 1
        print(f"  PASS  {label}")
    else:
        print(f"  FAIL  {label}  {detail}")
        sys.exit(1)


with TestClient(app) as client:
    print("\nFuelLink backend smoke test\n" + "-" * 40)

    r = client.get("/api/health")
    check("health endpoint", r.status_code == 200, r.text)
    print(f"        payments mode: {r.json()['payments_mode']}")

    r = client.post(
        "/api/auth/login",
        json={"phone_number": "0771234567", "password": "password123", "role": "customer"},
    )
    check("seeded customer signs in", r.status_code == 200, r.text)
    customer = r.headers and r.json()
    ctoken = {"Authorization": f"Bearer {customer['access_token']}"}
    check("customer carries a vehicle", len(customer["user"]["vehicles"]) == 1)

    r = client.post(
        "/api/auth/login",
        json={"phone_number": "0712345678", "password": "password123", "role": "supplier"},
    )
    check("seeded supplier signs in", r.status_code == 200, r.text)
    supplier = r.json()
    stoken = {"Authorization": f"Bearer {supplier['access_token']}"}
    check("supplier carries a licence", bool(supplier["user"]["supplier_profile"]["zera_licence_number"]))

    r = client.post(
        "/api/auth/login",
        json={"phone_number": "0771234567", "password": "password123", "role": "supplier"},
    )
    check("role mismatch is rejected", r.status_code == 403, r.text)

    r = client.post(
        "/api/auth/register/customer",
        json={
            "full_name": "Rudo Nyoni",
            "phone_number": "+263775550001",
            "password": "secret123",
            "vehicle_make": "Honda",
            "vehicle_model": "Fit",
            "plate_number": "ACD1234",
        },
    )
    check("new customer registers", r.status_code == 201, r.text)
    check("phone normalised to local form", r.json()["user"]["phone_number"] == "0775550001")

    r = client.post(
        "/api/auth/register/customer",
        json={
            "full_name": "Duplicate",
            "phone_number": "0775550001",
            "password": "secret123",
            "vehicle_make": "X",
            "vehicle_model": "Y",
            "plate_number": "ZZZ111",
        },
    )
    check("duplicate number is blocked", r.status_code == 409, r.text)

    r = client.get("/api/fuel-prices")
    check("fuel prices resolve", r.status_code == 200, r.text)
    prices = r.json()
    print(f"        petrol ${prices['petrol_price']} | live={prices['is_live']} | {prices['source']}")

    r = client.get("/api/stations/nearby", params={**{"lat": PICKUP["pickup_lat"], "lng": PICKUP["pickup_lng"]}})
    check("nearby stations found", r.status_code == 200 and len(r.json()) > 0, r.text)
    check("stations sorted by distance", r.json() == sorted(r.json(), key=lambda s: s["distance_km"]))

    r = client.get("/api/services")
    check("service catalogue loads", r.status_code == 200 and len(r.json()) == 6, r.text)

    r = client.post("/api/quote", json={**PICKUP, "fuel_type": "petrol", "quantity_litres": 20})
    check("quote returns", r.status_code == 200, r.text)
    q = r.json()
    expected_delivery = round(q["distance_km"] * 3.0, 2)
    check(
        "delivery fee is distance x 3",
        abs(q["delivery_fee"] - expected_delivery) < 0.01,
        f"{q['delivery_fee']} vs {expected_delivery}",
    )
    check(
        "total is fuel + delivery + callout",
        abs(q["total_amount"] - round(q["fuel_cost"] + q["delivery_fee"] + q["service_fee"], 2)) < 0.01,
    )
    print(f"        {q['breakdown_note']} | total ${q['total_amount']}")

    r = client.post("/api/quote", json={**PICKUP, "fuel_type": "petrol", "quantity_litres": 0})
    check("zero litres rejected", r.status_code == 422, r.text)

    r = client.post("/api/quote", json={"pickup_lat": -20.15, "pickup_lng": 28.58, "quantity_litres": 20})
    check("out-of-radius pin rejected (TC-04)", r.status_code == 422, r.text)

    r = client.post("/api/quote", json={**PICKUP, "service_type": "towing"})
    check("towing quote carries a callout fee", r.json()["service_fee"] == 25.0, r.text)

    r = client.post(
        "/api/orders",
        headers=ctoken,
        json={**PICKUP, "fuel_type": "petrol", "quantity_litres": 20, "pickup_address": "Cnr 4th & Nelson Mandela"},
    )
    check("order created", r.status_code == 201, r.text)
    order = r.json()
    oid = order["id"]
    check("order starts pending", order["status"] == "pending")

    r = client.post("/api/orders", headers=ctoken, json={**PICKUP, "quantity_litres": 10})
    check("second live order blocked", r.status_code == 409, r.text)

    r = client.post("/api/supplier/location", headers=stoken, json={"lat": -17.8419, "lng": 31.1092})
    check("supplier pushes GPS", r.status_code == 204, r.text)

    r = client.get("/api/orders/available", headers=stoken)
    check("job appears in supplier feed", any(o["id"] == oid for o in r.json()), r.text)

    r = client.patch(f"/api/orders/{oid}/status", headers=stoken, json={"status": "in_transit"})
    check("unassigned supplier cannot advance a job", r.status_code == 403, r.text)

    r = client.post(f"/api/orders/{oid}/accept", headers=stoken)
    check("supplier accepts", r.status_code == 200 and r.json()["status"] == "accepted", r.text)

    r = client.post(f"/api/orders/{oid}/accept", headers=stoken)
    check("double acceptance blocked", r.status_code == 409, r.text)

    r = client.get("/api/payments/methods")
    ids = {m["id"] for m in r.json()}
    check("payment methods listed", {"ecocash", "onemoney", "innbucks", "zipit", "cash"} <= ids, r.text)

    r = client.post("/api/payments/initiate", headers=ctoken, json={"order_id": oid, "method": "ecocash"})
    check("ecocash payment initiates", r.status_code == 200, r.text)
    print(f"        {r.json()['status']}: {r.json()['instructions'][:60]}")

    r = client.patch(f"/api/orders/{oid}/status", headers=stoken, json={"status": "in_transit"})
    check("supplier goes in transit", r.status_code == 200, r.text)

    r = client.post(f"/api/supplier/demo-drive/{oid}", headers=stoken)
    check("demo drive advances marker", r.status_code == 200, r.text)
    first_remaining = r.json()["remaining_km"]
    r = client.post(f"/api/supplier/demo-drive/{oid}", headers=stoken)
    check("distance shrinks on next step", r.json()["remaining_km"] < first_remaining)

    r = client.patch(f"/api/orders/{oid}/status", headers=stoken, json={"status": "arrived"})
    check("supplier marks arrived", r.status_code == 200, r.text)

    r = client.patch(f"/api/orders/{oid}/status", headers=ctoken, json={"status": "delivered"})
    check("customer cannot self-complete", r.status_code == 403, r.text)

    r = client.patch(f"/api/orders/{oid}/status", headers=stoken, json={"status": "delivered"})
    check("supplier delivers", r.status_code == 200 and r.json()["status"] == "delivered", r.text)

    r = client.post(f"/api/orders/{oid}/rate", headers=ctoken, json={"rating": 5})
    check("customer rates the job", r.status_code == 200 and r.json()["rating"] == 5, r.text)

    r = client.get("/api/supplier/summary", headers=stoken)
    check("supplier earnings recorded", r.json()["completed_jobs"] == 1 and r.json()["total_earnings"] > 0, r.text)

    r = client.get("/api/orders/active", headers=ctoken)
    check("no active order after delivery", r.json() is None, r.text)

    r = client.get("/api/orders", headers=ctoken)
    check("order history returns", len(r.json()) >= 1, r.text)

    r = client.get("/api/orders/1")
    check("unauthenticated access refused", r.status_code == 401, r.text)

print("-" * 40)
print(f"{passed} checks passed\n")
