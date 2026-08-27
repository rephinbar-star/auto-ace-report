/**
 * Multi-source discovery adapters for `find-best-deals`.
 *
 * Rules:
 *  - Server-side only, polite: one request per URL per search, short timeout,
 *    descriptive User-Agent, in-memory cache, no login/CAPTCHA/paywall bypass,
 *    no guessed-path spraying, no search-engine SERP scraping.
 *  - Every adapter is isolated. One adapter failing can never fail another,
 *    and none of them can fail the MarketCheck inventory search.
 *  - Nothing is invented: if a number cannot be parsed defensibly it is omitted
 *    and the offer degrades to a benchmark/program card.
 */
import {
  computeEffectiveMonthly,
  detectConditionalEligibility,
  isExpired,
  parseExpiration,
  scoreConfidence,
  type NormalizedOffer,
  type OfferSourceType,
  type SourceCheck,
} from "./offer-normalization.ts";

const USER_AGENT =
  "CarWiseExpertDealBot/1.0 (+https://carwise.expert; contact carwise.expert@gmail.com)";
const TIMEOUT_MS = 7000;
const CACHE_TTL_MS = 30 * 60 * 1000;

export interface FetchedDoc {
  ok: boolean;
  text: string;
  jsonLd: unknown[];
  rawHtml: string;
  retrievedAt: string;
  reason?: string;
}

const cache = new Map<string, { doc: FetchedDoc; expiresAt: number }>();

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function extractJsonLd(html: string): unknown[] {
  const out: unknown[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      out.push(JSON.parse(m[1].trim()));
    } catch {
      /* ignore unparseable blocks */
    }
    if (out.length >= 20) break;
  }
  return out;
}

export async function politeFetch(url: string): Promise<FetchedDoc> {
  const cached = cache.get(url);
  if (cached && cached.expiresAt > Date.now()) return cached.doc;

  const retrievedAt = new Date().toISOString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let doc: FetchedDoc;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json,text/html,text/plain;q=0.9",
      },
      signal: controller.signal,
      redirect: "follow",
    });
    if (!res.ok) {
      doc = { ok: false, text: "", jsonLd: [], rawHtml: "", retrievedAt, reason: `HTTP ${res.status}` };
    } else {
      const contentType = res.headers.get("content-type") ?? "";
      const body = await res.text();
      if (contentType.includes("json")) {
        let parsed: unknown = null;
        try {
          parsed = JSON.parse(body);
        } catch {
          parsed = null;
        }
        doc = {
          ok: parsed !== null,
          text: body.slice(0, 400_000),
          jsonLd: parsed !== null ? [parsed] : [],
          rawHtml: "",
          retrievedAt,
          reason: parsed === null ? "unparseable JSON" : undefined,
        };
      } else {
        const blocked =
          /captcha|cf-browser-verification|Attention Required|Access Denied|Request unsuccessful|enable JavaScript to/i.test(
            body.slice(0, 4000)
          );
        const text = stripHtml(body);
        if (blocked || text.length < 400) {
          doc = {
            ok: false,
            text: "",
            jsonLd: [],
            rawHtml: "",
            retrievedAt,
            reason: blocked ? "blocked or client-rendered" : "insufficient public content",
          };
        } else {
          doc = {
            ok: true,
            text: text.slice(0, 400_000),
            jsonLd: extractJsonLd(body),
            rawHtml: body.slice(0, 400_000),
            retrievedAt,
          };
        }
      }
    }
  } catch (err) {
    doc = {
      ok: false,
      text: "",
      jsonLd: [],
      rawHtml: "",
      retrievedAt,
      reason: err instanceof Error ? err.message : "network error",
    };
  } finally {
    clearTimeout(timer);
  }

  // Polite fallback: when a public page blocks a plain server request, retry
  // once through the already-authorized Firecrawl scrape API (robots-aware).
  // No login, CAPTCHA, or paywall is ever bypassed.
  if (!doc.ok && /HTTP (403|429|503)|blocked or client-rendered|insufficient public content/.test(doc.reason ?? "")) {
    const viaFirecrawl = await firecrawlScrape(url);
    if (viaFirecrawl) doc = viaFirecrawl;
  }

  cache.set(url, { doc, expiresAt: Date.now() + CACHE_TTL_MS });
  return doc;
}

