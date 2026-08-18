"""Initial data.

Station coordinates are approximate positions for well-known Harare service
stations, accurate enough for radius and routing demonstrations. Replace them
with surveyed coordinates (or a Google Places import) before production use.

The `petrol_price` / `diesel_price` columns hold an offset in USD against the
ZERA national cap, not an absolute price. The API adds the offset to the live
snapshot at read time so a station is never showing a stale absolute figure.
"""

import json
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from .models import (
    Order,
    OrderStatus,
    Payment,
    PaymentStatus,
    PayoutStatus,
    ProviderType,
    Role,
    SealedContainer,
    ServiceType,
    ShiftState,
    Staff,
    StaffRole,
    Station,
    SupplierProfile,
    User,
    Vehicle,
    VerificationStatus,
)
from .security import hash_password
from .services.geo import eta_minutes

# Mirror of routers/orders.CALLOUT_FEES so seeded history uses the same fee
# schedule without importing the router chain.
_CALLOUT_FEES = {
    ServiceType.TOWING: 25.0,
    ServiceType.JUMP_START: 8.0,
    ServiceType.TYRE_CHANGE: 10.0,
    ServiceType.LOCKOUT: 12.0,
    ServiceType.MECHANIC: 15.0,
    ServiceType.FUEL: 0.0,
}

STATIONS = [
    ("Zuva Msasa", "Zuva", "Mutare Road, Msasa", -17.8419, 31.1092, 0.00, -0.01, True, True),
    ("Total Borrowdale", "TotalEnergies", "Borrowdale Road, Borrowdale", -17.7614, 31.0913, 0.03, 0.02, True, True),
    ("Puma Avondale", "Puma Energy", "King George Road, Avondale", -17.7982, 31.0347, 0.02, 0.01, True, False),
    ("Engen Samora Machel", "Engen", "Samora Machel Avenue, CBD", -17.8252, 31.0483, 0.01, 0.00, True, True),
    ("Redan Belvedere", "Redan", "Samora Machel Ave West, Belvedere", -17.8244, 31.0112, -0.02, -0.02, True, False),
    ("Petrotrade Southerton", "Petrotrade", "Highfield Road, Southerton", -17.8621, 31.0031, -0.03, -0.03, True, True),
    ("Zuva Chisipite", "Zuva", "Hindhead Avenue, Chisipite", -17.7758, 31.1141, 0.03, 0.02, True, False),
    ("Total Westgate", "TotalEnergies", "Harare Drive, Westgate", -17.7621, 30.9758, 0.02, 0.01, True, True),
    ("Engen Highfield", "Engen", "Highfield Road, Highfield", -17.8894, 30.9989, -0.02, -0.01, True, True),
    ("Puma Chitungwiza", "Puma Energy", "Chikwanha, Chitungwiza", -17.9938, 31.0761, -0.01, -0.01, True, True),
]


def seed_if_empty(db: Session) -> None:
    if db.query(Station).count() == 0:
        for name, brand, address, lat, lng, p_off, d_off, petrol, diesel in STATIONS:
            slug = brand.lower().replace(" ", "-").replace("energies", "")
            db.add(
                Station(
                    name=name,
                    brand=brand,
                    address=address,
                    lat=lat,
                    lng=lng,
                    petrol_price=p_off,
                    diesel_price=d_off,
                    has_petrol=petrol,
                    has_diesel=diesel,
                    is_24h=brand in {"Zuva", "TotalEnergies"},
                    photo_url=f"/stations/{slug}.svg",
                )
            )
        db.commit()

    if db.query(User).count() == 0:
        customer = User(
            full_name="Tanaka Moyo",
            phone_number="0771234567",
            email="tanaka@example.co.zw",
            hashed_password=hash_password("password123"),
            role=Role.CUSTOMER,
            phone_verified=True,
            avatar_seed="tanaka-moyo",
        )
        customer.vehicles.append(
            Vehicle(
                make="Toyota",
                model="Wish",
                plate_number="AEK 4412",
                fuel_type="petrol",
                tank_capacity_litres=55,
            )
        )

        supplier = User(
            full_name="Farai Chikwanha",
            phone_number="0712345678",
            email="farai@zuvadispatch.co.zw",
            hashed_password=hash_password("password123"),
            role=Role.SUPPLIER,
            phone_verified=True,
            avatar_seed="zuva-rapid",
        )
        first_station = db.query(Station).first()
        supplier.supplier_profile = SupplierProfile(
            company_name="Zuva Rapid Dispatch",
            zera_licence_number="ZERA-PPD-0429",
            vehicle_registration="ADP 8821",
            tanker_capacity_litres=10000,
            services_offered="fuel,towing,jump_start,tyre_change",
            provider_type=ProviderType.FUEL_STATION,
            verification_status=VerificationStatus.VERIFIED,
            is_verified=True,
            is_online=True,
            fuel_stock_petrol=8430,
            fuel_stock_diesel=6210,
            base_station_id=first_station.id if first_station else None,
            current_lat=first_station.lat if first_station else None,
            current_lng=first_station.lng if first_station else None,
        )

        db.add_all([customer, supplier])
        db.commit()

    _ensure_demo_users(db)
    _ensure_mechanic_supplier(db)
    _repair_profiles(db)
    _ensure_rosters_and_seals(db)
    _seed_history(db)


