
CREATE OR REPLACE FUNCTION public.get_marketplace_listings(
  p_zip_code text DEFAULT NULL,
  p_user_state text DEFAULT NULL,
  p_min_year int DEFAULT NULL,
  p_max_year int DEFAULT NULL,
  p_make text DEFAULT NULL,
  p_model text DEFAULT NULL,
  p_max_price numeric DEFAULT NULL,
  p_min_price numeric DEFAULT NULL,
  p_max_mileage int DEFAULT NULL,
  p_body_style text DEFAULT NULL,
  p_limit int DEFAULT 20,
  p_offset int DEFAULT 0
)
RETURNS SETOF marketplace_listings
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM marketplace_listings
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
  ORDER BY RANDOM()
  LIMIT p_limit OFFSET p_offset;
$$;
