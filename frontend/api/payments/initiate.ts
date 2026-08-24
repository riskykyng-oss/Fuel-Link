import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../_lib/supabase.js";
import { requireAuth, handleError, ApiError } from "../_lib/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ detail: "Method not allowed" });

  try {
    const auth = await requireAuth(req);
    const { order_id, method, payer_phone } = req.body;
    if (!order_id || !method) throw new ApiError("order_id and method required", 400);

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, customer_id, total_amount, status, reference")
      .eq("id", order_id)
      .single();
    if (!order) throw new ApiError("Order not found", 404);
    if (order.customer_id !== auth.userId) throw new ApiError("Not your order", 403);

    const ref = `MOCK-${Date.now().toString(36).toUpperCase()}`;

    const { data: existingPayment } = await supabaseAdmin
      .from("payments")
      .select("*")
      .eq("order_id", order_id)
      .maybeSingle();
    if (existingPayment) {
      return res.status(200).json(existingPayment);
    }

    const { data: payment, error } = await supabaseAdmin
      .from("payments")
      .insert({
        order_id,
        method,
        amount: order.total_amount,
        status: "paid",
        provider_reference: ref,
        payout_status: "held",
      })
      .select()
      .single();
    if (error) throw error;

    await supabaseAdmin
      .from("orders")
      .update({ payment_status: "paid" })
      .eq("id", order_id);

    return res.status(201).json(payment);
  } catch (err) {
    return handleError(res, err);
  }
}
