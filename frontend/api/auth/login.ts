import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../_lib/supabase.js";
import { ApiError, handleError } from "../_lib/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ detail: "Method not allowed" });

  try {
    const { phone_number, password, role } = req.body;
    if (!phone_number || !password) {
      throw new ApiError("phone_number and password are required", 400);
    }

    const normalizedPhone = phone_number.startsWith("+") ? phone_number : phone_number.replace(/^0/, "+263");

    const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      phone: normalizedPhone,
      password,
    });
    if (signInError) throw new ApiError("Invalid phone number or password", 401);

    const { data: user } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("auth_id", signInData.user.id)
      .single();

    if (!user) throw new ApiError("User profile not found", 404);
    if (role && user.role !== role) {
      throw new ApiError(`This account is not a ${role}`, 403);
    }

    const { data: vehicles } = await supabaseAdmin
      .from("vehicles")
      .select("*")
      .eq("owner_id", user.id);

    const { data: profile } = await supabaseAdmin
      .from("supplier_profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    return res.status(200).json({
      access_token: signInData.session.access_token,
      refresh_token: signInData.session.refresh_token,
      expires_in: signInData.session.expires_in,
      token_type: "bearer",
      user: {
        ...user,
        vehicles: vehicles || [],
        supplier_profile: user.role === "supplier" ? profile : null,
      },
    });
  } catch (err) {
    return handleError(res, err);
  }
}