def _ensure_demo_users(db: Session) -> None:
    """Repair the documented demo accounts on every boot.

    The main seed only runs when the users table is empty, so a demo account
    created by an older seed may be stuck with phone_verified=False. Demo
    accounts should always be ready to sign in and request help.
    """
    repaired = False
    for phone in ("0771234567", "0712345678"):
        user = db.query(User).filter(User.phone_number == phone).first()
        if user is not None and not user.phone_verified:
            user.phone_verified = True
            repaired = True
    if repaired:
        db.commit()


def _ensure_mechanic_supplier(db: Session) -> None:
    """Add the roadside-mechanics garage so symptom triage resolving to
    'mechanic' has a coverable provider. Runs on every boot, no-ops if present."""
    phone = "0786669991"
    if db.query(User).filter(User.phone_number == phone).first():
        return
    station = db.query(Station).filter(Station.brand == "Engen", Station.address.contains("CBD")).first()
    mechanic = User(
        full_name="Tendai Mutasa",
        phone_number=phone,
        hashed_password=hash_password("password123"),
        role=Role.SUPPLIER,
        phone_verified=True,
        avatar_seed="harare-mobile-mechanics",
    )
    mechanic.supplier_profile = SupplierProfile(
        company_name="Harare Mobile Mechanics",
        zera_licence_number="ZERA-GAR-0713",
        vehicle_registration="ADX 4430",
        tanker_capacity_litres=0,
        services_offered="mechanic,lockout,tyre_change,jump_start",
        provider_type=ProviderType.GARAGE,
        verification_status=VerificationStatus.VERIFIED,
        callout_fee=18.0,
        labour_rate=35.0,
        is_verified=True,
        is_online=True,
        rating=4.8,
        base_station_id=station.id if station else None,
        current_lat=station.lat if station else -17.8252,
        current_lng=station.lng if station else 31.0483,
    )
    db.add(mechanic)
    db.commit()


def _repair_profiles(db: Session) -> None:
    """Fill archetype/verification defaults on profiles created before those
    columns existed (the live DB gets ALTERed by migrate(); this keeps rows
    consistent every boot)."""
    dirty = False
    for profile in db.query(SupplierProfile).all():
        if not profile.provider_type:
            profile.provider_type = ProviderType.FUEL_STATION
            dirty = True
        if not profile.verification_status:
            profile.verification_status = (
                VerificationStatus.VERIFIED if profile.is_verified else VerificationStatus.PENDING
            )
            dirty = True
    if dirty:
        db.commit()


