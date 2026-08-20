-- ============================================================
-- FuelLink: Complete Database Schema for Supabase
-- Run this FIRST in the Supabase SQL Editor
-- ============================================================

-- 1. Create all tables

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  phone_number VARCHAR(20) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE,
  full_name VARCHAR(120) NOT NULL,
  hashed_password VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  phone_verified BOOLEAN DEFAULT false,
  avatar_seed VARCHAR(40) DEFAULT 'fuellink',
  theme VARCHAR(10) DEFAULT 'dark',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  brand VARCHAR(60) NOT NULL,
  address VARCHAR(255) NOT NULL,
  lat FLOAT NOT NULL,
  lng FLOAT NOT NULL,
  petrol_price FLOAT DEFAULT 0.0,
  diesel_price FLOAT DEFAULT 0.0,
  has_petrol BOOLEAN DEFAULT true,
  has_diesel BOOLEAN DEFAULT true,
  is_24h BOOLEAN DEFAULT false,
  photo_url VARCHAR(500)
);

CREATE TABLE IF NOT EXISTS vehicles (
  id SERIAL PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  make VARCHAR(60) NOT NULL,
  model VARCHAR(60) NOT NULL,
  plate_number VARCHAR(20) NOT NULL,
  fuel_type VARCHAR(20) DEFAULT 'petrol',
  tank_capacity_litres FLOAT DEFAULT 50.0,
  is_default BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS supplier_profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_name VARCHAR(120) NOT NULL,
  zera_licence_number VARCHAR(60) NOT NULL,
  vehicle_registration VARCHAR(20) NOT NULL,
  tanker_capacity_litres FLOAT DEFAULT 200.0,
  services_offered VARCHAR(255) DEFAULT 'fuel',
  base_station_id INTEGER REFERENCES stations(id),
  provider_type VARCHAR(20) DEFAULT 'fuel_station',
  verification_status VARCHAR(20) DEFAULT 'pending',
  rejection_reason VARCHAR(255),
  callout_fee FLOAT DEFAULT 0.0,
  labour_rate FLOAT DEFAULT 0.0,
  is_verified BOOLEAN DEFAULT false,
  is_online BOOLEAN DEFAULT false,
  current_lat FLOAT,
  current_lng FLOAT,
  location_updated_at TIMESTAMPTZ,
  rating FLOAT DEFAULT 5.0,
  completed_jobs INTEGER DEFAULT 0,
  rejected_jobs INTEGER DEFAULT 0,
  fuel_stock_petrol FLOAT DEFAULT 0.0,
  fuel_stock_diesel FLOAT DEFAULT 0.0,
  total_earnings FLOAT DEFAULT 0.0
);

