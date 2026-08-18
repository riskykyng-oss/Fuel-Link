from datetime import datetime, timezone
from enum import StrEnum

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Role(StrEnum):
    CUSTOMER = "customer"
    SUPPLIER = "supplier"
    ADMIN = "admin"
    STAFF = "staff"


class OrderStatus(StrEnum):
    """Dispatch lifecycle per the master spec.

    ``OFFERED`` is a single outstanding 60s offer to one provider; the
    offer cascades to the next-ranked provider on decline or timeout.
    ``DECLINED`` is the terminal when every ranked provider passed.
    """

    PENDING = "pending"
    OFFERED = "offered"
    BIDDING = "bidding"
    ACCEPTED = "accepted"
    IN_TRANSIT = "in_transit"
    ARRIVED = "arrived"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"
    DECLINED = "declined"


class PaymentStatus(StrEnum):
    """Settlement state of the mobile-money leg with the motorist."""

    CREATED = "created"
    HELD = "held"
    AWAITING_CONFIRMATION = "awaiting_confirmation"
    PAID = "paid"
    FAILED = "failed"


class PayoutStatus(StrEnum):
    """Escrow ledger state of the provider's money (master spec §10).

    The platform never touches a balance; "escrow" is a ledger state on the
    order. Funds start HELD when the motorist confirms, flip to RELEASED only
    server-side after a verified handover, and DISPUTED when an admin holds
    them pending adjudication. ``PAID`` means the money actually left the
    platform (outside the demo scope).
    """

    HELD = "held"
    RELEASED = "released"
    DISPUTED = "disputed"
    PAID = "paid"


class ProviderType(StrEnum):
    FUEL_STATION = "fuel_station"
    GARAGE = "garage"


class VerificationStatus(StrEnum):
    PENDING = "pending"
    VERIFIED = "verified"
    REJECTED = "rejected"


class StaffRole(StrEnum):
    COURIER = "courier"
    MECHANIC = "mechanic"
    TOW_DRIVER = "tow_driver"


class ShiftState(StrEnum):
    AVAILABLE = "available"
    ON_JOB = "on_job"
    OFFLINE = "offline"


class SymptomType(StrEnum):
    """The motorist's own description of the problem, before triage resolves it
    to a service type. Both are stored on the order to measure dispatch
    accuracy later."""

    OUT_OF_FUEL = "out_of_fuel"
    WONT_START = "wont_start"
    FLAT_TYRE = "flat_tyre"
    CANT_MOVE = "cant_move"
    LOCKED_OUT = "locked_out"
    SOMETHING_ELSE = "something_else"


class ServiceType(StrEnum):
    FUEL = "fuel"
    TOWING = "towing"
    JUMP_START = "jump_start"
    TYRE_CHANGE = "tyre_change"
    LOCKOUT = "lockout"
    MECHANIC = "mechanic"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    phone_number: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    email: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)
    full_name: Mapped[str] = mapped_column(String(120))
    hashed_password: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    phone_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    avatar_seed: Mapped[str] = mapped_column(String(40), default="fuellink")
    theme: Mapped[str] = mapped_column(String(10), default="dark")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    vehicles: Mapped[list["Vehicle"]] = relationship(
        back_populates="owner", cascade="all, delete-orphan"
    )
    supplier_profile: Mapped["SupplierProfile | None"] = relationship(
        back_populates="user", cascade="all, delete-orphan", uselist=False
    )
    emergency_contacts: Mapped[list["EmergencyContact"]] = relationship(
        back_populates="owner", cascade="all, delete-orphan"
    )
    disputes: Mapped[list["Dispute"]] = relationship(
        back_populates="customer", cascade="all, delete-orphan"
    )
    staff: Mapped[list["Staff"]] = relationship(
        back_populates="provider", cascade="all, delete-orphan"
    )
    containers: Mapped[list["SealedContainer"]] = relationship(
        back_populates="provider", cascade="all, delete-orphan"
    )


