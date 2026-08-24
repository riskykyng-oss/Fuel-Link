import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../../../_lib/supabase.js";
import { requireRole, handleError, ApiError } from "../../../_lib/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const auth = await requireRole(req, "supplier");
    const staffId = Number(req.query.id);
    if (!staffId) throw new ApiError("Invalid staff ID", 400);

    const { data: staff } = await supabaseAdmin
      .from("staff")
      .select("id, provider_id")
      .eq("id", staffId)
      .single();
    if (!staff || staff.provider_id !== auth.userId) {
      throw new ApiError("Staff not found or not yours", 404);
    }

    if (req.method === "PATCH") {
      const { full_name, phone_number, role_label, is_active } = req.body;
      const updates: Record<string, unknown> = {};
      if (full_name !== undefined) updates.full_name = full_name;
      if (role_label !== undefined) updates.role_label = role_label;
      if (is_active !== undefined) updates.is_active = is_active;
      if (phone_number !== undefined) {
        const normalizedPhone = phone_number.startsWith("+") ? phone_number : phone_number.replace(/^0/, "+263");
        const { data: existing } = await supabaseAdmin
          .from("staff")
          .select("id")
          .eq("phone_number", normalizedPhone)
          .neq("id", staffId)
          .single();
        if (existing) throw new ApiError("Phone number already in use", 409);
        updates.phone_number = normalizedPhone;
      }

      const { data: updated, error } = await supabaseAdmin
        .from("staff")
        .update(updates)
        .eq("id", staffId)
        .select()
        .single();
      if (error) throw error;
      return res.status(200).json(updated);
    }

    if (req.method === "DELETE") {
      const { data: activeOrders } = await supabaseAdmin
        .from("orders")
        .select("id")
        .eq("staff_id", staffId)
        .in("status", ["accepted", "in_transit"]);
      if (activeOrders && activeOrders.length > 0) {
        throw new ApiError("Cannot delete staff with active jobs", 400);
      }

      const { error } = await supabaseAdmin.from("staff").delete().eq("id", staffId);
      if (error) throw error;
      return res.status(204).end();
    }

    return res.status(405).json({ detail: "Method not allowed" });
  } catch (err) {
    return handleError(res, err);
  }
}
