-- Fix: Make vehicle-images bucket private and add proper RLS policies
-- This prevents anonymous access to cached vehicle images

-- Make the bucket private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'vehicle-images';

-- Drop the existing overly permissive public access policy
DROP POLICY IF EXISTS "Vehicle images are publicly accessible" ON storage.objects;

-- Allow authenticated users to view images from their own reports only
CREATE POLICY "Users can view images from their reports"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'vehicle-images' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.vehicle_reports WHERE user_id = auth.uid()
  )
);

-- Keep the existing upload/update/delete policies for service role
-- The service role used by edge functions can still upload images