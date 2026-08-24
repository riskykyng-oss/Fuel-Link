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
    const { phone_number, code, purpose } = req.body;
    if (!phone_number || !code) throw new ApiError("phone_number and code required", 400);

    const normalizedPhone = phone_number.startsWith("+") ? phone_number : phone_number.replace(/^0/, "+263");

    const { data, error } = await supabaseAdmin.auth.verifyOtp({
      phone: normalizedPhone,
      token: code,
      type: purpose === "reset" ? "recovery" : "sms",
    });

    if (error) throw new ApiError("Invalid or expired code", 400);

    return res.status(200).json({
      verified: true,
      purpose: purpose || "signup",
      reset_token: data?.session?.access_token || null,
    });
  } catch (err) {
    return handleError(res, err);
  }
}
