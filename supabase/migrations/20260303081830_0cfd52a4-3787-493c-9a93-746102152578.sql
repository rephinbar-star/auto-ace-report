
-- Add condition column to marketplace_listings
ALTER TABLE public.marketplace_listings
  ADD COLUMN IF NOT EXISTS condition text DEFAULT 'good';

-- Add unique index on external_id for MarketCheck upsert (idempotent via CREATE UNIQUE INDEX IF NOT EXISTS)
CREATE UNIQUE INDEX IF NOT EXISTS marketplace_listings_external_id_key
  ON public.marketplace_listings (external_id)
  WHERE external_id IS NOT NULL;
