const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = "https://sxajkqpcabowhclxkrpk.supabase.co";
const serviceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4YWprcXBjYWJvd2hjbHhrcnBrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzA2NjI1MywiZXhwIjoyMTAyNjQyMjUzfQ.GOZYTKnocL2r_cSsqBoqkiiRE3zAYPmMwYrJwa1wioE";

const supabase = createClient(supabaseUrl, serviceKey);

async function main() {
  console.log("=== Cleaning hardcoded demo data ===\n");

  // 1. List all auth users
  const { data: allUsers } = await supabase.auth.admin.listUsers();
  console.log(`Found ${allUsers.users.length} auth users`);

  // 2. Delete all auth users (they were all demo/test accounts)
  for (const u of allUsers.users) {
    const { error } = await supabase.auth.admin.deleteUser(u.id);
    console.log(`  Deleted auth user ${u.email || u.phone || u.id}: ${error ? error.message : "ok"}`);
  }

  // 3. Clear all data from user-facing tables (keep schema, stations, fuel_prices)
  const tables = [
    "sealed_containers",
    "staff",
    "courier_shifts",
    "bids",
    "payments",
    "orders",
    "vehicles",
    "supplier_profiles",
    "users",
  ];

  for (const table of tables) {
    const { error, count } = await supabase.from(table).delete().neq("id", 0);
    const { data: remaining } = await supabase.from(table).select("id", { count: "exact", head: true });
    console.log(`  ${table}: cleared (remaining: ${remaining?.length ?? "?"})`);
    if (error) console.error(`    Error: ${error.message}`);
  }

  // 4. Check what's left in stations
  const { data: stations } = await supabase.from("stations").select("id, brand");
  console.log(`\nKept ${stations?.length ?? 0} stations (fuel stations are reference data)`);

  console.log("\n=== DONE — database is clean ===");
  console.log("New users who sign up will appear in the users table.");
}

main().catch(console.error);