CREATE TABLE IF NOT EXISTS staff (
  id SERIAL PRIMARY KEY,
  provider_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  full_name VARCHAR(120) NOT NULL,
  phone_number VARCHAR(20) UNIQUE NOT NULL,
  staff_id VARCHAR(20) UNIQUE NOT NULL,
  hashed_password VARCHAR(255) NOT NULL,
  role_label VARCHAR(30) DEFAULT 'courier',
  shift_state VARCHAR(20) DEFAULT 'offline',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sealed_containers (
  id SERIAL PRIMARY KEY,
  provider_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  serial VARCHAR(40) UNIQUE NOT NULL,
  capacity_litres FLOAT DEFAULT 20.0,
  status VARCHAR(20) DEFAULT 'available',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  reference VARCHAR(20) UNIQUE NOT NULL,
  customer_id INTEGER NOT NULL REFERENCES users(id),
  supplier_id INTEGER REFERENCES users(id),
  station_id INTEGER REFERENCES stations(id),
  offered_supplier_id INTEGER REFERENCES users(id),
  offer_queue TEXT,
  offer_index INTEGER DEFAULT 0,
  offer_expires_at TIMESTAMPTZ,
  staff_id INTEGER REFERENCES staff(id),
  seal_id VARCHAR(40),
  seal_dispatched_at TIMESTAMPTZ,
  seal_arrived_at TIMESTAMPTZ,
  service_type VARCHAR(20) DEFAULT 'fuel',
  fuel_type VARCHAR(20),
  quantity_litres FLOAT DEFAULT 0.0,
  symptom VARCHAR(30),
  symptom_answer VARCHAR(30),
  vehicle_id INTEGER,
  client_request_id VARCHAR(64) UNIQUE,
  pickup_lat FLOAT NOT NULL,
  pickup_lng FLOAT NOT NULL,
  pickup_address VARCHAR(255) DEFAULT 'Dropped pin',
  notes TEXT,
  distance_km FLOAT DEFAULT 0.0,
  fuel_cost FLOAT DEFAULT 0.0,
  delivery_fee FLOAT DEFAULT 0.0,
  service_fee FLOAT DEFAULT 0.0,
  total_amount FLOAT DEFAULT 0.0,
  status VARCHAR(20) DEFAULT 'pending',
  eta_minutes INTEGER DEFAULT 0,
  rating INTEGER,
  handover_code VARCHAR(4),
  photo_url VARCHAR(500),
  created_at TIMESTAMPTZ DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  order_id INTEGER UNIQUE NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  method VARCHAR(30) NOT NULL,
  amount FLOAT NOT NULL,
  status VARCHAR(30) DEFAULT 'created',
  provider_reference VARCHAR(120),
  poll_url VARCHAR(500),
  redirect_url VARCHAR(500),
  instructions TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  paid_at TIMESTAMPTZ,
  payout_status VARCHAR(20) DEFAULT 'held',
  payout_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS price_snapshots (
  id SERIAL PRIMARY KEY,
  petrol_price FLOAT NOT NULL,
  diesel_price FLOAT NOT NULL,
  currency VARCHAR(10) DEFAULT 'USD',
  source VARCHAR(120) DEFAULT 'ZERA',
  source_url VARCHAR(500),
  is_live BOOLEAN DEFAULT false,
  effective_period VARCHAR(40) DEFAULT '',
  fetched_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS verification_codes (
  id SERIAL PRIMARY KEY,
  phone_number VARCHAR(20),
  purpose VARCHAR(20) DEFAULT 'signup',
  code_hash VARCHAR(255) NOT NULL,
  attempts INTEGER DEFAULT 0,
  consumed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS emergency_contacts (
  id SERIAL PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  full_name VARCHAR(120) NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  relationship VARCHAR(60),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS disputes (
  id SERIAL PRIMARY KEY,
  order_id INTEGER UNIQUE NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  customer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS dispute_messages (
  id SERIAL PRIMARY KEY,
  dispute_id INTEGER NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bids (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  supplier_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  proposed_amount FLOAT NOT NULL,
  note TEXT,
  distance_km FLOAT DEFAULT 0.0,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create indexes

CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_number);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_vehicles_owner ON vehicles(owner_id);
CREATE INDEX IF NOT EXISTS idx_supplier_profiles_user ON supplier_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_supplier_profiles_station ON supplier_profiles(base_station_id);
CREATE INDEX IF NOT EXISTS idx_staff_provider ON staff(provider_id);
CREATE INDEX IF NOT EXISTS idx_staff_phone ON staff(phone_number);
CREATE INDEX IF NOT EXISTS idx_staff_staff_id ON staff(staff_id);
CREATE INDEX IF NOT EXISTS idx_sealed_containers_provider ON sealed_containers(provider_id);
CREATE INDEX IF NOT EXISTS idx_sealed_containers_serial ON sealed_containers(serial);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_supplier ON orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_orders_offered ON orders(offered_supplier_id);
CREATE INDEX IF NOT EXISTS idx_orders_station ON orders(station_id);
CREATE INDEX IF NOT EXISTS idx_orders_staff ON orders(staff_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_reference ON orders(reference);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_verification_codes_phone ON verification_codes(phone_number);
CREATE INDEX IF NOT EXISTS idx_emergency_contacts_owner ON emergency_contacts(owner_id);
CREATE INDEX IF NOT EXISTS idx_disputes_order ON disputes(order_id);
CREATE INDEX IF NOT EXISTS idx_disputes_customer ON disputes(customer_id);
CREATE INDEX IF NOT EXISTS idx_dispute_messages_dispute ON dispute_messages(dispute_id);
CREATE INDEX IF NOT EXISTS idx_dispute_messages_sender ON dispute_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_bids_order ON bids(order_id);
CREATE INDEX IF NOT EXISTS idx_bids_supplier ON bids(supplier_id);
CREATE INDEX IF NOT EXISTS idx_bids_status ON bids(status);

-- 3. Add auth_id columns (for Supabase Auth integration)

ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON users(auth_id);
CREATE INDEX IF NOT EXISTS idx_staff_auth_id ON staff(auth_id);

-- 4. Enable Row Level Security

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

-- USERS
CREATE POLICY "users_select_own" ON users FOR SELECT USING (auth_id = auth.uid() OR role = 'admin');
CREATE POLICY "users_update_own" ON users FOR UPDATE USING (auth_id = auth.uid());
CREATE POLICY "users_insert_own" ON users FOR INSERT WITH CHECK (auth_id = auth.uid());

-- VEHICLES
CREATE POLICY "vehicles_select_own" ON vehicles FOR SELECT USING (owner_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));
CREATE POLICY "vehicles_insert_own" ON vehicles FOR INSERT WITH CHECK (owner_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));
CREATE POLICY "vehicles_update_own" ON vehicles FOR UPDATE USING (owner_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));
CREATE POLICY "vehicles_delete_own" ON vehicles FOR DELETE USING (owner_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

-- SUPPLIER PROFILES
CREATE POLICY "supplier_profiles_select_public" ON supplier_profiles FOR SELECT USING (true);
CREATE POLICY "supplier_profiles_update_own" ON supplier_profiles FOR UPDATE USING (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));
CREATE POLICY "supplier_profiles_insert_own" ON supplier_profiles FOR INSERT WITH CHECK (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

-- STATIONS
CREATE POLICY "stations_select_public" ON stations FOR SELECT USING (true);

-- ORDERS
CREATE POLICY "orders_select_customer" ON orders FOR SELECT USING (customer_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));
CREATE POLICY "orders_select_supplier" ON orders FOR SELECT USING (supplier_id IN (SELECT id FROM users WHERE auth_id = auth.uid()) OR offered_supplier_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));
CREATE POLICY "orders_insert_auth" ON orders FOR INSERT WITH CHECK (customer_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));
CREATE POLICY "orders_update_own" ON orders FOR UPDATE USING (customer_id IN (SELECT id FROM users WHERE auth_id = auth.uid()) OR supplier_id IN (SELECT id FROM users WHERE auth_id = auth.uid()) OR offered_supplier_id IN (SELECT id FROM users WHERE auth_id = auth.uid()) OR staff_id IN (SELECT id FROM staff WHERE auth_id = auth.uid()));

-- PAYMENTS
CREATE POLICY "payments_select_order" ON payments FOR SELECT USING (order_id IN (SELECT id FROM orders WHERE customer_id IN (SELECT id FROM users WHERE auth_id = auth.uid()) OR supplier_id IN (SELECT id FROM users WHERE auth_id = auth.uid())));
CREATE POLICY "payments_insert_auth" ON payments FOR INSERT WITH CHECK (order_id IN (SELECT id FROM orders WHERE customer_id IN (SELECT id FROM users WHERE auth_id = auth.uid())));
CREATE POLICY "payments_update_auth" ON payments FOR UPDATE USING (order_id IN (SELECT id FROM orders WHERE customer_id IN (SELECT id FROM users WHERE auth_id = auth.uid()) OR supplier_id IN (SELECT id FROM users WHERE auth_id = auth.uid())));

-- PRICE SNAPSHOTS
CREATE POLICY "price_snapshots_select_public" ON price_snapshots FOR SELECT USING (true);
CREATE POLICY "price_snapshots_insert_service" ON price_snapshots FOR INSERT WITH CHECK (true);

-- EMERGENCY CONTACTS
CREATE POLICY "emergency_contacts_select_own" ON emergency_contacts FOR SELECT USING (owner_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));
CREATE POLICY "emergency_contacts_insert_own" ON emergency_contacts FOR INSERT WITH CHECK (owner_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));
CREATE POLICY "emergency_contacts_update_own" ON emergency_contacts FOR UPDATE USING (owner_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));
CREATE POLICY "emergency_contacts_delete_own" ON emergency_contacts FOR DELETE USING (owner_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

-- DISPUTES
CREATE POLICY "disputes_select_own" ON disputes FOR SELECT USING (customer_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));
CREATE POLICY "disputes_insert_own" ON disputes FOR INSERT WITH CHECK (customer_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));
CREATE POLICY "disputes_update_own" ON disputes FOR UPDATE USING (customer_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

-- DISPUTE MESSAGES
CREATE POLICY "dispute_messages_select_own" ON dispute_messages FOR SELECT USING (dispute_id IN (SELECT id FROM disputes WHERE customer_id IN (SELECT id FROM users WHERE auth_id = auth.uid())));
CREATE POLICY "dispute_messages_insert_own" ON dispute_messages FOR INSERT WITH CHECK (sender_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

-- BIDS
CREATE POLICY "bids_select_order" ON bids FOR SELECT USING (order_id IN (SELECT id FROM orders WHERE customer_id IN (SELECT id FROM users WHERE auth_id = auth.uid()) OR supplier_id IN (SELECT id FROM users WHERE auth_id = auth.uid())));
CREATE POLICY "bids_insert_own" ON bids FOR INSERT WITH CHECK (supplier_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));
CREATE POLICY "bids_update_own" ON bids FOR UPDATE USING (supplier_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

-- SEALED CONTAINERS
CREATE POLICY "sealed_containers_select_own" ON sealed_containers FOR SELECT USING (provider_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));
CREATE POLICY "sealed_containers_insert_own" ON sealed_containers FOR INSERT WITH CHECK (provider_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));
CREATE POLICY "sealed_containers_update_own" ON sealed_containers FOR UPDATE USING (provider_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

-- STAFF
CREATE POLICY "staff_select_provider" ON staff FOR SELECT USING (provider_id IN (SELECT id FROM users WHERE auth_id = auth.uid()) OR auth_id = auth.uid());
CREATE POLICY "staff_insert_provider" ON staff FOR INSERT WITH CHECK (provider_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));
CREATE POLICY "staff_update_provider" ON staff FOR UPDATE USING (provider_id IN (SELECT id FROM users WHERE auth_id = auth.uid()) OR auth_id = auth.uid());
CREATE POLICY "staff_delete_provider" ON staff FOR DELETE USING (provider_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));
