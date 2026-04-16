
-- Fix 1: Block authenticated SELECT on admin_otp
CREATE POLICY "Block authenticated select on admin_otp"
ON public.admin_otp
FOR SELECT
TO authenticated
USING (false);

-- Fix 3: Block UPDATE on user_roles to prevent privilege escalation
CREATE POLICY "Block all updates on user_roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (false);
