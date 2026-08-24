import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../_lib/supabase.js";
import { requireAuth, handleError } from "../_lib/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "PATCH,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "PATCH") return res.status(405).json({ detail: "Method not allowed" });

  try {
    const auth = await requireAuth(req);
    const { theme } = req.body;
    if (!theme || !["dark", "light", "system"].includes(theme)) {
      return res.status(400).json({ detail: "theme must be dark, light, or system" });
    }

    const { data, error } = await supabaseAdmin
      .from("users")
      .update({ theme })
      .eq("id", auth.userId)
      .select()
      .single();
    if (error) throw error;
    return res.status(200).json(data);
  } catch (err) {
    return handleError(res, err);
  }
}
