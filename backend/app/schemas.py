from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from .models import (
    OrderStatus,
    ProviderType,
    Role,
    ServiceType,
    StaffRole,
    SymptomType,
    VerificationStatus,
)


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------- auth ----------


class CustomerRegister(BaseModel):
    """Motorist sign-up. Per the flow spec, vehicle details are OPTIONAL here —
    collected at signup but only enforced before the first request."""

    full_name: str = Field(min_length=2, max_length=120)
    phone_number: str = Field(min_length=9, max_length=20)
    email: str | None = None
    password: str = Field(min_length=6, max_length=128)
    vehicle_make: str | None = Field(default=None, min_length=1, max_length=60)
    vehicle_model: str | None = Field(default=None, min_length=1, max_length=60)
    plate_number: str | None = Field(default=None, min_length=3, max_length=20)
    fuel_type: str = "petrol"
    tank_capacity_litres: float | None = 50.0


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
    provider_type: ProviderType = ProviderType.FUEL_STATION
    callout_fee: float = Field(default=0.0, ge=0)
    labour_rate: float = Field(default=0.0, ge=0)


class SupplierVerificationIn(BaseModel):
    """Resubmit a rejected supplier for the verification queue."""

    pass


class LoginRequest(BaseModel):
    phone_number: str
    password: str
    role: Role


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"


class CodeRequest(BaseModel):
    phone_number: str = Field(min_length=9, max_length=20)
    purpose: str = Field(pattern="^(signup|reset)$")


class CodeVerify(BaseModel):
    phone_number: str = Field(min_length=9, max_length=20)
    code: str = Field(min_length=6, max_length=6)
    purpose: str = Field(pattern="^(signup|reset)$")


class PasswordReset(BaseModel):
    reset_token: str
    new_password: str = Field(min_length=6, max_length=128)


class VehicleIn(BaseModel):
    make: str = Field(min_length=1, max_length=60)
    model: str = Field(min_length=1, max_length=60)
    plate_number: str = Field(min_length=3, max_length=20)
    fuel_type: str = Field(default="petrol", pattern="^(petrol|diesel)$")
    tank_capacity_litres: float | None = Field(default=None, gt=0, le=2000)
    is_default: bool = False


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
    provider_type: str
    verification_status: str
    rejection_reason: str | None = None
    callout_fee: float = 0.0
    labour_rate: float = 0.0
    is_verified: bool
    is_online: bool
    rating: float
    completed_jobs: int
    total_earnings: float
    fuel_stock_petrol: float = 0.0
    fuel_stock_diesel: float = 0.0
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
    phone_verified: bool = False
    vehicles: list[VehicleOut] = []
    supplier_profile: SupplierProfileOut | None = None


class ThemeUpdate(BaseModel):
    theme: str = Field(pattern="^(dark|light|system)$")


class ProfileUpdate(BaseModel):
    """The only editable identity fields on a motorist account."""

    full_name: str | None = Field(default=None, min_length=2, max_length=120)
    email: str | None = Field(default=None, max_length=255)


class SupplierProfileUpdate(BaseModel):
    services_offered: list[str] | None = None
    callout_fee: float | None = None
    labour_rate: float | None = None


# ---------- staff ----------


class StaffCreate(BaseModel):
    """A provider adds an executor (courier / mechanic / tow driver)."""

    full_name: str = Field(min_length=2, max_length=120)
    phone_number: str = Field(min_length=9, max_length=20)
    password: str = Field(min_length=6, max_length=128)
    role_label: StaffRole = StaffRole.COURIER


class StaffUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=120)
    phone_number: str | None = Field(default=None, min_length=9, max_length=20)
    role_label: StaffRole | None = None


class StaffOut(ORMModel):
    id: int
    provider_id: int
    full_name: str
    phone_number: str
    staff_id: str
    role_label: str
    shift_state: str
    is_active: bool
    created_at: datetime


class StaffLogin(BaseModel):
    phone_number: str
    password: str


class StaffToken(BaseModel):
    access_token: str
    token_type: str = "bearer"
    staff: StaffOut


class StaffShift(BaseModel):
    shift_state: str = Field(pattern="^(available|offline)$")


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
    service_type: ServiceType | None = None
    fuel_type: str | None = "petrol"
    quantity_litres: float = Field(default=0, ge=0, le=20)
    station_id: int | None = None
    symptom: SymptomType | None = None
    symptom_answer: str | None = None


