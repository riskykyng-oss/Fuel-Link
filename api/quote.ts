import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../_lib/supabase.js";
import { handleError } from "../_lib/auth.js";
import { roadDistanceKm, etaMinutes } from "../_lib/geo.js";

const DELIVERY_RATE = 3.0;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ detail: "Method not allowed" });

  try {
    const { pickup_lat, pickup_lng, fuel_type, quantity_litres, station_id, service_type } = req.body;
    if (!pickup_lat || !pickup_lng) {
      return res.status(400).json({ detail: "pickup_lat and pickup_lng required" });
    }

    const { data: stations } = await supabaseAdmin.from("stations").select("*");
    const { data: snapshot } = await supabaseAdmin
      .from("price_snapshots")
      .select("*")
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const unitPrice = snapshot
      ? ((fuel_type || "").toLowerCase() === "diesel" ? snapshot.diesel_price : snapshot.petrol_price)
      : 1.57;

    const litres = quantity_litres || 20;
    const fuelCost = Math.round(unitPrice * litres * 100) / 100;

    let selectedStation: any = null;
    let distanceKm = 0;

    if (station_id) {
      selectedStation = (stations || []).find((s: any) => s.id === station_id);
    }
    if (!selectedStation) {
      const ranked = (stations || [])
        .filter((s: any) => s.has_petrol || s.has_diesel)
        .map((s: any) => ({ ...s, distance_km: roadDistanceKm(pickup_lat, pickup_lng, s.lat, s.lng) }))
        .sort((a: any, b: any) => a.distance_km - b.distance_km);
      selectedStation = ranked[0] || null;
    }

    if (selectedStation) {
      distanceKm = selectedStation.distance_km;
    }

    const deliveryFee = Math.round(distanceKm * DELIVERY_RATE * 100) / 100;
    const eta = etaMinutes(distanceKm);
    const serviceFee = 0;
    const totalAmount = Math.round((fuelCost + deliveryFee + serviceFee) * 100) / 100;

    const { data: suppliers } = await supabaseAdmin
      .from("supplier_profiles")
      .select("*, user:users!supplier_profiles_user_id_fkey(id, full_name)")
      .eq("is_verified", true)
      .eq("is_online", true);

    const providers = (suppliers || [])
      .filter((sp: any) => sp.current_lat && sp.current_lng)
      .map((sp: any) => ({
        provider_id: sp.user_id,
        name: sp.company_name,
        distance_km: roadDistanceKm(pickup_lat, pickup_lng, sp.current_lat, sp.current_lng),
        eta_minutes: etaMinutes(roadDistanceKm(pickup_lat, pickup_lng, sp.current_lat, sp.current_lng)),
        is_verified: sp.is_verified,
        rating: sp.rating,
      }))
      .sort((a: any, b: any) => a.distance_km - b.distance_km)
      .slice(0, 5);

    const nearest = (stations || [])
      .map((s: any) => ({ ...s, distance_km: roadDistanceKm(pickup_lat, pickup_lng, s.lat, s.lng) }))
      .sort((a: any, b: any) => a.distance_km - b.distance_km)
      .slice(0, 3);

    return res.status(200).json({
      distance_km: distanceKm,
      unit_price: unitPrice,
      fuel_cost: fuelCost,
      delivery_fee: deliveryFee,
      service_fee: serviceFee,
      total_amount: totalAmount,
      eta_minutes: eta,
      currency: "USD",
      breakdown_note: `${litres}L × $${unitPrice.toFixed(2)} + ${distanceKm}km delivery`,
      station: selectedStation,
      coverage: !!selectedStation,
      providers,
      nearest_stations: nearest,
    });
  } catch (err) {
    return handleError(res, err);
  }
}
