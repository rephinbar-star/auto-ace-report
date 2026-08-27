/**
 * Independent benchmark adapters for lease/deal validation.
 *
 * Rules enforced here:
 *  - Server-side only, one polite request per source per search, short timeout.
 *  - Public HTML/text only. No auth bypass, no CAPTCHA solving, no paywall
 *    circumvention, no aggressive crawling. `robots`-restricted or blocked
 *    responses become `unavailable`.
 *  - If content cannot be parsed unambiguously we return `unavailable` or
 *    `no_comparable_match`. We never invent numbers.
 */

export type ValidationStatus =
  | "corroborated_numeric"
  | "editorial_match"
  | "no_comparable_match"
  | "unavailable"
  | "not_applicable";

export interface ValidationResult {
  sourceName: string;
  sourceUrl: string;
  retrievedAt: string;
  status: ValidationStatus;
  matchBasis: string;
  note: string;
}

export interface BenchmarkVehicle {
  year: number | null;
  make: string | null;
  model: string | null;
  state: string | null;
  effectiveMonthly: number | null;
  termMonths: number | null;
  msrp: number | null;
}

export interface BenchmarkSource {
  name: string;
  url: string;
  /** Fetches and parses the public document once per search. */
  load(): Promise<BenchmarkDocument>;
  /** Evaluates one vehicle against the loaded document. */
  evaluate(doc: BenchmarkDocument, vehicle: BenchmarkVehicle): ValidationResult;
}

export interface BenchmarkDocument {
  ok: boolean;
  text: string;
  retrievedAt: string;
  reason?: string;
}

const USER_AGENT =
  "CarWiseExpertBenchmarkBot/1.0 (+https://carwise.expert; contact carwise.expert@gmail.com)";
const TIMEOUT_MS = 6000;
const CACHE_TTL_MS = 30 * 60 * 1000;

const docCache = new Map<string, { doc: BenchmarkDocument; expiresAt: number }>();

async function politeFetch(url: string): Promise<BenchmarkDocument> {
  const cached = docCache.get(url);
  if (cached && cached.expiresAt > Date.now()) return cached.doc;

  const retrievedAt = new Date().toISOString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let doc: BenchmarkDocument;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,text/plain" },
      signal: controller.signal,
      redirect: "follow",
    });
    if (!res.ok) {
      doc = { ok: false, text: "", retrievedAt, reason: `HTTP ${res.status}` };
    } else {
      const body = await res.text();
      // Detect anti-bot / client-rendered shells: do not attempt to bypass.
      const looksBlocked =
        /captcha|cf-browser-verification|Attention Required|Access Denied|enable JavaScript to/i.test(
          body.slice(0, 4000)
        );
      const stripped = body
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (looksBlocked || stripped.length < 500) {
        doc = {
          ok: false,
          text: "",
          retrievedAt,
          reason: looksBlocked ? "blocked or client-rendered" : "insufficient public content",
        };
      } else {
        doc = { ok: true, text: stripped.slice(0, 400_000), retrievedAt };
      }
    }
  } catch (err) {
    doc = {
      ok: false,
      text: "",
      retrievedAt,
      reason: err instanceof Error ? err.message : "network error",
    };
  } finally {
    clearTimeout(timer);
  }

  docCache.set(url, { doc, expiresAt: Date.now() + CACHE_TTL_MS });
  return doc;
}

function vehiclePattern(vehicle: BenchmarkVehicle): RegExp | null {
  if (!vehicle.year || !vehicle.make || !vehicle.model) return null;
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(
    `${vehicle.year}\\s+${esc(vehicle.make)}\\s+${esc(vehicle.model)}`,
    "i"
  );
}

// ── Leasehackr Pre-Negotiated Deals ──────────────────────────────────────────
const LEASEHACKR_URL = "https://pnd.leasehackr.com/";

