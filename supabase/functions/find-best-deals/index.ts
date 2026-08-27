/**
 * find-best-deals — isolated MarketCheck-backed "best deal" search.
 *
 * This function is intentionally standalone: it does not touch the marketplace
 * cache tables, the analysis pipeline, or any existing edge function.
 * The MARKETCHECK_API_KEY is only ever read here, server-side.
 */
import { checkRateLimit, getClientIp, RATE_LIMITS } from "../_shared/rate-limiter.ts";
import {
  amortizedMonthlyPayment,
  badgeForScore,
  cohortAdvantagePercent,
  discountFromMsrp,
  discountPercent,
  leaseEffectiveMonthly,
  leaseValueRatio,
  paymentLabel,
  rankDeals,
  round2,
  scoreDeal,
  type DealType,
  type PaymentBasis,
  type ScoreBounds,
} from "./deal-math.ts";
import {
  BENCHMARK_SOURCES,
  loadBenchmarkDocuments,
  type BenchmarkVehicle,
  type ValidationResult,
} from "./benchmarks.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MC_BASE = "https://api.marketcheck.com/v2/search/car/active";
const MAX_CANDIDATES = 150;
const ROWS = 50;
const UPSTREAM_TIMEOUT_MS = 12_000;
const DATA_SOURCE = "MarketCheck Inventory Search (active listings)";

const ZIP_PREFIX_STATE: Array<[number, number, string]> = [
  [600, 629, "IL"], [700, 715, "LA"], [750, 799, "TX"], [800, 816, "CO"],
  [850, 865, "AZ"], [889, 898, "NV"], [900, 961, "CA"], [967, 968, "HI"],
  [970, 979, "OR"], [980, 994, "WA"], [995, 999, "AK"], [100, 149, "NY"],
  [150, 196, "PA"], [200, 205, "DC"], [206, 219, "MD"], [220, 246, "VA"],
  [270, 289, "NC"], [290, 299, "SC"], [300, 319, "GA"], [320, 349, "FL"],
  [350, 369, "AL"], [370, 385, "TN"], [400, 427, "KY"], [430, 459, "OH"],
  [460, 479, "IN"], [480, 499, "MI"], [500, 528, "IA"], [530, 549, "WI"],
  [550, 567, "MN"], [630, 658, "MO"], [660, 679, "KS"], [680, 693, "NE"],
  [730, 749, "OK"], [840, 847, "UT"], [870, 884, "NM"], [820, 831, "WY"],
  [832, 838, "ID"], [590, 599, "MT"], [10, 27, "MA"], [28, 29, "RI"],
  [30, 38, "NH"], [39, 49, "ME"], [50, 59, "VT"], [60, 69, "CT"],
  [70, 89, "NJ"], [197, 199, "DE"],
];

function stateForZip(zip: string): string | null {
  const prefix = Number(zip.slice(0, 3));
  for (const [lo, hi, st] of ZIP_PREFIX_STATE) {
    if (prefix >= lo && prefix <= hi) return st;
  }
  return null;
}

// ── Request validation ───────────────────────────────────────────────────────
interface SearchRequest {
  dealType: "any" | "lease" | "purchase";
  maxMonthlyPayment: number | null;
  annualMileage: "any" | "7500" | "10000" | "12000" | "15000";
  maxDueAtSigning: number | null;
  vehicleType: "any" | "sedan" | "truck" | "suv";
  powertrain: "any" | "ev" | "hybrid" | "gas";
  zip: string;
  radius: number;
  brand: string | null;
  termMonths: number;
  aprPercent: number;
  downPayment: number;
}

class ValidationError extends Error {}

function enumOr<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  if (typeof value === "string" && (allowed as readonly string[]).includes(value)) return value as T;
  if (value === undefined || value === null || value === "") return fallback;
  throw new ValidationError(`Invalid value: ${String(value)}`);
}

function optionalNumber(value: unknown, min: number, max: number, label: string): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) {
    throw new ValidationError(`${label} must be a number between ${min} and ${max}.`);
  }
  return n;
}

