from collections.abc import Generator

from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import settings

IS_SQLITE = settings.fuellink_database_url.startswith("sqlite")

connect_args = (
    {"check_same_thread": False, "timeout": 30} if IS_SQLITE else {}
)
engine = create_engine(
    settings.fuellink_database_url,
    connect_args=connect_args,
    # Connections handed back to the pool can go stale (VPN drops, laptop
    # sleep); pre-ping makes the pool discard dead ones instead of timing out.
    pool_pre_ping=True,
    # A larger pool so the tracking websockets and normal requests coexist.
    # Each websocket poll now uses a short-lived session (see tracking.py),
    # so connections return to the pool between pushes instead of being held
    # for the life of the socket.
    pool_size=10,
    max_overflow=20,
    pool_timeout=30,
)


if IS_SQLITE:

    @event.listens_for(engine, "connect")
    def _set_sqlite_pragmas(dbapi_conn, _record) -> None:
        cursor = dbapi_conn.cursor()
        # WAL lets concurrent readers run while a writer is active, so open
        # tracking sockets can't starve normal API requests.
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA busy_timeout=30000")
        cursor.close()


SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def _table_columns(conn, table: str) -> set[str]:
    if not inspect(conn).has_table(table):
        return set()
    return {col["name"] for col in inspect(conn).get_columns(table)}


def migrate() -> None:
    """Additive schema patches for databases created before a column existed.

    `create_all` only creates missing tables, so columns added to the models
    later need a hand-rolled ALTER here. Runs on every boot; no-ops when the
    column is already present.
    """
    if not settings.fuellink_database_url.startswith("sqlite"):
        return
    with engine.connect() as conn:
        cols = _table_columns(conn, "orders")
        if "handover_code" not in cols:
            conn.execute(text("ALTER TABLE orders ADD COLUMN handover_code VARCHAR(4)"))
            conn.execute(
                text(
                    "UPDATE orders SET handover_code = "
                    "substr(reference, 3) WHERE handover_code IS NULL"
                )
            )
        if "photo_url" not in cols:
            conn.execute(text("ALTER TABLE orders ADD COLUMN photo_url VARCHAR(500)"))
        if "symptom" not in cols:
            conn.execute(text("ALTER TABLE orders ADD COLUMN symptom VARCHAR(30)"))
        if "symptom_answer" not in cols:
            conn.execute(text("ALTER TABLE orders ADD COLUMN symptom_answer VARCHAR(30)"))
        if "vehicle_id" not in cols:
            conn.execute(text("ALTER TABLE orders ADD COLUMN vehicle_id INTEGER"))
        if "client_request_id" not in cols:
            conn.execute(text("ALTER TABLE orders ADD COLUMN client_request_id VARCHAR(64)"))
            conn.execute(
                text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS ix_orders_client_request_id "
                    "ON orders (client_request_id)"
                )
            )
        if "offered_supplier_id" not in cols:
            conn.execute(text("ALTER TABLE orders ADD COLUMN offered_supplier_id INTEGER"))
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_orders_offered_supplier_id "
                    "ON orders (offered_supplier_id)"
                )
            )
        if "offer_queue" not in cols:
            conn.execute(text("ALTER TABLE orders ADD COLUMN offer_queue TEXT"))
        if "offer_index" not in cols:
            conn.execute(text("ALTER TABLE orders ADD COLUMN offer_index INTEGER DEFAULT 0"))
        if "offer_expires_at" not in cols:
            conn.execute(text("ALTER TABLE orders ADD COLUMN offer_expires_at DATETIME"))
        if "staff_id" not in cols:
            conn.execute(text("ALTER TABLE orders ADD COLUMN staff_id INTEGER"))
        if "seal_id" not in cols:
            conn.execute(text("ALTER TABLE orders ADD COLUMN seal_id VARCHAR(40)"))
        if "seal_dispatched_at" not in cols:
            conn.execute(text("ALTER TABLE orders ADD COLUMN seal_dispatched_at DATETIME"))
        if "seal_arrived_at" not in cols:
            conn.execute(text("ALTER TABLE orders ADD COLUMN seal_arrived_at DATETIME"))

        cols = _table_columns(conn, "users")
        if "phone_verified" not in cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN phone_verified BOOLEAN DEFAULT 0"))
        conn.execute(text("UPDATE users SET phone_verified = 1 WHERE phone_verified IS NULL"))

        cols = _table_columns(conn, "supplier_profiles")
        if "rejected_jobs" not in cols:
            conn.execute(text("ALTER TABLE supplier_profiles ADD COLUMN rejected_jobs INTEGER DEFAULT 0"))
        if "fuel_stock_petrol" not in cols:
            conn.execute(text("ALTER TABLE supplier_profiles ADD COLUMN fuel_stock_petrol FLOAT DEFAULT 0"))
        if "fuel_stock_diesel" not in cols:
            conn.execute(text("ALTER TABLE supplier_profiles ADD COLUMN fuel_stock_diesel FLOAT DEFAULT 0"))
            conn.execute(
                text(
                    "UPDATE supplier_profiles SET fuel_stock_petrol = 8430, "
                    "fuel_stock_diesel = 6210 WHERE fuel_stock_petrol = 0"
                )
            )
        if "provider_type" not in cols:
            conn.execute(
                text(
                    "ALTER TABLE supplier_profiles ADD COLUMN provider_type VARCHAR(20) "
                    "DEFAULT 'fuel_station'"
                )
            )
        if "verification_status" not in cols:
            conn.execute(
                text(
                    "ALTER TABLE supplier_profiles ADD COLUMN verification_status "
                    "VARCHAR(20) DEFAULT 'pending'"
                )
            )
        if "rejection_reason" not in cols:
            conn.execute(
                text("ALTER TABLE supplier_profiles ADD COLUMN rejection_reason VARCHAR(255)")
            )
        if "callout_fee" not in cols:
            conn.execute(
                text("ALTER TABLE supplier_profiles ADD COLUMN callout_fee FLOAT DEFAULT 0")
            )
        if "labour_rate" not in cols:
            conn.execute(
                text("ALTER TABLE supplier_profiles ADD COLUMN labour_rate FLOAT DEFAULT 0")
            )

        cols = _table_columns(conn, "payments")
        if "payout_status" not in cols:
            conn.execute(
                text("ALTER TABLE payments ADD COLUMN payout_status VARCHAR(20) DEFAULT 'held'")
            )
        if "payout_at" not in cols:
            conn.execute(text("ALTER TABLE payments ADD COLUMN payout_at DATETIME"))

        # Create bids table if it doesn't exist
        existing_tables = inspect(conn).get_table_names()
        if "bids" not in existing_tables:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS bids (
                    id INTEGER PRIMARY KEY,
                    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
                    supplier_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    proposed_amount FLOAT NOT NULL,
                    note TEXT,
                    distance_km FLOAT DEFAULT 0.0,
                    status VARCHAR(20) DEFAULT 'pending',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_bids_order_id ON bids (order_id)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_bids_supplier_id ON bids (supplier_id)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_bids_status ON bids (status)"))

        conn.commit()


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
