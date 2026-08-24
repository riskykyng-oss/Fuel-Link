import { supabase } from "./supabase";

const SERVICES = [
  { id: "fuel", name: "Fuel delivery", blurb: "Run out of fuel? We bring it to you.", icon: "nozzle", unit: "litre", callout_fee: 0 },
  { id: "towing", name: "Towing", blurb: "Vehicle recovery and towing.", icon: "tow", unit: "trip", callout_fee: 25 },
  { id: "jump_start", name: "Jump start", blurb: "Dead battery? We'll get you going.", icon: "battery", unit: "job", callout_fee: 8 },
  { id: "tyre_change", name: "Tyre change", blurb: "Flat tyre replacement.", icon: "tyre", unit: "job", callout_fee: 10 },
  { id: "lockout", name: "Lockout assistance", blurb: "Locked keys in the car?", icon: "key", unit: "job", callout_fee: 12 },
  { id: "mechanic", name: "Roadside mechanic", blurb: "On-site mechanical diagnosis.", icon: "wrench", unit: "job", callout_fee: 15 },
] as const;

const PAYMENT_METHODS = [
  { id: "ecocash", name: "EcoCash", kind: "mobile_money", requires_phone: true, prefixes: ["077", "078"], note: "You will get a PIN prompt on your handset.", live: false },
  { id: "onemoney", name: "OneMoney", kind: "mobile_money", requires_phone: true, prefixes: ["071"], note: "You will get a PIN prompt on your handset.", live: false },
  { id: "innbucks", name: "InnBucks", kind: "mobile_money", requires_phone: true, prefixes: ["078", "077", "071"], note: "Approve the collection in your InnBucks app.", live: false },
  { id: "zipit", name: "Card / ZIPIT", kind: "redirect", requires_phone: false, prefixes: [], note: "Opens the secure Paynow checkout page.", live: false },
];

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = 6371.0088;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(a));
}

function roadDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  return Math.round(haversineKm(lat1, lng1, lat2, lng2) * 1.35 * 100) / 100;
}

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