async function firecrawlScrape(url: string): Promise<FetchedDoc | null> {
  const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
  if (!apiKey) return null;
  const retrievedAt = new Date().toISOString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error(`Firecrawl scrape failed [${res.status}] for ${url}`);
      return null;
    }
    const data = await res.json();
    const markdown: string | undefined = data?.markdown ?? data?.data?.markdown;
    if (!markdown || markdown.length < 300) return null;
    const text = markdown.replace(/[#*_>`|]/g, " ").replace(/\s+/g, " ").trim();
    return { ok: true, text: text.slice(0, 400_000), jsonLd: [], rawHtml: "", retrievedAt };
  } catch (err) {
    console.error("Firecrawl scrape error:", err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ── Source catalog ───────────────────────────────────────────────────────────
export interface CatalogSource {
  name: string;
  url: string;
  sourceType: OfferSourceType;
  /** Brand key (lowercase make) this source publishes offers for, if narrow. */
  brand: string | null;
  /** Geographic scope statement shown to the user. */
  scope: string;
  /** ZIP prefixes (3-digit) or state codes this source is relevant to; null = national. */
  regionStates: string[] | null;
  dealType: "lease" | "purchase" | "unspecified";
}

export const OEM_SOURCES: CatalogSource[] = [
  {
    name: "Toyota Southern California — lease offers",
    url: "https://review.prd.jsds.tms.aws.toyota.com/socal/offers/lease",
    sourceType: "oem_regional",
    brand: "toyota",
    scope: "Toyota Southern California region",
    regionStates: ["CA"],
    dealType: "lease",
  },
  {
    name: "GMC current offers",
    url: "https://www.gmc.com/current-offers",
    sourceType: "oem_regional",
    brand: "gmc",
    scope: "National GMC program (regional variations apply)",
    regionStates: null,
    dealType: "unspecified",
  },
  {
    name: "Lucid offers",
    url: "https://lucidmotors.com/offers",
    sourceType: "oem_regional",
    brand: "lucid",
    scope: "National Lucid program",
    regionStates: null,
    dealType: "unspecified",
  },
  {
    name: "Polestar offers",
    url: "https://www.polestar.com/us/offers/new",
    sourceType: "oem_regional",
    brand: "polestar",
    scope: "National Polestar program",
    regionStates: null,
    dealType: "unspecified",
  },
];

export const INDEX_SOURCES: CatalogSource[] = [
  {
    name: "Leasehackr Pre-Negotiated Deals",
    url: "https://pnd.leasehackr.com/",
    sourceType: "broker_prenegotiated",
    brand: null,
    scope: "Broker pre-negotiated deals (region varies by broker)",
    regionStates: null,
    dealType: "lease",
  },
  {
    name: "Edmunds California lease deals",
    url: "https://www.edmunds.com/lease-deals/california/",
    sourceType: "independent_index",
    brand: null,
    scope: "California lease programs",
    regionStates: ["CA"],
    dealType: "lease",
  },
  {
    name: "CarsDirect lease deals",
    url: "https://www.carsdirect.com/deals/lease-deals",
    sourceType: "independent_index",
    brand: null,
    scope: "National lease program index",
    regionStates: null,
    dealType: "lease",
  },
  {
    name: "U.S. News best lease deals",
    url: "https://cars.usnews.com/cars-trucks/deals/best-lease-deals",
    sourceType: "editorial",
    brand: null,
    scope: "National editorial round-up",
    regionStates: null,
    dealType: "lease",
  },
];

/**
 * Verified public local specials pages used as *discovery seeds* only.
 * Nothing here is offer data — pages are fetched live on every search.
 */
export const DEALER_SEED_CATALOG: Array<{ zipPrefixes: string[]; url: string; name: string }> = [
  { zipPrefixes: ["920", "921"], url: "https://carlsbad.porsche.com/en/new-vehicle-specials", name: "Porsche Carlsbad specials" },
  { zipPrefixes: ["920", "921"], url: "https://www.audicarlsbad.com/en/specials-and-finance/", name: "Audi Carlsbad specials" },
  { zipPrefixes: ["920", "921"], url: "https://www.audisandiego.com/en/", name: "Audi San Diego" },
  { zipPrefixes: ["920", "921"], url: "https://www.mercedesbenzcarlsbad.com/", name: "Mercedes-Benz of Carlsbad" },
  { zipPrefixes: ["920", "921"], url: "https://www.autonation.com/dealers/chrysler-dodge-jeep-ram-carlsbad-ca", name: "AutoNation CDJR Carlsbad" },
  { zipPrefixes: ["920", "921"], url: "https://www.bobstall.com/new-specials", name: "Bob Stall new specials" },
  { zipPrefixes: ["920", "921"], url: "https://www.kearnymesacdjr.com/new-vehicles/new-vehicle-specials/", name: "Kearny Mesa CDJR specials" },
];

// ── Generic offer parsing ────────────────────────────────────────────────────
const MAKES = [
  "Acura","Alfa Romeo","Audi","BMW","Buick","Cadillac","Chevrolet","Chrysler","Dodge","Fiat","Ford",
  "Genesis","GMC","Honda","Hyundai","Infiniti","Jaguar","Jeep","Kia","Land Rover","Lexus","Lincoln",
  "Lucid","Maserati","Mazda","Mercedes-Benz","MINI","Mitsubishi","Nissan","Polestar","Porsche","Ram",
  "Rivian","Subaru","Tesla","Toyota","Volkswagen","Volvo",
];

interface ParsedSnippet {
  year: number | null;
  make: string | null;
  model: string | null;
  monthly: number;
  termMonths: number | null;
  totalDueAtSigning: number | null;
  downPayment: number | null;
  annualMileage: number | null;
  msrp: number | null;
  expiresAt: string | null;
  eligibility: string[];
  applicabilityText: string;
}

function parseVehicleIdentity(window: string): { year: number | null; make: string | null; model: string | null } {
  const yearMatch = window.match(/\b(20[2-3]\d)\b/);
  const year = yearMatch ? Number(yearMatch[1]) : null;
  let make: string | null = null;
  let model: string | null = null;
  for (const candidate of MAKES) {
    const re = new RegExp(`\\b${candidate.replace(/[-]/g, "[- ]")}\\b\\s+([A-Za-z0-9][A-Za-z0-9\\-]{1,20}(?:\\s+[A-Za-z0-9\\-]{1,15})?)`, "i");
    const m = window.match(re);
    if (m) {
      make = candidate;
      model = m[1].replace(/\s+(lease|for|with|from|offer|special|deal|models?)$/i, "").trim() || null;
      // Reject corporate/marketing noise that is not a model name.
      if (model && /(retail|financial|services|location|dealer|dealership|owners?|customers?|drivers?|models|vehicles)/i.test(model)) {
        model = null;
      }
      break;
    }
  }
  return { year, make, model };
}

/** Extracts defensible offer snippets from visible page text. */
export function parseOffersFromText(text: string): ParsedSnippet[] {
  const out: ParsedSnippet[] = [];
  const monthlyRe = /\$\s?([0-9][0-9,]{1,4})\s*(?:\/|\s)?\s*(?:per\s+)?(?:mo\b|month)/gi;
  let m: RegExpExecArray | null;
  while ((m = monthlyRe.exec(text)) !== null && out.length < 12) {
    const monthly = Number(m[1].replace(/,/g, ""));
    if (!Number.isFinite(monthly) || monthly < 79 || monthly > 5000) continue;
    const window = text.slice(Math.max(0, m.index - 260), m.index + 420);

    const termMatch = window.match(/\b(24|27|30|33|36|39|42|48|60|72|84)\s*(?:-|\s)?\s*month/i);
    const termMonths = termMatch ? Number(termMatch[1]) : null;

    const dasMatch = window.match(
      /\$\s?([0-9][0-9,]{2,7})\s*(?:total\s+)?due at (?:lease )?signing|due at (?:lease )?signing[^$]{0,40}\$\s?([0-9][0-9,]{2,7})/i
    );
    const totalDueAtSigning = dasMatch
      ? Number((dasMatch[1] ?? dasMatch[2] ?? "").replace(/,/g, "")) || null
      : null;

    const downMatch = window.match(
      /\$\s?([0-9][0-9,]{2,7})\s*(?:cash )?(?:down|cap(?:italized)? cost reduction)\b|(?:down payment|cap cost reduction)[^$]{0,30}\$\s?([0-9][0-9,]{2,7})/i
    );
    const downPayment =
      totalDueAtSigning === null && downMatch
        ? Number((downMatch[1] ?? downMatch[2] ?? "").replace(/,/g, "")) || null
        : null;

    const mileageMatch = window.match(/\b(7,?500|10,?000|12,?000|15,?000)\s*(?:miles?|mi)\b/i);
    const annualMileage = mileageMatch ? Number(mileageMatch[1].replace(/,/g, "")) : null;

    const msrpMatch = window.match(/MSRP[^$]{0,20}\$\s?([0-9][0-9,]{3,8})/i);
    const msrp = msrpMatch ? Number(msrpMatch[1].replace(/,/g, "")) : null;

    const identity = parseVehicleIdentity(window);
    out.push({
      ...identity,
      monthly,
      termMonths,
      totalDueAtSigning,
      downPayment,
      annualMileage,
      msrp,
      expiresAt: parseExpiration(window),
      eligibility: detectConditionalEligibility(window),
      applicabilityText: window.replace(/\s+/g, " ").trim().slice(0, 280),
    });
  }
  return out;
}

let offerSeq = 0;
function nextId(prefix: string): string {
  offerSeq += 1;
  return `${prefix}-${offerSeq}`;
}

function toNormalized(
  snippet: ParsedSnippet,
  source: { name: string; url: string; sourceType: OfferSourceType; scope: string; dealType: CatalogSource["dealType"] },
  retrievedAt: string
): NormalizedOffer | null {
  if (isExpired(snippet.expiresAt)) return null;

  const eff = computeEffectiveMonthly({
    monthly: snippet.monthly,
    termMonths: snippet.termMonths,
    totalDueAtSigning: snippet.totalDueAtSigning,
    downPayment: snippet.downPayment,
    totalIncludesFirstPayment: snippet.totalDueAtSigning !== null ? true : undefined,
  });

  const conditional = snippet.eligibility.length > 0;
  const citation = {
    sourceName: source.name,
    sourceUrl: source.url,
    sourceType: source.sourceType,
    retrievedAt,
  };

  return {
    id: nextId("offer"),
    sourceName: source.name,
    sourceUrl: source.url,
    sourceType: source.sourceType,
    retrievedAt,
    expiresAt: snippet.expiresAt,
    vin: null,
    year: snippet.year,
    make: snippet.make,
    model: snippet.model,
    trim: null,
    programName: snippet.model ? `${snippet.model} published offer` : "Published offer",
    dealType: source.dealType,
    monthly: snippet.monthly,
    termMonths: snippet.termMonths,
    totalDueAtSigning: snippet.totalDueAtSigning,
    downPayment: snippet.downPayment,
    annualMileage: snippet.annualMileage,
    msrp: snippet.msrp,
    effectiveMonthly: eff.effectiveMonthly,
    effectiveMonthlyBasis: eff.basis,
    eligibility: snippet.eligibility,
    conditionalEligibility: conditional,
    applicabilityText: snippet.applicabilityText,
    geographicScope: source.scope,
    confidence: scoreConfidence({
      sourceType: source.sourceType,
      hasMatchedInventory: false,
      conditionalEligibility: conditional,
      effectiveMonthlyBasis: eff.basis,
      expiresAt: snippet.expiresAt,
    }),
    limitedDataNote: eff.note,
    hasMatchedInventory: false,
    citations: [citation],
  };
}

export interface AdapterResult {
  check: SourceCheck;
  offers: NormalizedOffer[];
}

async function runCatalogSource(source: CatalogSource, maxOffers: number): Promise<AdapterResult> {
  const doc = await politeFetch(source.url);
  const base = {
    sourceName: source.name,
    sourceUrl: source.url,
    sourceType: source.sourceType,
  };
  if (!doc.ok) {
    return {
      check: {
        ...base,
        status: "unavailable",
        detail: `Could not be read (${doc.reason ?? "unavailable"}).`,
        offersFound: 0,
      },
      offers: [],
    };
  }
  const text = doc.text || JSON.stringify(doc.jsonLd).slice(0, 200_000);
  const snippets = parseOffersFromText(text).slice(0, maxOffers);
  const offers = snippets
    .map((s) => toNormalized(s, source, doc.retrievedAt))
    .filter((o): o is NormalizedOffer => o !== null);

  if (offers.length === 0) {
    return {
      check: {
        ...base,
        status: "no_match",
        detail: "Page was reachable, but no unambiguous published terms could be parsed.",
        offersFound: 0,
      },
      offers: [],
    };
  }
  return {
    check: {
      ...base,
      status: "success",
      detail: `${offers.length} published offer${offers.length === 1 ? "" : "s"} parsed.`,
      offersFound: offers.length,
    },
    offers,
  };
}

/** OEM / regional program adapters, keyed by brand + region relevance. */
export function selectOemSources(brand: string | null, state: string | null): CatalogSource[] {
  return OEM_SOURCES.filter((s) => {
    if (brand && s.brand && s.brand !== brand.toLowerCase()) return false;
    if (s.regionStates && state && !s.regionStates.includes(state)) return false;
    return true;
  });
}

export function selectIndexSources(state: string | null): CatalogSource[] {
  return INDEX_SOURCES.filter((s) => !s.regionStates || !state || s.regionStates.includes(state));
}

export async function runProgramAdapters(sources: CatalogSource[]): Promise<AdapterResult[]> {
  const settled = await Promise.allSettled(sources.map((s) => runCatalogSource(s, 4)));
  return settled.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    const s = sources[i];
    return {
      check: {
        sourceName: s.name,
        sourceUrl: s.url,
        sourceType: s.sourceType,
        status: "unavailable" as const,
        detail: "Adapter error while reading this source.",
        offersFound: 0,
      },
      offers: [],
    };
  });
}

// ── Local dealer specials discovery ──────────────────────────────────────────
const SPECIALS_HINT =
  /(new[- ]vehicle[- ]specials|new-specials|vehicle-specials|lease[- ]offers|lease[- ]specials|finance[- ]offers|finance[- ]specials|incentives|current[- ]offers|specials)/i;

function domainOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

/** Finds one same-domain specials link from a dealer homepage. No path guessing. */
export function findSpecialsLink(html: string, origin: string): string | null {
  const re = /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]{0,120}?)<\/a>/gi;
  let m: RegExpExecArray | null;
  let best: string | null = null;
  while ((m = re.exec(html)) !== null) {
    const href = m[1];
    const label = stripHtml(m[2]);
    if (!SPECIALS_HINT.test(href) && !SPECIALS_HINT.test(label)) continue;
    let abs: URL;
    try {
      abs = new URL(href, origin);
    } catch {
      continue;
    }
    if (abs.hostname.replace(/^www\./, "") !== new URL(origin).hostname.replace(/^www\./, "")) continue;
    if (abs.protocol !== "https:" && abs.protocol !== "http:") continue;
    best = abs.toString();
    if (/new/i.test(abs.pathname)) break; // prefer new-vehicle specials
  }
  return best;
}

