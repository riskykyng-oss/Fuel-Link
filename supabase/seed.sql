-- ============================================================
-- FuelLink: Seed data for Supabase
-- Run AFTER schema.sql and after creating auth users
-- ============================================================

-- 1. Stations (Harare service stations)
INSERT INTO stations (name, brand, address, lat, lng, petrol_price, diesel_price, has_petrol, has_diesel, is_24h, photo_url) VALUES
('Zuva Msasa', 'Zuva', 'Mutare Road, Msasa', -17.8419, 31.1092, 0.00, -0.01, true, true, true, '/stations/zuva.svg'),
('Total Borrowdale', 'TotalEnergies', 'Borrowdale Road, Borrowdale', -17.7614, 31.0913, 0.03, 0.02, true, true, true, '/stations/total.svg'),
('Puma Avondale', 'Puma Energy', 'King George Road, Avondale', -17.7982, 31.0347, 0.02, 0.01, true, false, false, '/stations/puma.svg'),
('Engen Samora Machel', 'Engen', 'Samora Machel Avenue, CBD', -17.8252, 31.0483, 0.01, 0.00, true, true, true, '/stations/engen.svg'),
('Redan Belvedere', 'Redan', 'Samora Machel Ave West, Belvedere', -17.8244, 31.0112, -0.02, -0.02, true, false, false, '/stations/redan.svg'),
('Petrotrade Southerton', 'Petrotrade', 'Highfield Road, Southerton', -17.8621, 31.0031, -0.03, -0.03, true, true, true, '/stations/petrotrade.svg'),
('Zuva Chisipite', 'Zuva', 'Hindhead Avenue, Chisipite', -17.7758, 31.1141, 0.03, 0.02, true, false, false, '/stations/zuva.svg'),
('Total Westgate', 'TotalEnergies', 'Harare Drive, Westgate', -17.7621, 30.9758, 0.02, 0.01, true, true, true, '/stations/total.svg'),
('Engen Highfield', 'Engen', 'Highfield Road, Highfield', -17.8894, 30.9989, -0.02, -0.01, true, true, true, '/stations/engen.svg'),
('Puma Chitungwiza', 'Puma Energy', 'Chikwanha, Chitungwiza', -17.9938, 31.0761, -0.01, -0.01, true, true, true, '/stations/puma.svg')
ON CONFLICT DO NOTHING;

-- 2. Price snapshot (ZERA national cap)
INSERT INTO price_snapshots (petrol_price, diesel_price, currency, source, is_live, effective_period) VALUES
(1.57, 1.54, 'USD', 'ZERA', true, '2025-Q1')
ON CONFLICT DO NOTHING;

-- 3. Demo users (hashed_password is a bcrypt hash of 'password123')
-- The password hashes are for the old Python bcrypt system. With Supabase Auth,
-- passwords are managed by Supabase. These users are created via Supabase Auth dashboard.
-- This script just creates the profile rows and links them.

-- Customer
INSERT INTO users (phone_number, email, full_name, hashed_password, role, is_active, phone_verified, avatar_seed)
VALUES ('0771234567', 'tanaka@example.co.zw', 'Tanaka Moyo', 'supabase-auth', 'customer', true, true, 'tanaka-moyo')
ON CONFLICT (phone_number) DO NOTHING;

-- Supplier (fuel station)
INSERT INTO users (phone_number, email, full_name, hashed_password, role, is_active, phone_verified, avatar_seed)
VALUES ('0712345678', 'farai@zuvadispatch.co.zw', 'Farai Chikwanha', 'supabase-auth', 'supplier', true, true, 'zuva-rapid')
ON CONFLICT (phone_number) DO NOTHING;

-- Supplier (garage)
INSERT INTO users (phone_number, email, full_name, hashed_password, role, is_active, phone_verified, avatar_seed)
VALUES ('0786669991', NULL, 'Tendai Mutasa', 'supabase-auth', 'supplier', true, true, 'harare-mobile-mechanics')
ON CONFLICT (phone_number) DO NOTHING;

-- 4. Link auth_id (run after creating auth users in Supabase dashboard)
UPDATE users SET auth_id = (SELECT id FROM auth.users WHERE phone = '0771234567' LIMIT 1) WHERE phone_number = '0771234567';
UPDATE users SET auth_id = (SELECT id FROM auth.users WHERE phone = '0712345678' LIMIT 1) WHERE phone_number = '0712345678';
UPDATE users SET auth_id = (SELECT id FROM auth.users WHERE phone = '0786669991' LIMIT 1) WHERE phone_number = '0786669991';
UPDATE users SET auth_id = (SELECT id FROM auth.users WHERE phone = '0774000001' LIMIT 1) WHERE phone_number = '0774000001';

