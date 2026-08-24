import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../../_lib/supabase.js";
import { requireAuth, handleError, ApiError } from "../../_lib/auth.js";

const TRANSITIONS: Record<string, string[]> = {
  pending: ["cancelled"],
  bidding: ["cancelled", "offered"],
  offered: ["accepted", "declined", "cancelled"],
  accepted: ["in_transit", "cancelled"],
  in_transit: ["arrived"],
  arrived: ["delivered"],
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "PATCH,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "PATCH") return res.status(405).json({ detail: "Method not allowed" });

  try {
    const auth = await requireAuth(req);
    const orderId = Number(req.query.id);
    const { status, handover_code, seal_id } = req.body;

    if (!orderId || !status) throw new ApiError("id and status are required", 400);

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();
    if (!order) throw new ApiError("Order not found", 404);

    const allowed = TRANSITIONS[order.status] || [];
    if (!allowed.includes(status)) {
      throw new ApiError(`Cannot transition from ${order.status} to ${status}`, 400);
    }

    const updates: Record<string, unknown> = { status };

    if (status === "delivered") {
      if (handover_code && order.handover_code !== handover_code) {
        throw new ApiError("Invalid handover code", 400);
      }
      updates.delivered_at = new Date().toISOString();

      if (order.handover_code && order.handover_code === handover_code) {
        await supabaseAdmin
          .from("payments")
          .update({ payout_status: "released", payout_at: new Date().toISOString() })
          .eq("order_id", orderId)
          .eq("payout_status", "held");
      }
    }

    if (seal_id) {
      if (status === "in_transit") {
        updates.seal_id = seal_id;
        updates.seal_dispatched_at = new Date().toISOString();
        await supabaseAdmin
          .from("sealed_containers")
          .update({ status: "in_use" })
          .eq("serial", seal_id)
          .eq("provider_id", order.supplier_id);
      }
      if (status === "delivered") {
        if (order.seal_id && order.seal_id !== seal_id) {
          throw new ApiError("Seal mismatch between dispatch and arrival", 400);
        }
        updates.seal_arrived_at = new Date().toISOString();
        await supabaseAdmin
          .from("sealed_containers")
          .update({ status: "returned" })
          .eq("serial", seal_id);
      }
    }

    if (status === "in_transit") {
      updates.eta_minutes = order.eta_minutes || 30;
    }

    const { data: updated, error } = await supabaseAdmin
      .from("orders")
      .update(updates)
      .eq("id", orderId)
      .select(`
        *,
        customer:users!orders_customer_id_fkey(id, full_name, phone_number),
        supplier:users!orders_supplier_id_fkey(id, full_name, phone_number),
        station:stations(*)
      `)
      .single();
    if (error) throw error;

    if (status === "delivered" && order.supplier_id) {
      const { data: profile } = await supabaseAdmin
        .from("supplier_profiles")
        .select("completed_jobs, total_earnings")
        .eq("user_id", order.supplier_id)
        .single();
      if (profile) {
        await supabaseAdmin
          .from("supplier_profiles")
          .update({
            completed_jobs: (profile.completed_jobs || 0) + 1,
            total_earnings: (profile.total_earnings || 0) + (order.total_amount || 0),
          })
          .eq("user_id", order.supplier_id);
      }
    }

    return res.status(200).json(updated);
  } catch (err) {
    return handleError(res, err);
  }
}
