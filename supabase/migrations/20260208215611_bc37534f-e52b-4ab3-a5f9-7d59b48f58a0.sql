-- Add explicit anonymous deny policies for defense-in-depth
-- These tables already have proper RLS with default-deny, but explicit policies
-- make the security posture clear and documented

-- Profiles: Explicit anonymous deny
CREATE POLICY "Block anonymous access to profiles"
ON public.profiles
FOR ALL
TO anon
USING (false);

-- Subscriptions: Explicit anonymous deny
CREATE POLICY "Block anonymous access to subscriptions"
ON public.subscriptions
FOR ALL
TO anon
USING (false);

-- User roles: Explicit anonymous deny
CREATE POLICY "Block anonymous access to user_roles"
ON public.user_roles
FOR ALL
TO anon
USING (false);

-- Add documentation comments
COMMENT ON POLICY "Block anonymous access to profiles" ON public.profiles IS 'Defense-in-depth: Explicitly denies anonymous access to user profile data';
COMMENT ON POLICY "Block anonymous access to subscriptions" ON public.subscriptions IS 'Defense-in-depth: Explicitly denies anonymous access to subscription/payment data';
COMMENT ON POLICY "Block anonymous access to user_roles" ON public.user_roles IS 'Defense-in-depth: Explicitly denies anonymous access to role assignments';