function parseRequest(body: Record<string, unknown>): SearchRequest {
  const zip = String(body.zip ?? "").trim();
  if (!/^\d{5}$/.test(zip)) throw new ValidationError("A valid five-digit ZIP code is required.");

  const radiusRaw = Number(body.radius ?? 100);
  const radius = [25, 50, 100].includes(radiusRaw) ? radiusRaw : 100;

  const termRaw = Number(body.termMonths ?? 72);
  const termMonths = [48, 60, 72, 84].includes(termRaw) ? termRaw : 72;

  const aprPercent = optionalNumber(body.aprPercent ?? 7.49, 0, 30, "APR") ?? 7.49;
  const downPayment = optionalNumber(body.downPayment ?? 0, 0, 500_000, "Down payment") ?? 0;

  const brandRaw = typeof body.brand === "string" ? body.brand.trim() : "";
  const brand = brandRaw && brandRaw.toLowerCase() !== "any" ? brandRaw.slice(0, 40) : null;

  return {
    dealType: enumOr(body.dealType, ["any", "lease", "purchase"] as const, "any"),
    maxMonthlyPayment: optionalNumber(body.maxMonthlyPayment, 1, 20_000, "Max monthly payment"),
    annualMileage: enumOr(
      body.annualMileage,
      ["any", "7500", "10000", "12000", "15000"] as const,
      "any"
    ),
    maxDueAtSigning: optionalNumber(body.maxDueAtSigning, 0, 200_000, "Max due at signing"),
    vehicleType: enumOr(body.vehicleType, ["any", "sedan", "truck", "suv"] as const, "any"),
    powertrain: enumOr(body.powertrain, ["any", "ev", "hybrid", "gas"] as const, "any"),
    zip,
    radius,
    brand,
    termMonths,
    aprPercent,
    downPayment,
  };
}

// ── MarketCheck plumbing ─────────────────────────────────────────────────────
const BODY_TYPE_MAP: Record<string, string> = {
  sedan: "Sedan",
  truck: "Pickup",
  suv: "SUV",
};

function applyPowertrain(url: URL, powertrain: SearchRequest["powertrain"]) {
  if (powertrain === "ev") {
    url.searchParams.set("fuel_type", "Electric");
    url.searchParams.set("powertrain_type", "BEV");
  } else if (powertrain === "hybrid") {
    url.searchParams.set("powertrain_type", "HEV,MHEV,PHEV");
  } else if (powertrain === "gas") {
    url.searchParams.set("fuel_type", "Gasoline,Premium Unleaded,Unleaded");
    url.searchParams.set("powertrain_type", "Combustion");
  }
}

function buildUrl(
  apiKey: string,
  req: SearchRequest,
  mode: DealType,
  start: number
): string {
  const url = new URL(MC_BASE);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("country", "us");
  url.searchParams.set("zip", req.zip);
  url.searchParams.set("radius", String(Math.min(req.radius, 100)));
  url.searchParams.set("rows", String(ROWS));
  url.searchParams.set("start", String(start));
  url.searchParams.set("has_price", "true");
  url.searchParams.set("dedup", "true");
  url.searchParams.set("photo_links", "true");
  if (req.brand) url.searchParams.set("make", req.brand);
  if (req.vehicleType !== "any") url.searchParams.set("body_type", BODY_TYPE_MAP[req.vehicleType]);
  applyPowertrain(url, req.powertrain);
  if (mode === "lease") {
    url.searchParams.set("car_type", "new");
    url.searchParams.set("include_lease", "true");
  } else {
    url.searchParams.set("include_finance", "true");
  }
  return url.toString();
}

type McListing = Record<string, any>;

async function fetchCandidates(
  apiKey: string,
  req: SearchRequest,
  mode: DealType,
  cap: number,
  notices: string[]
): Promise<{ listings: McListing[]; upstreamFailed: boolean }> {
  const listings: McListing[] = [];
  let upstreamFailed = false;
  for (let start = 0; listings.length < cap; start += ROWS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
    try {
      const res = await fetch(buildUrl(apiKey, req, mode, start), {
        signal: controller.signal,
      });
      if (res.status === 429) {
        notices.push("MarketCheck rate limit reached — results may be partial.");
        upstreamFailed = listings.length === 0;
        break;
      }
      if (!res.ok) {
        const text = await res.text();
        console.error(`MarketCheck ${mode} error ${res.status}: ${text.slice(0, 200)}`);
        upstreamFailed = listings.length === 0;
        break;
      }
      const data = await res.json();
      const page = (data.listings ?? []) as McListing[];
      listings.push(...page);
      if (page.length < ROWS) break;
    } catch (err) {
      console.error(`MarketCheck ${mode} fetch failed:`, err);
      upstreamFailed = listings.length === 0;
      break;
    } finally {
      clearTimeout(timer);
    }
    // Polite pacing between pages.
    await new Promise((r) => setTimeout(r, 250));
  }
  return { listings: listings.slice(0, cap), upstreamFailed };
}

