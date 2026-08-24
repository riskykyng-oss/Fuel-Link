import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://sxajkqpcabowhclxkrpk.supabase.co";
const serviceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4YWprcXBjYWJvd2hjbHhrcnBrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzA2NjI1MywiZXhwIjoyMTAyNjQyMjUzfQ.GOZYTKnocL2r_cSsqBoqkiiRE3zAYPmMwYrJwa1wioE";
const supabase = createClient(supabaseUrl, serviceKey);

const demoUsers = [
  { phone: "0771234567", email: "263771234567@fuellink.auth", name: "Tanaka Moyo", role: "customer" },
  { phone: "0712345678", email: "263712345678@fuellink.auth", name: "Farai Chikwanha", role: "supplier" },
  { phone: "0786669991", email: "263786669991@fuellink.auth", name: "Tendai Mutasa", role: "supplier" },
  { phone: "0774000001", email: "263774000001@fuellink.auth", name: "Bongani Ndlovu", role: "supplier" },
];

async function main() {
  // 1. Create auth users (no phone, use email)
  const authIds = {};
  for (const u of demoUsers) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: u.email,
      password: "password123",
      email_confirm: true,
      user_metadata: { full_name: u.name, role: u.role },
    });
    if (error) {
      console.log(`Auth create ${u.name}: ${error.message}`);
      continue;
    }
    authIds[u.phone] = data.user.id;
    console.log(`Auth created ${u.name}: ${data.user.id}`);
  }

  // 2. Insert user profiles (with auth_id, NO cascade from this side since auth doesn't exist yet)
  const userIds = {};
  for (const u of demoUsers) {
    const authId = authIds[u.phone];
    if (!authId) continue;

    const { data, error } = await supabase
      .from("users")
      .insert({
        auth_id: authId,
        phone_number: u.phone,
        full_name: u.name,
        email: u.email,
        role: u.role,
        is_active: true,
        phone_verified: true,
        hashed_password: "supabase-managed",
      })
      .select("id")
      .single();
    if (error) {
      console.log(`Profile insert ${u.name}: ${error.message}`);
      continue;
    }
    userIds[u.phone] = data.id;
    console.log(`Profile created ${u.name}: id=${data.id}`);
  }

  // 3. Create supplier profiles
  const suppliers = [
    { phone: "0712345678", company: "Zuva Rapid Dispatch", zera: "ZERA-PPD-0429", plate: "ADP 8821", type: "fuel_station", services: "fuel,towing,jump_start" },
    { phone: "0786669991", company: "Harare Mechanics Hub", zera: "ZERA-PPD-0112", plate: "ABC 1234", type: "garage", services: "mechanic,tyre_change,lockout" },
    { phone: "0774000001", company: "Bongani Courier Services", zera: "ZERA-PPD-0087", plate: "XYZ 5678", type: "fuel_station", services: "fuel,towing" },
  ];

  for (const s of suppliers) {
    const uid = userIds[s.phone];
    if (!uid) continue;

    const { error } = await supabase.from("supplier_profiles").insert({
      user_id: uid,
      company_name: s.company,
      zera_licence_number: s.zera,
      vehicle_registration: s.plate,
      tanker_capacity_litres: 200,
      services_offered: s.services,
      provider_type: s.type,
      callout_fee: 0,
      labour_rate: 0,
      is_verified: true,
      rating: 4.8,
    });
    console.log(`Supplier profile ${s.company}: ${error ? error.message : "ok"}`);
  }

  // 4. Create vehicle for customer
  const customerId = userIds["0771234567"];
  if (customerId) {
    const { error } = await supabase.from("vehicles").insert({
      owner_id: customerId,
      make: "Toyota",
      model: "Corolla",
      plate_number: "ABC 1234",
      fuel_type: "petrol",
      tank_capacity_litres: 50,
      is_default: true,
    });
    console.log(`Vehicle: ${error ? error.message : "ok"}`);
  }

  // 5. Create staff for Bongani
  const bonganiId = userIds["0774000001"];
  if (bonganiId) {
    const staffAuth = await supabase.auth.admin.createUser({
      email: "263774000099@fuellink.auth",
      password: "password123",
      email_confirm: true,
      user_metadata: { full_name: "Staff Demo", role: "staff" },
    });
    if (staffAuth.data) {
      const { error } = await supabase.from("staff").insert({
        provider_id: bonganiId,
        auth_id: staffAuth.data.user.id,
        full_name: "Staff Demo",
        phone_number: "0774000099",
        staff_id: "STF001",
        hashed_password: "password123",
        role_label: "courier",
        shift_state: "offline",
        is_active: true,
      });
      console.log(`Staff: ${error ? error.message : "ok"}`);
    }
  }

  // 6. Verify
  const { data: verify } = await supabase.from("users").select("id, phone_number, full_name, role");
  console.log(`\nFinal users table: ${verify?.length} rows`);
  verify?.forEach(u => console.log(`  ${u.phone_number} - ${u.full_name} (${u.role})`));
}

main().catch(console.error);
