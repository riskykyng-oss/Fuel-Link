import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../../_lib/supabase.js";
import { handleError, ApiError } from "../../_lib/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ detail: "Method not allowed" });

  try {
    const { phone_number, password } = req.body;
    if (!phone_number || !password) throw new ApiError("phone_number and password required", 400);

    const normalizedPhone = phone_number.replace(/^(?:\+?263|0)/, "0");

    const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      phone: normalizedPhone,
      password,
    });
    if (signInError) throw new ApiError("Invalid phone number or password", 401);

    const { data: staff } = await supabaseAdmin
      .from("staff")
      .select("id, provider_id, full_name, phone_number, staff_id, role_label, shift_state, is_active, created_at")
      .eq("auth_id", signInData.user.id)
      .single();
    if (!staff) throw new ApiError("Staff profile not found", 404);
    if (!staff.is_active) throw new ApiError("Staff account deactivated", 403);

    return res.status(200).json({
      access_token: signInData.session.access_token,
      token_type: "bearer",
      staff,
    });
  } catch (err) {
    return handleError(res, err);
  }
}
