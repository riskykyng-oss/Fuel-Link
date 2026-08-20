-- ============================================================
-- FuelLink: Create demo Supabase Auth users + link to profiles
-- Run AFTER migration.sql
-- ============================================================

-- Create auth users via Supabase Admin
-- Note: passwords are set via Supabase Admin API, not SQL
-- This script links existing profiles to auth users

-- Step 1: First create these users via Supabase Dashboard → Auth → Add User:
--   Phone: 0771234567  Password: password123  (Customer - Tapiwa)
--   Phone: 0712345678  Password: password123  (Fuel Supplier - Mr Ngoni)
--   Phone: 0786669991  Password: password123  (Garage - Steelmix)
--   Phone: 0774000001  Password: password123  (Courier - Moses)

-- Step 2: After creating them, run this to link auth_id to profiles:
-- Replace the UUIDs below with the actual auth.users.id from each created user
-- Find them in: Supabase Dashboard → Auth → Users → click user → copy ID

-- Customer
UPDATE users SET auth_id = (
  SELECT id FROM auth.users WHERE phone = '0771234567' LIMIT 1
) WHERE phone_number = '0771234567';

-- Fuel Supplier
UPDATE users SET auth_id = (
  SELECT id FROM auth.users WHERE phone = '0712345678' LIMIT 1
) WHERE phone_number = '0712345678';

-- Garage
UPDATE users SET auth_id = (
  SELECT id FROM auth.users WHERE phone = '0786669991' LIMIT 1
) WHERE phone_number = '0786669991';

-- Courier
UPDATE users SET auth_id = (
  SELECT id FROM auth.users WHERE phone = '0774000001' LIMIT 1
) WHERE phone_number = '0774000001';