export interface DealerCandidateRef {
  dealerName: string | null;
  vdpUrl: string | null;
  distanceMiles: number | null;
}

/**
 * Inspects at most the 5 closest unique dealer domains present in inventory:
 * one homepage request to discover a public specials link, then at most one
 * specials page fetch per dealer.
 */
export async function discoverDealerSpecials(
  candidates: DealerCandidateRef[],
  maxDomains = 5
): Promise<AdapterResult[]> {
  const seen = new Map<string, DealerCandidateRef>();
  for (const c of [...candidates].sort(
    (a, b) => (a.distanceMiles ?? 9999) - (b.distanceMiles ?? 9999)
  )) {
    const domain = domainOf(c.vdpUrl);
    if (!domain) continue;
    if (/marketcheck|carfax|cars\.com|autotrader|cargurus/i.test(domain)) continue;
    if (!seen.has(domain)) seen.set(domain, c);
    if (seen.size >= maxDomains) break;
  }

  const entries = [...seen.entries()];
  const settled = await Promise.allSettled(
    entries.map(async ([domain, ref]) => {
      const origin = `https://${domain}`;
      const home = await politeFetch(origin);
      const base = {
        sourceName: ref.dealerName ?? domain,
        sourceUrl: origin,
        sourceType: "dealer_advertised" as OfferSourceType,
      };
      if (!home.ok || !home.rawHtml) {
        return {
          check: { ...base, status: "unavailable" as const, detail: `Homepage could not be read (${home.reason ?? "unavailable"}).`, offersFound: 0 },
          offers: [],
        };
      }
      const link = findSpecialsLink(home.rawHtml, origin);
      if (!link) {
        return {
          check: { ...base, status: "no_match" as const, detail: "No public specials link was published on the homepage.", offersFound: 0 },
          offers: [],
        };
      }
      return await runDealerSpecialsPage(ref.dealerName ?? domain, link);
    })
  );

  return settled.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : {
          check: {
            sourceName: entries[i][1].dealerName ?? entries[i][0],
            sourceUrl: `https://${entries[i][0]}`,
            sourceType: "dealer_advertised" as OfferSourceType,
            status: "unavailable" as const,
            detail: "Adapter error while reading this dealer site.",
            offersFound: 0,
          },
          offers: [],
        }
  );
}