class QuoteProviderOut(BaseModel):
    provider_id: int | None = None
    name: str
    distance_km: float
    eta_minutes: int
    is_verified: bool = False
    rating: float | None = None


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
    coverage: bool = True
    providers: list[QuoteProviderOut] = []
    nearest_stations: list[StationOut] = []


# ---------- orders ----------


class OrderCreate(QuoteRequest):
    pickup_address: str = "Dropped pin"
    notes: str | None = None
    photo_url: str | None = None
    vehicle_id: int | None = None
    # Client-supplied idempotency key: retrying with the same key must not
    # create a duplicate order (NFR-5).
    client_request_id: str | None = Field(default=None, min_length=8, max_length=64)
    # Confirm-and-pay in one step: selecting a method marks the funds as HELD
    # on the order. The provider is not settled at this stage (FR-29).
    payment_method: str | None = None
    payer_phone: str | None = None
    # The motorist's chosen provider (from the quote's ranked list). Omitted
    # or unknown -> the top-ranked provider receives the first offer.
    provider_id: int | None = None


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
    symptom: str | None = None
    symptom_answer: str | None = None
    vehicle_id: int | None = None
    pickup_lat: float | None = None
    pickup_lng: float | None = None
    pickup_address: str | None = None
    notes: str | None
    distance_km: float
    fuel_cost: float
    delivery_fee: float
    service_fee: float
    total_amount: float
    status: str
    eta_minutes: int
    rating: int | None
    handover_code: str | None = None
    provider_staff_id: str | None = None
    sealed_container_id: str | None = None
    offer_expires_at: datetime | None = None
    photo_url: str | None = None
    created_at: datetime
    customer: OrderPartyOut
    supplier: OrderPartyOut | None = None
    station: StationOut | None = None
    payment_status: str | None = None
    payout_status: str | None = None
    supplier_lat: float | None = None
    supplier_lng: float | None = None


# ---------- coverage ----------


class CoverageIn(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)


class CoverageOut(BaseModel):
    covered: bool
    message: str
    est_response_min: int | None = None
    stations: list[StationOut] = []


class OrderStatusUpdate(BaseModel):
    status: OrderStatus
    handover_code: str | None = None
    # Arrival seal scan serial for fuel jobs (the dispatch scan must already
    # match the serial issued to the order).
    seal_id: str | None = None


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


# ---------- motorist extras: contacts, disputes, receipts ----------


class EmergencyContactIn(BaseModel):
    full_name: str = Field(min_length=1, max_length=120)
    phone_number: str = Field(min_length=9, max_length=20)
    relationship: str | None = Field(default=None, max_length=60)


class EmergencyContactOut(ORMModel):
    id: int
    full_name: str
    phone_number: str
    relationship: str | None = None


class DisputeCreate(BaseModel):
    reason: str = Field(min_length=10, max_length=2000)


class DisputeMessageIn(BaseModel):
    body: str = Field(min_length=1, max_length=2000)


class DisputeMessageOut(ORMModel):
    id: int
    sender_id: int
    sender_name: str | None = None
    sender_role: str | None = None
    body: str
    created_at: datetime


class DisputeStatusUpdate(BaseModel):
    status: str = Field(pattern="^(resolved|closed)$")


class DisputeOut(BaseModel):
    id: int
    order_id: int
    reference: str | None = None
    reason: str
    status: str
    created_at: datetime
    resolved_at: datetime | None = None
    messages: list[DisputeMessageOut] = []


class ReceiptOut(BaseModel):
    """Itemised immutable receipt for a completed order.

    Built server-side from the stored quote figures; the client never
    recomputes a price, so a receipt can never drift from what was approved.
    """

    order_id: int
    reference: str
    service_type: str
    fuel_type: str | None = None
    quantity_litres: float
    unit_price: float
    fuel_cost: float
    delivery_fee: float
    service_fee: float
    total_amount: float
    pickup_address: str
    payment_method: str | None = None
    payment_status: str | None = None
    paid_at: datetime | None = None
    created_at: datetime
    delivered_at: datetime | None = None


# ---------- bids ----------


class BidCreate(BaseModel):
    """Supplier submits a counter-offer on a customer request."""
    proposed_amount: float = Field(gt=0)
    note: str | None = Field(default=None, max_length=500)


class BidOut(ORMModel):
    id: int
    order_id: int
    supplier_id: int
    proposed_amount: float
    note: str | None = None
    distance_km: float
    status: str
    created_at: datetime
    supplier_name: str | None = None
    supplier_company: str | None = None
    supplier_verified: bool = False
    supplier_rating: float | None = None


Token.model_rebuild()
