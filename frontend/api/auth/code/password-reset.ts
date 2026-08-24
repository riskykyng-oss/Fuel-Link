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
    const { reset_token, new_password } = req.body;
    if (!reset_token || !new_password) throw new ApiError("reset_token and new_password required", 400);
    if (new_password.length < 6) throw new ApiError("Password must be at least 6 characters", 400);

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(reset_token);
    if (userError || !userData.user) throw new ApiError("Invalid or expired reset token", 400);

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userData.user.id,
      { password: new_password },
    );
    if (updateError) throw new ApiError(updateError.message, 400);

    const phone = userData.user.phone ?? "";
    const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      phone,
      password: new_password,
    });
    if (signInError) throw new ApiError("Password updated but sign-in failed", 500);

    const { data: user } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("auth_id", userData.user.id)
      .single();

    return res.status(200).json({
      access_token: signInData.session.access_token,
      refresh_token: signInData.session.refresh_token,
      expires_in: signInData.session.expires_in,
      token_type: "bearer",
      user,
    });
  } catch (err) {
    return handleError(res, err);
  }
}
