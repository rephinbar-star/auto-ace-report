
-- Create marketplace_listings table
CREATE TABLE public.marketplace_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'user_submitted',
  external_id text,
  year integer NOT NULL,
  make text NOT NULL,
  model text NOT NULL,
  trim text,
  mileage integer,
  asking_price numeric NOT NULL,
  zip_code text,
  city text,
  state text,
  vin text,
  images text[] DEFAULT '{}',
  listing_url text,
  seller_type text DEFAULT 'private',
  seller_name text,
  body_style text,
  fuel_type text,
  transmission text,
  drivetrain text,
  exterior_color text,
  description text,
  status text NOT NULL DEFAULT 'active',
  fetched_at timestamptz DEFAULT now(),
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.marketplace_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active listings"
  ON public.marketplace_listings FOR SELECT
  USING (status = 'active' OR user_id = auth.uid());

CREATE POLICY "Authenticated users can create listings"
  ON public.marketplace_listings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners can update their listings"
  ON public.marketplace_listings FOR UPDATE TO authenticated
  USING (source = 'user_submitted' AND auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners can delete their listings"
  ON public.marketplace_listings FOR DELETE TO authenticated
  USING (source = 'user_submitted' AND auth.uid() = user_id);

-- Create marketplace_search_cache table
CREATE TABLE public.marketplace_search_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  search_key text UNIQUE NOT NULL,
  last_fetched_at timestamptz NOT NULL DEFAULT now(),
  total_results integer DEFAULT 0
);

ALTER TABLE public.marketplace_search_cache ENABLE ROW LEVEL SECURITY;

-- Storage policy for marketplace photo uploads
CREATE POLICY "Authenticated users can upload marketplace images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'vehicle-images'
    AND (storage.foldername(name))[1] = 'marketplace'
  );

-- Allow users to read their own uploaded marketplace images
CREATE POLICY "Authenticated users can read marketplace images"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'vehicle-images'
    AND (storage.foldername(name))[1] = 'marketplace'
  );

-- Allow users to delete their own marketplace images
CREATE POLICY "Users can delete their own marketplace images"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'vehicle-images'
    AND (storage.foldername(name))[1] = 'marketplace'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );
