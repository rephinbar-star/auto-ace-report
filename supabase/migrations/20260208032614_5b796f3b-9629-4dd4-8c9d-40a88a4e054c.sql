-- Add UPDATE policy to subscriptions (users can update their own subscription)
CREATE POLICY "Users can update their own subscription"
ON public.subscriptions
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Add DELETE policy to subscriptions (GDPR compliance)
CREATE POLICY "Users can delete their own subscription"
ON public.subscriptions
FOR DELETE
USING (auth.uid() = user_id);

-- Add DELETE policy to profiles (GDPR compliance)
CREATE POLICY "Users can delete their own profile"
ON public.profiles
FOR DELETE
USING (auth.uid() = user_id);

-- Add UPDATE policy to admin_otp (allow marking codes as used)
CREATE POLICY "Users can mark their own OTP as used"
ON public.admin_otp
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Add DELETE policy to admin_otp (allow cleanup of own codes)
CREATE POLICY "Users can delete their own OTP codes"
ON public.admin_otp
FOR DELETE
USING (auth.uid() = user_id);

-- Note: INSERT on admin_otp is intentionally restricted to service role only
-- Edge functions create OTPs using service role key which bypasses RLS
-- This prevents unauthorized OTP generation by regular users