export const leasehackrSource: BenchmarkSource = {
  name: "Leasehackr",
  url: LEASEHACKR_URL,
  load: () => politeFetch(LEASEHACKR_URL),
  evaluate(doc, vehicle) {
    const base = {
      sourceName: "Leasehackr",
      sourceUrl: LEASEHACKR_URL,
      retrievedAt: doc.retrievedAt,
    };
    if (!doc.ok) {
      return {
        ...base,
        status: "unavailable",
        matchBasis: "none",
        note: `Leasehackr Pre-Negotiated Deals could not be read (${doc.reason ?? "unavailable"}). Check the source directly.`,
      };
    }
    const pattern = vehiclePattern(vehicle);
    if (!pattern) {
      return {
        ...base,
        status: "no_comparable_match",
        matchBasis: "insufficient vehicle identity",
        note: "Year/make/model were not complete enough to look for a comparable deal.",
      };
    }
    const idx = doc.text.search(pattern);
    if (idx === -1) {
      return {
        ...base,
        status: "no_comparable_match",
        matchBasis: `year/make/model${vehicle.state ? ` in ${vehicle.state}` : ""}`,
        note: "No current Pre-Negotiated Deal listed for this year/make/model.",
      };
    }
    const window = doc.text.slice(Math.max(0, idx - 200), idx + 600);
    const stateOk = vehicle.state ? new RegExp(`\\b${vehicle.state}\\b`).test(window) : false;
    const monthly = window.match(/\$\s?([0-9]{2,4})\s?(?:\/|\s)?(?:mo|month)/i);
    const term = window.match(/\b(24|27|30|36|39|42|48)\s?(?:mo|month)/i);
    const upfront = window.match(/(?:due at signing|upfront|drive[- ]?off)[^$]{0,30}\$\s?([0-9,]{3,8})/i);

    if (monthly && term && vehicle.effectiveMonthly) {
      const benchMonthly = Number(monthly[1]);
      const benchTerm = Number(term[1]);
      const benchUpfront = upfront ? Number(upfront[1].replace(/,/g, "")) : 0;
      const benchEffective = benchMonthly + benchUpfront / benchTerm;
      const delta = vehicle.effectiveMonthly - benchEffective;
      return {
        ...base,
        status: "corroborated_numeric",
        matchBasis: `year/make/model${stateOk && vehicle.state ? ` + ${vehicle.state} region` : ""}, monthly + term${upfront ? " + upfront" : ""}`,
        note: `Leasehackr lists an effective ~$${Math.round(benchEffective)}/mo over ${benchTerm} months${upfront ? " including upfront" : " (upfront not stated)"}. This listing is ${delta <= 0 ? `$${Math.abs(Math.round(delta))}/mo lower` : `$${Math.round(delta)}/mo higher`} on effective cost. Broker fees and conditional loyalty/military/college incentives may not apply to you.`,
      };
    }

    return {
      ...base,
      status: "editorial_match",
      matchBasis: "year/make/model mention only",
      note: "Leasehackr currently lists this vehicle, but the numeric terms could not be parsed unambiguously. Compare on the source page.",
    };
  },
};

// ── U.S. News automotive lease/deal editorial pages ──────────────────────────
const USNEWS_URL = "https://cars.usnews.com/cars-trucks/deals/best-lease-deals";

export const usNewsSource: BenchmarkSource = {
  name: "U.S. News",
  url: USNEWS_URL,
  load: () => politeFetch(USNEWS_URL),
  evaluate(doc, vehicle) {
    const base = {
      sourceName: "U.S. News",
      sourceUrl: USNEWS_URL,
      retrievedAt: doc.retrievedAt,
    };
    if (!doc.ok) {
      return {
        ...base,
        status: "unavailable",
        matchBasis: "none",
        note: `The U.S. News deals page could not be read (${doc.reason ?? "unavailable"}). Check the source directly.`,
      };
    }
    const pattern = vehiclePattern(vehicle);
    if (!pattern) {
      return {
        ...base,
        status: "no_comparable_match",
        matchBasis: "insufficient vehicle identity",
        note: "Year/make/model were not complete enough to match an editorial page.",
      };
    }
    const idx = doc.text.search(pattern);
    if (idx === -1) {
      return {
        ...base,
        status: "no_comparable_match",
        matchBasis: "current year/make/model",
        note: "This vehicle is not on the current U.S. News deals page.",
      };
    }
    const window = doc.text.slice(Math.max(0, idx - 200), idx + 600);
    const monthly = window.match(/\$\s?([0-9]{2,4})\s?(?:\/|\s)?(?:mo|month)/i);
    const term = window.match(/\b(24|27|30|36|39|42|48)\s?(?:mo|month)/i);
    const due = window.match(/(?:due at signing)[^$]{0,30}\$\s?([0-9,]{3,8})/i);
    const miles = window.match(/([0-9]{1,2},?[05]00)\s?miles?/i);
    const expires = window.match(/(?:through|expires?|ends?)\s+([A-Z][a-z]+\.?\s+\d{1,2},?\s+\d{4})/);

    if (monthly && term && due && miles && expires) {
      return {
        ...base,
        status: "corroborated_numeric",
        matchBasis: "monthly, term, due at signing, mileage, expiration all parsed",
        note: `U.S. News lists $${monthly[1]}/mo for ${term[1]} months with $${due[1]} due at signing, ${miles[1]} miles/yr, through ${expires[1]}. Regional eligibility and credit tier still apply.`,
      };
    }

    return {
      ...base,
      status: "editorial_match",
      matchBasis: "current editorial page mentions this year/make/model",
      note: "Featured on the current U.S. News deals page, but the full numeric terms were not unambiguously parseable — treat as an editorial mention only.",
    };
  },
};

export const BENCHMARK_SOURCES: BenchmarkSource[] = [leasehackrSource, usNewsSource];

/** Loads all sources in isolation — a failure can never fail the search. */
export async function loadBenchmarkDocuments(): Promise<Map<string, BenchmarkDocument>> {
  const results = await Promise.allSettled(
    BENCHMARK_SOURCES.map(async (s) => [s.name, await s.load()] as const)
  );
  const map = new Map<string, BenchmarkDocument>();
  results.forEach((r, i) => {
    const source = BENCHMARK_SOURCES[i];
    if (r.status === "fulfilled") {
      map.set(r.value[0], r.value[1]);
    } else {
      map.set(source.name, {
        ok: false,
        text: "",
        retrievedAt: new Date().toISOString(),
        reason: "adapter error",
      });
    }
  });
  return map;
}
