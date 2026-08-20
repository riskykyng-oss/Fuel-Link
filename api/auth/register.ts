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
    const { full_name, phone_number, email, password, role, ...profileFields } = req.body;
    if (!full_name || !phone_number || !password || !role) {
      throw new ApiError("full_name, phone_number, password, and role are required", 400);
    }
    if (!["customer", "supplier"].includes(role)) {
      throw new ApiError("role must be customer or supplier", 400);
    }

    const { data: existing } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("phone_number", phone_number)
      .single();
    if (existing) throw new ApiError("Phone number already registered", 409);

    const normalizedPhone = phone_number.startsWith("+") ? phone_number : phone_number.replace(/^0/, "+263");

    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      phone: normalizedPhone,
      password,
      phone_confirm: true,
      user_metadata: { full_name, role },
    });
    if (authError) throw new ApiError(authError.message, 400);

    const userData: Record<string, unknown> = {
      auth_id: authUser.user.id,
      full_name,
      phone_number: normalizedPhone,
      email: email || null,
      role,
      is_active: true,
      phone_verified: true,
    };

    const { data: user, error: userError } = await supabaseAdmin
      .from("users")
      .insert(userData)
      .select()
      .single();
    if (userError) {
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      throw new ApiError("Failed to create user profile", 500);
    }

    if (role === "supplier") {
      const supplierData: Record<string, unknown> = {
        user_id: user.id,
        company_name: profileFields.company_name || "My Company",
        zera_licence_number: profileFields.zera_licence_number || "",
        vehicle_registration: profileFields.vehicle_registration || "",
        tanker_capacity_litres: profileFields.tanker_capacity_litres || 200,
        services_offered: profileFields.services_offered || "fuel",
        provider_type: profileFields.provider_type || "fuel_station",
        callout_fee: profileFields.callout_fee || 0,
        labour_rate: profileFields.labour_rate || 0,
      };
      await supabaseAdmin.from("supplier_profiles").insert(supplierData);
    }

    const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      phone: normalizedPhone,
      password,
    });
    if (signInError) throw new ApiError("Account created but sign-in failed", 500);

    const { data: vehicles } = await supabaseAdmin
      .from("vehicles")
      .select("*")
      .eq("owner_id", user.id);

    const { data: profile } = await supabaseAdmin
      .from("supplier_profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    return res.status(201).json({
      access_token: signInData.session.access_token,
      refresh_token: signInData.session.refresh_token,
      expires_in: signInData.session.expires_in,
      token_type: "bearer",
      user: {
        ...user,
        vehicles: vehicles || [],
        supplier_profile: role === "supplier" ? profile : null,
      },
    });
  } catch (err) {
    return handleError(res, err);
  }
}
