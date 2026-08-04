export type Role = "customer" | "supplier";

export type Vehicle = {
  id: number;
  make: string;
  model: string;
  plate_number: string;
  fuel_type: string;
  tank_capacity_litres: number;
  is_default: boolean;
};

export type SupplierProfile = {
  company_name: string;
  zera_licence_number: string;
  vehicle_registration: string;
  tanker_capacity_litres: number;
  services_offered: string;
  is_verified: boolean;
  is_online: boolean;
  rating: number;
  completed_jobs: number;
  total_earnings: number;
  current_lat: number | null;
  current_lng: number | null;
};

export type User = {
  id: number;
  full_name: string;
  phone_number: string;
  email: string | null;
  role: Role | "admin";
  theme: string;
  avatar_seed: string;
  created_at: string;
  vehicles: Vehicle[];
  supplier_profile: SupplierProfile | null;
};

export type Station = {
  id: number;
  name: string;
  brand: string;
  address: string;
  lat: number;
  lng: number;
  petrol_price: number;
  diesel_price: number;
  has_petrol: boolean;
  has_diesel: boolean;
  is_24h: boolean;
  photo_url: string | null;
  distance_km: number;
};

export type FuelPrices = {
  petrol_price: number;
  diesel_price: number;
  currency: string;
  source: string;
  source_url: string | null;
  is_live: boolean;
  effective_period: string;
  fetched_at: string;
};

export type ServiceType =
  | "fuel"
  | "towing"
  | "jump_start"
  | "tyre_change"
  | "lockout"
  | "mechanic";

export type ServiceItem = {
  id: ServiceType;
  name: string;
  blurb: string;
  icon: string;
  unit: string;
  callout_fee: number;
};

export type Quote = {
  distance_km: number;
  unit_price: number;
  fuel_cost: number;
  delivery_fee: number;
  service_fee: number;
  total_amount: number;
  eta_minutes: number;
  currency: string;
  breakdown_note: string;
  station: Station | null;
};

export type OrderStatus =
  | "pending"
  | "accepted"
  | "in_transit"
  | "arrived"
  | "delivered"
  | "cancelled";

export type Order = {
  id: number;
  reference: string;
  service_type: ServiceType;
  fuel_type: string | null;
  quantity_litres: number;
  pickup_lat: number;
  pickup_lng: number;
  pickup_address: string;
  notes: string | null;
  distance_km: number;
  fuel_cost: number;
  delivery_fee: number;
  service_fee: number;
  total_amount: number;
  status: OrderStatus;
  eta_minutes: number;
  rating: number | null;
  created_at: string;
  customer: { id: number; full_name: string; phone_number: string };
  supplier: { id: number; full_name: string; phone_number: string } | null;
  station: Station | null;
  payment_status: string | null;
  supplier_lat: number | null;
  supplier_lng: number | null;
};

export type PaymentMethod = {
  id: string;
  name: string;
  kind: string;
  requires_phone: boolean;
  prefixes: string[];
  note: string;
  live: boolean;
};

export type Payment = {
  id: number;
  order_id: number;
  method: string;
  amount: number;
  status: string;
  provider_reference: string | null;
  redirect_url: string | null;
  instructions: string | null;
  created_at: string;
};

export type TrackingFrame = {
  order_id: number;
  reference: string;
  status: OrderStatus;
  payment_status: string | null;
  supplier_lat: number | null;
  supplier_lng: number | null;
  pickup_lat: number;
  pickup_lng: number;
  remaining_km: number;
  eta_minutes: number;
  supplier_name: string | null;
  supplier_phone: string | null;
};

export type SupplierSummary = {
  is_online: boolean;
  is_verified: boolean;
  rating: number;
  completed_jobs: number;
  total_earnings: number;
  litres_delivered: number;
  open_requests: number;
};

const TOKEN_KEY = "fuellink.token";

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = tokenStore.get();
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const body = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const detail = body?.detail;
    const message =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail.map((d: { msg: string }) => d.msg).join(", ")
          : "Something went wrong. Try again.";
    throw new ApiError(message, res.status);
  }
  return body as T;
}

const post = <T,>(path: string, body?: unknown) =>
  request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined });

export type AuthResponse = { access_token: string; token_type: string; user: User };

export const api = {
  health: () => request<{ status: string; payments_mode: string }>("/api/health"),

  login: (phone_number: string, password: string, role: Role) =>
    post<AuthResponse>("/api/auth/login", { phone_number, password, role }),

  registerCustomer: (body: Record<string, unknown>) =>
    post<AuthResponse>("/api/auth/register/customer", body),

  registerSupplier: (body: Record<string, unknown>) =>
    post<AuthResponse>("/api/auth/register/supplier", body),

  me: () => request<User>("/api/auth/me"),

  setTheme: (theme: string) =>
    request<User>("/api/auth/me/theme", { method: "PATCH", body: JSON.stringify({ theme }) }),

  stationsNearby: (lat: number, lng: number, fuelType?: string) =>
    request<Station[]>(
      `/api/stations/nearby?lat=${lat}&lng=${lng}${fuelType ? `&fuel_type=${fuelType}` : ""}`,
    ),

  fuelPrices: (refresh = false) => request<FuelPrices>(`/api/fuel-prices?refresh=${refresh}`),

  services: () => request<ServiceItem[]>("/api/services"),

  quote: (body: Record<string, unknown>) => post<Quote>("/api/quote", body),

  createOrder: (body: Record<string, unknown>) => post<Order>("/api/orders", body),

  orders: () => request<Order[]>("/api/orders"),

  activeOrder: () => request<Order | null>("/api/orders/active"),

  availableJobs: () => request<Order[]>("/api/orders/available"),

  order: (id: number) => request<Order>(`/api/orders/${id}`),

  acceptOrder: (id: number) => post<Order>(`/api/orders/${id}/accept`),

  setOrderStatus: (id: number, status: OrderStatus) =>
    request<Order>(`/api/orders/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  rateOrder: (id: number, rating: number) => post<Order>(`/api/orders/${id}/rate`, { rating }),

  pushLocation: (lat: number, lng: number) => post<void>("/api/supplier/location", { lat, lng }),

  setOnline: (is_online: boolean) => post<void>("/api/supplier/online", { is_online }),

  supplierSummary: () => request<SupplierSummary>("/api/supplier/summary"),

  demoDrive: (orderId: number) =>
    post<{ lat: number; lng: number; remaining_km: number }>(
      `/api/supplier/demo-drive/${orderId}`,
    ),

  paymentMethods: () => request<PaymentMethod[]>("/api/payments/methods"),

  initiatePayment: (order_id: number, method: string, payer_phone?: string) =>
    post<Payment>("/api/payments/initiate", { order_id, method, payer_phone }),

  paymentStatus: (orderId: number) => request<Payment>(`/api/payments/${orderId}/status`),
};

export function trackOrder(orderId: number, onFrame: (frame: TrackingFrame) => void): () => void {
  const token = tokenStore.get() ?? "";
  const scheme = window.location.protocol === "https:" ? "wss" : "ws";
  const socket = new WebSocket(
    `${scheme}://${window.location.host}/ws/orders/${orderId}?token=${token}`,
  );
  socket.onmessage = (event) => {
    try {
      onFrame(JSON.parse(event.data) as TrackingFrame);
    } catch {
      /* ignore malformed frames */
    }
  };
  return () => socket.close();
}
