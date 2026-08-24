import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../_lib/supabase.js";
import { requireRole, handleError, ApiError } from "../_lib/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ detail: "Method not allowed" });

  try {
    const auth = await requireRole(req, "supplier");
    const { lat, lng } = req.body;
    if (!lat || !lng) throw new ApiError("lat and lng required", 400);

    await supabaseAdmin
      .from("supplier_profiles")
      .update({
        current_lat: lat,
        current_lng: lng,
        location_updated_at: new Date().toISOString(),
      })
      .eq("user_id", auth.userId);

    return res.status(200).end();
  } catch (err) {
    return handleError(res, err);
  }
}
