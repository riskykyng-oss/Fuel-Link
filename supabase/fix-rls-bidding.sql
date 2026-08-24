-- Fix: allow suppliers to see pending/bidding orders (not yet assigned to them)
-- and allow customers to see their own orders for bidding view

-- Drop existing restrictive SELECT policies on orders
DROP POLICY IF EXISTS orders_select_customer ON orders;
DROP POLICY IF EXISTS orders_select_supplier ON orders;

-- Customers can see all their own orders
CREATE POLICY "orders_select_customer" ON orders
  FOR SELECT USING (
    customer_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
  );

-- Suppliers can see:
-- 1. Orders assigned to them (supplier_id or offered_supplier_id)
-- 2. All pending/bidding orders (not yet assigned)
CREATE POLICY "orders_select_supplier" ON orders
  FOR SELECT USING (
    supplier_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
    OR offered_supplier_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
    OR status IN ('pending', 'bidding')
  );

-- Suppliers must be able to update orders they bid on (to change status to bidding)
-- The existing orders_update_own should already cover this since offered_supplier_id is set
