import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../_lib/supabase.js";
import { handleError } from "../_lib/auth.js";
import { roadDistanceKm } from "../_lib/geo.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ detail: "Method not allowed" });

  try {
    const { lat, lng } = req.body;
    if (!lat || !lng) return res.status(400).json({ detail: "lat and lng required" });

    const { data: stations } = await supabaseAdmin.from("stations").select("*");
    const nearby = (stations || [])
      .map((s: any) => ({ ...s, distance_km: roadDistanceKm(lat, lng, s.lat, s.lng) }))
      .filter((s: any) => s.distance_km <= 30)
      .sort((a: any, b: any) => a.distance_km - b.distance_km);

    return res.status(200).json({
      covered: nearby.length > 0,
      message: nearby.length > 0
        ? `We cover your area. ${nearby.length} station(s) nearby.`
        : "Your area is outside our current coverage zone.",
      est_response_min: nearby.length > 0 ? Math.round(nearby[0].distance_km * 2 + 10) : null,
      stations: nearby.slice(0, 5),
    });
  } catch (err) {
    return handleError(res, err);
  }
}
