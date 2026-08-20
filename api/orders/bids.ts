import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../../_lib/supabase.js";
import { requireAuth, handleError, ApiError } from "../../_lib/auth.js";
import { roadDistanceKm } from "../../_lib/geo.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const auth = await requireAuth(req);
    const orderId = Number(req.query.id);
    if (!orderId) throw new ApiError("Invalid order ID", 400);

    if (req.method === "GET") {
      const { data: bids } = await supabaseAdmin
        .from("bids")
        .select(`
          id, order_id, supplier_id, proposed_amount, note, distance_km, status, created_at,
          supplier:users!bids_supplier_id_fkey(full_name),
          profile:supplier_profiles!bids_supplier_id_fkey(company_name, is_verified, rating)
        `)
        .eq("order_id", orderId)
        .order("created_at", { ascending: false });

      const enriched = (bids || []).map((b: any) => ({
        ...b,
        supplier_name: b.supplier?.full_name || null,
        supplier_company: b.profile?.company_name || null,
        supplier_verified: b.profile?.is_verified || false,
        supplier_rating: b.profile?.rating || null,
        supplier: undefined,
        profile: undefined,
      }));

      return res.status(200).json(enriched);
    }

    if (req.method === "POST") {
      const { proposed_amount, note } = req.body;
      if (!proposed_amount || proposed_amount <= 0) {
        throw new ApiError("proposed_amount must be > 0", 400);
      }

      const { data: order } = await supabaseAdmin
        .from("orders")
        .select("id, status, pickup_lat, pickup_lng, customer_id")
        .eq("id", orderId)
        .single();
      if (!order) throw new ApiError("Order not found", 404);
      if (!["pending", "bidding"].includes(order.status)) {
        throw new ApiError("Order is not accepting bids", 400);
      }

      const { data: profile } = await supabaseAdmin
        .from("supplier_profiles")
        .select("current_lat, current_lng")
        .eq("user_id", auth.userId)
        .single();

      let distanceKm = 0;
      if (profile?.current_lat && profile?.current_lng && order.pickup_lat && order.pickup_lng) {
        distanceKm = roadDistanceKm(profile.current_lat, profile.current_lng, order.pickup_lat, order.pickup_lng);
      }

      if (order.status === "pending") {
        await supabaseAdmin
          .from("orders")
          .update({ status: "bidding" })
          .eq("id", orderId);
      }

      const { data: bid, error } = await supabaseAdmin
        .from("bids")
        .insert({
          order_id: orderId,
          supplier_id: auth.userId,
          proposed_amount,
          note: note || null,
          distance_km: distanceKm,
          status: "pending",
        })
        .select()
        .single();
      if (error) throw error;

      return res.status(201).json(bid);
    }

    return res.status(405).json({ detail: "Method not allowed" });
  } catch (err) {
    return handleError(res, err);
  }
}
