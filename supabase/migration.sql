-- ============================================================
-- FuelLink: Add Supabase Auth integration
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 1. Add auth_id column to users table (links to auth.users.id)
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Add auth_id column to staff table
ALTER TABLE staff ADD COLUMN IF NOT EXISTS auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE;

-- 3. Create index on auth_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON users(auth_id);
CREATE INDEX IF NOT EXISTS idx_staff_auth_id ON staff(auth_id);

-- 4. Enable Row Level Security on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE sealed_containers ENABLE ROW LEVEL SECURITY;
ALTER TABLE stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispute_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE bids ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies

-- USERS: Users can read/update their own profile
CREATE POLICY "users_select_own" ON users FOR SELECT USING (
  auth_id = auth.uid() OR role = 'admin'
);
CREATE POLICY "users_update_own" ON users FOR UPDATE USING (
  auth_id = auth.uid()
);
CREATE POLICY "users_insert_own" ON users FOR INSERT WITH CHECK (
  auth_id = auth.uid()
);

-- VEHICLES: Users can CRUD their own vehicles
CREATE POLICY "vehicles_select_own" ON vehicles FOR SELECT USING (
  owner_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
);
CREATE POLICY "vehicles_insert_own" ON vehicles FOR INSERT WITH CHECK (
  owner_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
);
CREATE POLICY "vehicles_update_own" ON vehicles FOR UPDATE USING (
  owner_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
);
CREATE POLICY "vehicles_delete_own" ON vehicles FOR DELETE USING (
  owner_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
);

-- SUPPLIER PROFILES: Public read, owner update
CREATE POLICY "supplier_profiles_select_public" ON supplier_profiles FOR SELECT USING (true);
CREATE POLICY "supplier_profiles_update_own" ON supplier_profiles FOR UPDATE USING (
  user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
);
CREATE POLICY "supplier_profiles_insert_own" ON supplier_profiles FOR INSERT WITH CHECK (
  user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
);

-- STATIONS: Public read
CREATE POLICY "stations_select_public" ON stations FOR SELECT USING (true);

-- ORDERS: Customers see their own, suppliers see assigned/offered
CREATE POLICY "orders_select_customer" ON orders FOR SELECT USING (
  customer_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
);
CREATE POLICY "orders_select_supplier" ON orders FOR SELECT USING (
  supplier_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
  OR offered_supplier_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
);
CREATE POLICY "orders_insert_auth" ON orders FOR INSERT WITH CHECK (
  customer_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
);
CREATE POLICY "orders_update_own" ON orders FOR UPDATE USING (
  customer_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
  OR supplier_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
  OR offered_supplier_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
  OR staff_id IN (SELECT id FROM staff WHERE auth_id = auth.uid())
);

-- PAYMENTS: Order participants can read
CREATE POLICY "payments_select_order" ON payments FOR SELECT USING (
  order_id IN (
    SELECT id FROM orders WHERE
      customer_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
      OR supplier_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
  )
);
CREATE POLICY "payments_insert_auth" ON payments FOR INSERT WITH CHECK (
  order_id IN (
    SELECT id FROM orders WHERE customer_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
  )
);
CREATE POLICY "payments_update_auth" ON payments FOR UPDATE USING (
  order_id IN (
    SELECT id FROM orders WHERE customer_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
    OR supplier_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
  )
);

-- PRICE SNAPSHOTS: Public read
CREATE POLICY "price_snapshots_select_public" ON price_snapshots FOR SELECT USING (true);
CREATE POLICY "price_snapshots_insert_service" ON price_snapshots FOR INSERT WITH CHECK (true);

-- EMERGENCY CONTACTS: Users CRUD their own
CREATE POLICY "emergency_contacts_select_own" ON emergency_contacts FOR SELECT USING (
  owner_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
);
CREATE POLICY "emergency_contacts_insert_own" ON emergency_contacts FOR INSERT WITH CHECK (
  owner_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
);
CREATE POLICY "emergency_contacts_update_own" ON emergency_contacts FOR UPDATE USING (
  owner_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
);
CREATE POLICY "emergency_contacts_delete_own" ON emergency_contacts FOR DELETE USING (
  owner_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
);

-- DISPUTES: Customer sees their own
CREATE POLICY "disputes_select_own" ON disputes FOR SELECT USING (
  customer_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
);
CREATE POLICY "disputes_insert_own" ON disputes FOR INSERT WITH CHECK (
  customer_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
);
CREATE POLICY "disputes_update_own" ON disputes FOR UPDATE USING (
  customer_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
);

-- DISPUTE MESSAGES: Related parties can read
CREATE POLICY "dispute_messages_select_own" ON dispute_messages FOR SELECT USING (
  dispute_id IN (
    SELECT id FROM disputes WHERE customer_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
  )
);
CREATE POLICY "dispute_messages_insert_own" ON dispute_messages FOR INSERT WITH CHECK (
  sender_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
);

-- BIDS: Order participants can read, suppliers can insert
CREATE POLICY "bids_select_order" ON bids FOR SELECT USING (
  order_id IN (
    SELECT id FROM orders WHERE
      customer_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
      OR supplier_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
  )
);
CREATE POLICY "bids_insert_own" ON bids FOR INSERT WITH CHECK (
  supplier_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
);
CREATE POLICY "bids_update_own" ON bids FOR UPDATE USING (
  supplier_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
);

-- SEALED CONTAGERS: Provider can manage their own
CREATE POLICY "sealed_containers_select_own" ON sealed_containers FOR SELECT USING (
  provider_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
);
CREATE POLICY "sealed_containers_insert_own" ON sealed_containers FOR INSERT WITH CHECK (
  provider_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
);
CREATE POLICY "sealed_containers_update_own" ON sealed_containers FOR UPDATE USING (
  provider_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
);

-- STAFF: Provider manages, staff reads own
CREATE POLICY "staff_select_provider" ON staff FOR SELECT USING (
  provider_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
  OR auth_id = auth.uid()
);
CREATE POLICY "staff_insert_provider" ON staff FOR INSERT WITH CHECK (
  provider_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
);
CREATE POLICY "staff_update_provider" ON staff FOR UPDATE USING (
  provider_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
  OR auth_id = auth.uid()
);
CREATE POLICY "staff_delete_provider" ON staff FOR DELETE USING (
  provider_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
);

-- ============================================================
-- NOTE: The service_role key used by API serverless functions
-- bypasses RLS. RLS policies only apply to the anon key used
-- by the frontend Supabase client. The API functions use
-- supabaseAdmin (service role) which has full access.
-- ============================================================
