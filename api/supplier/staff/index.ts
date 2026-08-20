import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../../_lib/supabase.js";
import { requireRole, handleError, ApiError } from "../../_lib/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const auth = await requireRole(req, "supplier");

    if (req.method === "GET") {
      const { data: staff } = await supabaseAdmin
        .from("staff")
        .select("id, provider_id, full_name, phone_number, staff_id, role_label, shift_state, is_active, created_at")
        .eq("provider_id", auth.userId)
        .order("created_at", { ascending: false });
      return res.status(200).json(staff || []);
    }

    if (req.method === "POST") {
      const { full_name, phone_number, password, role_label } = req.body;
      if (!full_name || !phone_number || !password) {
        throw new ApiError("full_name, phone_number, and password are required", 400);
      }

      const normalizedPhone = phone_number.startsWith("+") ? phone_number : phone_number.replace(/^0/, "+263");

      const { data: existing } = await supabaseAdmin
        .from("staff")
        .select("id")
        .eq("phone_number", normalizedPhone)
        .single();
      if (existing) throw new ApiError("Phone number already registered", 409);

      const { count } = await supabaseAdmin
        .from("staff")
        .select("*", { count: "exact", head: true })
        .eq("provider_id", auth.userId);
      const staffCode = `ST-${String((count || 0) + 1).padStart(4, "0")}`;

      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        phone: normalizedPhone,
        password,
        phone_confirm: true,
        user_metadata: { full_name, role: "staff" },
      });
      if (authError) throw new ApiError(authError.message, 400);

      const { data: staff, error: staffError } = await supabaseAdmin
        .from("staff")
        .insert({
          auth_id: authUser.user.id,
          provider_id: auth.userId,
          full_name,
          phone_number: normalizedPhone,
          staff_id: staffCode,
          role_label: role_label || "courier",
          shift_state: "offline",
          is_active: true,
        })
        .select()
        .single();
      if (staffError) {
        await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
        throw new ApiError("Failed to create staff", 500);
      }

      return res.status(201).json(staff);
    }

    return res.status(405).json({ detail: "Method not allowed" });
  } catch (err) {
    return handleError(res, err);
  }
}
