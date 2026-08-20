import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../_lib/supabase.js";
import { requireAuth, handleError, ApiError } from "../_lib/auth.js";
import { roadDistanceKm } from "../_lib/geo.js";

const SIM_STEP_KM = 0.5;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ detail: "Method not allowed" });

  try {
    const auth = await requireAuth(req);
    const orderId = Number(req.query.id);
    if (!orderId) throw new ApiError("Invalid order ID", 400);

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, supplier_id, pickup_lat, pickup_lng, distance_km")
      .eq("id", orderId)
      .single();
    if (!order) throw new ApiError("Order not found", 404);

    const { data: profile } = await supabaseAdmin
      .from("supplier_profiles")
      .select("current_lat, current_lng")
      .eq("user_id", order.supplier_id)
      .single();

    if (!profile?.current_lat || !profile?.current_lng) {
      throw new ApiError("No supplier location", 400);
    }

    const totalDist = order.distance_km || roadDistanceKm(
      profile.current_lat, profile.current_lng, order.pickup_lat, order.pickup_lng,
    );
    const fraction = Math.min(SIM_STEP_KM / Math.max(totalDist, 0.1), 1.0);
    const newLat = profile.current_lat + (order.pickup_lat - profile.current_lat) * fraction;
    const newLng = profile.current_lng + (order.pickup_lng - profile.current_lng) * fraction;
    const remaining = roadDistanceKm(newLat, newLng, order.pickup_lat, order.pickup_lng);

    await supabaseAdmin
      .from("supplier_profiles")
      .update({ current_lat: newLat, current_lng: newLng, location_updated_at: new Date().toISOString() })
      .eq("user_id", order.supplier_id);

    return res.status(200).json({ lat: newLat, lng: newLng, remaining_km: remaining });
  } catch (err) {
    return handleError(res, err);
  }
}
