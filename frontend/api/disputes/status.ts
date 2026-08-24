import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../../_lib/supabase.js";
import { requireAuth, handleError, ApiError } from "../../_lib/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "PATCH,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "PATCH") return res.status(405).json({ detail: "Method not allowed" });

  try {
    const auth = await requireAuth(req);
    const disputeId = Number(req.query.id);
    const { status } = req.body;
    if (!disputeId || !status) throw new ApiError("id and status required", 400);
    if (!["resolved", "closed"].includes(status)) {
      throw new ApiError("status must be resolved or closed", 400);
    }

    const updates: Record<string, unknown> = { status };
    if (status === "resolved") updates.resolved_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from("disputes")
      .update(updates)
      .eq("id", disputeId)
      .eq("customer_id", auth.userId)
      .select()
      .single();
    if (error) throw error;

    return res.status(200).json(data);
  } catch (err) {
    return handleError(res, err);
  }
}
