
-- Remove SELECT, UPDATE, and DELETE user policies on admin_otp
-- Edge functions use service role key which bypasses RLS, so no client access is needed
DROP POLICY IF EXISTS "Users can view their own OTP codes" ON public.admin_otp;
DROP POLICY IF EXISTS "Users can mark their own OTP as used" ON public.admin_otp;
DROP POLICY IF EXISTS "Users can delete their own OTP codes" ON public.admin_otp;

-- Add a blanket deny for all operations (combined with existing INSERT deny)
CREATE POLICY "Deny all client access to admin_otp"
ON public.admin_otp
AS RESTRICTIVE
FOR ALL
USING (false);
