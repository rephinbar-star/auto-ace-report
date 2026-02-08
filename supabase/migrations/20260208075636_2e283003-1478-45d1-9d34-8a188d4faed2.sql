-- The admin_otp table currently has no INSERT policy, which means 
-- no authenticated users can insert via RLS (deny by default).
-- However, we should add an explicit restrictive policy to make this clear
-- and ensure the service role (used by edge functions) is the only way to insert.

-- First, let's add an explicit policy that blocks all user-level inserts
-- This makes the security posture explicit and documented
CREATE POLICY "Block all user inserts - service role only"
ON public.admin_otp
FOR INSERT
TO authenticated
WITH CHECK (false);

-- Add a comment to document the security design
COMMENT ON TABLE public.admin_otp IS 'Admin OTP codes for two-factor authentication. INSERT only allowed via service role (edge functions). Users can only view/update/delete their own OTP codes.';