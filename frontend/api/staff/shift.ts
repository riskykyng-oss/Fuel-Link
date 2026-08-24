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
    const auth = await requireRole(req, "staff");
    const { shift_state } = req.body;
    if (!["available", "offline"].includes(shift_state)) {
      throw new ApiError("shift_state must be available or offline", 400);
    }

    if (shift_state === "offline") {
      const { data: activeOrder } = await supabaseAdmin
        .from("orders")
        .select("id")
        .eq("staff_id", auth.userId)
        .in("status", ["accepted", "in_transit"])
        .maybeSingle();
      if (activeOrder) throw new ApiError("Cannot go offline while on a job", 400);
    }

    const { data: staff, error } = await supabaseAdmin
      .from("staff")
      .update({ shift_state })
      .eq("id", auth.userId)
      .select("id, provider_id, full_name, phone_number, staff_id, role_label, shift_state, is_active, created_at")
      .single();
    if (error) throw error;
    return res.status(200).json(staff);
  } catch (err) {
    return handleError(res, err);
  }
}
