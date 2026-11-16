-- ====================================================================
-- Migration: 20261007_audit_rls_crud_fixes.sql
-- Description: Enable complete CRUD for authorized Admins, Registrars & Cashiers
-- ====================================================================

-- 1. PRODUCTS: Full manage for admin
DROP POLICY IF EXISTS "Enable update for products" ON public.products;
DROP POLICY IF EXISTS "products_admin_manage" ON public.products;

CREATE POLICY "products_admin_manage"
  ON public.products FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

-- 2. SHOP TRANSACTIONS & ITEMS: SELECT for cashiers & admins
DROP POLICY IF EXISTS "shop_transactions_read_staff" ON public.shop_transactions;
DROP POLICY IF EXISTS "shop_transactions_admin_manage" ON public.shop_transactions;
CREATE POLICY "shop_transactions_read_staff"
  ON public.shop_transactions FOR SELECT TO authenticated
  USING (public.get_user_role() IN ('admin', 'cashier'));
CREATE POLICY "shop_transactions_admin_manage"
  ON public.shop_transactions FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

DROP POLICY IF EXISTS "shop_transaction_items_read_staff" ON public.shop_transaction_items;
DROP POLICY IF EXISTS "shop_transaction_items_admin_manage" ON public.shop_transaction_items;
CREATE POLICY "shop_transaction_items_read_staff"
  ON public.shop_transaction_items FOR SELECT TO authenticated
  USING (public.get_user_role() IN ('admin', 'cashier'));
CREATE POLICY "shop_transaction_items_admin_manage"
  ON public.shop_transaction_items FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

-- 3. RECEIPT SEQUENCES: Staff full access
DROP POLICY IF EXISTS "receipt_sequences_staff_all" ON public.receipt_sequences;
CREATE POLICY "receipt_sequences_staff_all"
  ON public.receipt_sequences FOR ALL TO authenticated
  USING (public.get_user_role() IN ('admin', 'cashier'))
  WITH CHECK (public.get_user_role() IN ('admin', 'cashier'));

-- 4. STUDENTS, ADDRESSES, PARENTS: Include academic staff (Registrars)
DROP POLICY IF EXISTS "Admin has full access to students" ON public.students;
CREATE POLICY "Admin has full access to students"
  ON public.students FOR ALL TO authenticated
  USING (public.get_user_role() IN ('admin', 'academic staff'))
  WITH CHECK (public.get_user_role() IN ('admin', 'academic staff'));

DROP POLICY IF EXISTS "Admin has full access to addresses" ON public.student_addresses;
CREATE POLICY "Admin has full access to addresses"
  ON public.student_addresses FOR ALL TO authenticated
  USING (public.get_user_role() IN ('admin', 'academic staff'))
  WITH CHECK (public.get_user_role() IN ('admin', 'academic staff'));

DROP POLICY IF EXISTS "Admin has full access to parents" ON public.student_parents;
CREATE POLICY "Admin has full access to parents"
  ON public.student_parents FOR ALL TO authenticated
  USING (public.get_user_role() IN ('admin', 'academic staff'))
  WITH CHECK (public.get_user_role() IN ('admin', 'academic staff'));

-- 5. WEBSITE TABLES: Admin manage policies
DROP POLICY IF EXISTS "albums_admin_manage" ON public.albums;
CREATE POLICY "albums_admin_manage"
  ON public.albums FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

DROP POLICY IF EXISTS "album_photos_admin_manage" ON public.album_photos;
CREATE POLICY "album_photos_admin_manage"
  ON public.album_photos FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

DROP POLICY IF EXISTS "documents_admin_manage" ON public.documents;
CREATE POLICY "documents_admin_manage"
  ON public.documents FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

DROP POLICY IF EXISTS "calendar_events_admin_manage" ON public.calendar_events;
CREATE POLICY "calendar_events_admin_manage"
  ON public.calendar_events FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');
