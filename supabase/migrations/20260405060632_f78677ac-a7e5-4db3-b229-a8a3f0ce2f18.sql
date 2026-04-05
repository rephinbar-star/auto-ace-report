-- 1. Remove user DELETE policy on subscriptions
DROP POLICY IF EXISTS "Users can delete their own subscription" ON public.subscriptions;

-- 2. Explicit deny-UPDATE on vehicle-images bucket
CREATE POLICY "Block public updates on vehicle images"
ON storage.objects
FOR UPDATE
TO public
USING (false);

-- 3. Explicit deny-UPDATE on history-reports bucket (already covered by the above since it applies to all buckets, but let's be specific)
-- The above policy on storage.objects covers all buckets for UPDATE. That's fine.