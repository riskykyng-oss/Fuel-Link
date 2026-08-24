import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../../_lib/supabase.js";
import { requireRole, handleError, ApiError } from "../../_lib/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ detail: "Method not allowed" });

  try {
    const auth = await requireRole(req, "staff");
    const { data: staff } = await supabaseAdmin
      .from("staff")
      .select("id, provider_id, full_name, phone_number, staff_id, role_label, shift_state, is_active, created_at")
      .eq("id", auth.userId)
      .single();
    if (!staff) throw new ApiError("Staff not found", 404);
    return res.status(200).json(staff);
  } catch (err) {
    return handleError(res, err);
  }
}
