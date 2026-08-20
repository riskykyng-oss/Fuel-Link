import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../../_lib/supabase.js";
import { requireAuth, handleError, ApiError } from "../../_lib/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ detail: "Method not allowed" });

  try {
    const auth = await requireAuth(req);
    const orderId = Number(req.query.id);
    if (!orderId) throw new ApiError("Invalid order ID", 400);

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, reference, status, payment_status, supplier_id, customer_id, staff_id, pickup_lat, pickup_lng, handover_code, eta_minutes")
      .eq("id", orderId)
      .single();
    if (!order) throw new ApiError("Order not found", 404);

    if (order.customer_id !== auth.userId && order.supplier_id !== auth.userId && auth.role !== "staff") {
      throw new ApiError("Not authorized", 403);
    }

    let supplierLat: number | null = null;
    let supplierLng: number | null = null;
    let supplierName: string | null = null;
    let supplierPhone: string | null = null;
    let providerVerified = false;
    let providerStaffId: string | null = null;

    if (order.supplier_id) {
      const { data: profile } = await supabaseAdmin
        .from("supplier_profiles")
        .select("current_lat, current_lng")
        .eq("user_id", order.supplier_id)
        .single();
      if (profile) {
        supplierLat = profile.current_lat;
        supplierLng = profile.current_lng;
      }
      const { data: supplier } = await supabaseAdmin
        .from("users")
        .select("full_name, phone_number")
        .eq("id", order.supplier_id)
        .single();
      if (supplier) {
        supplierName = supplier.full_name;
        supplierPhone = supplier.phone_number;
      }
      const { data: sp } = await supabaseAdmin
        .from("supplier_profiles")
        .select("is_verified")
        .eq("user_id", order.supplier_id)
        .single();
      if (sp) providerVerified = sp.is_verified;
    }

    if (order.staff_id) {
      const { data: staff } = await supabaseAdmin
        .from("staff")
        .select("staff_id")
        .eq("id", order.staff_id)
        .single();
      if (staff) providerStaffId = staff.staff_id;
    }

    return res.status(200).json({
      order_id: order.id,
      reference: order.reference,
      status: order.status,
      payment_status: order.payment_status,
      supplier_lat: supplierLat,
      supplier_lng: supplierLng,
      pickup_lat: order.pickup_lat,
      pickup_lng: order.pickup_lng,
      remaining_km: 0,
      eta_minutes: order.eta_minutes,
      supplier_name: supplierName,
      supplier_phone: supplierPhone,
      provider_verified: providerVerified,
      provider_staff_id: providerStaffId,
      handover_code: order.handover_code,
    });
  } catch (err) {
    return handleError(res, err);
  }
}
