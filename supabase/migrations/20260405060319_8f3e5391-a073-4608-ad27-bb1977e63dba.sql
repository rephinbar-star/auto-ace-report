-- 1. Fix subscription privilege escalation: remove user INSERT/UPDATE policies
DROP POLICY IF EXISTS "Users can insert their own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can update their own subscription" ON public.subscriptions;

-- 2. Fix vehicle-images storage policies: remove misconfigured public-role policies
DROP POLICY IF EXISTS "Service role can upload vehicle images" ON storage.objects;
DROP POLICY IF EXISTS "Service role can update vehicle images" ON storage.objects;
DROP POLICY IF EXISTS "Service role can delete vehicle images" ON storage.objects;

-- Fix INSERT ownership check for marketplace images
DROP POLICY IF EXISTS "Authenticated users can upload marketplace images" ON storage.objects;
CREATE POLICY "Authenticated users can upload marketplace images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'vehicle-images'
  AND (storage.foldername(name))[1] = 'marketplace'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- 3. Schedule OTP cleanup with pg_cron
SELECT cron.schedule(
  'cleanup-expired-otps',
  '0 2 * * *',
  $$SELECT public.cleanup_expired_otps()$$
);