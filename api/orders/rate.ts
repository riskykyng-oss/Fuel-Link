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
    const { rating } = req.body;
    if (!orderId || !rating || rating < 1 || rating > 5) {
      throw new ApiError("rating must be between 1 and 5", 400);
    }

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, customer_id, supplier_id, status")
      .eq("id", orderId)
      .single();
    if (!order) throw new ApiError("Order not found", 404);
    if (order.customer_id !== auth.userId) throw new ApiError("Only the customer can rate", 403);
    if (order.status !== "delivered") throw new ApiError("Can only rate delivered orders", 400);

    const { data: updated, error } = await supabaseAdmin
      .from("orders")
      .update({ rating: Math.round(rating) })
      .eq("id", orderId)
      .select(`
        *,
        customer:users!orders_customer_id_fkey(id, full_name, phone_number),
        supplier:users!orders_supplier_id_fkey(id, full_name, phone_number),
        station:stations(*)
      `)
      .single();
    if (error) throw error;

    if (order.supplier_id) {
      const { data: profile } = await supabaseAdmin
        .from("supplier_profiles")
        .select("rating, completed_jobs")
        .eq("user_id", order.supplier_id)
        .single();
      if (profile && profile.completed_jobs > 0) {
        const newRating = ((profile.rating * profile.completed_jobs) + rating) / (profile.completed_jobs + 1);
        await supabaseAdmin
          .from("supplier_profiles")
          .update({ rating: Math.round(newRating * 10) / 10 })
          .eq("user_id", order.supplier_id);
      }
    }

    return res.status(200).json(updated);
  } catch (err) {
    return handleError(res, err);
  }
}
