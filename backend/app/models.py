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


class OrderStatus(StrEnum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    IN_TRANSIT = "in_transit"
    ARRIVED = "arrived"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"


class PaymentStatus(StrEnum):
    CREATED = "created"
    AWAITING_CONFIRMATION = "awaiting_confirmation"
    PAID = "paid"
    FAILED = "failed"


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
    avatar_seed: Mapped[str] = mapped_column(String(40), default="fuellink")
    theme: Mapped[str] = mapped_column(String(10), default="dark")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    vehicles: Mapped[list["Vehicle"]] = relationship(
        back_populates="owner", cascade="all, delete-orphan"
    )
    supplier_profile: Mapped["SupplierProfile | None"] = relationship(
        back_populates="user", cascade="all, delete-orphan", uselist=False
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
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    is_online: Mapped[bool] = mapped_column(Boolean, default=False)
    current_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    current_lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    location_updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    rating: Mapped[float] = mapped_column(Float, default=5.0)
    completed_jobs: Mapped[int] = mapped_column(Integer, default=0)
    total_earnings: Mapped[float] = mapped_column(Float, default=0.0)

    user: Mapped[User] = relationship(back_populates="supplier_profile")
    base_station: Mapped["Station | None"] = relationship()


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

    service_type: Mapped[str] = mapped_column(String(20), default=ServiceType.FUEL)
    fuel_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    quantity_litres: Mapped[float] = mapped_column(Float, default=0.0)

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

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    customer: Mapped[User] = relationship(foreign_keys=[customer_id])
    supplier: Mapped[User | None] = relationship(foreign_keys=[supplier_id])
    station: Mapped[Station | None] = relationship()
    payment: Mapped["Payment | None"] = relationship(
        back_populates="order", cascade="all, delete-orphan", uselist=False
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
