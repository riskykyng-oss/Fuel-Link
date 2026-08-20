import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../_lib/supabase.js";
import { requireRole, handleError } from "../_lib/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "PATCH,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "PATCH") return res.status(405).json({ detail: "Method not allowed" });

  try {
    const auth = await requireRole(req, "supplier");
    const { services_offered, callout_fee, labour_rate } = req.body;

    const updates: Record<string, unknown> = {};
    if (services_offered !== undefined) updates.services_offered = services_offered;
    if (callout_fee !== undefined) updates.callout_fee = callout_fee;
    if (labour_rate !== undefined) updates.labour_rate = labour_rate;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ detail: "No fields to update" });
    }

    const { data, error } = await supabaseAdmin
      .from("supplier_profiles")
      .update(updates)
      .eq("user_id", auth.userId)
      .select()
      .single();
    if (error) throw error;
    return res.status(200).json(data);
  } catch (err) {
    return handleError(res, err);
  }
}
