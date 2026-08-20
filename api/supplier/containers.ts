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
    const { data: containers } = await supabaseAdmin
      .from("sealed_containers")
      .select("serial, capacity_litres, status")
      .eq("provider_id", auth.userId);
    return res.status(200).json({ containers: containers || [] });
  } catch (err) {
    return handleError(res, err);
  }
}