// ── Normalization ────────────────────────────────────────────────────────────
function safeUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const u = new URL(value);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

function clean(value: unknown, max = 120): string | null {
  if (typeof value !== "string") return null;
  const s = value.replace(/[<>]/g, "").trim();
  return s ? s.slice(0, max) : null;
}

function num(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value.replace(/[$,]/g, "")) : Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

interface Candidate {
  listingId: string;
  vin: string | null;
  dealType: DealType;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  heading: string | null;
  inventoryType: string | null;
  imageUrl: string | null;
  dealerName: string | null;
  city: string | null;
  state: string | null;
  distanceMiles: number | null;
  vdpUrl: string | null;
  domActive: number | null;
  price: number | null;
  msrp: number | null;
  monthlyPayment: number | null;
  paymentBasis: PaymentBasis;
  termMonths: number | null;
  advertisedDownPayment: number | null;
  effectiveMonthly: number | null;
  leaseValueRatio: number | null;
}

function normalize(listing: McListing, mode: DealType, req: SearchRequest): Candidate | null {
  const build = (listing.build ?? {}) as McListing;
  const dealer = (listing.dealer ?? {}) as McListing;
  const media = (listing.media ?? {}) as McListing;
  const listingId = clean(listing.id ?? listing.vin, 64);
  if (!listingId) return null;

  const price = num(listing.price);
  const msrp = num(listing.msrp) ?? num(build.msrp);

  const photos = Array.isArray(media.photo_links) ? media.photo_links : [];
  const cachedPhotos = Array.isArray(media.photo_links_cached) ? media.photo_links_cached : [];
  const imageUrl = safeUrl(cachedPhotos[0]) ?? safeUrl(photos[0]);

  const base: Candidate = {
    listingId,
    vin: clean(listing.vin, 20),
    dealType: mode,
    year: Number.isFinite(Number(build.year)) ? Number(build.year) : null,
    make: clean(build.make, 40),
    model: clean(build.model, 60),
    trim: clean(build.trim, 60),
    heading: clean(listing.heading, 160),
    inventoryType: clean(listing.inventory_type, 20),
    imageUrl,
    dealerName: clean(dealer.name, 80),
    city: clean(dealer.city, 60),
    state: clean(dealer.state, 4),
    distanceMiles: Number.isFinite(Number(listing.dist)) ? round2(Number(listing.dist)) : null,
    vdpUrl: safeUrl(listing.vdp_url),
    domActive: Number.isFinite(Number(listing.dom_active)) ? Number(listing.dom_active) : null,
    price,
    msrp,
    monthlyPayment: null,
    paymentBasis: "advertised",
    termMonths: null,
    advertisedDownPayment: null,
    effectiveMonthly: null,
    leaseValueRatio: null,
  };

  if (mode === "lease") {
    const lease = (listing.leasing_options ?? {}) as McListing;
    const monthly = num(lease.estimated_monthly_payment);
    if (!monthly) return null; // never fabricate lease terms
    const down = num(lease.down_payment) ?? 0;
    const term = Number.isFinite(Number(lease.lease_term)) ? Number(lease.lease_term) : null;
    const effective = leaseEffectiveMonthly(monthly, down, term);
    return {
      ...base,
      monthlyPayment: monthly,
      paymentBasis: "advertised",
      termMonths: term,
      advertisedDownPayment: down,
      effectiveMonthly: effective,
      leaseValueRatio: leaseValueRatio(effective, msrp),
    };
  }

  const finance = (listing.financing_options ?? {}) as McListing;
  const advertised = num(finance.estimated_monthly_payment);
  if (advertised) {
    const term = Number.isFinite(Number(finance.loan_term)) ? Number(finance.loan_term) : null;
    const down = num(finance.down_payment);
    return {
      ...base,
      monthlyPayment: advertised,
      paymentBasis: "advertised",
      termMonths: term,
      advertisedDownPayment: down,
      effectiveMonthly: advertised,
    };
  }

  const estimated = amortizedMonthlyPayment(price, req.aprPercent, req.termMonths, req.downPayment);
  if (estimated === null) return null;
  return {
    ...base,
    monthlyPayment: estimated,
    paymentBasis: "estimated",
    termMonths: req.termMonths,
    advertisedDownPayment: null,
    effectiveMonthly: estimated,
  };
}