function phoneToEmail(phone: string): string {
  const digits = normalizePhone(phone).replace(/\D/g, "");
  return `${digits}@fuellink.auth`;
}

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
  health: async () => {
    try { await supabase.from("stations").select("id").limit(1); return { status: "ok", payments_mode: "mock" as string }; }
    catch { return { status: "error", payments_mode: "mock" as string }; }
  },

  login: async (phone_number: string, password: string, role?: Role): Promise<AuthResponse> => {
    const email = phoneToEmail(phone_number);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
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
    const email = phoneToEmail(body.phone_number as string);
    const { full_name, password } = body;

    const { data, error } = await supabase.auth.signUp({
      email,
      password: password as string,
      options: { data: { full_name, role: "customer", phone_number: phone } },
    });
    if (error) throw new ApiError(error.message, 400);

    if (data.session && data.user) {
      const { error: insertError } = await supabase.from("users").insert({
        auth_id: data.user.id,
        full_name,
        phone_number: phone,
        email: email,
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
        email,
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
    const email = phoneToEmail(body.phone_number as string);
    const { full_name, password, company_name, zera_licence_number,
      vehicle_registration, tanker_capacity_litres, services_offered } = body as Record<string, unknown>;

    const { data, error } = await supabase.auth.signUp({
      email,
      password: password as string,
      options: { data: { full_name, role: "supplier", phone_number: phone } },
    });
    if (error) throw new ApiError(error.message, 400);

    if (data.session && data.user) {
      const { error: insertError } = await supabase.from("users").insert({
        auth_id: data.user.id,
        full_name,
        phone_number: phone,
        email,
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
        email,
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

  setTheme: async (theme: string): Promise<User> => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) throw new ApiError("Not authenticated", 401);
    await supabase.from("users").update({ theme }).eq("auth_id", authUser.id);
    return fetchUserProfile(authUser.id);
  },

  updateSupplierProfile: async (body: Record<string, unknown>): Promise<User> => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) throw new ApiError("Not authenticated", 401);
    const { data: profile } = await supabase.from("users").select("id").eq("auth_id", authUser.id).single();
    if (!profile) throw new ApiError("Profile not found", 404);
    await supabase.from("supplier_profiles").update(body).eq("user_id", profile.id);
    return fetchUserProfile(authUser.id);
  },

  requestCode: async (phone_number: string, _purpose: "signup" | "reset"): Promise<CodeRequestResponse> => {
    const email = phoneToEmail(phone_number);
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) throw new ApiError(error.message, 400);
    return { message: "Code sent", lifetime_s: 300, resend_after_s: 60, dev_code: null };
  },

  verifyCode: async (phone_number: string, code: string, purpose: "signup" | "reset"): Promise<CodeVerifyResponse> => {
    const email = phoneToEmail(phone_number);
    const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
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

  coverage: async (lat: number, lng: number): Promise<Coverage> => {
    const { data: stations } = await supabase.from("stations").select("*");
    const results = (stations || []).map((s) => ({
      ...s,
      distance_km: roadDistanceKm(lat, lng, s.lat, s.lng),
    }));
    results.sort((a, b) => a.distance_km - b.distance_km);
    const covered = results.some((s) => s.distance_km <= 15);
    const nearest = results[0];
    return {
      covered,
      message: covered ? "FuelLink covers your area" : "You are outside our coverage zone",
      est_response_min: nearest ? Math.round(nearest.distance_km / 32 * 60 + 6) : null,
      stations: results.slice(0, 5),
    };
  },

  vehicles: async (): Promise<Vehicle[]> => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return [];
    const { data: profile } = await supabase.from("users").select("id").eq("auth_id", authUser.id).single();
    if (!profile) return [];
    const { data } = await supabase.from("vehicles").select("*").eq("owner_id", profile.id);
    return data || [];
  },

  createVehicle: async (body: Record<string, unknown>): Promise<Vehicle> => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) throw new ApiError("Not authenticated", 401);
    const { data: profile } = await supabase.from("users").select("id").eq("auth_id", authUser.id).single();
    if (!profile) throw new ApiError("Profile not found", 404);
    if (body.is_default) {
      await supabase.from("vehicles").update({ is_default: false }).eq("owner_id", profile.id);
    }
    const { data, error } = await supabase.from("vehicles").insert({
      owner_id: profile.id,
      make: body.make,
      model: body.model,
      plate_number: body.plate_number,
      fuel_type: body.fuel_type || "petrol",
      tank_capacity_litres: body.tank_capacity_litres || 50,
      is_default: body.is_default ?? true,
    }).select().single();
    if (error) throw new ApiError(error.message, 400);
    return data;
  },

  updateVehicle: async (id: number, body: Record<string, unknown>): Promise<Vehicle> => {
    const { data, error } = await supabase.from("vehicles").update(body).eq("id", id).select().single();
    if (error) throw new ApiError(error.message, 400);
    return data;
  },

  deleteVehicle: async (id: number): Promise<void> => {
    await supabase.from("vehicles").delete().eq("id", id);
  },

  stationsNearby: async (lat: number, lng: number, fuelType?: string): Promise<Station[]> => {
    const { data: stations } = await supabase.from("stations").select("*");
    let results = (stations || []).map((s) => ({
      ...s,
      distance_km: roadDistanceKm(lat, lng, s.lat, s.lng),
    }));
    if (fuelType === "petrol") results = results.filter((s) => s.has_petrol);
    else if (fuelType === "diesel") results = results.filter((s) => s.has_diesel);
    results.sort((a, b) => a.distance_km - b.distance_km);
    return results.slice(0, 20);
  },

  fuelPrices: async (_refresh = false): Promise<FuelPrices> => {
    const { data: cached } = await supabase
      .from("price_snapshots").select("*").order("fetched_at", { ascending: false }).limit(1).maybeSingle();
    if (cached) return cached;
    return { petrol_price: 1.57, diesel_price: 1.54, currency: "USD", source: "Fallback", source_url: null, is_live: false, effective_period: "", fetched_at: new Date().toISOString() };
  },

  services: (): Promise<ServiceItem[]> => Promise.resolve(SERVICES as unknown as ServiceItem[]),

  quote: async (body: Record<string, unknown>): Promise<Quote> => {
    const lat = body.lat as number, lng = body.lng as number, serviceType = (body.service_type as string) || "fuel";
    const { data: stations } = await supabase.from("stations").select("*");
    let stationList = (stations || []).map((s) => ({ ...s, distance_km: roadDistanceKm(lat, lng, s.lat, s.lng) }));
    stationList.sort((a, b) => a.distance_km - b.distance_km);
    const station = stationList[0] || null;
    const distance_km = station?.distance_km || 0;
    const eta_minutes = Math.round(distance_km / 32 * 60 + 6);
    const unit_price = serviceType === "fuel" ? (station?.petrol_price || 1.57) : 0;
    const quantity = (body.quantity_litres as number) || 20;
    const fuel_cost = serviceType === "fuel" ? unit_price * quantity : 0;
    const delivery_fee = Math.round(distance_km * 2 * 100) / 100;
    const service_fee = SERVICES.find((s) => s.id === serviceType)?.callout_fee || 0;
    return {
      distance_km, unit_price, fuel_cost, delivery_fee, service_fee,
      total_amount: Math.round((fuel_cost + delivery_fee + service_fee) * 100) / 100,
      eta_minutes, currency: "USD",
      breakdown_note: serviceType === "fuel" ? `${quantity}L × $${unit_price}/L` : "",
      station, coverage: distance_km <= 50,
      providers: [], nearest_stations: stationList.slice(0, 5),
    };
  },

  createOrder: async (body: Record<string, unknown>): Promise<Order> => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) throw new ApiError("Not authenticated", 401);
    const { data: profile } = await supabase.from("users").select("id").eq("auth_id", authUser.id).single();
    if (!profile) throw new ApiError("Profile not found", 404);
    const ref = "FL-" + Math.random().toString(36).slice(2, 8).toUpperCase();
    const code = String(Math.floor(1000 + Math.random() * 9000));
    const { data, error } = await supabase.from("orders").insert({
      reference: ref,
      customer_id: profile.id,
      service_type: body.service_type || "fuel",
      fuel_type: body.fuel_type || null,
      quantity_litres: body.quantity_litres || 0,
      pickup_lat: body.pickup_lat,
      pickup_lng: body.pickup_lng,
      pickup_address: body.pickup_address || "Dropped pin",
      notes: body.notes || null,
      distance_km: body.distance_km || 0,
      fuel_cost: body.fuel_cost || 0,
      delivery_fee: body.delivery_fee || 0,
      service_fee: body.service_fee || 0,
      total_amount: body.total_amount || 0,
      vehicle_id: body.vehicle_id || null,
      status: "pending",
      handover_code: code,
    }).select(`*, customer:users!orders_customer_id_fkey(id, full_name, phone_number), supplier:users!orders_supplier_id_fkey(id, full_name, phone_number), station:stations(*)`).single();
    if (error) throw new ApiError(error.message, 400);
    return data;
  },

  orders: async (): Promise<Order[]> => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return [];
    const { data: profile } = await supabase.from("users").select("id").eq("auth_id", authUser.id).single();
    if (!profile) return [];
    const { data } = await supabase.from("orders").select(`*, customer:users!orders_customer_id_fkey(id, full_name, phone_number), supplier:users!orders_supplier_id_fkey(id, full_name, phone_number), station:stations(*)`).eq("customer_id", profile.id).order("created_at", { ascending: false });
    return data || [];
  },

  activeOrder: async (): Promise<Order | null> => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return null;
    const { data: profile } = await supabase.from("users").select("id").eq("auth_id", authUser.id).single();
    if (!profile) return null;
    const ACTIVE = ["pending", "bidding", "offered", "accepted", "in_transit", "arrived"];
    const { data } = await supabase.from("orders").select(`*, customer:users!orders_customer_id_fkey(id, full_name, phone_number), supplier:users!orders_supplier_id_fkey(id, full_name, phone_number), station:stations(*)`).eq("customer_id", profile.id).in("status", ACTIVE).order("created_at", { ascending: false }).limit(1).maybeSingle();
    return data || null;
  },

  availableJobs: async (): Promise<Order[]> => {
    const { data } = await supabase.from("orders").select(`*, customer:users!orders_customer_id_fkey(id, full_name, phone_number), supplier:users!orders_supplier_id_fkey(id, full_name, phone_number), station:stations(*)`).eq("status", "pending").order("created_at", { ascending: false });
    return data || [];
  },

  offers: async (): Promise<Order[]> => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return [];
    const { data: profile } = await supabase.from("users").select("id").eq("auth_id", authUser.id).single();
    if (!profile) return [];
    const { data } = await supabase.from("orders").select(`*, customer:users!orders_customer_id_fkey(id, full_name, phone_number), supplier:users!orders_supplier_id_fkey(id, full_name, phone_number), station:stations(*)`).eq("offered_supplier_id", profile.id).in("status", ["offered", "pending"]).order("created_at", { ascending: false });
    return data || [];
  },

  order: async (id: number): Promise<Order> => {
    const { data, error } = await supabase.from("orders").select(`*, customer:users!orders_customer_id_fkey(id, full_name, phone_number), supplier:users!orders_supplier_id_fkey(id, full_name, phone_number), station:stations(*)`).eq("id", id).single();
    if (error || !data) throw new ApiError("Order not found", 404);
    return data;
  },

  acceptOrder: async (id: number): Promise<Order> => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) throw new ApiError("Not authenticated", 401);
    const { data: profile } = await supabase.from("users").select("id").eq("auth_id", authUser.id).single();
    if (!profile) throw new ApiError("Profile not found", 404);
    const { data, error } = await supabase.from("orders").update({ supplier_id: profile.id, status: "accepted", accepted_at: new Date().toISOString() }).eq("id", id).select(`*, customer:users!orders_customer_id_fkey(id, full_name, phone_number), supplier:users!orders_supplier_id_fkey(id, full_name, phone_number), station:stations(*)`).single();
    if (error) throw new ApiError(error.message, 400);
    return data;
  },

  rejectOrder: async (id: number): Promise<Order> => {
    const { data, error } = await supabase.from("orders").update({ status: "declined" }).eq("id", id).select(`*, customer:users!orders_customer_id_fkey(id, full_name, phone_number), supplier:users!orders_supplier_id_fkey(id, full_name, phone_number), station:stations(*)`).single();
    if (error) throw new ApiError(error.message, 400);
    return data;
  },

  setOrderStatus: async (id: number, status: OrderStatus, handoverCode?: string, sealId?: string): Promise<Order> => {
    const update: Record<string, unknown> = { status };
    if (handoverCode) update.handover_code = handoverCode;
    if (sealId) update.seal_id = sealId;
    if (status === "delivered") update.delivered_at = new Date().toISOString();
    if (status === "in_transit") update.seal_dispatched_at = new Date().toISOString();
    if (status === "arrived") update.seal_arrived_at = new Date().toISOString();
    const { data, error } = await supabase.from("orders").update(update).eq("id", id).select(`*, customer:users!orders_customer_id_fkey(id, full_name, phone_number), supplier:users!orders_supplier_id_fkey(id, full_name, phone_number), station:stations(*)`).single();
    if (error) throw new ApiError(error.message, 400);
    return data;
  },

  rateOrder: async (id: number, rating: number): Promise<Order> => {
    const { data, error } = await supabase.from("orders").update({ rating }).eq("id", id).select(`*, customer:users!orders_customer_id_fkey(id, full_name, phone_number), supplier:users!orders_supplier_id_fkey(id, full_name, phone_number), station:stations(*)`).single();
    if (error) throw new ApiError(error.message, 400);
    return data;
  },

  pushLocation: async (lat: number, lng: number): Promise<void> => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return;
    const { data: profile } = await supabase.from("users").select("id").eq("auth_id", authUser.id).single();
    if (!profile) return;
    await supabase.from("supplier_profiles").update({ current_lat: lat, current_lng: lng, location_updated_at: new Date().toISOString() }).eq("user_id", profile.id);
  },

  setOnline: async (is_online: boolean): Promise<void> => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return;
    const { data: profile } = await supabase.from("users").select("id").eq("auth_id", authUser.id).single();
    if (!profile) return;
    await supabase.from("supplier_profiles").update({ is_online }).eq("user_id", profile.id);
  },

  supplierSummary: async (): Promise<SupplierSummary> => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) throw new ApiError("Not authenticated", 401);
    const { data: profile } = await supabase.from("users").select("id").eq("auth_id", authUser.id).single();
    if (!profile) throw new ApiError("Profile not found", 404);
    const { data: sp } = await supabase.from("supplier_profiles").select("*").eq("user_id", profile.id).single();
    const { data: snapshot } = await supabase.from("price_snapshots").select("petrol_price, diesel_price, fetched_at, is_live").order("fetched_at", { ascending: false }).limit(1).maybeSingle();
    const { data: todayOrders } = await supabase.from("orders").select("total_amount, quantity_litres").eq("supplier_id", profile.id).eq("status", "delivered").gte("delivered_at", new Date().toISOString().slice(0, 10));
    const earningsToday = (todayOrders || []).reduce((s, o) => s + (o.total_amount || 0), 0);
    const litresDelivered = (todayOrders || []).reduce((s, o) => s + (o.quantity_litres || 0), 0);
    return {
      is_online: sp?.is_online || false, is_verified: sp?.is_verified || false,
      rating: sp?.rating || 5.0, completed_jobs: sp?.completed_jobs || 0,
      total_earnings: sp?.total_earnings || 0, earnings_today: Math.round(earningsToday * 100) / 100,
      litres_delivered: litresDelivered,
      fuel_stock_petrol: sp?.fuel_stock_petrol || 0, fuel_stock_diesel: sp?.fuel_stock_diesel || 0,
      tanker_capacity_litres: sp?.tanker_capacity_litres || 200, response_rate: 100,
      open_requests: 0,
      petrol_price: snapshot?.petrol_price || 1.57, diesel_price: snapshot?.diesel_price || 1.54,
      cap_petrol: snapshot?.petrol_price || 1.57, cap_diesel: snapshot?.diesel_price || 1.54,
      price_verified_at: snapshot?.fetched_at || null, price_is_live: snapshot?.is_live || false,
      staff_on_shift: 0, staff_available: 0,
      containers_ready: 0, containers_in_use: 0, containers_total: 0,
      payout_held: 0, payout_released: 0, payout_disputed: 0, disputes_open: 0,
    };
  },

  supplierContainers: async (): Promise<{ containers: SealedContainer[] }> => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return { containers: [] };
    const { data: profile } = await supabase.from("users").select("id").eq("auth_id", authUser.id).single();
    if (!profile) return { containers: [] };
    const { data } = await supabase.from("sealed_containers").select("serial, capacity_litres, status").eq("provider_id", profile.id);
    return { containers: (data || []) as SealedContainer[] };
  },

  addContainer: async (serial: string, capacityLitres: number): Promise<void> => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) throw new ApiError("Not authenticated", 401);
    const { data: profile } = await supabase.from("users").select("id").eq("auth_id", authUser.id).single();
    if (!profile) throw new ApiError("Profile not found", 404);
    const { error } = await supabase.from("sealed_containers").insert({
      provider_id: profile.id,
      serial,
      capacity_litres: capacityLitres,
      status: "available",
    });
    if (error) throw new ApiError(error.message, 400);
  },

  deleteContainer: async (serial: string): Promise<void> => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) throw new ApiError("Not authenticated", 401);
    const { data: profile } = await supabase.from("users").select("id").eq("auth_id", authUser.id).single();
    if (!profile) throw new ApiError("Profile not found", 404);
    const { error } = await supabase.from("sealed_containers").delete()
      .eq("provider_id", profile.id)
      .eq("serial", serial);
    if (error) throw new ApiError(error.message, 400);
  },

  disputes: async (): Promise<Dispute[]> => {
    const { data } = await supabase.from("disputes").select("*, order:orders(reference)").order("created_at", { ascending: false });
    return (data || []).map((d) => ({ ...d, reference: d.order?.reference || null, messages: [] }));
  },

  replyToDispute: async (disputeId: number, body: string): Promise<Dispute> => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) throw new ApiError("Not authenticated", 401);
    const { data: profile } = await supabase.from("users").select("id").eq("auth_id", authUser.id).single();
    if (!profile) throw new ApiError("Profile not found", 404);
    await supabase.from("dispute_messages").insert({ dispute_id: disputeId, sender_id: profile.id, body });
    const { data } = await supabase.from("disputes").select("*").eq("id", disputeId).single();
    return { ...data, messages: [] };
  },

  setDisputeStatus: async (disputeId: number, status: "resolved" | "closed"): Promise<Dispute> => {
    const { data, error } = await supabase.from("disputes").update({ status, resolved_at: status === "resolved" ? new Date().toISOString() : null }).eq("id", disputeId).select().single();
    if (error) throw new ApiError(error.message, 400);
    return { ...data, messages: [] };
  },

  demoDrive: async (orderId: number): Promise<{ lat: number; lng: number; remaining_km: number }> => {
    const { data: order } = await supabase.from("orders").select("pickup_lat, pickup_lng").eq("id", orderId).single();
    return { lat: order?.pickup_lat || -17.8, lng: order?.pickup_lng || 31.0, remaining_km: 5.0 };
  },

  paymentMethods: (): Promise<PaymentMethod[]> => Promise.resolve(PAYMENT_METHODS as unknown as PaymentMethod[]),

  initiatePayment: async (order_id: number, method: string, payer_phone?: string): Promise<Payment> => {
    const { data, error } = await supabase.from("payments").insert({
      order_id, method, amount: 0, status: "initiated",
      instructions: `Pay via ${method}. Reference: FL-${order_id}`,
      provider_reference: payer_phone || null,
    }).select().single();
    if (error) throw new ApiError(error.message, 400);
    return data;
  },

  paymentStatus: async (orderId: number): Promise<Payment> => {
    const { data, error } = await supabase.from("payments").select("*").eq("order_id", orderId).single();
    if (error || !data) throw new ApiError("Payment not found", 404);
    return data;
  },

  staffLogin: async (phone_number: string, password: string): Promise<StaffToken> => {
    const email = phoneToEmail(phone_number);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new ApiError("Invalid credentials", 401);
    const { data: staff } = await supabase.from("staff").select("*").eq("auth_id", data.user.id).single();
    if (!staff) throw new ApiError("Staff profile not found", 404);
    return { access_token: data.session.access_token, token_type: "bearer", staff };
  },

  staffMe: async (): Promise<Staff> => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) throw new ApiError("Not authenticated", 401);
    const { data: staff } = await supabase.from("staff").select("*").eq("auth_id", authUser.id).single();
    if (!staff) throw new ApiError("Staff not found", 404);
    return staff;
  },

  staffShift: async (shift_state: string): Promise<Staff> => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) throw new ApiError("Not authenticated", 401);
    const { data, error } = await supabase.from("staff").update({ shift_state }).eq("auth_id", authUser.id).select().single();
    if (error) throw new ApiError(error.message, 400);
    return data;
  },

  staffJobs: async (): Promise<Order[]> => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return [];
    const { data: staff } = await supabase.from("staff").select("id").eq("auth_id", authUser.id).single();
    if (!staff) return [];
    const { data } = await supabase.from("orders").select(`*, customer:users!orders_customer_id_fkey(id, full_name, phone_number), supplier:users!orders_supplier_id_fkey(id, full_name, phone_number), station:stations(*)`).eq("staff_id", staff.id).in("status", ["accepted", "in_transit", "arrived"]).order("created_at", { ascending: false });
    return data || [];
  },

  staffOrder: async (id: number): Promise<Order> => {
    const { data, error } = await supabase.from("orders").select(`*, customer:users!orders_customer_id_fkey(id, full_name, phone_number), supplier:users!orders_supplier_id_fkey(id, full_name, phone_number), station:stations(*)`).eq("id", id).single();
    if (error || !data) throw new ApiError("Order not found", 404);
    return data;
  },

  staffSetOrderStatus: async (id: number, status: OrderStatus, handoverCode?: string, sealId?: string): Promise<Order> => {
    return api.setOrderStatus(id, status, handoverCode, sealId);
  },

  supplierStaff: async (): Promise<Staff[]> => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return [];
    const { data: profile } = await supabase.from("users").select("id").eq("auth_id", authUser.id).single();
    if (!profile) return [];
    const { data } = await supabase.from("staff").select("*").eq("provider_id", profile.id);
    return data || [];
  },

  supplierAddStaff: async (body: Record<string, unknown>): Promise<Staff> => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) throw new ApiError("Not authenticated", 401);
    const { data: profile } = await supabase.from("users").select("id").eq("auth_id", authUser.id).single();
    if (!profile) throw new ApiError("Profile not found", 404);
    const staffId = "STF" + String(Math.floor(Math.random() * 9999)).padStart(4, "0");
    const { data, error } = await supabase.from("staff").insert({
      provider_id: profile.id, full_name: body.full_name, phone_number: body.phone_number,
      staff_id: staffId, hashed_password: "supabase-managed", role_label: body.role_label || "courier",
      shift_state: "offline", is_active: true,
    }).select().single();
    if (error) throw new ApiError(error.message, 400);
    return data;
  },

  supplierSetStaffActive: async (id: number, is_active: boolean): Promise<Staff> => {
    const { data, error } = await supabase.from("staff").update({ is_active }).eq("id", id).select().single();
    if (error) throw new ApiError(error.message, 400);
    return data;
  },

  supplierUpdateStaff: async (id: number, body: Record<string, unknown>): Promise<Staff> => {
    const { data, error } = await supabase.from("staff").update(body).eq("id", id).select().single();
    if (error) throw new ApiError(error.message, 400);
    return data;
  },

  supplierDeleteStaff: async (id: number): Promise<void> => {
    await supabase.from("staff").delete().eq("id", id);
  },

  listBids: async (orderId: number): Promise<Bid[]> => {
    const { data } = await supabase.from("bids").select("*, supplier:users!bids_supplier_id_fkey(full_name, supplier_profiles(company_name, is_verified, rating))").eq("order_id", orderId).order("created_at", { ascending: false });
    return (data || []).map((b) => ({
      ...b,
      supplier_name: b.supplier?.full_name || null,
      supplier_company: b.supplier?.supplier_profiles?.company_name || null,
      supplier_verified: b.supplier?.supplier_profiles?.is_verified || false,
      supplier_rating: b.supplier?.supplier_profiles?.rating || null,
    }));
  },

  placeBid: async (orderId: number, proposed_amount: number, note?: string): Promise<Bid> => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) throw new ApiError("Not authenticated", 401);
    const { data: profile } = await supabase.from("users").select("id").eq("auth_id", authUser.id).single();
    if (!profile) throw new ApiError("Profile not found", 404);
    const { data, error } = await supabase.from("bids").insert({
      order_id: orderId, supplier_id: profile.id, proposed_amount, note: note || null,
    }).select().single();
    if (error) throw new ApiError(error.message, 400);
    return { ...data, supplier_name: null, supplier_company: null, supplier_verified: false, supplier_rating: null };
  },

  acceptBid: async (orderId: number, bidId: number): Promise<Order> => {
    const { data: bid } = await supabase.from("bids").select("*").eq("id", bidId).single();
    if (!bid) throw new ApiError("Bid not found", 404);
    const { data, error } = await supabase.from("orders").update({ supplier_id: bid.supplier_id, total_amount: bid.proposed_amount, status: "accepted", accepted_at: new Date().toISOString() }).eq("id", orderId).select(`*, customer:users!orders_customer_id_fkey(id, full_name, phone_number), supplier:users!orders_supplier_id_fkey(id, full_name, phone_number), station:stations(*)`).single();
    if (error) throw new ApiError(error.message, 400);
    return data;
  },

  pendingRequests: async (): Promise<Order[]> => {
    const { data } = await supabase.from("orders").select(`*, customer:users!orders_customer_id_fkey(id, full_name, phone_number), supplier:users!orders_supplier_id_fkey(id, full_name, phone_number), station:stations(*)`).in("status", ["pending", "offered"]).order("created_at", { ascending: false });
    return data || [];
  },
};

