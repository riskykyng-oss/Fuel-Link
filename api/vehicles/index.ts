import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../_lib/supabase.js";
import { requireAuth, handleError, ApiError } from "../_lib/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const auth = await requireAuth(req);

    if (req.method === "GET") {
      const { data: vehicles } = await supabaseAdmin
        .from("vehicles")
        .select("*")
        .eq("owner_id", auth.userId);
      return res.status(200).json(vehicles || []);
    }

    if (req.method === "POST") {
      const { make, model, plate_number, fuel_type, tank_capacity_litres, is_default } = req.body;
      if (!make || !model || !plate_number) {
        throw new ApiError("make, model, and plate_number are required", 400);
      }
      if (is_default) {
        await supabaseAdmin.from("vehicles").update({ is_default: false }).eq("owner_id", auth.userId);
      }
      const { data, error } = await supabaseAdmin
        .from("vehicles")
        .insert({
          owner_id: auth.userId,
          make,
          model,
          plate_number,
          fuel_type: fuel_type || "petrol",
          tank_capacity_litres: tank_capacity_litres || 50,
          is_default: is_default ?? true,
        })
        .select()
        .single();
      if (error) throw error;
      return res.status(201).json(data);
    }

    return res.status(405).json({ detail: "Method not allowed" });
  } catch (err) {
    return handleError(res, err);
  }
}
