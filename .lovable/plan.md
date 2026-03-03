
# Phase 1: Marketplace Search Infrastructure

## What Already Exists

The database tables (`marketplace_listings`, `marketplace_search_cache`) and storage RLS policies were created in the previous implementation. The `MARKETCHECK_API_KEY` secret is already configured. No additional database migration is required for Phase 1.

## What Needs to Be Built

1. **`search-marketplace` edge function** — cache-first search that queries the local DB, falls back to MarketCheck API, seeds results, then returns a unified response.
2. **Seed data migration** — 10 pre-seeded metro + vehicle-type combinations inserted directly into `marketplace_listings` as `source = 'seed'` so the browse page is never empty on launch.

---

## 1. Edge Function: `supabase/functions/search-marketplace/index.ts`

### Architecture

```text
Request (filters)
      │
      ▼
Check marketplace_search_cache
  └─ cache_key = MD5(normalized filters)
  └─ last_fetched_at < 6 hours ago? → STALE
      │
  ┌───┴──────────────────────────┐
FRESH                          STALE
  │                               │
  ▼                               ▼
Query marketplace_listings    Call MarketCheck /search/car/active
  WHERE matches filters          (paginated, status = active)
  ORDER BY created_at DESC          │
  LIMIT 20                      Upsert into marketplace_listings
                                  (source = 'marketcheck',
                                   ON CONFLICT external_id DO UPDATE)
                                      │
                                  Update marketplace_search_cache
                                  (last_fetched_at = now())
                                      │
                                  Query marketplace_listings
                                  (same filter query)
      │                               │
      └──────────────┬───────────────┘
                     ▼
            Return { listings, total, cached }
```

### Accepted Request Body

```typescript
{
  year?: number;           // e.g. 2020
  make?: string;           // e.g. "Honda"
  model?: string;          // e.g. "Civic"
  zipCode?: string;        // e.g. "10001"
  radiusMiles?: number;    // e.g. 50 (default 100)
  maxPrice?: number;
  minPrice?: number;
  maxMileage?: number;
  bodyStyle?: string;
  page?: number;           // default 1
  limit?: number;          // default 20
}
```

### MarketCheck API Call

The function hits MarketCheck's active listings search endpoint:
```
GET https://api.marketcheck.com/v2/search/car/active
  ?api_key=KEY
  &year=YEAR
  &make=MAKE
  &model=MODEL
  &zip=ZIP
  &radius=RADIUS
  &price_max=MAX_PRICE
  &miles_max=MAX_MILEAGE
  &rows=20
  &start=PAGE*20
```

Each result is upserted into `marketplace_listings` with:
- `source = 'marketcheck'`
- `external_id = listing.id` (ON CONFLICT(external_id) DO UPDATE)
- `status = 'active'`
- `fetched_at = now()`

The function uses the service role key to perform the upsert (bypass RLS on insert for MarketCheck data). Auth is validated in-code for rate limiting purposes, but the endpoint is publicly callable.

### Cache Key

```
cache_key = `${make || 'any'}:${model || 'any'}:${year || 'any'}:${zipCode || 'any'}:${radiusMiles}:${maxPrice || 'any'}:${minPrice || 'any'}:${maxMileage || 'any'}`
```

Cache TTL = 6 hours. If `last_fetched_at` is within 6 hours, skip the MarketCheck call.

### Response Shape

```typescript
{
  success: true,
  data: {
    listings: MarketplaceListing[];  // from marketplace_listings table
    total: number;
    page: number;
    cached: boolean;       // true = served from DB cache
    source: 'cache' | 'marketcheck' | 'mixed';
  }
}
```

### Config Entry (`supabase/config.toml`)

```toml
[functions.search-marketplace]
verify_jwt = false
```

---

## 2. Seed Data Migration

A new migration inserts 10 representative listings covering popular US metros and vehicle types. These serve as "starter" inventory so the browse page isn't empty on launch.

### 10 Seed Combinations

| # | Metro / ZIP | Vehicle | Year | Price | Mileage |
|---|---|---|---|---|---|
| 1 | Los Angeles, CA 90001 | Toyota Camry | 2021 | 24,900 | 32,000 |
| 2 | New York, NY 10001 | Honda CR-V | 2022 | 31,500 | 18,500 |
| 3 | Chicago, IL 60601 | Ford F-150 | 2020 | 38,900 | 47,000 |
| 4 | Houston, TX 77001 | Chevrolet Silverado | 2019 | 34,500 | 58,000 |
| 5 | Phoenix, AZ 85001 | Tesla Model 3 | 2022 | 36,800 | 22,000 |
| 6 | Miami, FL 33101 | Jeep Grand Cherokee | 2021 | 41,200 | 29,000 |
| 7 | Seattle, WA 98101 | Subaru Outback | 2021 | 28,500 | 35,000 |
| 8 | Denver, CO 80201 | Toyota 4Runner | 2020 | 39,900 | 44,000 |
| 9 | Atlanta, GA 30301 | Honda Accord | 2022 | 27,800 | 15,000 |
| 10 | Austin, TX 78701 | Ford Mustang | 2021 | 33,500 | 28,000 |

Inserted with `source = 'seed'`, `status = 'active'`, `user_id = NULL`, `seller_type = 'dealer'`.

The seed migration also adds a `condition` column to `marketplace_listings` (currently missing from the table — the form collects it but the column doesn't exist yet), and adds a `total_count` to `marketplace_search_cache` for pagination metadata.

---

## 3. Database Schema Fix

The existing `marketplace_listings` table is missing a `condition` column (the listing form collects this value but cannot store it). The migration will add it:

```sql
ALTER TABLE public.marketplace_listings
  ADD COLUMN IF NOT EXISTS condition text DEFAULT 'good';
```

---

## Files Created / Modified

| File | Action | Description |
|---|---|---|
| `supabase/functions/search-marketplace/index.ts` | Create | Cache-first search edge function |
| `supabase/config.toml` | Edit | Add `[functions.search-marketplace]` entry |
| `supabase/migrations/TIMESTAMP_seed.sql` | Create | Adds `condition` column + 10 seed listings |

---

## Technical Notes

- **Service role for upsert**: MarketCheck results are upserted using `SUPABASE_SERVICE_ROLE_KEY` (already available as a secret) so they bypass the RLS `user_id = auth.uid()` restriction on INSERT. User-submitted listings still go through the normal authenticated client path.
- **ON CONFLICT strategy**: `marketplace_listings` will get a unique index on `external_id` (non-null) to support the upsert. Added in the same migration.
- **Seed listings are permanent**: They have `source = 'seed'` and will not be overwritten by the MarketCheck upsert path (which only targets `source = 'marketcheck'` via `external_id` conflict resolution).
- **Rate limiting**: The function uses the existing `_shared/rate-limiter.ts` — 10 req/min per IP for public callers, 30 req/min for authenticated.
- **No browse page yet**: This phase only builds the data layer + edge function. The browse UI (`/marketplace`) is Phase 2.
