import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../_lib/supabase.js";
import { requireRole, handleError } from "../_lib/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ detail: "Method not allowed" });

  try {
    const auth = await requireRole(req, "supplier");
    const { is_online } = req.body;

    await supabaseAdmin
      .from("supplier_profiles")
      .update({ is_online: !!is_online })
      .eq("user_id", auth.userId);

    return res.status(200).end();
  } catch (err) {
    return handleError(res, err);
  }
}