def _ensure_rosters_and_seals(db: Session) -> None:
    """Seed one courier for the station, a mechanic + tow driver for the
    garage, and two sealed containers for the fuel station. Idempotent."""
    fuel = db.query(User).filter(User.phone_number == "0712345678").first()
    if fuel is not None:
        roster = [
            ("Bongani Ndlovu", "0774000001", StaffRole.COURIER),
        ]
        for name, phone, role in roster:
            if db.query(Staff).filter(Staff.phone_number == phone).first() is None:
                db.add(
                    Staff(
                        provider_id=fuel.id,
                        full_name=name,
                        phone_number=phone,
                        staff_id=f"ST-{phone[-4:]}",
                        hashed_password=hash_password("password123"),
                        role_label=role.value,
                        # Demo convenience: on shift so the accept gate passes
                        # out of the box. Real staff toggle via the staff app.
                        shift_state=ShiftState.AVAILABLE,
                    )
                )
        if db.query(SealedContainer).filter(SealedContainer.provider_id == fuel.id).count() == 0:
            for i in range(1, 3):
                db.add(
                    SealedContainer(
                        provider_id=fuel.id,
                        serial=f"SC-ZRD-{i:03d}",
                        capacity_litres=20.0,
                    )
                )

    garage = db.query(User).filter(User.phone_number == "0786669991").first()
    if garage is not None:
        roster = [
            ("Ropafadzo Chikoro", "0774000002", StaffRole.MECHANIC),
            ("Tapiwa Mufaro", "0774000003", StaffRole.TOW_DRIVER),
        ]
        for name, phone, role in roster:
            if db.query(Staff).filter(Staff.phone_number == phone).first() is None:
                db.add(
                    Staff(
                        provider_id=garage.id,
                        full_name=name,
                        phone_number=phone,
                        staff_id=f"ST-{phone[-4:]}",
                        hashed_password=hash_password("password123"),
                        role_label=role.value,
                        shift_state=ShiftState.AVAILABLE,
                    )
                )
    db.commit()


