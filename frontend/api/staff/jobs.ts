import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../../_lib/supabase.js";
import { requireRole, handleError } from "../../_lib/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ detail: "Method not allowed" });

  try {
    const auth = await requireRole(req, "staff");
    const { data: orders } = await supabaseAdmin
      .from("orders")
      .select(`
        *,
        customer:users!orders_customer_id_fkey(id, full_name, phone_number),
        supplier:users!orders_supplier_id_fkey(id, full_name, phone_number),
        station:stations(*)
      `)
      .eq("staff_id", auth.userId)
      .in("status", ["accepted", "in_transit", "arrived"])
      .order("created_at", { ascending: false });
    return res.status(200).json(orders || []);
  } catch (err) {
    return handleError(res, err);
  }
}