function preferenceFit(c: Candidate, req: SearchRequest): number {
  let hits = 0;
  let checks = 0;
  if (req.brand) {
    checks++;
    if (c.make && c.make.toLowerCase() === req.brand.toLowerCase()) hits++;
  }
  if (req.maxMonthlyPayment) {
    checks++;
    if (c.monthlyPayment !== null && c.monthlyPayment <= req.maxMonthlyPayment * 0.9) hits++;
  }
  if (req.maxDueAtSigning !== null && c.dealType === "lease") {
    checks++;
    if (c.advertisedDownPayment !== null && c.advertisedDownPayment <= req.maxDueAtSigning * 0.9) hits++;
  }
  checks++;
  if (c.distanceMiles !== null && c.distanceMiles <= 25) hits++;
  return checks === 0 ? 0.5 : hits / checks;
}

function passesFilters(c: Candidate, req: SearchRequest): boolean {
  if (req.maxMonthlyPayment !== null) {
    if (c.monthlyPayment === null || c.monthlyPayment > req.maxMonthlyPayment) return false;
  }
  if (req.maxDueAtSigning !== null && c.dealType === "lease") {
    if (c.advertisedDownPayment !== null && c.advertisedDownPayment > req.maxDueAtSigning) return false;
  }
  return true;
}

function boundsFor(values: (number | null)[], fallback: [number, number]): [number, number] {
  const clean = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (clean.length < 2) return fallback;
  const min = Math.min(...clean);
  const max = Math.max(...clean);
  if (max <= min) return fallback;
  return [min, max];
}

