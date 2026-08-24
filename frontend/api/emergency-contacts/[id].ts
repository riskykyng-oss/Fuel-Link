import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../../_lib/supabase.js";
import { requireAuth, handleError, ApiError } from "../../_lib/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const auth = await requireAuth(req);
    const contactId = Number(req.query.id);
    if (!contactId) throw new ApiError("Invalid contact ID", 400);

    if (req.method === "PATCH") {
      const { full_name, phone_number, relationship } = req.body;
      const updates: Record<string, unknown> = {};
      if (full_name !== undefined) updates.full_name = full_name;
      if (phone_number !== undefined) updates.phone_number = phone_number;
      if (relationship !== undefined) updates.relationship = relationship;
      const { data, error } = await supabaseAdmin
        .from("emergency_contacts")
        .update(updates)
        .eq("id", contactId)
        .eq("owner_id", auth.userId)
        .select()
        .single();
      if (error) throw error;
      return res.status(200).json(data);
    }

    if (req.method === "DELETE") {
      const { error } = await supabaseAdmin
        .from("emergency_contacts")
        .delete()
        .eq("id", contactId)
        .eq("owner_id", auth.userId);
      if (error) throw error;
      return res.status(204).end();
    }

    return res.status(405).json({ detail: "Method not allowed" });
  } catch (err) {
    return handleError(res, err);
  }
}
