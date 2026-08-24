import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../../_lib/supabase.js";
import { requireAuth, handleError } from "../../_lib/auth.js";

const ACTIVE_STATUSES = ["pending", "bidding", "offered", "accepted", "in_transit", "arrived"];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ detail: "Method not allowed" });

  try {
    const auth = await requireAuth(req);
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select(`
        *,
        customer:users!orders_customer_id_fkey(id, full_name, phone_number),
        supplier:users!orders_supplier_id_fkey(id, full_name, phone_number),
        station:stations(*)
      `)
      .eq("customer_id", auth.userId)
      .in("status", ACTIVE_STATUSES)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return res.status(200).json(order || null);
  } catch (err) {
    return handleError(res, err);
  }
}
