import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../_lib/supabase.js";
import { handleError } from "../_lib/auth.js";
import { roadDistanceKm } from "../_lib/geo.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ detail: "Method not allowed" });

  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const fuelType = req.query.fuel_type as string | undefined;
    if (!lat || !lng) return res.status(400).json({ detail: "lat and lng required" });

    const { data: stations } = await supabaseAdmin
      .from("stations")
      .select("*");

    let results = (stations || []).map((s: any) => ({
      ...s,
      distance_km: roadDistanceKm(lat, lng, s.lat, s.lng),
    }));

    if (fuelType === "petrol") results = results.filter((s: any) => s.has_petrol);
    else if (fuelType === "diesel") results = results.filter((s: any) => s.has_diesel);

    results.sort((a: any, b: any) => a.distance_km - b.distance_km);
    return res.status(200).json(results.slice(0, 20));
  } catch (err) {
    return handleError(res, err);
  }
}