// ── Handler ──────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const retrievedAt = new Date().toISOString();
  const emptyBase = {
    deals: [],
    candidatesEvaluated: 0,
    leaseCandidates: 0,
    purchaseCandidates: 0,
    retrievedAt,
    notices: [] as string[],
    validationSources: [] as unknown[],
  };

  try {
    const rate = checkRateLimit(getClientIp(req), {
      ...RATE_LIMITS.heavy,
      keyPrefix: "find-best-deals",
    });
    if (!rate.allowed) {
      return json(
        {
          ...emptyBase,
          success: false,
          errorCode: "rate_limited",
          error: `Too many searches. Try again in ${rate.retryAfter ?? 60}s.`,
        },
        429
      );
    }

    let parsed: SearchRequest;
    try {
      parsed = parseRequest((await req.json()) ?? {});
    } catch (err) {
      return json(
        {
          ...emptyBase,
          success: false,
          errorCode: "invalid_request",
          error: err instanceof ValidationError ? err.message : "Invalid request.",
        },
        400
      );
    }

    const apiKey = Deno.env.get("MARKETCHECK_API_KEY");
    if (!apiKey) {
      return json(
        {
          ...emptyBase,
          success: false,
          errorCode: "not_configured",
          error: "Live inventory search is not configured. No results can be shown.",
        },
        503
      );
    }

    const notices: string[] = [];
    const modes: DealType[] =
      parsed.dealType === "any" ? ["lease", "purchase"] : [parsed.dealType];
    const capPerMode = modes.length > 1 ? Math.floor(MAX_CANDIDATES / 2) : MAX_CANDIDATES;

    const fetched = await Promise.all(
      modes.map((m) => fetchCandidates(apiKey, parsed, m, capPerMode, notices))
    );

    if (fetched.every((f) => f.upstreamFailed)) {
      return json(
        {
          ...emptyBase,
          success: false,
          errorCode: "upstream_error",
          error: "The inventory service did not respond. Please retry in a moment.",
          notices,
        },
        502
      );
    }

    // Normalize + dedupe by VIN, then listing id. Lease wins ties (advertised terms).
    const byKey = new Map<string, Candidate>();
    let leaseCount = 0;
    let purchaseCount = 0;
    fetched.forEach((f, i) => {
      const mode = modes[i];
      for (const raw of f.listings) {
        const c = normalize(raw, mode, parsed);
        if (!c || !passesFilters(c, parsed)) continue;
        if (mode === "lease") leaseCount++;
        else purchaseCount++;
        const key = c.vin ?? c.listingId;
        const existing = byKey.get(key);
        if (!existing || (existing.dealType === "purchase" && c.dealType === "lease")) {
          byKey.set(key, c);
        }
      }
    });

    const candidates = [...byKey.values()];

    // Cohort price context for purchase candidates (same year/make/model).
    const cohortPrices = new Map<string, number[]>();
    for (const c of candidates) {
      if (c.dealType !== "purchase" || !c.price || !c.year || !c.make || !c.model) continue;
      const key = `${c.year}|${c.make.toLowerCase()}|${c.model.toLowerCase()}`;
      cohortPrices.set(key, [...(cohortPrices.get(key) ?? []), c.price]);
    }

    // Score within each deal type, then merge on the normalized 0..100 scale.
    const scored = ["lease", "purchase"].flatMap((mode) => {
      const group = candidates.filter((c) => c.dealType === mode);
      if (group.length === 0) return [];
      const [monthlyMin, monthlyMax] = boundsFor(
        group.map((c) => c.effectiveMonthly ?? c.monthlyPayment),
        [150, 1500]
      );
      const [ratioMin, ratioMax] = boundsFor(
        group.map((c) => c.leaseValueRatio),
        [0.5, 2.5]
      );
      const bounds: ScoreBounds = { monthlyMin, monthlyMax, ratioMin, ratioMax };
      return group.map((c) => {
        const cohortKey =
          c.year && c.make && c.model
            ? `${c.year}|${c.make.toLowerCase()}|${c.model.toLowerCase()}`
            : null;
        const cohortAdv =
          c.dealType === "purchase" && cohortKey
            ? cohortAdvantagePercent(c.price, cohortPrices.get(cohortKey) ?? [])
            : null;
        const score = scoreDeal(
          {
            dealType: c.dealType,
            monthlyCost: c.effectiveMonthly ?? c.monthlyPayment,
            leaseValueRatio: c.leaseValueRatio,
            discountPercent: discountPercent(c.price, c.msrp),
            cohortAdvantagePercent: cohortAdv,
            distanceMiles: c.distanceMiles,
            preferenceFit: preferenceFit(c, parsed),
            isEstimatedPayment: c.paymentBasis === "estimated",
          },
          bounds
        );
        return { candidate: c, score, cohortAdv, listingId: c.listingId, distanceMiles: c.distanceMiles };
      });
    });

    const top = rankDeals(scored).slice(0, 10);

    // ── Benchmark validation (isolated; never fails the search) ──────────────
    let docs = new Map<string, Awaited<ReturnType<typeof loadBenchmarkDocuments>> extends Map<string, infer D> ? D : never>();
    try {
      docs = await loadBenchmarkDocuments();
    } catch (err) {
      console.error("Benchmark load failed:", err);
    }

    const searchState = stateForZip(parsed.zip);

    const deals = top.map((entry, index) => {
      const c = entry.candidate;
      const vehicle: BenchmarkVehicle = {
        year: c.year,
        make: c.make,
        model: c.model,
        state: c.state ?? searchState,
        effectiveMonthly: c.effectiveMonthly,
        termMonths: c.termMonths,
        msrp: c.msrp,
      };

      const validations: ValidationResult[] = BENCHMARK_SOURCES.map((source) => {
        const doc = docs.get(source.name);
        if (source.name === "Leasehackr" && c.dealType === "purchase") {
          return {
            sourceName: source.name,
            sourceUrl: source.url,
            retrievedAt: doc?.retrievedAt ?? retrievedAt,
            status: "not_applicable" as const,
            matchBasis: "lease-only benchmark",
            note: "Leasehackr Pre-Negotiated Deals cover leases only.",
          };
        }
        if (!doc) {
          return {
            sourceName: source.name,
            sourceUrl: source.url,
            retrievedAt,
            status: "unavailable" as const,
            matchBasis: "none",
            note: "Benchmark source could not be reached for this search.",
          };
        }
        try {
          return source.evaluate(doc, vehicle);
        } catch (err) {
          console.error(`Benchmark ${source.name} evaluate failed:`, err);
          return {
            sourceName: source.name,
            sourceUrl: source.url,
            retrievedAt: doc.retrievedAt,
            status: "unavailable" as const,
            matchBasis: "none",
            note: "Benchmark comparison could not be completed.",
          };
        }
      });

      const evidence: { label: string; detail: string }[] = [];
      if (c.dealType === "lease") {
        if (c.effectiveMonthly !== null) {
          evidence.push({
            label: "Effective monthly cost",
            detail: `$${Math.round(c.effectiveMonthly)}/mo including the advertised down payment amortized over ${c.termMonths ?? "an unstated"} ${c.termMonths ? "months" : "term"}.`,
          });
        }
        if (c.leaseValueRatio !== null) {
          evidence.push({
            label: "Lease value ratio",
            detail: `${c.leaseValueRatio}% of MSRP per month.`,
          });
        }
      } else {
        if (c.monthlyPayment !== null) {
          evidence.push({
            label: paymentLabel(c.paymentBasis, "purchase"),
            detail:
              c.paymentBasis === "advertised"
                ? `$${Math.round(c.monthlyPayment)}/mo as advertised by the dealer.`
                : `$${Math.round(c.monthlyPayment)}/mo modeled at ${parsed.aprPercent}% APR over ${parsed.termMonths} months with $${parsed.downPayment} down, before tax & fees.`,
          });
        }
        const disc = discountPercent(c.price, c.msrp);
        if (disc !== null && disc > 0) {
          evidence.push({
            label: "Below MSRP",
            detail: `$${Math.round(discountFromMsrp(c.price, c.msrp) ?? 0).toLocaleString()} off MSRP (${disc}%).`,
          });
        }
        if (entry.cohortAdv !== null && entry.cohortAdv > 0) {
          evidence.push({
            label: "Cohort price advantage",
            detail: `${entry.cohortAdv}% below the median price of comparable ${c.year} ${c.make} ${c.model} listings nearby.`,
          });
        }
      }
      if (c.distanceMiles !== null) {
        evidence.push({
          label: "Distance",
          detail: `${Math.round(c.distanceMiles)} miles from ${parsed.zip}.`,
        });
      }

      const mileageNote =
        c.dealType === "lease" && parsed.annualMileage !== "any"
          ? "Mileage not provided—confirm with dealer."
          : null;

      return {
        rank: index + 1,
        listingId: c.listingId,
        vin: c.vin,
        dealType: c.dealType,
        score: entry.score,
        badge: badgeForScore(entry.score),
        year: c.year,
        make: c.make,
        model: c.model,
        trim: c.trim,
        heading: c.heading,
        inventoryType: c.inventoryType,
        imageUrl: c.imageUrl,
        dealerName: c.dealerName,
        city: c.city,
        state: c.state,
        distanceMiles: c.distanceMiles,
        vdpUrl: c.vdpUrl,
        domActive: c.domActive,
        price: c.price,
        msrp: c.msrp,
        discountFromMsrp: discountFromMsrp(c.price, c.msrp),
        discountPercent: discountPercent(c.price, c.msrp),
        cohortAdvantagePercent: entry.cohortAdv,
        monthlyPayment: c.monthlyPayment,
        paymentBasis: c.paymentBasis,
        paymentLabel: paymentLabel(c.paymentBasis, c.dealType),
        termMonths: c.termMonths,
        advertisedDownPayment: c.advertisedDownPayment,
        effectiveMonthly: c.effectiveMonthly,
        leaseValueRatio: c.leaseValueRatio,
        assumedAprPercent: c.paymentBasis === "estimated" ? parsed.aprPercent : null,
        assumedDownPayment: c.paymentBasis === "estimated" ? parsed.downPayment : null,
        mileageNote,
        evidence: evidence.slice(0, 3),
        dataSource: DATA_SOURCE,
        retrievedAt,
        validations,
      };
    });

    if (deals.length === 0) {
      notices.push("No listings matched these filters. Try widening the radius or relaxing filters.");
    }

    return json({
      success: true,
      deals,
      candidatesEvaluated: candidates.length,
      leaseCandidates: leaseCount,
      purchaseCandidates: purchaseCount,
      retrievedAt,
      notices,
      validationSources: BENCHMARK_SOURCES.map((s) => ({
        sourceName: s.name,
        sourceUrl: s.url,
        status: docs.get(s.name)?.ok ? "editorial_match" : "unavailable",
      })),
    });
  } catch (err) {
    console.error("find-best-deals fatal error:", err);
    return json(
      {
        ...emptyBase,
        success: false,
        errorCode: "internal_error",
        error: "Something went wrong running this search.",
      },
      500
    );
  }
});
