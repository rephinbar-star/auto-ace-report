-- Add RLS policies for admin_otp table
-- Only allow users to access their own OTP codes (via service role in edge functions)

-- Policy: Users can only view their own OTP codes
CREATE POLICY "Users can view their own OTP codes"
ON public.admin_otp
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Service role can insert OTPs (done via edge functions with service role)
-- Note: Regular users cannot insert, only service role edge functions can

-- Policy: Service role can update OTPs (mark as used)
-- Note: Regular users cannot update, only service role edge functions can

-- Policy: Service role can delete expired/unused OTPs
-- Note: Regular users cannot delete, only service role edge functions can

-- Add an index for faster lookup by user_id and expiry
CREATE INDEX IF NOT EXISTS idx_admin_otp_user_lookup 
ON public.admin_otp (user_id, used, expires_at);

-- Add cleanup function to remove expired OTPs
CREATE OR REPLACE FUNCTION public.cleanup_expired_otps()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.admin_otp
  WHERE expires_at < now() OR used = true;
END;
$$;