import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../_lib/supabase.js";
import { requireRole, handleError } from "../_lib/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ detail: "Method not allowed" });

  try {
    const auth = await requireRole(req, "supplier");

    const { data: profile } = await supabaseAdmin
      .from("supplier_profiles")
      .select("*")
      .eq("user_id", auth.userId)
      .single();

    const { count: staffOnShift } = await supabaseAdmin
      .from("staff")
      .select("*", { count: "exact", head: true })
      .eq("provider_id", auth.userId)
      .eq("shift_state", "available")
      .eq("is_active", true);

    const { count: staffAvailable } = await supabaseAdmin
      .from("staff")
      .select("*", { count: "exact", head: true })
      .eq("provider_id", auth.userId)
      .eq("is_active", true);

    const { count: containersReady } = await supabaseAdmin
      .from("sealed_containers")
      .select("*", { count: "exact", head: true })
      .eq("provider_id", auth.userId)
      .eq("status", "available");

    const { count: containersInUse } = await supabaseAdmin
      .from("sealed_containers")
      .select("*", { count: "exact", head: true })
      .eq("provider_id", auth.userId)
      .eq("status", "in_use");

    const { count: containersTotal } = await supabaseAdmin
      .from("sealed_containers")
      .select("*", { count: "exact", head: true })
      .eq("provider_id", auth.userId);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: todayOrders } = await supabaseAdmin
      .from("orders")
      .select("total_amount, quantity_litres")
      .eq("supplier_id", auth.userId)
      .eq("status", "delivered")
      .gte("delivered_at", todayStart.toISOString());

    const earningsToday = (todayOrders || []).reduce((sum: number, o: any) => sum + (o.total_amount || 0), 0);
    const litresDelivered = (todayOrders || []).reduce((sum: number, o: any) => sum + (o.quantity_litres || 0), 0);

    const { data: snapshot } = await supabaseAdmin
      .from("price_snapshots")
      .select("petrol_price, diesel_price, fetched_at, is_live")
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: heldPayments } = await supabaseAdmin
      .from("payments")
      .select("amount")
      .eq("payout_status", "held");

    const { data: releasedPayments } = await supabaseAdmin
      .from("payments")
      .select("amount")
      .eq("payout_status", "released");

    const { count: disputesOpen } = await supabaseAdmin
      .from("disputes")
      .select("*", { count: "exact", head: true })
      .eq("status", "open");

    const { count: openRequests } = await supabaseAdmin
      .from("orders")
      .select("*", { count: "exact", head: true })
      .or(`offered_supplier_id.eq.${auth.userId},and(status.eq.pending,offered_supplier_id.is.null)`)
      .in("status", ["pending", "offered"]);

    const { count: pendingBids } = await supabaseAdmin
      .from("bids")
      .select("*", { count: "exact", head: true })
      .eq("supplier_id", auth.userId)
      .eq("status", "pending");

    const { count: completedJobs } = await supabaseAdmin
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("supplier_id", auth.userId)
      .eq("status", "delivered");

    const responseRate = completedJobs
      ? Math.round(((completedJobs - (profile?.rejected_jobs || 0)) / completedJobs) * 100)
      : 100;

    return res.status(200).json({
      is_online: profile?.is_online || false,
      is_verified: profile?.is_verified || false,
      rating: profile?.rating || 5.0,
      completed_jobs: completedJobs || 0,
      total_earnings: profile?.total_earnings || 0,
      earnings_today: Math.round(earningsToday * 100) / 100,
      litres_delivered: litresDelivered,
      fuel_stock_petrol: profile?.fuel_stock_petrol || 0,
      fuel_stock_diesel: profile?.fuel_stock_diesel || 0,
      tanker_capacity_litres: profile?.tanker_capacity_litres || 200,
      response_rate: responseRate,
      open_requests: openRequests || 0,
      petrol_price: snapshot?.petrol_price || 1.57,
      diesel_price: snapshot?.diesel_price || 1.54,
      cap_petrol: snapshot?.petrol_price || 1.57,
      cap_diesel: snapshot?.diesel_price || 1.54,
      price_verified_at: snapshot?.fetched_at || null,
      price_is_live: snapshot?.is_live || false,
      staff_on_shift: staffOnShift || 0,
      staff_available: staffAvailable || 0,
      containers_ready: containersReady || 0,
      containers_in_use: containersInUse || 0,
      containers_total: containersTotal || 0,
      payout_held: (heldPayments || []).reduce((s: number, p: any) => s + (p.amount || 0), 0),
      payout_released: (releasedPayments || []).reduce((s: number, p: any) => s + (p.amount || 0), 0),
      payout_disputed: 0,
      disputes_open: disputesOpen || 0,
    });
  } catch (err) {
    return handleError(res, err);
  }
}
