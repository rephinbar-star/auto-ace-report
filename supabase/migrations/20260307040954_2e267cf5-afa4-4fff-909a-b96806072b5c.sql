CREATE OR REPLACE FUNCTION public.get_marketplace_listings(
  p_zip_code text DEFAULT NULL,
  p_user_state text DEFAULT NULL,
  p_min_year integer DEFAULT NULL,
  p_max_year integer DEFAULT NULL,
  p_make text DEFAULT NULL,
  p_model text DEFAULT NULL,
  p_max_price numeric DEFAULT NULL,
  p_min_price numeric DEFAULT NULL,
  p_max_mileage integer DEFAULT NULL,
  p_body_style text DEFAULT NULL,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid, year integer, mileage integer, asking_price numeric,
  fetched_at timestamp with time zone, user_id uuid, created_at timestamp with time zone,
  status text, source text, external_id text, condition text, make text, model text,
  "trim" text, fetched_for_zip text, zip_code text, city text, state text, vin text,
  images text[], listing_url text, seller_type text, seller_name text, body_style text,
  fuel_type text, transmission text, drivetrain text, exterior_color text, description text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- Use a stable hash (md5 of id) instead of RANDOM() so ORDER BY is consistent
  -- across all page requests — OFFSET-based pagination produces correct results.
  -- Dealers are interleaved: rn=1 for every dealer first, then rn=2, etc.
  SELECT
    id, year, mileage, asking_price, fetched_at, user_id, created_at, status,
    source, external_id, condition, make, model, "trim", fetched_for_zip, zip_code,
    city, state, vin, images, listing_url, seller_type, seller_name, body_style,
    fuel_type, transmission, drivetrain, exterior_color, description
  FROM (
    SELECT *,
      ROW_NUMBER() OVER (
        PARTITION BY COALESCE(seller_name, id::text)
        ORDER BY md5(id::text)
      ) AS rn
    FROM marketplace_listings
    WHERE status = 'active'
      AND (p_min_year IS NULL OR year >= p_min_year)
      AND (p_max_year IS NULL OR year <= p_max_year)
      AND (p_make IS NULL OR make ILIKE '%' || p_make || '%')
      AND (p_model IS NULL OR model ILIKE '%' || p_model || '%')
      AND (p_max_price IS NULL OR asking_price <= p_max_price)
      AND (p_min_price IS NULL OR asking_price >= p_min_price)
      AND (p_max_mileage IS NULL OR mileage <= p_max_mileage)
      AND (p_body_style IS NULL OR body_style ILIKE '%' || p_body_style || '%')
      AND (
        p_zip_code IS NULL OR (
          fetched_for_zip = p_zip_code
          OR (source = 'user_submitted' AND (p_user_state IS NULL OR state = p_user_state))
        )
      )
  ) ranked
  ORDER BY rn, md5(id::text)
  LIMIT p_limit OFFSET p_offset;
$$