def _seed_history(db: Session) -> None:
    """A week of internally-consistent demo history for the fuel station.

    Every dashboard card reads from one seeded dataset, so the numbers never
    contradict each other: fuel priced at the station's real ZERA-cap offset,
    delivery fees at the configured $/km rate, callouts on the published fee
    schedule, payouts released after verified handovers, a response rate that
    reflects the declines, and sealed containers returned to the pool.

    Runs only when the supplier has no orders at all, so it never stacks on an
    existing database.
    """
    fuel = db.query(User).filter(User.phone_number == "0712345678").first()
    if fuel is None or fuel.supplier_profile is None:
        return
    if db.query(Order).filter(Order.supplier_id == fuel.id).count() > 0:
        return

    profile = fuel.supplier_profile
    station = profile.base_station
    if station is None:
        return

    from .services.fuel_prices import _latest

    snapshot = _latest(db)
    petrol_cap = snapshot.petrol_price if snapshot else 1.57
    diesel_cap = snapshot.diesel_price if snapshot else 1.54
    petrol_unit = round(petrol_cap + (station.petrol_price or 0.0), 3)
    diesel_unit = round(diesel_cap + (station.diesel_price or 0.0), 3)

    courier = (
        db.query(Staff)
        .filter(Staff.provider_id == fuel.id, Staff.role_label == StaffRole.COURIER.value)
        .first()
    )

    # Extra motorists so the week's history is not one customer on a loop.
    extra_phones = [
        ("Nyasha Dube", "0772000111"),
        ("Chido Marufu", "0772000222"),
        ("Tariro Makoni", "0772000333"),
    ]
    extras: list[User] = []
    for name, phone in extra_phones:
        if db.query(User).filter(User.phone_number == phone).first() is not None:
            continue
        customer = User(
            full_name=name,
            phone_number=phone,
            hashed_password=hash_password("password123"),
            role=Role.CUSTOMER,
            phone_verified=True,
            avatar_seed=f"history-{phone[-4:]}",
        )
        customer.vehicles.append(
            Vehicle(
                make="Toyota",
                model="Vitz",
                plate_number=f"ACV {phone[-4:]}",
                fuel_type="petrol",
                tank_capacity_litres=45,
            )
        )
        db.add(customer)
        db.flush()
        extras.append(customer)

    tana = db.query(User).filter(User.phone_number == "0771234567").first()
    customers = [tana, *extras]

    # (customer, service, fuel_type, quantity, distance_km, days_ago, rating)
    # days_ago=0 keeps three deliveries "today" so the today-KPIs are live.
    rows = [
        (customers[0], "fuel", "petrol", 20, 4.2, 6, 5),
        (customers[1], "fuel", "diesel", 15, 3.1, 5, 5),
        (customers[2], "fuel", "petrol", 10, 2.6, 5, 4),
        (customers[0], "towing", None, 0, 6.8, 4, 5),
        (customers[2], "fuel", "petrol", 15, 5.3, 4, 4),
        (customers[1], "jump_start", None, 0, 2.1, 3, 5),
        (customers[0], "fuel", "diesel", 20, 7.4, 3, 5),
        (customers[2], "fuel", "petrol", 10, 3.9, 2, 4),
        (customers[1], "fuel", "petrol", 15, 2.8, 1, 5),
        (customers[0], "fuel", "petrol", 20, 5.7, 0, 5),
        (customers[2], "fuel", "diesel", 10, 3.4, 0, 4),
        (customers[1], "fuel", "petrol", 15, 4.8, 0, 5),
    ]

    now = datetime.now(timezone.utc)
    revenue = 0.0
    rating_sum = 0.0
    for index, (customer, service, fuel_type, qty, km, days_ago, rating) in enumerate(rows):
        delivered_at = now - timedelta(days=days_ago, hours=index % 4, minutes=index * 7)
        created_at = delivered_at - timedelta(minutes=41)
        accepted_at = delivered_at - timedelta(minutes=33)
        dispatch_at = delivered_at - timedelta(minutes=24)
        service_type = ServiceType(service)

        delivery_fee = round(km * 3.0, 2)
        service_fee = _CALLOUT_FEES[service_type]
        fuel_cost = round(qty * (petrol_unit if fuel_type == "petrol" else diesel_unit), 2)
        total = round(fuel_cost + delivery_fee + service_fee, 2)
        revenue += delivery_fee + service_fee
        rating_sum += rating

        order = Order(
            reference=f"FLH{index:03d}",
            customer_id=customer.id,
            supplier_id=fuel.id,
            station_id=station.id,
            staff_id=courier.id if courier else None,
            service_type=service_type.value,
            fuel_type=fuel_type,
            quantity_litres=qty,
            symptom="out_of_fuel" if service_type == ServiceType.FUEL else None,
            vehicle_id=customer.vehicles[0].id,
            pickup_lat=station.lat + (index % 3) * 0.003,
            pickup_lng=station.lng + (index % 4) * 0.004,
            pickup_address=station.address,
            distance_km=km,
            fuel_cost=fuel_cost,
            delivery_fee=delivery_fee,
            service_fee=service_fee,
            total_amount=total,
            eta_minutes=eta_minutes(km),
            status=OrderStatus.DELIVERED,
            offered_supplier_id=fuel.id,
            offer_queue=json.dumps([fuel.id]),
            offer_index=0,
            offer_expires_at=None,
            handover_code=f"{1000 + (index * 317) % 9000}",
            rating=rating,
            created_at=created_at,
            accepted_at=accepted_at,
            seal_dispatched_at=dispatch_at if service_type == ServiceType.FUEL else None,
            seal_arrived_at=delivered_at - timedelta(minutes=1) if service_type == ServiceType.FUEL else None,
            seal_id="SC-ZRD-001" if service_type == ServiceType.FUEL else None,
            delivered_at=delivered_at,
        )
        db.add(order)
        db.flush()

        db.add(
            Payment(
                order_id=order.id,
                method="ecocash" if index % 2 == 0 else "onemoney",
                amount=total,
                status=PaymentStatus.PAID,
                paid_at=delivered_at,
                payout_status=PayoutStatus.RELEASED,
                payout_at=delivered_at,
            )
        )

    # The week's deliveries used the first container; it is now back in the
    # reusable pool, matching the accept filter (available OR returned).
    container = (
        db.query(SealedContainer)
        .filter(SealedContainer.provider_id == fuel.id, SealedContainer.serial == "SC-ZRD-001")
        .first()
    )
    if container is not None:
        container.status = "returned"

    profile.completed_jobs = len(rows)
    profile.total_earnings = round(revenue, 2)
    profile.rating = round(rating_sum / len(rows), 2)
    profile.rejected_jobs = 3
    db.commit()