class Vehicle(Base):
    """Customer-only detail. Suppliers never fill this in."""

    __tablename__ = "vehicles"

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    make: Mapped[str] = mapped_column(String(60))
    model: Mapped[str] = mapped_column(String(60))
    plate_number: Mapped[str] = mapped_column(String(20))
    fuel_type: Mapped[str] = mapped_column(String(20), default="petrol")
    tank_capacity_litres: Mapped[float] = mapped_column(Float, default=50.0)
    is_default: Mapped[bool] = mapped_column(Boolean, default=True)

    owner: Mapped[User] = relationship(back_populates="vehicles")


class SupplierProfile(Base):
    """Supplier-only detail. Customers never fill this in."""

    __tablename__ = "supplier_profiles"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True
    )
    company_name: Mapped[str] = mapped_column(String(120))
    zera_licence_number: Mapped[str] = mapped_column(String(60))
    vehicle_registration: Mapped[str] = mapped_column(String(20))
    tanker_capacity_litres: Mapped[float] = mapped_column(Float, default=200.0)
    services_offered: Mapped[str] = mapped_column(String(255), default="fuel")
    base_station_id: Mapped[int | None] = mapped_column(
        ForeignKey("stations.id"), nullable=True
    )
    # Archetype branch: fuel_station vs garage. One provider row, one order
    # model — the API branches on this for pricing, inventory and verification.
    provider_type: Mapped[str] = mapped_column(String(20), default=ProviderType.FUEL_STATION)
    # Verification is a workflow, not a boolean: pending -> verified/rejected,
    # a rejected provider may resubmit (which returns them to pending).
    verification_status: Mapped[str] = mapped_column(
        String(20), default=VerificationStatus.PENDING
    )
    rejection_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Garage-only pricing: the callout is held at dispatch, the itemised quote
    # is approved on-site before chargeable work begins.
    callout_fee: Mapped[float] = mapped_column(Float, default=0.0)
    labour_rate: Mapped[float] = mapped_column(Float, default=0.0)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    is_online: Mapped[bool] = mapped_column(Boolean, default=False)
    current_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    current_lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    location_updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    rating: Mapped[float] = mapped_column(Float, default=5.0)
    completed_jobs: Mapped[int] = mapped_column(Integer, default=0)
    rejected_jobs: Mapped[int] = mapped_column(Integer, default=0)
    fuel_stock_petrol: Mapped[float] = mapped_column(Float, default=0.0)
    fuel_stock_diesel: Mapped[float] = mapped_column(Float, default=0.0)
    total_earnings: Mapped[float] = mapped_column(Float, default=0.0)

    user: Mapped[User] = relationship(back_populates="supplier_profile")
    base_station: Mapped["Station | None"] = relationship()


class Staff(Base):
    """A provider's execution staff — couriers, mechanics, tow drivers.

    Staff log in to the staff app only. Their tokens never authenticate to
    dashboard routes: a staff token carries role="staff" and `sub` = a staff
    id, which cannot resolve to a `User` row (invariant #6).
    """

    __tablename__ = "staff"

    id: Mapped[int] = mapped_column(primary_key=True)
    provider_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    full_name: Mapped[str] = mapped_column(String(120))
    phone_number: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    staff_id: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    role_label: Mapped[str] = mapped_column(String(30), default=StaffRole.COURIER)
    shift_state: Mapped[str] = mapped_column(String(20), default=ShiftState.OFFLINE)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    provider: Mapped[User] = relationship(back_populates="staff")


class SealedContainer(Base):
    """A uniquely-labelled sealed fuel container (master spec §4, §7).

    Lifecycle: available -> in_use (issued to an order at dispatch) -> returned
    (back in the pool after a verified handover). The seal serial is scanned at
    dispatch and again at handover; the server requires the pair to match the
    serial it issued to the order before it releases payment.
    """

    __tablename__ = "sealed_containers"

    id: Mapped[int] = mapped_column(primary_key=True)
    provider_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    serial: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    capacity_litres: Mapped[float] = mapped_column(Float, default=20.0)
    status: Mapped[str] = mapped_column(String(20), default="available")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    provider: Mapped[User] = relationship(back_populates="containers")


