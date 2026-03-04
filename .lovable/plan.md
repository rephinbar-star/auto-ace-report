
## Answers to your questions, then the plan

### Can we fetch 5,000 vehicles?

**MarketCheck API constraint:** The `rows` parameter maxes out at **100 per request**. So to get 5,000 vehicles we'd need 50 API calls. Each call hits the MarketCheck server and costs API quota. This is technically feasible in a single edge function invocation, but has trade-offs:

- Edge function timeout: Supabase edge functions timeout at **150 seconds**. 50 sequential API calls at ~300–500ms each = 15–25 seconds total — actually fine.
- MarketCheck rate limits: Most tiers allow hundreds of requests per day, so 50 calls per user search would burn through quota quickly if many users search simultaneously.
- **Recommended compromise:** Fetch **500–1,000 vehicles** (5–10 calls of 100 each) with randomized offsets. This gives strong diversity without hammering the API.

### Database refresh strategy (with future favorites in mind)

Good forward-thinking question. The right approach is a **soft-delete / TTL pattern**:

1. Each listing has a `fetched_at` timestamp.
2. On refresh, instead of deleting all listings, mark listings older than X days as `status = 'expired'` — **except** listings that have been favorited.
3. The favorites table (future) will have a FK to `marketplace_listings.id`. Any listing with a favorite reference is never expired, just re-fetched and updated in place.
4. The browse query already filters `status = 'active'`, so expired listings naturally disappear.

This means: **no favorites are ever broken by a cache refresh.**

---

## Plan

### 1. Fetch Strategy — Randomized offsets, 100 rows each

```text
Step 1: Probe call (rows=1) → get num_found (e.g. 2,400 local listings)
Step 2: Generate 10 random unique start offsets in [0, min(num_found-100, 1000)]
Step 3: Fetch 10 batches × 100 rows = up to 1,000 candidates
Step 4: Deduplicate by external_id
Step 5: Cap at 20 listings per seller_name
Step 6: Insert net-new rows only
```

This gives ~1,000 listings from many different dealers.

### 2. Randomized DB serving

When serving listings from the DB to the user (the `SELECT` query), add `ORDER BY RANDOM()` instead of `ORDER BY created_at DESC`. This ensures browsing page 1 vs page 2 vs reloading shows different cars in different orders — no dealer clustering in the browse UI.

**Caveat:** User's explicit sort selection (price, miles, year) still overrides `RANDOM()`. Only when no explicit sort is chosen does `RANDOM()` apply.

### 3. 100-mile geo guarantee

The MarketCheck call already uses `radius=100`. The DB query filters `fetched_for_zip = params.zipCode`, so only listings fetched for the user's ZIP are served. This is already correct — no changes needed here.

### 4. DB refresh strategy (favorites-safe)

Add a `status` transition on re-fetch:
- When re-fetching a ZIP, mark all existing `marketcheck` listings for that ZIP as `status = 'expired'` **before** inserting the new batch.
- After inserting, any listing that reappeared (matched by `external_id`) gets set back to `active`.
- Future favorites table: listings with favorites are never transitioned to `expired` — the refresh logic will check for FK references before expiring.

---

## Files Changed

- `supabase/functions/search-marketplace/index.ts`
  - Probe call to get `num_found`
  - 10 random offset fetches at `rows=100`
  - Per-dealer cap of 20
  - `ORDER BY RANDOM()` in DB query when no user sort specified
  - Soft-expire old listings on re-fetch instead of keeping stale data

- No DB schema changes needed — `status` column already exists with `'active'`/`'expired'` values.
- No frontend changes needed.
