import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../../_lib/supabase.js";
import { handleError } from "../../_lib/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ detail: "Method not allowed" });

  try {
    const { phone_number } = req.body;
    if (!phone_number) return res.status(400).json({ detail: "phone_number required" });

    const normalizedPhone = phone_number.replace(/^(?:\+?263|0)/, "0");

    const { error } = await supabaseAdmin.auth.signInWithOtp({ phone: normalizedPhone });
    if (error) return res.status(400).json({ detail: error.message });

    return res.status(200).json({
      message: "Code sent",
      lifetime_s: 300,
      resend_after_s: 60,
      dev_code: null,
    });
  } catch (err) {
    return handleError(res, err);
  }
}
