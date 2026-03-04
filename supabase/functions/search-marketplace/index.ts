import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "../_shared/rate-limiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

interface SearchParams {
  year?: number;
  make?: string;
  model?: string;
  zipCode?: string;
  radiusMiles?: number;
  maxPrice?: number;
  minPrice?: number;
  maxMileage?: number;
  bodyStyle?: string;
  page?: number;
  limit?: number;
}

function buildCacheKey(p: SearchParams, radiusMiles: number): string {
  return [
    p.make || "any",
    p.model || "any",
    p.year || "any",
    p.zipCode || "any",
    radiusMiles,
    p.maxPrice || "any",
    p.minPrice || "any",
    p.maxMileage || "any",
    p.bodyStyle || "any",
  ].join(":");
}

function mapMarketCheckListing(item: Record<string, unknown>) {
  const build = (item.build as Record<string, unknown>) || {};
  const price = item.price ?? item.dp_price ?? null;
  const dealer = (item.dealer as Record<string, unknown>) || {};
  return {
    external_id: String(item.id),
    source: "marketcheck",
    status: "active",
    year: Number(build.year ?? item.year ?? 0),
    make: String(build.make ?? item.make ?? ""),
    model: String(build.model ?? item.model ?? ""),
    trim: String(build.trim ?? item.trim ?? "") || null,
    mileage: item.miles ? Number(item.miles) : null,
    asking_price: price ? Number(price) : 0,
    vin: item.vin ? String(item.vin) : null,
    listing_url: item.vdp_url ? String(item.vdp_url) : null,
    images: item.media
      ? [(item.media as Record<string, unknown>)?.photo_links as string[] ?? []].flat()
      : [],
    seller_name: dealer.name ? String(dealer.name) : null,
    seller_type: "dealer",
    city: dealer.city ? String(dealer.city) : null,
    state: dealer.state ? String(dealer.state) : null,
    zip_code: dealer.zip ? String(dealer.zip) : null,
    body_style: build.body_type ? String(build.body_type) : null,
    fuel_type: build.fuel_type ? String(build.fuel_type) : null,
    transmission: build.transmission ? String(build.transmission) : null,
    drivetrain: build.drivetrain ? String(build.drivetrain) : null,
    exterior_color: item.exterior_color ? String(item.exterior_color) : null,
    condition: "good",
    fetched_at: new Date().toISOString(),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limiting
  const ip = getClientIp(req);
  const authHeader = req.headers.get("Authorization");
  const isAuthed = !!authHeader?.startsWith("Bearer ");
  const rateLimitConfig = isAuthed ? RATE_LIMITS.standard : RATE_LIMITS.public;
  const rateLimit = checkRateLimit(ip, { ...rateLimitConfig, keyPrefix: "search-marketplace" });

  if (!rateLimit.allowed) {
    return new Response(
      JSON.stringify({ error: "Rate limit exceeded", retryAfter: rateLimit.retryAfter }),
      {
        status: 429,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Retry-After": String(rateLimit.retryAfter),
        },
      }
    );
  }

  try {
    const params: SearchParams = req.method === "POST"
      ? await req.json().catch(() => ({}))
      : Object.fromEntries(new URL(req.url).searchParams);

    const page = Number(params.page ?? 1);
    const limit = Math.min(Number(params.limit ?? 20), 50);
    const radiusMiles = Number(params.radiusMiles ?? 100);
    const offset = (page - 1) * limit;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const marketCheckApiKey = Deno.env.get("MARKETCHECK_API_KEY");

    // Service-role client (bypasses RLS for cache + upsert operations)
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const cacheKey = buildCacheKey(params, radiusMiles);

    // Check cache freshness
    const { data: cacheRow } = await adminClient
      .from("marketplace_search_cache")
      .select("last_fetched_at, total_results")
      .eq("search_key", cacheKey)
      .maybeSingle();

    const isCacheFresh =
      cacheRow &&
      Date.now() - new Date(cacheRow.last_fetched_at).getTime() < CACHE_TTL_MS;

    let fetchedFromMarketCheck = false;

    // --- STALE: fetch from MarketCheck ---
    if (!isCacheFresh && marketCheckApiKey) {
      try {
        const mcUrl = new URL("https://api.marketcheck.com/v2/search/car/active");
        mcUrl.searchParams.set("api_key", marketCheckApiKey);
        mcUrl.searchParams.set("rows", String(limit));
        mcUrl.searchParams.set("start", String(offset));
        if (params.year) mcUrl.searchParams.set("year", String(params.year));
        if (params.make) mcUrl.searchParams.set("make", params.make);
        if (params.model) mcUrl.searchParams.set("model", params.model);
        if (params.zipCode) {
          mcUrl.searchParams.set("zip", params.zipCode);
          mcUrl.searchParams.set("radius", String(radiusMiles));
        }
        if (params.maxPrice) mcUrl.searchParams.set("price_max", String(params.maxPrice));
        if (params.minPrice) mcUrl.searchParams.set("price_min", String(params.minPrice));
        if (params.maxMileage) mcUrl.searchParams.set("miles_max", String(params.maxMileage));
        if (params.bodyStyle) mcUrl.searchParams.set("body_style", params.bodyStyle);

        const mcRes = await fetch(mcUrl.toString());

        if (mcRes.ok) {
          const mcData = await mcRes.json();
          const listings = (mcData.listings ?? []) as Record<string, unknown>[];
          const totalCount = mcData.num_found ?? listings.length;

          if (listings.length > 0) {
            const rows = listings.map(mapMarketCheckListing);

            // Upsert into marketplace_listings
            await adminClient
              .from("marketplace_listings")
              .upsert(rows, { onConflict: "external_id", ignoreDuplicates: false });
          }

          // Update cache
          await adminClient
            .from("marketplace_search_cache")
            .upsert(
              {
                search_key: cacheKey,
                last_fetched_at: new Date().toISOString(),
                total_results: totalCount,
              },
              { onConflict: "search_key" }
            );

          fetchedFromMarketCheck = true;
        } else {
          await mcRes.text(); // consume body
        }
      } catch (mcErr) {
        console.error("MarketCheck fetch failed:", mcErr);
        // Fall through to serve from DB
      }
    }

    // --- Query marketplace_listings with filters ---
    let query = adminClient
      .from("marketplace_listings")
      .select("*", { count: "exact" })
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (params.year) query = query.eq("year", params.year);
    if (params.make) query = query.ilike("make", `%${params.make}%`);
    if (params.model) query = query.ilike("model", `%${params.model}%`);
    if (params.maxPrice) query = query.lte("asking_price", params.maxPrice);
    if (params.minPrice) query = query.gte("asking_price", params.minPrice);
    if (params.maxMileage) query = query.lte("mileage", params.maxMileage);
    if (params.bodyStyle) query = query.ilike("body_style", `%${params.bodyStyle}%`);
    // Note: We don't filter by zip_code locally — seed/cached data spans all regions.
    // Location filtering is handled by MarketCheck API when fetching fresh data.

    const { data: listings, count, error } = await query;

    if (error) {
      console.error("DB query error:", JSON.stringify(error));
      throw new Error(`DB query failed: ${error.message ?? error.code ?? JSON.stringify(error)}`);
    }

    const totalResults =
      cacheRow?.total_results ??
      count ??
      (listings?.length ?? 0);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          listings: listings ?? [],
          total: totalResults,
          page,
          limit,
          cached: !!(isCacheFresh && !fetchedFromMarketCheck),
          source: fetchedFromMarketCheck ? "marketcheck" : "cache",
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("search-marketplace error:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
