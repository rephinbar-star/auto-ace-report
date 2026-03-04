
The root cause is clear from the code. The DB query uses `.order("id", { ascending: true })` — a stable alphabetical UUID sort — which means listings always come back grouped by insert batch (i.e. all cars from one dealer fetch together). The round-robin interleave then fights against this but it's purely in-memory and deterministic, so the display order on the page never truly randomizes.

The simplest fix: **use PostgreSQL's native `ORDER BY RANDOM()`** directly via a raw RPC function. PostgREST's `.order()` doesn't support `RANDOM()`, but we can create a SQL function in a migration that returns shuffled listings with all the same filters, then call it via `supabase.rpc()` from the edge function.

**Plan:**

1. **Create a DB migration** — add a `get_marketplace_listings` PostgreSQL function that accepts all the filter params and returns rows with `ORDER BY RANDOM()`. This is the only way to get true random order from the DB.

2. **Update the edge function** — replace the current `.from("marketplace_listings").select(...).order("id")...` block with a call to `adminClient.rpc("get_marketplace_listings", { ... })`. Remove the round-robin interleave logic entirely since the DB randomizes the order natively.

**Migration SQL (new function):**
```sql
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
STABLE
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
```

3. **Edge function change** — replace the query + interleave block (~lines 454–519) with a single `adminClient.rpc("get_marketplace_listings", params)` call. Also run a separate `count` query (standard `.select("id", { count: "exact", head: true })`) to get the total for pagination.

This gives true random order every request with zero in-memory shuffling needed.
