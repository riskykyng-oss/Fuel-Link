import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://sxajkqpcabowhclxkrpk.supabase.co";
const serviceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4YWprcXBjYWJvd2hjbHhrcnBrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzA2NjI1MywiZXhwIjoyMTAyNjQyMjUzfQ.GOZYTKnocL2r_cSsqBoqkiiRE3zAYPmMwYrJwa1wioE";

const supabase = createClient(supabaseUrl, serviceKey);

const users = [
  { phone: "0771234567", email: "+263771234567@fuellink.auth", name: "Tanaka Moyo", role: "customer" },
  { phone: "0712345678", email: "+263712345678@fuellink.auth", name: "Farai Chikwanha", role: "supplier" },
  { phone: "0786669991", email: "+263786669991@fuellink.auth", name: "Tendai Mutasa", role: "supplier" },
  { phone: "0774000001", email: "+263774000001@fuellink.auth", name: "Bongani Ndlovu", role: "supplier" },
];

async function main() {
  for (const u of users) {
    console.log(`\n--- ${u.name} (${u.phone}) ---`);

    // Get existing profile to find auth_id
    const { data: profile } = await supabase
      .from("users")
      .select("id, auth_id")
      .eq("phone_number", u.phone)
      .single();

    if (!profile) {
      console.log("  No profile found, skipping");
      continue;
    }

    // Delete old auth user if exists
    if (profile.auth_id) {
      const { error: delErr } = await supabase.auth.admin.deleteUser(profile.auth_id);
      if (delErr) console.log("  Delete old auth:", delErr.message);
      else console.log("  Deleted old auth user");
    }

    // Create new auth user with email
    const { data: authUser, error: createErr } = await supabase.auth.admin.createUser({
      email: u.email,
      password: "password123",
      email_confirm: true,
      user_metadata: { full_name: u.name, role: u.role, phone_number: u.phone },
    });
    if (createErr) {
      console.log("  Create auth error:", createErr.message);
      continue;
    }
    console.log("  Created auth user:", authUser.user.id);

    // Link profile to new auth user
    const { error: updateErr } = await supabase
      .from("users")
      .update({ auth_id: authUser.user.id })
      .eq("id", profile.id);
    if (updateErr) console.log("  Link error:", updateErr.message);
    else console.log("  Linked to profile");

    // Also update email in users table
    await supabase
      .from("users")
      .update({ email: u.email })
      .eq("id", profile.id);
  }

  console.log("\nDone!");
}

main().catch(console.error);
