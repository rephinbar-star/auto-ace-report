-- Create storage bucket for cached vehicle images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vehicle-images',
  'vehicle-images',
  true,
  5242880, -- 5MB limit per image
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
);

-- Allow public read access to vehicle images
CREATE POLICY "Vehicle images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'vehicle-images');

-- Allow authenticated users to upload images (via edge functions with service role)
CREATE POLICY "Service role can upload vehicle images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'vehicle-images');

-- Allow service role to manage vehicle images
CREATE POLICY "Service role can update vehicle images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'vehicle-images');

CREATE POLICY "Service role can delete vehicle images"
ON storage.objects FOR DELETE
USING (bucket_id = 'vehicle-images');