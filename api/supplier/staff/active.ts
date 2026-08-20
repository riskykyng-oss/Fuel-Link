import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../../_lib/supabase.js";
import { requireRole, handleError, ApiError } from "../../_lib/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "PATCH,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "PATCH") return res.status(405).json({ detail: "Method not allowed" });

  try {
    const auth = await requireRole(req, "supplier");
    const staffId = Number(req.query.id);
    const { is_active } = req.body;
    if (!staffId) throw new ApiError("Invalid staff ID", 400);

    const { data: staff } = await supabaseAdmin
      .from("staff")
      .select("id, provider_id")
      .eq("id", staffId)
      .single();
    if (!staff || staff.provider_id !== auth.userId) {
      throw new ApiError("Staff not found or not yours", 404);
    }

    const { data: updated, error } = await supabaseAdmin
      .from("staff")
      .update({ is_active })
      .eq("id", staffId)
      .select()
      .single();
    if (error) throw error;
    return res.status(200).json(updated);
  } catch (err) {
    return handleError(res, err);
  }
}
