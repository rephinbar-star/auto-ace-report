-- 1. Fix subscription privilege escalation: remove INSERT/UPDATE for users
DROP POLICY IF EXISTS "Users can insert their own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can update their own subscription" ON public.subscriptions;

-- 2. Fix vehicle-images storage: remove misconfigured public-role policies
DROP POLICY IF EXISTS "Service role can upload vehicle images" ON storage.objects;
DROP POLICY IF EXISTS "Service role can update vehicle images" ON storage.objects;
DROP POLICY IF EXISTS "Service role can delete vehicle images" ON storage.objects;

-- 3. Schedule OTP cleanup daily at 2 AM UTC
SELECT cron.schedule(
  'cleanup-expired-otps',
  '0 2 * * *',
  $$SELECT public.cleanup_expired_otps()$$
);