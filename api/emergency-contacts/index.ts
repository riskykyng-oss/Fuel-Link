import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../_lib/supabase.js";
import { requireAuth, handleError, ApiError } from "../_lib/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const auth = await requireAuth(req);

    if (req.method === "GET") {
      const { data } = await supabaseAdmin
        .from("emergency_contacts")
        .select("*")
        .eq("owner_id", auth.userId);
      return res.status(200).json(data || []);
    }

    if (req.method === "POST") {
      const { full_name, phone_number, relationship } = req.body;
      if (!full_name || !phone_number) throw new ApiError("full_name and phone_number required", 400);
      const { data, error } = await supabaseAdmin
        .from("emergency_contacts")
        .insert({ owner_id: auth.userId, full_name, phone_number, relationship: relationship || null })
        .select()
        .single();
      if (error) throw error;
      return res.status(201).json(data);
    }

    return res.status(405).json({ detail: "Method not allowed" });
  } catch (err) {
    return handleError(res, err);
  }
}
