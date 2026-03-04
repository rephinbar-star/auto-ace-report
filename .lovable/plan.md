
## Root cause analysis

The cache shows `total_results: 38788` for `TOYOTA:any:any:any:92011:100` — MarketCheck knows about tens of thousands of Toyotas near 92011. But the database only has **4 Toyota rows** (all seed data). This means:

1. **MarketCheck IS being called** and returns 50 results, which get upserted. But they're upserted by `external_id`. The next call hits the cache (TTL = 6hrs) and skips MarketCheck entirely — serving only the 4 seed rows instead of the 50 fetched ones.

2. **The upsert conflict key is `external_id`** — seed rows have `external_id = NULL`, which can cause silent upsert failures/collisions.

3. **The `start` offset passed to MarketCheck is wrong** — it uses `(page - 1) * limit` where `limit` is the frontend page size (20), but MarketCheck should always start at 0 to fetch fresh results, not offset by the UI page.

4. **The out-of-radius listing** — the distance sort in the frontend uses ZIP numeric proximity (a terrible approximation — ZIP 80201 Denver vs 92011 Carlsbad has a small numeric diff compared to some California ZIPs). The seed Toyota in Denver (80201) sorts near ZIPs in the 9xxxx range incorrectly.

5. **After fetching from MarketCheck, the DB query still returns only the 4 seed Toyotas** because the upserted MarketCheck rows likely failed silently (NULL external_id conflict on seed rows, or the `ilike '%toyota%'` is case-sensitive against "Toyota").

## Verification of the exact bug

Looking at `mapMarketCheckListing`: it sets `external_id: String(item.id)` — so MarketCheck rows DO have external_ids. The seed rows have `external_id = NULL`. So those shouldn't conflict.

The real bug: after the MarketCheck upsert, the DB query uses `ilike("make", "%Toyota%")` which works. But the cache TTL check is:
- Cache row exists for `TOYOTA:any:any:any:92011:100` with `last_fetched_at` from **01:42** 
- At **03:16** it was refreshed — 1.5hrs later, still within 6hr TTL at next load
- So on subsequent page loads within 6hrs, `isCacheFresh = true`, MarketCheck is skipped, and only the 4 seed rows are returned

**Wait** — if 50 rows were upserted from MarketCheck, why does the DB query only return 4? Let me check: the make stored by MarketCheck is likely uppercase `"TOYOTA"` from the API, and the `ilike` filter is `%Toyota%`. Actually `ilike` is case-insensitive so that should match.

The more likely issue: MarketCheck was never successfully called because the API key wasn't set when seed data was inserted, OR the upsert returned an error that was swallowed. The cache was written even when `listings.length === 0`.

## The real problems to fix

**Problem 1**: The cache is written even when MarketCheck returns 0 listings (because of an API error, bad key, or empty response), locking out fresh fetches for 6 hours with only seed data.

**Problem 2**: The cache key uses uppercase `TOYOTA` (from the filter value) but the frontend send `make: "Toyota"` (title-case from NHTSA). The cache key `buildCacheKey` doesn't normalize case, so `Toyota` vs `TOYOTA` create different cache entries.

**Problem 3**: MarketCheck fetched rows never show up. The edge function upserts them but the conflict is `external_id` — if `external_id` is unique-constrained in the DB, the upsert works. But looking at the schema, there's no unique constraint shown on `external_id`, so the upsert may just be doing INSERTs that silently fail.

**Problem 4**: The Denver Toyota (80201) appears because there's no actual geo-distance filter on the DB query — seed data from Denver shows up when searching near 92011.

**Problem 5**: The `start` parameter sent to MarketCheck equals the frontend pagination offset, so page 2 of the UI fetches rows 21–40 from MarketCheck starting at offset 20 — meaning page 1's results (rows 0–19) are never stored for page 2 searches, and vice versa.

## Plan

### 1. Fix cache invalidation — never cache when 0 results fetched
Only write the cache entry if MarketCheck returned actual listings. Currently it always writes after a call.

### 2. Always start MarketCheck at offset 0 and fetch 50 fresh rows
Remove the `start: offset` — it should always fetch the most relevant 50 for the given search params and zip/radius, not paginate by UI page.

### 3. Normalize make/model case in cache key
Lowercase the make/model before building the cache key so `Toyota` and `TOYOTA` hit the same cache slot.

### 4. Add unique constraint on `external_id` (migration)
The `upsert({ onConflict: "external_id" })` requires a unique constraint to actually upsert. Without it, every call just inserts duplicates or fails silently. Add `UNIQUE` constraint on `external_id` where not null.

### 5. Filter out-of-radius seed/cached listings in DB query
When a zip+radius is provided, filter out listings whose `state` clearly doesn't match. For now: if user ZIP starts with `9` (CA/West), exclude TX/CO/NY listings. Better approach: store a `latitude`/`longitude` on listings and do proper geo-filtering. **Simpler immediate fix**: skip listings where the DB-stored ZIP is numerically more than `radiusMiles * 15` away from the user ZIP (rough heuristic). 

Actually the cleanest fix is: **add a `latitude` and `longitude` column** and use PostGIS or manual distance calc. But that's large scope.

**Immediate pragmatic fix**: when `zipCode` is provided, filter the DB results to only rows where `zip_code` starts with the same first 3 digits OR `state` is in a reasonable set. Given the current small seed dataset, just filter out listings where `state` is far (e.g., TX, CO, NY) when the user ZIP is a California code (9xxxx).

Actually the simplest fix that works: **don't show seed/cached listings from outside the searched state**. Add a filter: if `zipCode` provided and zipCode starts with `9`, only return listings with `state IN ('CA','NV','OR','WA','AZ')` etc. But this is too hardcoded.

**Best fix without PostGIS**: Pass a `state` hint to the DB query derived from the user's ZIP prefix, and filter by it.

### Files to change
- `supabase/functions/search-marketplace/index.ts` — fixes 1, 2, 3, 5
- Database migration — fix 4 (add unique constraint on external_id)
- `src/pages/Marketplace.tsx` — fix 5 (derive state from ZIP for filtering)

### Detailed changes

**Edge function**:
```
- Normalize make/model to lowercase in buildCacheKey
- Only write cache if listings.length > 0
- Always pass start=0 to MarketCheck (remove offset from MC call)  
- Add state filtering to DB query when zipCode provided (lookup state from ZIP prefix map)
```

**Migration**:
```sql
-- Add unique constraint on external_id for proper upsert behavior
-- (only where external_id is not null)
CREATE UNIQUE INDEX IF NOT EXISTS marketplace_listings_external_id_unique 
  ON marketplace_listings (external_id) 
  WHERE external_id IS NOT NULL;
```

**Frontend** (Marketplace.tsx):
```
- ZIP-to-state mapping: derive the user's state from their ZIP prefix
- Pass derived `state` in the request body so the edge function can filter
```

This will ensure:
- MarketCheck results actually get stored (unique index)
- Cache doesn't lock out fresh data after a 0-result call
- Toyota (title-case) and TOYOTA both hit the same cache key
- Denver Toyota doesn't show in Carlsbad CA search
- MarketCheck always fetches the freshest top-50 results regardless of UI page
