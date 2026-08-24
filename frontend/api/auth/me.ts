import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../_lib/supabase.js";
import { requireAuth, handleError, ApiError } from "../_lib/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,PATCH,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const auth = await requireAuth(req);

    if (auth.role === "staff") {
      const { data: staff } = await supabaseAdmin
        .from("staff")
        .select("*")
        .eq("id", auth.userId)
        .single();
      if (!staff) throw new ApiError("Staff not found", 404);
      return res.status(200).json(staff);
    }

    const { data: user } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("id", auth.userId)
      .single();
    if (!user) throw new ApiError("User not found", 404);

    if (req.method === "PATCH") {
      const { theme } = req.body;
      if (theme) {
        await supabaseAdmin.from("users").update({ theme }).eq("id", user.id);
        user.theme = theme;
      }
    }

    const { data: vehicles } = await supabaseAdmin
      .from("vehicles")
      .select("*")
      .eq("owner_id", user.id);

    const { data: profile } = await supabaseAdmin
      .from("supplier_profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    return res.status(200).json({
      ...user,
      vehicles: vehicles || [],
      supplier_profile: user.role === "supplier" ? profile : null,
    });
  } catch (err) {
    return handleError(res, err);
  }
}