export function trackOrder(orderId: number, onFrame: (frame: TrackingFrame) => void): () => void {
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let stopped = false;

  const poll = async () => {
    if (stopped) return;
    try {
      const { data } = await supabase
        .from("orders")
        .select("id, reference, status, supplier_id, pickup_lat, pickup_lng, eta_minutes, handover_code, provider_staff_id")
        .eq("id", orderId)
        .single();
      if (!data) return;
      const { data: supplierProfile } = await supabase
        .from("supplier_profiles").select("current_lat, current_lng, is_verified").eq("user_id", data.supplier_id || 0).maybeSingle();
      const { data: supplierUser } = data.supplier_id
        ? await supabase.from("users").select("full_name, phone_number").eq("id", data.supplier_id).single()
        : { data: null };
      const remaining_km = supplierProfile?.current_lat && data.pickup_lat
        ? roadDistanceKm(supplierProfile.current_lat, supplierProfile.current_lng, data.pickup_lat, data.pickup_lng) : 0;
      onFrame({
        order_id: data.id, reference: data.reference, status: data.status as OrderStatus,
        payment_status: null,
        supplier_lat: supplierProfile?.current_lat || null, supplier_lng: supplierProfile?.current_lng || null,
        pickup_lat: data.pickup_lat || 0, pickup_lng: data.pickup_lng || 0,
        remaining_km, eta_minutes: data.eta_minutes || 0,
        supplier_name: supplierUser?.full_name ?? null,
        supplier_phone: supplierUser?.phone_number ?? null,
        provider_verified: supplierProfile?.is_verified ?? false,
        provider_staff_id: data.provider_staff_id, handover_code: data.handover_code,
      });
      if (data.status === "delivered" || data.status === "cancelled") {
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
