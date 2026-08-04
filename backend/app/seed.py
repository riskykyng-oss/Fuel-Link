"""Initial data.

Station coordinates are approximate positions for well-known Harare service
stations, accurate enough for radius and routing demonstrations. Replace them
with surveyed coordinates (or a Google Places import) before production use.

The `petrol_price` / `diesel_price` columns hold an offset in USD against the
ZERA national cap, not an absolute price. The API adds the offset to the live
snapshot at read time so a station is never showing a stale absolute figure.
"""

from sqlalchemy.orm import Session

from .models import Role, Station, SupplierProfile, User, Vehicle
from .security import hash_password

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
            avatar_seed="zuva-rapid",
        )
        first_station = db.query(Station).first()
        supplier.supplier_profile = SupplierProfile(
            company_name="Zuva Rapid Dispatch",
            zera_licence_number="ZERA-PPD-0429",
            vehicle_registration="ADP 8821",
            tanker_capacity_litres=400,
            services_offered="fuel,towing,jump_start,tyre_change",
            is_verified=True,
            is_online=True,
            base_station_id=first_station.id if first_station else None,
            current_lat=first_station.lat if first_station else None,
            current_lng=first_station.lng if first_station else None,
        )

        db.add_all([customer, supplier])
        db.commit()
