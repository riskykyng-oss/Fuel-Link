"""End-to-end check of the whole dispatch lifecycle.

Run with:  python smoke_test.py
Exits non-zero on the first failure so it can gate a commit.

Runs against a throwaway database (never the live demo DB): the env var is
set BEFORE the app imports so config picks up the temp file, and every boot
re-seeds it from scratch.
"""

import atexit
import os
import sys
import tempfile
import time

from fastapi.testclient import TestClient

_tmp_db = tempfile.mktemp(suffix="-fuellink-smoke.db")
os.environ["FUELLINK_DATABASE_URL"] = f"sqlite:///{_tmp_db.replace(os.sep, '/')}"


@atexit.register
def _cleanup_tmp_db() -> None:
    for suffix in ("", "-wal", "-shm"):
        try:
            os.remove(_tmp_db + suffix)
        except OSError:
            pass


from app.config import settings
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
    customer = r.json()
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
    check("fuel supplier is a fuel_station archetype", supplier["user"]["supplier_profile"]["provider_type"] == "fuel_station", r.text)
    check("fuel supplier is verified", supplier["user"]["supplier_profile"]["verification_status"] == "verified", r.text)

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

    r = client.post("/api/quote", json={**PICKUP, "service_type": "fuel", "fuel_type": "petrol", "quantity_litres": 20})
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
    check("quote providers carry provider ids", all(p.get("provider_id") for p in q["providers"]), r.text)
    print(f"        {q['breakdown_note']} | total ${q['total_amount']}")

    r = client.post("/api/quote", json={**PICKUP, "service_type": "fuel", "fuel_type": "petrol", "quantity_litres": 0})
    check("zero litres rejected", r.status_code == 422, r.text)

    r = client.post("/api/quote", json={"pickup_lat": -20.15, "pickup_lng": 28.58, "service_type": "fuel", "quantity_litres": 20})
    check("no-coverage returns nearest stations, not an error (FR-25)", r.status_code == 200 and r.json()["coverage"] is False and len(r.json()["nearest_stations"]) > 0, r.text)

    r = client.post("/api/quote", json={**PICKUP, "service_type": "towing"})
    check("towing quote carries a callout fee", r.json()["service_fee"] == 25.0, r.text)

    # ---- dispatch: timed offer -> accept -> staff execution -> handover ----

    r = client.post(
        "/api/orders",
        headers=ctoken,
        json={**PICKUP, "service_type": "fuel", "fuel_type": "petrol", "quantity_litres": 20, "pickup_address": "Cnr 4th & Nelson Mandela", "payment_method": "ecocash"},
    )
    check("order created", r.status_code == 201, r.text)
    order = r.json()
    oid = order["id"]
    check("order starts as an offer", order["status"] == "offered")
    check("offer carries a server deadline", order["offer_expires_at"] is not None)
    check("funds HELD on confirm, not settled (FR-29)", order["payment_status"] == "held")
    check("payout ledger starts held", order["payout_status"] == "held")
    check("motorist sees full details on their own order", order["pickup_lat"] is not None and order["handover_code"] is None)

    r = client.post("/api/orders", headers=ctoken, json={**PICKUP, "quantity_litres": 10})
    check("second live order blocked", r.status_code == 409, r.text)

    r = client.post("/api/supplier/location", headers=stoken, json={"lat": -17.8419, "lng": 31.1092})
    check("supplier pushes GPS", r.status_code == 204, r.text)

    r = client.get("/api/orders/available", headers=stoken)
    offer = next((o for o in r.json() if o["id"] == oid), None)
    check("offer appears in the supplier feed", offer is not None, r.text)
    if offer:
        check("offer is masked: no exact pin", offer["pickup_lat"] is None and offer["pickup_address"] is None, r.text)
        check("offer is masked: motorist line masked", offer["customer"]["phone_number"] == "07******67", offer["customer"]["phone_number"])
        check("offer still shows the payout", offer["total_amount"] == order["total_amount"], r.text)

    r = client.patch(f"/api/orders/{oid}/status", headers=stoken, json={"status": "in_transit"})
    check("supplier cannot advance an unaccepted offer", r.status_code == 409, r.text)

    r = client.post(f"/api/orders/{oid}/accept", headers=stoken)
    check("supplier accepts", r.status_code == 200 and r.json()["status"] == "accepted", r.text)
    accepted = r.json()
    check("real staff id assigned at accept", accepted["provider_staff_id"].startswith("ST-"), accepted["provider_staff_id"])
    check("sealed container issued at accept", accepted["sealed_container_id"].startswith("SC-"), str(accepted["sealed_container_id"]))
    check("handover code is NOT shown to the supplier", accepted["handover_code"] is None, r.text)
    seal_id = accepted["sealed_container_id"]

    r = client.post(f"/api/orders/{oid}/accept", headers=stoken)
    check("double acceptance blocked", r.status_code == 409, r.text)

    r = client.get(f"/api/orders/{oid}", headers=ctoken)
    handover_code = r.json()["handover_code"]
    check("motorist SEES the read-only handover code (reversed)", bool(handover_code) and len(handover_code) == 4, r.text)

    r = client.get("/api/supplier/summary", headers=stoken)
    check("fuel stock read before delivery", r.status_code == 200, r.text)
    stock_petrol_before = r.json()["fuel_stock_petrol"]
    completed_before = r.json()["completed_jobs"]

    r = client.get("/api/payments/methods")
    ids = {m["id"] for m in r.json()}
    check("payment methods listed", {"ecocash", "onemoney", "innbucks", "zipit"} <= ids, r.text)
    check("cash is NOT a payment method", "cash" not in ids, r.text)
    check("no offline payment kind", all(m["kind"] != "offline" for m in r.json()), r.text)

    r = client.post("/api/payments/initiate", headers=ctoken, json={"order_id": oid, "method": "ecocash"})
    check("ecocash payment initiates", r.status_code == 200, r.text)
    print(f"        {r.json()['status']}: {r.json()['instructions'][:60]}")

    # ---- staff execution path (master spec §7) ----

    r = client.post("/api/staff/login", json={"phone_number": "0774000001", "password": "password123"})
    check("seeded courier signs into the staff app", r.status_code == 200, r.text)
    sstaff = r.json()
    stoken_staff = {"Authorization": f"Bearer {sstaff['access_token']}"}
    check("staff carries a staff id", sstaff["staff"]["staff_id"].startswith("ST-"), r.text)

    r = client.get("/api/auth/me", headers=stoken_staff)
    check("staff token cannot reach dashboard routes (invariant #6)", r.status_code == 401, r.text)
    r = client.patch(f"/api/orders/{oid}/status", headers=stoken_staff, json={"status": "in_transit"})
    check("staff token refused on dashboard status endpoint", r.status_code == 401, r.text)

    r = client.get("/api/staff/me", headers=stoken_staff)
    check("staff profile reads back (mid-job)", r.status_code == 200 and r.json()["shift_state"] == "on_job", r.text)

    r = client.get("/api/staff/jobs", headers=stoken_staff)
    check("assigned job appears in the staff queue", any(o["id"] == oid for o in r.json()), r.text)

    r = client.get(f"/api/staff/orders/{oid}", headers=stoken_staff)
    staff_view = r.json()
    check("staff sees the seal serial to scan", staff_view["sealed_container_id"] == seal_id, r.text)
    check("staff never receives the handover code", staff_view["handover_code"] is None, r.text)

    r = client.patch(f"/api/staff/orders/{oid}/status", headers=stoken_staff, json={"status": "in_transit", "seal_id": "SC-000000"})
    check("wrong dispatch seal scan is rejected", r.status_code == 403, r.text)
    r = client.patch(f"/api/staff/orders/{oid}/status", headers=stoken_staff, json={"status": "in_transit", "seal_id": seal_id})
    check("staff goes in transit with the seal scan", r.status_code == 200 and r.json()["status"] == "in_transit", r.text)

    r = client.post(f"/api/supplier/demo-drive/{oid}", headers=stoken)
    check("demo drive advances marker", r.status_code == 200, r.text)
    first_remaining = r.json()["remaining_km"]
    r = client.post(f"/api/supplier/demo-drive/{oid}", headers=stoken)
    check("distance shrinks on next step", r.json()["remaining_km"] < first_remaining)

    r = client.patch(f"/api/staff/orders/{oid}/status", headers=stoken_staff, json={"status": "arrived"})
    check("staff marks arrived", r.status_code == 200, r.text)

    r = client.patch(f"/api/orders/{oid}/status", headers=ctoken, json={"status": "delivered", "handover_code": handover_code})
    check("motorist can no longer complete the handover (reversed)", r.status_code == 403, r.text)

    r = client.patch(f"/api/staff/orders/{oid}/status", headers=stoken_staff, json={"status": "delivered", "seal_id": seal_id})
    check("delivery without the code is rejected", r.status_code == 403, r.text)

    r = client.patch(
        f"/api/staff/orders/{oid}/status",
        headers=stoken_staff,
        json={"status": "delivered", "handover_code": "9999", "seal_id": seal_id},
    )
    check("wrong handover code is rejected", r.status_code == 403, r.text)

    r = client.patch(
        f"/api/staff/orders/{oid}/status",
        headers=stoken_staff,
        json={"status": "delivered", "handover_code": handover_code, "seal_id": seal_id},
    )
    check("staff completes with the motorist's code + seal pair", r.status_code == 200 and r.json()["status"] == "delivered", r.text)
    r = client.get(f"/api/orders/{oid}", headers=ctoken)
    check("payout released server-side on verified handover", r.json()["payout_status"] == "released", r.text)

    r = client.patch(f"/api/staff/orders/{oid}/status", headers=stoken_staff, json={"status": "delivered"})
    check("completed job cannot be advanced again", r.status_code == 409, r.text)

    r = client.get("/api/supplier/summary", headers=stoken)
    check(
        "petrol stock decremented on delivery",
        abs(r.json()["fuel_stock_petrol"] - round(stock_petrol_before - 20, 1)) < 0.01,
        f"{r.json()['fuel_stock_petrol']} vs {stock_petrol_before - 20}",
    )

    r = client.post(f"/api/orders/{oid}/rate", headers=ctoken, json={"rating": 5})
    check("customer rates the job", r.status_code == 200 and r.json()["rating"] == 5, r.text)

    r = client.get("/api/supplier/summary", headers=stoken)
    check(
        "supplier earnings recorded",
        r.json()["completed_jobs"] == completed_before + 1 and r.json()["total_earnings"] > 0,
        r.text,
    )

    r = client.get("/api/orders/active", headers=ctoken)
    check("no active order after delivery", r.json() is None, r.text)

    r = client.get("/api/orders", headers=ctoken)
    check("order history returns", len(r.json()) >= 1, r.text)

    # ---- roster management + staff world boundary ----

    r = client.post(
        "/api/supplier/staff",
        headers=stoken,
        json={"full_name": "Nyasha Chiremba", "phone_number": "0774000009", "password": "secret123", "role_label": "courier"},
    )
    check("supplier adds a staff member", r.status_code == 201 and r.json()["staff_id"].startswith("ST-"), r.text)
    new_staff_id = r.json()["id"]
    r = client.post(
        "/api/supplier/staff",
        headers=stoken,
        json={"full_name": "Clash", "phone_number": "0774000009", "password": "secret123", "role_label": "courier"},
    )
    check("duplicate staff phone rejected", r.status_code == 409, r.text)

    r = client.patch(f"/api/supplier/staff/{new_staff_id}/active", headers=stoken, json={"is_active": False})
    check("supplier deactivates staff", r.status_code == 200 and r.json()["is_active"] is False, r.text)
    r = client.post("/api/staff/login", json={"phone_number": "0774000009", "password": "secret123"})
    check("deactivated staff cannot sign in", r.status_code == 403, r.text)
    r = client.patch(f"/api/supplier/staff/{new_staff_id}/active", headers=stoken, json={"is_active": True})
    check("supplier reactivates staff", r.status_code == 200 and r.json()["is_active"] is True, r.text)

    r = client.patch("/api/staff/me/shift", headers=stoken_staff, json={"shift_state": "offline"})
    check("staff toggles shift offline", r.status_code == 200 and r.json()["shift_state"] == "offline", r.text)
    r = client.patch("/api/staff/me/shift", headers=stoken_staff, json={"shift_state": "available"})
    check("staff toggles shift available", r.status_code == 200, r.text)

    # ---- explicit decline is free; cascade reaches the next provider ----

    r = client.post(
        "/api/orders",
        headers=ctoken,
        json={**PICKUP, "service_type": "jump_start", "pickup_address": "Cnr 4th & Nelson Mandela", "payment_method": "ecocash"},
    )
    check("jump-start order created", r.status_code == 201, r.text)
    oid2 = r.json()["id"]

    garage = client.post(
        "/api/auth/login",
        json={"phone_number": "0786669991", "password": "password123", "role": "supplier"},
    ).json()
    gtoken = {"Authorization": f"Bearer {garage['access_token']}"}
    check("garage supplier is a garage archetype", garage["user"]["supplier_profile"]["provider_type"] == "garage", r.text)
    check("garage carries its callout + labour rate", garage["user"]["supplier_profile"]["callout_fee"] == 18.0, r.text)

    r = client.post("/api/payments/initiate", headers=ctoken, json={"order_id": oid2, "method": "ecocash"})
    check("jump-start payment settles", r.status_code == 200, r.text)

    r = client.get("/api/orders/offers", headers=gtoken)
    check("first offer goes to the nearest (garage)", any(o["id"] == oid2 for o in r.json()), r.text)
    r = client.get("/api/orders/offers", headers=stoken)
    check("fuel supplier has no offer yet", not any(o["id"] == oid2 for o in r.json()), r.text)

    r = client.post(f"/api/orders/{oid2}/reject", headers=gtoken)
    check("garage declines for free", r.status_code == 200, r.text)
    r = client.get("/api/orders/offers", headers=stoken)
    check("offer cascades to the next-ranked provider", any(o["id"] == oid2 for o in r.json()), r.text)
    r = client.get("/api/supplier/summary", headers=gtoken)
    check("explicit decline does NOT lower the response rate", r.json()["response_rate"] == 100.0, r.text)

    r = client.post(f"/api/orders/{oid2}/accept", headers=stoken)
    check("second provider accepts the cascaded offer", r.status_code == 200 and r.json()["status"] == "accepted", r.text)
    check("non-fuel jobs carry no seal", r.json()["sealed_container_id"] is None, r.text)

    # Provider-owner execution path (no seal for non-fuel).
    r = client.patch(f"/api/orders/{oid2}/status", headers=stoken, json={"status": "in_transit"})
    check("owner advances in transit", r.status_code == 200, r.text)
    r = client.patch(f"/api/orders/{oid2}/status", headers=stoken, json={"status": "arrived"})
    check("owner marks arrived", r.status_code == 200, r.text)
    r = client.patch(f"/api/orders/{oid2}/status", headers=stoken, json={"status": "delivered"})
    check("non-fuel delivery needs the handover code", r.status_code == 403, r.text)
    r = client.get(f"/api/orders/{oid2}", headers=ctoken)
    code2 = r.json()["handover_code"]
    r = client.patch(f"/api/orders/{oid2}/status", headers=stoken, json={"status": "delivered", "handover_code": code2})
    check("owner completes with the motorist's code", r.status_code == 200 and r.json()["status"] == "delivered", r.text)

    # ---- wallet removed (master spec §3) ----

    r = client.get("/api/customer/wallet", headers=ctoken)
    check("wallet endpoint removed", r.status_code == 404, r.text)

    # ---- timed-offer timeout cascades and penalises (master spec §6) ----

    settings.fuellink_offer_ttl_seconds = 1
    r = client.post(
        "/api/orders",
        headers=ctoken,
        json={**PICKUP, "service_type": "fuel", "quantity_litres": 5, "payment_method": "ecocash"},
    )
    check("timeout-test order offered", r.status_code == 201 and r.json()["status"] == "offered", r.text)
    toid = r.json()["id"]
    r = client.get("/api/orders/offers", headers=stoken)
    check("offer live before the deadline", any(o["id"] == toid for o in r.json()), r.text)
    r = client.get("/api/supplier/summary", headers=stoken)
    rate_before_timeout = r.json()["response_rate"]
    time.sleep(3.0)
    r = client.get(f"/api/orders/{toid}", headers=ctoken)
    check("unanswered offer expires to DECLINED", r.status_code == 200 and r.json()["status"] == "declined", r.text)
    r = client.get("/api/orders/offers", headers=stoken)
    check("expired offer leaves the feed", not any(o["id"] == toid for o in r.json()), r.text)
    r = client.get("/api/supplier/summary", headers=stoken)
    check(
        "timeout counts against the response rate",
        r.json()["response_rate"] < rate_before_timeout,
        f"{r.json()['response_rate']} vs {rate_before_timeout}",
    )
    settings.fuellink_offer_ttl_seconds = 600

    # ---- unverified providers get no offers (invariant #5) ----

    r = client.post(
        "/api/auth/register/supplier",
        json={
            "full_name": "Fresh Garages",
            "phone_number": "0775551001",
            "password": "secret123",
            "company_name": "Fresh City Garages",
            "zera_licence_number": "ZERA-GAR-9999",
            "vehicle_registration": "ADF 9000",
            "services_offered": ["mechanic"],
            "provider_type": "garage",
            "callout_fee": 20.0,
            "labour_rate": 40.0,
        },
    )
    check("new provider registers as pending", r.status_code == 201, r.text)
    fresh = r.json()
    check("new provider is not yet verified", fresh["user"]["supplier_profile"]["verification_status"] == "pending" and fresh["user"]["supplier_profile"]["is_verified"] is False, r.text)
    ftoken = {"Authorization": f"Bearer {fresh['access_token']}"}
    r = client.get("/api/orders/offers", headers=ftoken)
    check("unverified provider receives no offers", r.json() == [], r.text)
    r = client.post("/api/supplier/verification", headers=ftoken, json={})
    check("rejected provider can resubmit (returns to queue)", r.status_code == 200 and r.json()["supplier_profile"]["verification_status"] == "pending", r.text)

    r = client.post(
        "/api/orders",
        headers=ctoken,
        json={**PICKUP, "service_type": "mechanic", "payment_method": "ecocash"},
    )
    check("mechanic order created", r.status_code == 201, r.text)
    moid = r.json()["id"]
    r = client.get("/api/orders/offers", headers=gtoken)
    check("verified garage receives the mechanic offer", any(o["id"] == moid for o in r.json()), r.text)
    r = client.get("/api/orders/offers", headers=ftoken)
    check("unverified provider still gets nothing", not any(o["id"] == moid for o in r.json()), r.text)
    r = client.patch(f"/api/orders/{moid}/status", headers=ctoken, json={"status": "cancelled"})
    check("motorist cancels the mechanic request for free", r.status_code == 200, r.text)

    # ---- Motorist flow: OPEN -> ACCOUNT -> REQUEST ----

    # FR-1: coverage check works without an account.
    r = client.post("/api/coverage", json={"lat": PICKUP["pickup_lat"], "lng": PICKUP["pickup_lng"]})
    cov = r.json()
    check("coverage check needs no account (FR-1)", r.status_code == 200, r.text)
    check("covered pin reports coverage + ETA", cov["covered"] is True and cov["est_response_min"] is not None, r.text)
    r = client.post("/api/coverage", json={"lat": -20.15, "lng": 28.58})
    check("uncovered pin lists nearest stations (FR-25)", r.json()["covered"] is False and len(r.json()["stations"]) > 0, r.text)

    # FR-2: register with phone, password and first name; vehicle skippable.
    r = client.post(
        "/api/auth/register/customer",
        json={"full_name": "Chipo Dube", "phone_number": "+263777777001", "password": "secret123"},
    )
    check("motorist registers without a vehicle (FR-2)", r.status_code == 201, r.text)
    check("new account is not yet phone-verified", r.json()["user"]["phone_verified"] is False, r.text)
    ntoken = {"Authorization": f"Bearer {r.json()['access_token']}"}

    # FR-6: registration of an existing/verified number is rejected.
    r = client.post(
        "/api/auth/register/customer",
        json={"full_name": "Chipo Dube", "phone_number": "0777777001", "password": "secret123"},
    )
    check("existing number cannot be registered twice (FR-6)", r.status_code == 409, r.text)

    # FR-3: verification required before the FIRST request.
    r = client.post(
        "/api/orders", headers=ntoken,
        json={**PICKUP, "service_type": "fuel", "quantity_litres": 5, "client_request_id": "pre-verify"},
    )
    check("unverified motorist cannot submit a request (FR-3)", r.status_code == 403, r.text)

    # FR-11: per-phone code throttling (once per 60s) + code request flow.
    r = client.post("/api/auth/code/request", json={"phone_number": "0777777001", "purpose": "signup"})
    check("signup code requested", r.status_code == 200, r.text)
    dev_code = r.json()["dev_code"]
    check("code is six digits (mock SMS mode)", len(dev_code) == 6 and dev_code.isdigit(), r.text)
    r = client.post("/api/auth/code/request", json={"phone_number": "0777777001", "purpose": "signup"})
    check("resend throttled to once per 60s (FR-11)", r.status_code == 429, r.text)

    # Max 5 attempts, then the code is locked.
    for _ in range(5):
        r = client.post("/api/auth/code/verify", json={"phone_number": "0777777001", "code": "000000", "purpose": "signup"})
        check("wrong code rejected", r.status_code == 422, r.text)
    r = client.post("/api/auth/code/verify", json={"phone_number": "0777777001", "code": "000000", "purpose": "signup"})
    check("sixth wrong attempt locks the code", r.status_code == 429, r.text)
    r = client.post("/api/auth/code/verify", json={"phone_number": "0777777001", "code": dev_code, "purpose": "signup"})
    check("locked code can no longer verify", r.status_code != 200, r.text)

    r = client.post("/api/auth/code/request", json={"phone_number": "0777777001", "purpose": "signup"})
    check("fresh code issued after lockout", r.status_code == 200, r.text)
    r = client.post("/api/auth/code/verify", json={"phone_number": "0777777001", "code": r.json()["dev_code"], "purpose": "signup"})
    check("phone verified with the correct code (FR-3)", r.status_code == 200 and r.json()["verified"] is True, r.text)

    # FR-4: reset password via SMS code.
    r = client.post("/api/auth/code/request", json={"phone_number": "0777777001", "purpose": "reset"})
    check("reset code requested", r.status_code == 200, r.text)
    r = client.post("/api/auth/code/verify", json={"phone_number": "0777777001", "code": r.json()["dev_code"], "purpose": "reset"})
    check("reset code verified", r.status_code == 200 and r.json()["purpose"] == "reset", r.text)
    r = client.post("/api/auth/code/password-reset", json={"reset_token": r.json()["reset_token"], "new_password": "newpass456"})
    check("password reset through the SMS code (FR-4)", r.status_code == 200, r.text)
    r = client.post("/api/auth/login", json={"phone_number": "0777777001", "password": "newpass456", "role": "customer"})
    check("sign-in works with the new password", r.status_code == 200, r.text)

    # FR-12 / FR-13: vehicle CRUD + exactly one default.
    r = client.post("/api/vehicles", headers=ntoken, json={"make": "Toyota", "model": "Corolla", "plate_number": "ABX1234", "fuel_type": "petrol", "is_default": True})
    check("first vehicle added and made default", r.status_code == 201 and r.json()["is_default"] is True, r.text)
    v1 = r.json()["id"]
    r = client.post("/api/vehicles", headers=ntoken, json={"make": "Nissan", "model": "Sunny", "plate_number": "CBY4321", "fuel_type": "diesel", "is_default": True})
    check("second vehicle added and made default", r.status_code == 201 and r.json()["is_default"] is True, r.text)
    v2 = r.json()["id"]
    r = client.get("/api/vehicles", headers=ntoken)
    check("exactly one default vehicle (FR-13)", sum(1 for v in r.json() if v["is_default"]) == 1, r.text)
    r = client.patch(f"/api/vehicles/{v1}", headers=ntoken, json={"make": "Toyota", "model": "Corolla GLi", "plate_number": "ABX1234", "fuel_type": "petrol", "tank_capacity_litres": 42, "is_default": False})
    check("vehicle editable (FR-12)", r.status_code == 200 and r.json()["model"] == "Corolla GLi" and r.json()["tank_capacity_litres"] == 42, r.text)
    r = client.delete(f"/api/vehicles/{v2}", headers=ntoken)
    check("vehicle deletable (FR-12)", r.status_code == 204, r.text)
    r = client.get("/api/vehicles", headers=ntoken)
    check("deleting the default keeps one default (FR-13)", len(r.json()) == 1 and sum(1 for v in r.json() if v["is_default"]) == 1, r.text)

    # FR-15..FR-21: symptom triage.
    r = client.post("/api/quote", json={**PICKUP, "service_type": "fuel", "fuel_type": "petrol", "quantity_litres": 10})
    check("fuel quote unit price at or below ZERA cap (FR-26/27)", r.json()["unit_price"] <= prices["petrol_price"], r.text)
    r = client.post("/api/quote", json={**PICKUP, "service_type": "fuel", "quantity_litres": 25})
    check("fuel delivery capped at 20 litres (FR-19)", r.status_code == 422, r.text)
    r = client.post("/api/quote", json={**PICKUP, "symptom": "flat_tyre", "symptom_answer": "spare_yes"})
    flat = r.json()
    check("flat_tyre + spare resolves to covered tyre service (FR-17)", flat["coverage"] is True, r.text)
    check("providers ranked by ETA (FR-24)", flat["providers"] == sorted(flat["providers"], key=lambda p: p["eta_minutes"]), r.text)
    r = client.post("/api/quote", json={**PICKUP, "symptom": "wont_start", "symptom_answer": "lights_yes"})
    check("wont_start + lights resolves to a covered mechanic (FR-17)", r.json()["coverage"] is True, r.text)

    # FR-27: an explicitly chosen station above the ZERA ceiling fails closed.
    near = client.get("/api/stations/nearby", params={"lat": PICKUP["pickup_lat"], "lng": PICKUP["pickup_lng"]}).json()
    over = next((s for s in near if s["petrol_price"] > prices["petrol_price"]), None)
    check("a station priced above the ZERA cap exists for the test", over is not None, "no over-cap station found")
    if over:
        r = client.post("/api/quote", json={**PICKUP, "service_type": "fuel", "quantity_litres": 5, "station_id": over["id"]})
        check("quote over the ZERA ceiling is rejected, not padded (FR-27)", r.status_code == 422, r.text)

    # FR-29 + FR-21 + NFR-5: confirm-and-pay holds funds, idempotent retry.
    triage_body = {
        **PICKUP, "symptom": "wont_start", "symptom_answer": "lights_no",
        "payment_method": "ecocash", "client_request_id": "triage-1",
    }
    r = client.post("/api/orders", headers=ntoken, json=triage_body)
    check("triage request submitted", r.status_code == 201, r.text)
    triage_oid = r.json()["id"]
    check("symptom + answer persisted on the order (FR-21)", r.json()["symptom"] == "wont_start" and r.json()["symptom_answer"] == "lights_no", r.text)
    check("wont_start + no lights resolves to jump start (FR-17)", r.json()["service_type"] == "jump_start", r.text)
    check("funds HELD on confirm, not settled (FR-29)", r.json()["payment_status"] == "held", r.text)
    r = client.post("/api/orders", headers=ntoken, json=triage_body)
    check("retry with the same key returns the same order (NFR-5)", r.status_code == 200 and r.json()["id"] == triage_oid, r.text)
    r = client.patch(f"/api/orders/{triage_oid}/status", headers=ntoken, json={"status": "cancelled"})
    check("request cancelled before acceptance at no charge (FR-23)", r.status_code == 200 and r.json()["status"] == "cancelled", r.text)

    # FR-11: per-IP verification code rate limit.
    blocked = None
    for i in range(40):
        r = client.post("/api/auth/code/request", json={"phone_number": f"07778{i:04d}", "purpose": "signup"})
        if r.status_code == 429:
            blocked = r.status_code
            break
    check("per-IP code requests rate-limited (FR-11)", blocked == 429, "never hit the limit")

    r = client.get("/api/orders/1")
    check("unauthenticated access refused", r.status_code == 401, r.text)

    # ---- Motorist security boundary: privacy, escrow, immutable audit ----

    # The courier's number is masked to the motorist over the tracking socket.
    with client.websocket_connect(f"/ws/orders/{oid}?token={customer['access_token']}") as ws:
        snap = ws.receive_json()
    check("courier phone is masked to the motorist", snap["supplier_phone"] == "07******78", snap["supplier_phone"])
    check("courier number is not the full number", snap["supplier_phone"] != "0712345678")
    check("motorist SEES the read-only code over WS", snap["handover_code"] == handover_code)
    with client.websocket_connect(f"/ws/orders/{oid}?token={supplier['access_token']}") as ws:
        snap_s = ws.receive_json()
    check("supplier never receives the code over WS", snap_s["handover_code"] is None)

    # Location is only exposed for ACTIVE orders — history must not leak it.
    r = client.get(f"/api/orders/{oid}", headers=ctoken)
    check("delivered order in history hides provider location", r.json()["supplier_lat"] is None and r.json()["supplier_lng"] is None, r.text)

    # Receipt: only the motorist's own closed order; immutable by construction.
    r = client.get(f"/api/orders/{oid}/receipt", headers=ctoken)
    rec = r.json()
    check("receipt returns for a delivered order", r.status_code == 200, r.text)
    check("receipt total matches the stored quote", abs(rec["total_amount"] - order["total_amount"]) < 0.01, r.text)
    r = client.get(f"/api/orders/{oid}/receipt", headers=ntoken)
    check("another motorist cannot read the receipt", r.status_code == 404, r.text)
    r = client.get(f"/api/orders/{oid}/receipt", headers=stoken)
    check("a provider cannot read the motorist's receipt", r.status_code == 403, r.text)

    # One rating per job — the second attempt is refused, not overwritten.
    r = client.post(f"/api/orders/{oid}/rate", headers=ctoken, json={"rating": 4})
    check("double rating is refused", r.status_code == 409, r.text)

    # Cancel-before-acceptance is the motorist's only write. After acceptance
    # the job cannot be walked back — the recourse is a dispute.
    r = client.post(
        "/api/orders",
        headers=ctoken,
        json={**PICKUP, "service_type": "fuel", "quantity_litres": 5, "payment_method": "ecocash"},
    )
    oid5 = r.json()["id"]
    r = client.post(f"/api/orders/{oid5}/accept", headers=stoken)
    check("supplier accepts for the cancel test", r.status_code == 200, r.text)
    r = client.patch(f"/api/orders/{oid5}/status", headers=ctoken, json={"status": "cancelled"})
    check("motorist cannot cancel after acceptance (recourse = dispute)", r.status_code == 409, r.text)
    r = client.patch(f"/api/orders/{oid5}/status", headers=stoken, json={"status": "cancelled"})
    check("provider may still cancel an accepted job", r.status_code == 200 and r.json()["status"] == "cancelled", r.text)

    # Disputes: open on a completed order, thread both sides, resolve, close,
    # and the record locks. Nothing is editable or deletable afterwards.
    r = client.post(f"/api/orders/{oid}/dispute", headers=ctoken, json={"reason": "The courier refilled 15L but charged for 20L."})
    check("motorist opens a dispute", r.status_code == 201 and r.json()["status"] == "open", r.text)
    did = r.json()["id"]
    r = client.post(f"/api/orders/{oid}/dispute", headers=ctoken, json={"reason": "Duplicate dispute."})
    check("second dispute on the same order is refused", r.status_code == 409, r.text)
    r = client.post(f"/api/disputes/{did}/messages", headers=stoken, json={"body": "The nozzle counter read 20.0 at handover."})
    check("provider replies to the dispute", r.status_code == 200 and len(r.json()["messages"]) == 2, r.text)
    r = client.post(f"/api/disputes/{did}/messages", headers=ntoken, json={"body": "Not my job."})
    check("a stranger cannot message the dispute", r.status_code == 403, r.text)
    r = client.patch(f"/api/disputes/{did}/status", headers=ctoken, json={"status": "resolved"})
    check("only the provider marks a dispute resolved", r.status_code == 403, r.text)
    r = client.patch(f"/api/disputes/{did}/status", headers=stoken, json={"status": "resolved"})
    check("provider resolves the dispute", r.status_code == 200 and r.json()["status"] == "resolved", r.text)
    r = client.post(f"/api/disputes/{did}/messages", headers=ctoken, json={"body": "Still unhappy."})
    check("resolved dispute is locked against further messages", r.status_code == 409, r.text)
    r = client.patch(f"/api/disputes/{did}/status", headers=stoken, json={"status": "closed"})
    check("provider cannot close the dispute", r.status_code == 403, r.text)
    r = client.patch(f"/api/disputes/{did}/status", headers=ctoken, json={"status": "closed"})
    check("motorist closes the dispute", r.status_code == 200 and r.json()["status"] == "closed", r.text)
    r = client.get("/api/disputes/mine", headers=ctoken)
    check("dispute appears in the motorist's history", any(d["id"] == did for d in r.json()), r.text)

    # A pending job cannot be disputed — cancel is the recourse.
    r = client.post("/api/orders", headers=ctoken, json={**PICKUP, "service_type": "fuel", "quantity_litres": 5})
    oid3 = r.json()["id"]
    r = client.post(f"/api/orders/{oid3}/dispute", headers=ctoken, json={"reason": "I changed my mind about the job."})
    check("pending job cannot be disputed", r.status_code == 409, r.text)
    r = client.patch(f"/api/orders/{oid3}/status", headers=ctoken, json={"status": "cancelled"})
    check("pending job cancels for free", r.status_code == 200 and r.json()["status"] == "cancelled", r.text)

    # Emergency contacts: CRUD on your own account only.
    r = client.post("/api/emergency-contacts", headers=ctoken, json={"full_name": "Mai Nyemba", "phone_number": "+263772111222", "relationship": "Sister"})
    check("emergency contact added", r.status_code == 201 and r.json()["phone_number"] == "0772111222", r.text)
    cid = r.json()["id"]
    r = client.post("/api/emergency-contacts", headers=ctoken, json={"full_name": "Kuda", "phone_number": "0772333444"})
    check("second contact added", r.status_code == 201, r.text)
    cid2 = r.json()["id"]
    r = client.get("/api/emergency-contacts", headers=ntoken)
    check("contacts never leak to another motorist", r.json() == [], r.text)
    r = client.patch(f"/api/emergency-contacts/{cid}", headers=ctoken, json={"full_name": "Mai Nyemba (Sister)", "phone_number": "0772111222", "relationship": "Sister"})
    check("contact editable", r.status_code == 200 and r.json()["full_name"].startswith("Mai Nyemba"), r.text)
    r = client.delete(f"/api/emergency-contacts/{cid}", headers=ntoken)
    check("another motorist cannot delete your contact", r.status_code == 404, r.text)
    r = client.delete(f"/api/emergency-contacts/{cid2}", headers=ctoken)
    check("own contact deletable", r.status_code == 204, r.text)

    # Profile: name and email editable; phone and role are not.
    r = client.patch("/api/auth/me", headers=ctoken, json={"full_name": "Tanaka Moyo", "email": "tanaka@fuellink.zw"})
    check("profile name + email updated", r.status_code == 200 and r.json()["full_name"] == "Tanaka Moyo" and r.json()["email"] == "tanaka@fuellink.zw", r.text)
    r = client.patch("/api/auth/me", headers=ntoken, json={"email": "tanaka@fuellink.zw"})
    check("another account cannot take the email", r.status_code == 409, r.text)

    # Account deletion is a soft delete that cannot erase an open order's
    # audit trail and cannot run while an order is live.
    r = client.post("/api/orders", headers=ctoken, json={**PICKUP, "service_type": "fuel", "quantity_litres": 5})
    oid4 = r.json()["id"]
    r = client.delete("/api/auth/me", headers=ctoken)
    check("account delete refused with an open order", r.status_code == 409, r.text)
    r = client.patch(f"/api/orders/{oid4}/status", headers=ctoken, json={"status": "cancelled"})
    r = client.delete("/api/auth/me", headers=ntoken)
    check("account soft-deletes once no order is open", r.status_code == 204, r.text)
    r = client.get("/api/orders", headers=ntoken)
    check("deleted account token is dead", r.status_code == 401, r.text)

print("-" * 40)
print(f"{passed} checks passed\n")