-- 5. Supplier profile (fuel station - Zuva Rapid Dispatch)
INSERT INTO supplier_profiles (user_id, company_name, zera_licence_number, vehicle_registration, tanker_capacity_litres, services_offered, base_station_id, provider_type, verification_status, is_verified, is_online, fuel_stock_petrol, fuel_stock_diesel, rating, completed_jobs, rejected_jobs, total_earnings)
SELECT u.id, 'Zuva Rapid Dispatch', 'ZERA-PPD-0429', 'ADP 8821', 10000, 'fuel,towing,jump_start,tyre_change', s.id, 'fuel_station', 'verified', true, true, 8430, 6210, 5.0, 12, 3, 478.50
FROM users u LEFT JOIN stations s ON s.brand = 'Zuva' AND s.address LIKE '%Msasa%'
WHERE u.phone_number = '0712345678'
ON CONFLICT DO NOTHING;

-- 6. Supplier profile (garage - Harare Mobile Mechanics)
INSERT INTO supplier_profiles (user_id, company_name, zera_licence_number, vehicle_registration, tanker_capacity_litres, services_offered, base_station_id, provider_type, verification_status, callout_fee, labour_rate, is_verified, is_online, rating)
SELECT u.id, 'Harare Mobile Mechanics', 'ZERA-GAR-0713', 'ADX 4430', 0, 'mechanic,lockout,tyre_change,jump_start', s.id, 'garage', 'verified', 18.0, 35.0, true, true, 4.8
FROM users u LEFT JOIN stations s ON s.brand = 'Engen' AND s.address LIKE '%CBD%'
WHERE u.phone_number = '0786669991'
ON CONFLICT DO NOTHING;

-- 7. Customer vehicle
INSERT INTO vehicles (owner_id, make, model, plate_number, fuel_type, tank_capacity_litres, is_default)
SELECT id, 'Toyota', 'Wish', 'AEK 4412', 'petrol', 55.0, true
FROM users WHERE phone_number = '0771234567'
AND NOT EXISTS (SELECT 1 FROM vehicles WHERE owner_id = (SELECT id FROM users WHERE phone_number = '0771234567'))
ON CONFLICT DO NOTHING;

-- 8. Staff (courier for fuel supplier)
INSERT INTO staff (provider_id, full_name, phone_number, staff_id, hashed_password, role_label, shift_state, is_active)
SELECT u.id, 'Bongani Ndlovu', '0774000001', 'ST-0001', 'supabase-auth', 'courier', 'available', true
FROM users u WHERE u.phone_number = '0712345678'
AND NOT EXISTS (SELECT 1 FROM staff WHERE phone_number = '0774000001')
ON CONFLICT DO NOTHING;

-- 9. Staff (mechanic for garage)
INSERT INTO staff (provider_id, full_name, phone_number, staff_id, hashed_password, role_label, shift_state, is_active)
SELECT u.id, 'Ropafadzo Chikoro', '0774000002', 'ST-0002', 'supabase-auth', 'mechanic', 'available', true
FROM users u WHERE u.phone_number = '0786669991'
AND NOT EXISTS (SELECT 1 FROM staff WHERE phone_number = '0774000002')
ON CONFLICT DO NOTHING;

-- 10. Staff (tow driver for garage)
INSERT INTO staff (provider_id, full_name, phone_number, staff_id, hashed_password, role_label, shift_state, is_active)
SELECT u.id, 'Tapiwa Mufaro', '0774000003', 'ST-0003', 'supabase-auth', 'tow_driver', 'available', true
FROM users u WHERE u.phone_number = '0786669991'
AND NOT EXISTS (SELECT 1 FROM staff WHERE phone_number = '0774000003')
ON CONFLICT DO NOTHING;

-- 11. Sealed containers for fuel supplier
INSERT INTO sealed_containers (provider_id, serial, capacity_litres, status)
SELECT u.id, 'SC-ZRD-001', 20.0, 'available'
FROM users u WHERE u.phone_number = '0712345678'
AND NOT EXISTS (SELECT 1 FROM sealed_containers WHERE serial = 'SC-ZRD-001')
ON CONFLICT DO NOTHING;

INSERT INTO sealed_containers (provider_id, serial, capacity_litres, status)
SELECT u.id, 'SC-ZRD-002', 20.0, 'available'
FROM users u WHERE u.phone_number = '0712345678'
AND NOT EXISTS (SELECT 1 FROM sealed_containers WHERE serial = 'SC-ZRD-002')
ON CONFLICT DO NOTHING;
