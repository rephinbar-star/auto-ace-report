
-- Add unique constraint on external_id for proper upsert behavior
CREATE UNIQUE INDEX IF NOT EXISTS marketplace_listings_external_id_unique 
  ON marketplace_listings (external_id) 
  WHERE external_id IS NOT NULL;

-- Also clear stale seed data that has no external_id and wrong location
-- (Denver seed data showing in CA searches)
DELETE FROM marketplace_listings WHERE external_id IS NULL AND state NOT IN ('CA','NV','OR','WA','AZ','HI');

-- Clear stale cache so fresh data is fetched
DELETE FROM marketplace_search_cache;
