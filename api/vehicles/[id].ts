import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../_lib/supabase.js";
import { requireAuth, handleError, ApiError } from "../_lib/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const auth = await requireAuth(req);
    const vehicleId = Number(req.query.id);
    if (!vehicleId) throw new ApiError("Invalid vehicle ID", 400);

    if (req.method === "PATCH") {
      const { make, model, plate_number, fuel_type, tank_capacity_litres, is_default } = req.body;
      if (is_default) {
        await supabaseAdmin.from("vehicles").update({ is_default: false }).eq("owner_id", auth.userId);
      }
      const updates: Record<string, unknown> = {};
      if (make !== undefined) updates.make = make;
      if (model !== undefined) updates.model = model;
      if (plate_number !== undefined) updates.plate_number = plate_number;
      if (fuel_type !== undefined) updates.fuel_type = fuel_type;
      if (tank_capacity_litres !== undefined) updates.tank_capacity_litres = tank_capacity_litres;
      if (is_default !== undefined) updates.is_default = is_default;

      const { data, error } = await supabaseAdmin
        .from("vehicles")
        .update(updates)
        .eq("id", vehicleId)
        .eq("owner_id", auth.userId)
        .select()
        .single();
      if (error) throw error;
      return res.status(200).json(data);
    }

    if (req.method === "DELETE") {
      const { error } = await supabaseAdmin
        .from("vehicles")
        .delete()
        .eq("id", vehicleId)
        .eq("owner_id", auth.userId);
      if (error) throw error;
      return res.status(204).end();
    }

    return res.status(405).json({ detail: "Method not allowed" });
  } catch (err) {
    return handleError(res, err);
  }
}
