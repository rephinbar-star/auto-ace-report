-- Harden admin_otp INSERT: convert to RESTRICTIVE false for authenticated
DROP POLICY IF EXISTS "Block all user inserts - service role only" ON public.admin_otp;
CREATE POLICY "Restrict admin_otp inserts to service role"
ON public.admin_otp
AS RESTRICTIVE
FOR INSERT
TO authenticated, anon
WITH CHECK (false);

-- Harden storage.objects UPDATE on history-reports for authenticated users
CREATE POLICY "Restrict updates on history-reports bucket"
ON storage.objects
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (bucket_id <> 'history-reports')
WITH CHECK (bucket_id <> 'history-reports');