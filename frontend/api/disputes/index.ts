import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../_lib/supabase.js";
import { requireAuth, handleError, ApiError } from "../_lib/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ detail: "Method not allowed" });

  try {
    const auth = await requireAuth(req);
    const { data: disputes } = await supabaseAdmin
      .from("disputes")
      .select(`
        id, order_id, reason, status, created_at, resolved_at,
        order:orders(reference)
      `)
      .eq("customer_id", auth.userId)
      .order("created_at", { ascending: false });

    const enriched = (disputes || []).map((d: any) => ({
      ...d,
      reference: d.order?.reference || null,
      order: undefined,
      messages: [],
    }));

    return res.status(200).json(enriched);
  } catch (err) {
    return handleError(res, err);
  }
}
