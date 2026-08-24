import { supabase } from "./supabase";

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
  provider_type: "fuel_station" | "garage";
  verification_status: "pending" | "verified" | "rejected";
  rejection_reason: string | null;
  callout_fee: number;
  labour_rate: number;
  is_verified: boolean;
  is_online: boolean;
  rating: number;
  completed_jobs: number;
  total_earnings: number;
  fuel_stock_petrol: number;
  fuel_stock_diesel: number;
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
  phone_verified: boolean;
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

export type SymptomType =
  | "out_of_fuel"
  | "wont_start"
  | "flat_tyre"
  | "cant_move"
  | "locked_out"
  | "something_else";

export type ServiceItem = {
  id: ServiceType;
  name: string;
  blurb: string;
  icon: string;
  unit: string;
  callout_fee: number;
};

export type QuoteProvider = {
  name: string;
  distance_km: number;
  eta_minutes: number;
  is_verified: boolean;
  rating: number | null;
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
  coverage: boolean;
  providers: QuoteProvider[];
  nearest_stations: Station[];
};

export type Coverage = {
  covered: boolean;
  message: string;
  est_response_min: number | null;
  stations: Station[];
};

export type OrderStatus =
  | "pending"
  | "bidding"
  | "offered"
  | "accepted"
  | "in_transit"
  | "arrived"
  | "delivered"
  | "cancelled"
  | "declined";

export type Order = {
  id: number;
  reference: string;
  service_type: ServiceType;
  fuel_type: string | null;
  quantity_litres: number;
  pickup_lat: number | null;
  pickup_lng: number | null;
  pickup_address: string | null;
  notes: string | null;
  distance_km: number;
  fuel_cost: number;
  delivery_fee: number;
  service_fee: number;
  total_amount: number;
  status: OrderStatus;
  eta_minutes: number;
  rating: number | null;
  handover_code: string | null;
  provider_staff_id: string | null;
  sealed_container_id: string | null;
  offer_expires_at: string | null;
  payout_status: string | null;
  provider_id: number | null;
  photo_url: string | null;
  created_at: string;
  symptom: SymptomType | null;
  symptom_answer: string | null;
  vehicle_id: number | null;
  customer: { id: number; full_name: string; phone_number: string };
  supplier: { id: number; full_name: string; phone_number: string } | null;
  station: Station | null;
  payment_status: string | null;
  supplier_lat: number | null;
  supplier_lng: number | null;
};

export type Bid = {
  id: number;
  order_id: number;
  supplier_id: number;
  proposed_amount: number;
  note: string | null;
  distance_km: number;
  status: string;
  created_at: string;
  supplier_name: string | null;
  supplier_company: string | null;
  supplier_verified: boolean;
  supplier_rating: number | null;
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
  provider_verified: boolean;
  provider_staff_id: string | null;
  handover_code: string | null;
};

export type SupplierSummary = {
  is_online: boolean;
  is_verified: boolean;
  rating: number;
  completed_jobs: number;
  total_earnings: number;
  earnings_today: number;
  litres_delivered: number;
  fuel_stock_petrol: number;
  fuel_stock_diesel: number;
  tanker_capacity_litres: number;
  response_rate: number;
  open_requests: number;
  petrol_price: number;
  diesel_price: number;
  cap_petrol: number;
  cap_diesel: number;
  price_verified_at: string | null;
  price_is_live: boolean;
  staff_on_shift: number;
  staff_available: number;
  containers_ready: number;
  containers_in_use: number;
  containers_total: number;
  payout_held: number;
  payout_released: number;
  payout_disputed: number;
  disputes_open: number;
};

export type SealedContainer = {
  serial: string;
  capacity_litres: number;
  status: "available" | "in_use" | "returned" | "unusable";
};

export type DisputeMessage = {
  id: number;
  sender_id: number;
  sender_name: string | null;
  sender_role: string | null;
  body: string;
  created_at: string;
};

export type Dispute = {
  id: number;
  order_id: number;
  reference: string | null;
  reason: string;
  status: "open" | "resolved" | "closed";
  created_at: string;
  resolved_at: string | null;
  messages: DisputeMessage[];
};

export type Staff = {
  id: number;
  provider_id: number;
  full_name: string;
  phone_number: string;
  staff_id: string;
  role_label: string;
  shift_state: string;
  is_active: boolean;
  created_at: string;
};

export type AuthResponse = { access_token: string; refresh_token: string; expires_in: number; token_type: string; user: User };