async function runDealerSpecialsPage(name: string, url: string): Promise<AdapterResult> {
  const source: CatalogSource = {
    name: `${name} — advertised specials`,
    url,
    sourceType: "dealer_advertised",
    brand: null,
    scope: "Single dealership advertised special",
    regionStates: null,
    dealType: "unspecified",
  };
  return await runCatalogSource(source, 4);
}

/** Seeded local specials pages, filtered by ZIP prefix. */
export async function runSeedDealerSources(zip: string): Promise<AdapterResult[]> {
  const prefix = zip.slice(0, 3);
  const seeds = DEALER_SEED_CATALOG.filter((s) => s.zipPrefixes.includes(prefix));
  if (seeds.length === 0) return [];
  const settled = await Promise.allSettled(seeds.map((s) => runDealerSpecialsPage(s.name, s.url)));
  return settled.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : {
          check: {
            sourceName: seeds[i].name,
            sourceUrl: seeds[i].url,
            sourceType: "dealer_advertised" as OfferSourceType,
            status: "unavailable" as const,
            detail: "Adapter error while reading this dealer site.",
            offersFound: 0,
          },
          offers: [],
        }
  );
}

// ── General web-discovery seam ───────────────────────────────────────────────
const DISCOVERY_ALLOWLIST =
  /(^|\.)((toyota|gmc|chevrolet|ford|honda|hyundai|kia|nissan|subaru|mazda|volkswagen|audi|bmw|mercedes-benz|porsche|lexus|acura|volvo|polestar|lucidmotors|rivian|jeep|ram|dodge|chrysler|cadillac|buick|genesis)\.com|edmunds\.com|carsdirect\.com|leasehackr\.com|usnews\.com|autonation\.com)$/i;

