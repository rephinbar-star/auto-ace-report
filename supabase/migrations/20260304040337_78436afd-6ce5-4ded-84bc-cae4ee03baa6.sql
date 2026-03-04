ALTER TABLE public.marketplace_listings ADD COLUMN IF NOT EXISTS fetched_for_zip TEXT;

-- Clean up out-of-state listings that were fetched for CA zip but stored with wrong states
DELETE FROM public.marketplace_listings 
WHERE source = 'marketcheck' 
  AND fetched_for_zip IS NULL
  AND state NOT IN ('CA', 'NV', 'AZ', 'OR', 'WA', 'HI', 'AK');

-- Clear cache to allow fresh fetches
DELETE FROM public.marketplace_search_cache;