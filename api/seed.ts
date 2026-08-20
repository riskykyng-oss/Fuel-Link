import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../_lib/supabase.js";
import { handleError } from "../_lib/auth.js";

const DEMO_USERS = [
  { phone: "0771234567", password: "password123", full_name: "Tanaka Moyo", email: "tanaka@example.co.zw", role: "customer", avatar_seed: "tanaka-moyo" },
  { phone: "0712345678", password: "password123", full_name: "Farai Chikwanha", email: "farai@zuvadispatch.co.zw", role: "supplier", avatar_seed: "zuva-rapid" },
  { phone: "0786669991", password: "password123", full_name: "Tendai Mutasa", email: null, role: "supplier", avatar_seed: "harare-mobile-mechanics" },
  { phone: "0774000001", password: "password123", full_name: "Bongani Ndlovu", email: null, role: "supplier", avatar_seed: "bongani-ndlovu" },
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const results: string[] = [];

    for (const u of DEMO_USERS) {
      const phone = u.phone.replace(/^(?:\+?263|0)/, "0");

      const { data: existing } = await supabaseAdmin.auth.admin.listUsers({ filter: phone });
      if (existing?.users?.length) {
        results.push(`${phone}: already exists (${existing.users[0].id})`);

        const { data: user } = await supabaseAdmin.from("users").select("id").eq("phone_number", phone).single();
        if (user) {
          await supabaseAdmin.from("users").update({ auth_id: existing.users[0].id }).eq("id", user.id);
          results.push(`  -> linked auth_id to profile`);
        }
        continue;
      }

      const { data: authUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        phone,
        password: u.password,
        phone_confirm: true,
        user_metadata: { full_name: u.full_name },
      });
      if (createError) {
        results.push(`${phone}: ERROR creating auth user - ${createError.message}`);
        continue;
      }
      results.push(`${phone}: created auth user ${authUser.user.id}`);

      const { error: profileError } = await supabaseAdmin.from("users").update({ auth_id: authUser.user.id }).eq("phone_number", phone);
      if (profileError) {
        results.push(`  -> WARNING: could not link auth_id - ${profileError.message}`);
      } else {
        results.push(`  -> linked auth_id to profile`);
      }
    }

    return res.status(200).json({ results });
  } catch (err) {
    return handleError(res, err);
  }
}