export type CodeRequestResponse = {
  message: string;
  lifetime_s: number;
  resend_after_s: number;
  dev_code: string | null;
};

export type CodeVerifyResponse = {
  verified: boolean;
  purpose: "signup" | "reset";
  reset_token?: string;
};

export type PasswordResetResponse = { access_token: string; refresh_token: string; expires_in: number; token_type: string; user: User };

export type StaffToken = { access_token: string; token_type: string; staff: Staff };

const API_BASE: string = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function normalizePhone(phone: string): string {
  const raw = phone.replace(/\s+/g, "");
  if (raw.startsWith("+")) return raw;
  return "+263" + raw.replace(/^0/, "");
}

async function getToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${API_BASE}${path}`, {
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

async function fetchUserProfile(authUserId: string): Promise<User> {
  const { data: profile, error } = await supabase
    .from("users")
    .select("*")
    .eq("auth_id", authUserId)
    .single();
  if (error || !profile) throw new ApiError("User profile not found", 404);

  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("*")
    .eq("owner_id", profile.id);

  let supplier_profile: SupplierProfile | null = null;
  if (profile.role === "supplier") {
    const { data: sp } = await supabase
      .from("supplier_profiles")
      .select("*")
      .eq("user_id", profile.id)
      .single();
    supplier_profile = sp;
  }

  return {
    ...profile,
    vehicles: vehicles || [],
    supplier_profile,
  };
}

export const api = {
  health: () => request<{ status: string; payments_mode: string }>("/api/health").catch(() => ({ status: "ok", payments_mode: "mock" })),

  login: async (phone_number: string, password: string, role?: Role): Promise<AuthResponse> => {
    const phone = normalizePhone(phone_number);
    const { data, error } = await supabase.auth.signInWithPassword({ phone, password });
    if (error) throw new ApiError(error.message, 401);

    const user = await fetchUserProfile(data.user.id);
    if (role && user.role !== role) throw new ApiError(`This account is not a ${role}`, 403);

    return {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_in: data.session.expires_in,
      token_type: "bearer",
      user,
    };
  },

  registerCustomer: async (body: Record<string, unknown>): Promise<AuthResponse> => {
    const phone = normalizePhone(body.phone_number as string);
    const { full_name, password, email } = body;

    const { data, error } = await supabase.auth.signUp({
      phone,
      password: password as string,
      options: { data: { full_name, role: "customer" } },
    });
    if (error) throw new ApiError(error.message, 400);

    if (data.session && data.user) {
      const { error: insertError } = await supabase.from("users").insert({
        auth_id: data.user.id,
        full_name,
        phone_number: phone,
        email: email || null,
        role: "customer",
        is_active: true,
        phone_verified: true,
      });
      if (insertError) throw new ApiError(insertError.message, 400);

      const user = await fetchUserProfile(data.user.id);
      return {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in,
        token_type: "bearer",
        user,
      };
    }

    return {
      access_token: "",
      refresh_token: "",
      expires_in: 0,
      token_type: "bearer",
      user: {
        id: 0,
        full_name: full_name as string,
        phone_number: phone,
        email: (email as string) || null,
        role: "customer",
        theme: "dark",
        avatar_seed: "fuellink",
        created_at: new Date().toISOString(),
        phone_verified: false,
        vehicles: [],
        supplier_profile: null,
      },
    };
  },

  registerSupplier: async (body: Record<string, unknown>): Promise<AuthResponse> => {
    const phone = normalizePhone(body.phone_number as string);
    const { full_name, password, email, company_name, zera_licence_number,
      vehicle_registration, tanker_capacity_litres, services_offered } = body as Record<string, unknown>;

    const { data, error } = await supabase.auth.signUp({
      phone,
      password: password as string,
      options: { data: { full_name, role: "supplier" } },
    });
    if (error) throw new ApiError(error.message, 400);

    if (data.session && data.user) {
      const { error: insertError } = await supabase.from("users").insert({
        auth_id: data.user.id,
        full_name,
        phone_number: phone,
        email: email || null,
        role: "supplier",
        is_active: true,
        phone_verified: true,
      });
      if (insertError) throw new ApiError(insertError.message, 400);

      const { data: profile } = await supabase
        .from("users").select("id").eq("auth_id", data.user.id).single();

      if (profile) {
        await supabase.from("supplier_profiles").insert({
          user_id: profile.id,
          company_name: company_name || "My Company",
          zera_licence_number: zera_licence_number || "",
          vehicle_registration: vehicle_registration || "",
          tanker_capacity_litres: tanker_capacity_litres || 200,
          services_offered: Array.isArray(services_offered) ? services_offered.join(",") : (services_offered || "fuel"),
          provider_type: "fuel_station",
          callout_fee: 0,
          labour_rate: 0,
        });
      }

      const user = await fetchUserProfile(data.user.id);
      return {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in,
        token_type: "bearer",
        user,
      };
    }

    return {
      access_token: "",
      refresh_token: "",
      expires_in: 0,
      token_type: "bearer",
      user: {
        id: 0,
        full_name: full_name as string,
        phone_number: phone,
        email: (email as string) || null,
        role: "supplier",
        theme: "dark",
        avatar_seed: "fuellink",
        created_at: new Date().toISOString(),
        phone_verified: false,
        vehicles: [],
        supplier_profile: null,
      },
    };
  },

  me: async (): Promise<User> => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) throw new ApiError("Not authenticated", 401);
    return fetchUserProfile(authUser.id);
  },

  setTheme: (theme: string) =>
    request<User>("/api/auth/theme", { method: "PATCH", body: JSON.stringify({ theme }) }),

  updateSupplierProfile: (body: Record<string, unknown>) =>
    request<User>("/api/auth/supplier", { method: "PATCH", body: JSON.stringify(body) }),

  requestCode: async (phone_number: string, _purpose: "signup" | "reset"): Promise<CodeRequestResponse> => {
    const phone = normalizePhone(phone_number);
    const { error } = await supabase.auth.signInWithOtp({ phone });
    if (error) throw new ApiError(error.message, 400);
    return { message: "Code sent", lifetime_s: 300, resend_after_s: 60, dev_code: null };
  },

  verifyCode: async (phone_number: string, code: string, purpose: "signup" | "reset"): Promise<CodeVerifyResponse> => {
    const phone = normalizePhone(phone_number);
    const { data, error } = await supabase.auth.verifyOtp({ phone, token: code, type: "sms" });
    if (error) throw new ApiError(error.message, 400);
    return { verified: true, purpose, reset_token: data.session?.access_token };
  },

  passwordReset: async (reset_token: string, new_password: string): Promise<PasswordResetResponse> => {
    const { data, error } = await supabase.auth.updateUser({ password: new_password });
    if (error) throw new ApiError(error.message, 400);
    const user = await fetchUserProfile(data.user.id);
    const { data: sessionData } = await supabase.auth.getSession();
    return {
      access_token: sessionData.session?.access_token ?? reset_token,
      refresh_token: sessionData.session?.refresh_token ?? "",
      expires_in: sessionData.session?.expires_in ?? 0,
      token_type: "bearer",
      user,
    };
  },

  coverage: (lat: number, lng: number) => post<Coverage>("/api/coverage", { lat, lng }),

  vehicles: () => request<Vehicle[]>("/api/vehicles"),

  createVehicle: (body: Record<string, unknown>) =>
    post<Vehicle>("/api/vehicles", body),

  updateVehicle: (id: number, body: Record<string, unknown>) =>
    request<Vehicle>(`/api/vehicles/${id}`, { method: "PATCH", body: JSON.stringify(body) }),

  deleteVehicle: (id: number) =>
    request<void>(`/api/vehicles/${id}`, { method: "DELETE" }),

  stationsNearby: (lat: number, lng: number, fuelType?: string) =>
    request<Station[]>(
      `/api/stations/nearby?lat=${lat}&lng=${lng}${fuelType ? `&fuel_type=${fuelType}` : ""}`,
    ),

  fuelPrices: (refresh = false) => request<FuelPrices>(`/api/stations/fuel-prices?refresh=${refresh}`),

  services: () => request<ServiceItem[]>("/api/stations/services"),

  quote: (body: Record<string, unknown>) => post<Quote>("/api/quote", body),

  createOrder: (body: Record<string, unknown>) => post<Order>("/api/orders", body),

  orders: () => request<Order[]>("/api/orders"),

  activeOrder: () => request<Order | null>("/api/orders/active"),

  availableJobs: () => request<Order[]>("/api/orders/available"),

  offers: () => request<Order[]>("/api/orders/offers"),

  order: (id: number) => request<Order>(`/api/orders/${id}`),

  acceptOrder: (id: number) => post<Order>(`/api/orders/${id}/accept`),

  rejectOrder: (id: number) => post<Order>(`/api/orders/${id}/reject`),

  setOrderStatus: (id: number, status: OrderStatus, handoverCode?: string, sealId?: string) =>
    request<Order>(`/api/orders/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({
        status,
        handover_code: handoverCode ?? null,
        seal_id: sealId ?? null,
      }),
    }),

  rateOrder: (id: number, rating: number) => post<Order>(`/api/orders/${id}/rate`, { rating }),

  pushLocation: (lat: number, lng: number) =>
    post<void>("/api/supplier/location", { lat, lng }),

  setOnline: (is_online: boolean) => post<void>("/api/supplier/online", { is_online }),

  supplierSummary: () => request<SupplierSummary>("/api/supplier/summary"),

  supplierContainers: () =>
    request<{ containers: SealedContainer[] }>("/api/supplier/containers"),

  disputes: () => request<Dispute[]>("/api/disputes"),

  replyToDispute: (disputeId: number, body: string) =>
    post<Dispute>(`/api/disputes/${disputeId}/messages`, { body }),

  setDisputeStatus: (disputeId: number, status: "resolved" | "closed") =>
    request<Dispute>(`/api/disputes/${disputeId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  demoDrive: (orderId: number) =>
    post<{ lat: number; lng: number; remaining_km: number }>(
      `/api/supplier/demo-drive/${orderId}`,
    ),

  paymentMethods: () => request<PaymentMethod[]>("/api/payments/methods"),

  initiatePayment: (order_id: number, method: string, payer_phone?: string) =>
    post<Payment>("/api/payments/initiate", { order_id, method, payer_phone }),

  paymentStatus: (orderId: number) => request<Payment>(`/api/payments/${orderId}/status`),

  staffLogin: (phone_number: string, password: string) =>
    post<StaffToken>("/api/staff/login", { phone_number, password }),

  staffMe: () => request<Staff>("/api/staff/me"),

  staffShift: (shift_state: string) =>
    request<Staff>("/api/staff/shift", { method: "PATCH", body: JSON.stringify({ shift_state }) }),

  staffJobs: () => request<Order[]>("/api/staff/jobs"),

  staffOrder: (id: number) => request<Order>(`/api/staff/order/${id}`),

  staffSetOrderStatus: (id: number, status: OrderStatus, handoverCode?: string, sealId?: string) =>
    request<Order>(`/api/staff/orders/${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        status,
        handover_code: handoverCode ?? null,
        seal_id: sealId ?? null,
      }),
    }),

  supplierStaff: () => request<Staff[]>("/api/supplier/staff"),

  supplierAddStaff: (body: Record<string, unknown>) => post<Staff>("/api/supplier/staff", body),

  supplierSetStaffActive: (id: number, is_active: boolean) =>
    request<Staff>(`/api/supplier/staff/${id}/active`, {
      method: "PATCH",
      body: JSON.stringify({ is_active }),
    }),

  supplierUpdateStaff: (id: number, body: Record<string, unknown>) =>
    request<Staff>(`/api/supplier/staff/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  supplierDeleteStaff: (id: number) =>
    request<void>(`/api/supplier/staff/${id}`, { method: "DELETE" }),

  listBids: (orderId: number) => request<Bid[]>(`/api/orders/${orderId}/bids`),

  placeBid: (orderId: number, proposed_amount: number, note?: string) =>
    request<Bid>(`/api/orders/${orderId}/bids`, {
      method: "POST",
      body: JSON.stringify({ proposed_amount, note: note || null }),
    }),

  acceptBid: (orderId: number, bidId: number) =>
    request<Order>(`/api/orders/${orderId}/bids/${bidId}/accept`, {
      method: "POST",
    }),

  pendingRequests: () => request<Order[]>("/api/supplier/pending-requests"),
};

export function trackOrder(orderId: number, onFrame: (frame: TrackingFrame) => void): () => void {
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let stopped = false;

  const poll = async () => {
    if (stopped) return;
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/api/orders/${orderId}/poll`, {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (!res.ok) return;
      const frame = (await res.json()) as TrackingFrame;
      onFrame(frame);
      if (frame.status === "delivered" || frame.status === "cancelled") {
        if (pollTimer) clearInterval(pollTimer);
      }
    } catch {
      /* transient network error */
    }
  };

  void poll();
  pollTimer = setInterval(poll, 3000);

  return () => {
    stopped = true;
    if (pollTimer) clearInterval(pollTimer);
  };
}