/**
 * Uses the already-authorized Firecrawl search capability when present.
 * If no provider secret is configured, the adapter reports `not_configured`
 * and never affects core results. SERPs are never scraped directly.
 */
export async function runWebDiscovery(args: {
  zip: string;
  city: string | null;
  state: string | null;
  brand: string | null;
  dealType: string;
  powertrain: string;
}): Promise<AdapterResult> {
  const base = {
    sourceName: "Web discovery",
    sourceUrl: "https://carwise.expert/best-deal",
    sourceType: "independent_index" as OfferSourceType,
  };
  const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
  if (!apiKey) {
    return {
      check: {
        ...base,
        status: "not_configured",
        detail:
          "General web discovery is not configured. Add a server-side search provider secret (FIRECRAWL_API_KEY) to enable it.",
        offersFound: 0,
      },
      offers: [],
    };
  }

  const now = new Date();
  const month = now.toLocaleString("en-US", { month: "long" });
  const parts = [
    args.brand ?? "",
    args.powertrain !== "any" ? args.powertrain : "",
    args.dealType === "purchase" ? "finance offers" : "lease deals",
    args.city ?? args.zip,
    args.state ?? "",
    `${month} ${now.getFullYear()}`,
  ].filter(Boolean);
  const query = parts.join(" ");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch("https://api.firecrawl.dev/v2/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, limit: 6 }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`Web discovery search failed [${res.status}]: ${body.slice(0, 200)}`);
      return {
        check: { ...base, status: "unavailable", detail: `Search provider returned HTTP ${res.status}.`, offersFound: 0 },
        offers: [],
      };
    }
    const data = await res.json();
    const results: Array<Record<string, unknown>> = Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data?.web)
        ? data.web
        : [];
    const allowed = results
      .map((r) => (typeof r.url === "string" ? r.url : null))
      .filter((u): u is string => {
        if (!u) return false;
        try {
          return DISCOVERY_ALLOWLIST.test(new URL(u).hostname.replace(/^www\./, ""));
        } catch {
          return false;
        }
      })
      .slice(0, 3);

    if (allowed.length === 0) {
      return {
        check: { ...base, status: "no_match", detail: "No allowlisted OEM, franchise-dealer, or approved index pages matched this search.", offersFound: 0 },
        offers: [],
      };
    }

    const settled = await Promise.allSettled(
      allowed.map((u) =>
        runCatalogSource(
          {
            name: `Web discovery — ${new URL(u).hostname.replace(/^www\./, "")}`,
            url: u,
            sourceType: "independent_index",
            brand: null,
            scope: `${args.city ?? args.zip}${args.state ? `, ${args.state}` : ""} area published offers`,
            regionStates: null,
            dealType: "unspecified",
          },
          2
        )
      )
    );
    const offers = settled.flatMap((r) => (r.status === "fulfilled" ? r.value.offers : []));
    return {
      check: {
        ...base,
        status: offers.length > 0 ? "success" : "no_match",
        detail:
          offers.length > 0
            ? `${offers.length} published offer${offers.length === 1 ? "" : "s"} found on allowlisted domains.`
            : "Allowlisted pages were reached but no unambiguous terms could be parsed.",
        offersFound: offers.length,
      },
      offers,
    };
  } catch (err) {
    console.error("Web discovery failed:", err);
    return {
      check: { ...base, status: "unavailable", detail: "The search provider did not respond in time.", offersFound: 0 },
      offers: [],
    };
  } finally {
    clearTimeout(timer);
  }
}
