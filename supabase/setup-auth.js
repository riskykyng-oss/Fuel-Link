const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = "https://sxajkqpcabowhclxkrpk.supabase.co";
const serviceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4YWprcXBjYWJvd2hjbHhrcnBrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzA2NjI1MywiZXhwIjoyMTAyNjQyMjUzfQ.GOZYTKnocL2r_cSsqBoqkiiRE3zAYPmMwYrJwa1wioE";

const supabase = createClient(supabaseUrl, serviceKey);

async function main() {
  console.log("=== Step 1: Delete wrong auth users ===");
  const { data: allUsers } = await supabase.auth.admin.listUsers();
  for (const u of allUsers.users) {
    if (!u.phone || u.phone === "") {
      console.log(`  Deleting email-only user ${u.id}`);
      await supabase.auth.admin.deleteUser(u.id);
    }
  }

  console.log("\n=== Step 2: Create phone-based auth users ===");
  const DEMO_USERS = [
    { phone: "0771234567", password: "password123", full_name: "Tanaka Moyo" },
    { phone: "0712345678", password: "password123", full_name: "Farai Chikwanha" },
    { phone: "0786669991", password: "password123", full_name: "Tendai Mutasa" },
    { phone: "0774000001", password: "password123", full_name: "Bongani Ndlovu" },
  ];

  const authIds = {};
  for (const u of DEMO_USERS) {
    const { data, error } = await supabase.auth.admin.createUser({
      phone: u.phone,
      password: u.password,
      phone_confirm: true,
      user_metadata: { full_name: u.full_name },
    });
    if (error) {
      console.log(`  ${u.phone}: ERROR - ${error.message}`);
    } else {
      authIds[u.phone] = data.user.id;
      console.log(`  ${u.phone}: created -> ${data.user.id}`);
    }
  }

  console.log("\n=== Step 3: Create user profiles ===");
  const profiles = [
    { phone_number: "0771234567", email: "tanaka@example.co.zw", full_name: "Tanaka Moyo", role: "customer", avatar_seed: "tanaka-moyo" },
    { phone_number: "0712345678", email: "farai@zuvadispatch.co.zw", full_name: "Farai Chikwanha", role: "supplier", avatar_seed: "zuva-rapid" },
    { phone_number: "0786669991", email: null, full_name: "Tendai Mutasa", role: "supplier", avatar_seed: "harare-mobile-mechanics" },
    { phone_number: "0774000001", email: null, full_name: "Bongani Ndlovu", role: "supplier", avatar_seed: "bongani-ndlovu" },
  ];

  for (const p of profiles) {
    const { error } = await supabase.from("users").insert({
      phone_number: p.phone_number,
      email: p.email,
      full_name: p.full_name,
      hashed_password: "supabase-auth",
      role: p.role,
      phone_verified: true,
      avatar_seed: p.avatar_seed,
      auth_id: authIds[p.phone_number],
    });
    if (error) {
      console.log(`  ${p.phone_number}: ERROR - ${error.message}`);
    } else {
      console.log(`  ${p.phone_number}: profile created`);
    }
  }

  console.log("\n=== Step 4: Create supplier profiles ===");
  const { data: zuvaStation } = await supabase.from("stations").select("id").ilike("brand", "%zuva%").ilike("address", "%msasa%").single();
  const { data: engenStation } = await supabase.from("stations").select("id").ilike("brand", "%engen%").ilike("address", "%CBD%").single();

  const { data: farai } = await supabase.from("users").select("id").eq("phone_number", "0712345678").single();
  if (farai) {
    const { error } = await supabase.from("supplier_profiles").insert({
      user_id: farai.id,
      company_name: "Zuva Rapid Dispatch",
      zera_licence_number: "ZERA-PPD-0429",
      vehicle_registration: "ADP 8821",
      tanker_capacity_litres: 10000,
      services_offered: "fuel,towing,jump_start,tyre_change",
      base_station_id: zuvaStation?.id || null,
      provider_type: "fuel_station",
      verification_status: "verified",
      is_verified: true,
      is_online: true,
      fuel_stock_petrol: 8430,
      fuel_stock_diesel: 6210,
      current_lat: zuvaStation ? -17.8419 : -17.8252,
      current_lng: zuvaStation ? 31.1092 : 31.0483,
      rating: 5.0,
      completed_jobs: 12,
      rejected_jobs: 3,
      total_earnings: 478.50,
    });
    console.log(`  Zuva Rapid: ${error ? error.message : "created"}`);
  }

  const { data: tendai } = await supabase.from("users").select("id").eq("phone_number", "0786669991").single();
  if (tendai) {
    const { error } = await supabase.from("supplier_profiles").insert({
      user_id: tendai.id,
      company_name: "Harare Mobile Mechanics",
      zera_licence_number: "ZERA-GAR-0713",
      vehicle_registration: "ADX 4430",
      tanker_capacity_litres: 0,
      services_offered: "mechanic,lockout,tyre_change,jump_start",
      base_station_id: engenStation?.id || null,
      provider_type: "garage",
      verification_status: "verified",
      callout_fee: 18.0,
      labour_rate: 35.0,
      is_verified: true,
      is_online: true,
      current_lat: engenStation ? engenStation.id : -17.8252,
      current_lng: engenStation ? 31.0483 : 31.0483,
      rating: 4.8,
    });
    console.log(`  Harare Mobile Mechanics: ${error ? error.message : "created"}`);
  }

  console.log("\n=== Step 5: Customer vehicle ===");
  const { data: tanaka } = await supabase.from("users").select("id").eq("phone_number", "0771234567").single();
  if (tanaka) {
    const { error } = await supabase.from("vehicles").insert({
      owner_id: tanaka.id,
      make: "Toyota",
      model: "Wish",
      plate_number: "AEK 4412",
      fuel_type: "petrol",
      tank_capacity_litres: 55,
    });
    console.log(`  Vehicle: ${error ? error.message : "created"}`);
  }

  console.log("\n=== Step 6: Staff ===");
  if (farai) {
    const { error } = await supabase.from("staff").insert({
      provider_id: farai.id,
      full_name: "Bongani Ndlovu",
      phone_number: "0774000001",
      staff_id: "ST-0001",
      hashed_password: "supabase-auth",
      role_label: "courier",
      shift_state: "available",
      is_active: true,
    });
    console.log(`  Courier Bongani: ${error ? error.message : "created"}`);
  }

  console.log("\n=== Step 7: Sealed containers ===");
  if (farai) {
    await supabase.from("sealed_containers").insert([
      { provider_id: farai.id, serial: "SC-ZRD-001", capacity_litres: 20, status: "available" },
      { provider_id: farai.id, serial: "SC-ZRD-002", capacity_litres: 20, status: "available" },
    ]);
    console.log("  Containers: created");
  }

  console.log("\n=== DONE ===");
  console.log("Auth users and profiles are ready. You can now deploy to Vercel.");
}

main().catch(console.error);
