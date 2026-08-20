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
    const orderId = Number(req.query.id);
    const bidId = Number(req.query.bidId);
    if (!orderId || !bidId) throw new ApiError("Invalid order or bid ID", 400);

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, customer_id, status")
      .eq("id", orderId)
      .single();
    if (!order) throw new ApiError("Order not found", 404);
    if (order.customer_id !== auth.userId) throw new ApiError("Only the customer can accept bids", 403);
    if (!["pending", "bidding"].includes(order.status)) {
      throw new ApiError("Order is not accepting bids", 400);
    }

    const { data: bid } = await supabaseAdmin
      .from("bids")
      .select("*")
      .eq("id", bidId)
      .eq("order_id", orderId)
      .eq("status", "pending")
      .single();
    if (!bid) throw new ApiError("Bid not found or no longer available", 404);

    await supabaseAdmin
      .from("bids")
      .update({ status: "rejected" })
      .eq("order_id", orderId)
      .eq("status", "pending")
      .neq("id", bidId);

    await supabaseAdmin
      .from("bids")
      .update({ status: "accepted" })
      .eq("id", bidId);

    const { data: updatedOrder, error } = await supabaseAdmin
      .from("orders")
      .update({
        supplier_id: bid.supplier_id,
        total_amount: bid.proposed_amount,
        status: "accepted",
        accepted_at: new Date().toISOString(),
      })
      .eq("id", orderId)
      .select(`
        *,
        customer:users!orders_customer_id_fkey(id, full_name, phone_number),
        supplier:users!orders_supplier_id_fkey(id, full_name, phone_number),
        station:stations(*)
      `)
      .single();
    if (error) throw error;

    return res.status(200).json(updatedOrder);
  } catch (err) {
    return handleError(res, err);
  }
}