class Station(Base):
    __tablename__ = "stations"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    brand: Mapped[str] = mapped_column(String(60))
    address: Mapped[str] = mapped_column(String(255))
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    petrol_price: Mapped[float] = mapped_column(Float, default=0.0)
    diesel_price: Mapped[float] = mapped_column(Float, default=0.0)
    has_petrol: Mapped[bool] = mapped_column(Boolean, default=True)
    has_diesel: Mapped[bool] = mapped_column(Boolean, default=True)
    is_24h: Mapped[bool] = mapped_column(Boolean, default=False)
    photo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    reference: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    supplier_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    station_id: Mapped[int | None] = mapped_column(ForeignKey("stations.id"), nullable=True)

    # Timed-offer cascade (master spec §6): a single ranked queue of provider
    # user ids, with the current offer at `offer_index`. The offer expires on
    # the server clock; decline or timeout cascades to the next in the queue.
    offered_supplier_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True, index=True
    )
    offer_queue: Mapped[str | None] = mapped_column(Text, nullable=True)
    offer_index: Mapped[int] = mapped_column(Integer, default=0)
    offer_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    staff_id: Mapped[int | None] = mapped_column(ForeignKey("staff.id"), nullable=True)
    seal_id: Mapped[str | None] = mapped_column(String(40), nullable=True)
    seal_dispatched_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    seal_arrived_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    service_type: Mapped[str] = mapped_column(String(20), default=ServiceType.FUEL)
    fuel_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    quantity_litres: Mapped[float] = mapped_column(Float, default=0.0)

    symptom: Mapped[str | None] = mapped_column(String(30), nullable=True)
    symptom_answer: Mapped[str | None] = mapped_column(String(30), nullable=True)
    vehicle_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    client_request_id: Mapped[str | None] = mapped_column(String(64), nullable=True, unique=True)

    pickup_lat: Mapped[float] = mapped_column(Float)
    pickup_lng: Mapped[float] = mapped_column(Float)
    pickup_address: Mapped[str] = mapped_column(String(255), default="Dropped pin")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    distance_km: Mapped[float] = mapped_column(Float, default=0.0)
    fuel_cost: Mapped[float] = mapped_column(Float, default=0.0)
    delivery_fee: Mapped[float] = mapped_column(Float, default=0.0)
    service_fee: Mapped[float] = mapped_column(Float, default=0.0)
    total_amount: Mapped[float] = mapped_column(Float, default=0.0)

    status: Mapped[str] = mapped_column(String(20), default=OrderStatus.PENDING, index=True)
    eta_minutes: Mapped[int] = mapped_column(Integer, default=0)
    rating: Mapped[int | None] = mapped_column(Integer, nullable=True)
    handover_code: Mapped[str | None] = mapped_column(String(4), nullable=True)
    photo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    customer: Mapped[User] = relationship(foreign_keys=[customer_id])
    supplier: Mapped[User | None] = relationship(foreign_keys=[supplier_id])
    offered_supplier: Mapped[User | None] = relationship(foreign_keys=[offered_supplier_id])
    staff: Mapped[Staff | None] = relationship()
    station: Mapped[Station | None] = relationship()
    payment: Mapped["Payment | None"] = relationship(
        back_populates="order", cascade="all, delete-orphan", uselist=False
    )
    dispute: Mapped["Dispute | None"] = relationship(
        back_populates="order", cascade="all, delete-orphan", uselist=False
    )
    bids: Mapped[list["Bid"]] = relationship(
        back_populates="order", cascade="all, delete-orphan"
    )


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(
        ForeignKey("orders.id", ondelete="CASCADE"), unique=True, index=True
    )
    method: Mapped[str] = mapped_column(String(30))
    amount: Mapped[float] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(30), default=PaymentStatus.CREATED)
    provider_reference: Mapped[str | None] = mapped_column(String(120), nullable=True)
    poll_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    redirect_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Escrow ledger state (master spec §10): HELD on confirm, RELEASED
    # server-side on a verified handover, DISPUTED while an admin holds it.
    payout_status: Mapped[str] = mapped_column(String(20), default=PayoutStatus.HELD)
    payout_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    order: Mapped[Order] = relationship(back_populates="payment")


