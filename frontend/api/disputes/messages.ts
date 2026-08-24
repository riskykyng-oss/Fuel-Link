import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../../_lib/supabase.js";
import { requireAuth, handleError, ApiError } from "../../_lib/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ detail: "Method not allowed" });

  try {
    const auth = await requireAuth(req);
    const disputeId = Number(req.query.id);
    const { body } = req.body;
    if (!disputeId || !body) throw new ApiError("dispute_id and body required", 400);

    const { data: dispute } = await supabaseAdmin
      .from("disputes")
      .select("id, customer_id")
      .eq("id", disputeId)
      .single();
    if (!dispute) throw new ApiError("Dispute not found", 404);
    if (dispute.customer_id !== auth.userId) throw new ApiError("Not your dispute", 403);

    const { data: msg, error } = await supabaseAdmin
      .from("dispute_messages")
      .insert({ dispute_id: disputeId, sender_id: auth.userId, body })
      .select()
      .single();
    if (error) throw error;

    return res.status(201).json({ ...dispute, messages: [msg] });
  } catch (err) {
    return handleError(res, err);
  }
}
