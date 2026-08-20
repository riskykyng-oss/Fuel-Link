import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../../_lib/supabase.js";
import { requireRole, handleError, ApiError } from "../../_lib/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ detail: "Method not allowed" });

  try {
    const auth = await requireRole(req, "supplier");
    const orderId = Number(req.query.id);
    if (!orderId) throw new ApiError("Invalid order ID", 400);

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();
    if (!order) throw new ApiError("Order not found", 404);

    if (order.offered_supplier_id !== auth.userId) {
      throw new ApiError("This offer is not for you", 403);
    }
    if (!["offered", "pending"].includes(order.status)) {
      throw new ApiError(`Cannot accept order in ${order.status} status`, 400);
    }

    const { data: updated, error } = await supabaseAdmin
      .from("orders")
      .update({
        supplier_id: auth.userId,
        status: "accepted",
        accepted_at: new Date().toISOString(),
        offered_supplier_id: null,
        offer_expires_at: null,
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

    await supabaseAdmin
      .from("supplier_profiles")
      .update({ is_online: true })
      .eq("user_id", auth.userId);

    return res.status(200).json(updated);
  } catch (err) {
    return handleError(res, err);
  }
}