class PriceSnapshot(Base):
    """Cached national pump-price ceiling so the app still works offline."""

    __tablename__ = "price_snapshots"

    id: Mapped[int] = mapped_column(primary_key=True)
    petrol_price: Mapped[float] = mapped_column(Float)
    diesel_price: Mapped[float] = mapped_column(Float)
    currency: Mapped[str] = mapped_column(String(10), default="USD")
    source: Mapped[str] = mapped_column(String(120), default="ZERA")
    source_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_live: Mapped[bool] = mapped_column(Boolean, default=False)
    effective_period: Mapped[str] = mapped_column(String(40), default="")
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class VerificationCode(Base):
    """One-time 6-digit phone verification code, hashed at rest.

    Expires after a few minutes and dies after a handful of wrong attempts,
    so a guessed code cannot be brute-forced.
    """

    __tablename__ = "verification_codes"

    id: Mapped[int] = mapped_column(primary_key=True)
    phone_number: Mapped[str] = mapped_column(String(20), index=True)
    purpose: Mapped[str] = mapped_column(String(20), default="signup")
    code_hash: Mapped[str] = mapped_column(String(255))
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    consumed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class EmergencyContact(Base):
    """A motorist's designated people — they get the trip-share link when the
    driver is stranded. Belongs to one account; never shared across users."""

    __tablename__ = "emergency_contacts"

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    full_name: Mapped[str] = mapped_column(String(120))
    phone_number: Mapped[str] = mapped_column(String(20))

    # NOTE: this relationship() call must stay ABOVE the `relationship`
    # column below — a class attribute named `relationship` shadows the
    # imported constructor for the rest of the class body.
    owner: Mapped[User] = relationship(back_populates="emergency_contacts")

    relationship: Mapped[str | None] = mapped_column(String(60), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class DisputeStatus(StrEnum):
    OPEN = "open"
    RESOLVED = "resolved"
    CLOSED = "closed"


class Dispute(Base):
    """An immutable complaint thread against an order.

    One dispute per order. Messages are append-only; there is deliberately no
    update or delete path for the motorist — the record is part of the audit
    trail (FR-xx audit immutability).
    """

    __tablename__ = "disputes"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(
        ForeignKey("orders.id", ondelete="CASCADE"), unique=True, index=True
    )
    customer_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    reason: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default=DisputeStatus.OPEN, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    order: Mapped[Order] = relationship(back_populates="dispute")
    customer: Mapped[User] = relationship(back_populates="disputes")
    messages: Mapped[list["DisputeMessage"]] = relationship(
        back_populates="dispute", cascade="all, delete-orphan"
    )


class DisputeMessage(Base):
    __tablename__ = "dispute_messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    dispute_id: Mapped[int] = mapped_column(
        ForeignKey("disputes.id", ondelete="CASCADE"), index=True
    )
    sender_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    dispute: Mapped[Dispute] = relationship(back_populates="messages")
    sender: Mapped[User] = relationship(foreign_keys=[sender_id])


class BidStatus(StrEnum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    EXPIRED = "expired"


class Bid(Base):
    """A supplier's counter-offer on a customer's service request (inDrive-style negotiation).

    The customer sets a price they want to pay. Suppliers can accept that price
    or propose a different amount. The customer reviews bids and picks one.
    """

    __tablename__ = "bids"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"), index=True)
    supplier_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    proposed_amount: Mapped[float] = mapped_column(Float)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    distance_km: Mapped[float] = mapped_column(Float, default=0.0)
    status: Mapped[str] = mapped_column(String(20), default=BidStatus.PENDING, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    order: Mapped[Order] = relationship(back_populates="bids")
    supplier: Mapped[User] = relationship()
