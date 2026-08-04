from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from .models import OrderStatus, Role, ServiceType


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------- auth ----------


class CustomerRegister(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    phone_number: str = Field(min_length=9, max_length=20)
    email: str | None = None
    password: str = Field(min_length=6, max_length=128)
    vehicle_make: str = Field(min_length=1, max_length=60)
    vehicle_model: str = Field(min_length=1, max_length=60)
    plate_number: str = Field(min_length=3, max_length=20)
    fuel_type: str = "petrol"
    tank_capacity_litres: float = 50.0


class SupplierRegister(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    phone_number: str = Field(min_length=9, max_length=20)
    email: str | None = None
    password: str = Field(min_length=6, max_length=128)
    company_name: str = Field(min_length=2, max_length=120)
    zera_licence_number: str = Field(min_length=3, max_length=60)
    vehicle_registration: str = Field(min_length=3, max_length=20)
    tanker_capacity_litres: float = 200.0
    services_offered: list[str] = ["fuel"]


class LoginRequest(BaseModel):
    phone_number: str
    password: str
    role: Role


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"


class VehicleOut(ORMModel):
    id: int
    make: str
    model: str
    plate_number: str
    fuel_type: str
    tank_capacity_litres: float
    is_default: bool


class SupplierProfileOut(ORMModel):
    company_name: str
    zera_licence_number: str
    vehicle_registration: str
    tanker_capacity_litres: float
    services_offered: str
    is_verified: bool
    is_online: bool
    rating: float
    completed_jobs: int
    total_earnings: float
    current_lat: float | None = None
    current_lng: float | None = None


class UserOut(ORMModel):
    id: int
    full_name: str
    phone_number: str
    email: str | None
    role: str
    theme: str
    avatar_seed: str
    created_at: datetime
    vehicles: list[VehicleOut] = []
    supplier_profile: SupplierProfileOut | None = None


class ThemeUpdate(BaseModel):
    theme: str = Field(pattern="^(dark|light|system)$")


# ---------- stations & pricing ----------


class StationOut(ORMModel):
    id: int
    name: str
    brand: str
    address: str
    lat: float
    lng: float
    petrol_price: float
    diesel_price: float
    has_petrol: bool
    has_diesel: bool
    is_24h: bool
    photo_url: str | None
    distance_km: float = 0.0


class FuelPriceOut(BaseModel):
    petrol_price: float
    diesel_price: float
    currency: str
    source: str
    source_url: str | None
    is_live: bool
    effective_period: str
    fetched_at: datetime


class QuoteRequest(BaseModel):
    pickup_lat: float = Field(ge=-90, le=90)
    pickup_lng: float = Field(ge=-180, le=180)
    service_type: ServiceType = ServiceType.FUEL
    fuel_type: str | None = "petrol"
    quantity_litres: float = Field(default=0, ge=0, le=500)
    station_id: int | None = None


class QuoteOut(BaseModel):
    distance_km: float
    unit_price: float
    fuel_cost: float
    delivery_fee: float
    service_fee: float
    total_amount: float
    eta_minutes: int
    currency: str = "USD"
    breakdown_note: str
    station: StationOut | None = None


# ---------- orders ----------


class OrderCreate(QuoteRequest):
    pickup_address: str = "Dropped pin"
    notes: str | None = None


class OrderPartyOut(ORMModel):
    id: int
    full_name: str
    phone_number: str


class OrderOut(ORMModel):
    id: int
    reference: str
    service_type: str
    fuel_type: str | None
    quantity_litres: float
    pickup_lat: float
    pickup_lng: float
    pickup_address: str
    notes: str | None
    distance_km: float
    fuel_cost: float
    delivery_fee: float
    service_fee: float
    total_amount: float
    status: str
    eta_minutes: int
    rating: int | None
    created_at: datetime
    customer: OrderPartyOut
    supplier: OrderPartyOut | None = None
    station: StationOut | None = None
    payment_status: str | None = None
    supplier_lat: float | None = None
    supplier_lng: float | None = None


class OrderStatusUpdate(BaseModel):
    status: OrderStatus


class RatingIn(BaseModel):
    rating: int = Field(ge=1, le=5)


class LocationPing(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)


class OnlineToggle(BaseModel):
    is_online: bool


# ---------- payments ----------


class PaymentInit(BaseModel):
    order_id: int
    method: str
    payer_phone: str | None = None


class PaymentOut(ORMModel):
    id: int
    order_id: int
    method: str
    amount: float
    status: str
    provider_reference: str | None
    redirect_url: str | None
    instructions: str | None
    created_at: datetime


class PaymentMethodOut(BaseModel):
    id: str
    name: str
    kind: str
    requires_phone: bool
    prefixes: list[str] = []
    note: str
    live: bool


Token.model_rebuild()
