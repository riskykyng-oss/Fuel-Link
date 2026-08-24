import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAuth, handleError, ApiError } from "../_lib/auth.js";
import { supabaseAdmin } from "../_lib/supabase.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ detail: "Method not allowed" });

  try {
    return res.status(200).json({ status: "ok", payments_mode: "mock" });
  } catch (err) {
    return handleError(res, err);
  }
}
