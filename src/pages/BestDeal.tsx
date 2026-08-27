import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, Pencil, RefreshCw, SearchX } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { SEO } from "@/components/seo/SEO";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BestDealSearchForm } from "@/components/best-deal/BestDealSearchForm";
import { DealResultCard } from "@/components/best-deal/DealResultCard";
import { ValidationExplainer } from "@/components/best-deal/ValidationExplainer";
import { supabase } from "@/integrations/supabase/client";
import type { BestDealResponse, BestDealSearchParams } from "@/types/best-deal";

const DEFAULTS: BestDealSearchParams = {
  dealType: "any",
  maxMonthlyPayment: null,
  annualMileage: "any",
  maxDueAtSigning: null,
  vehicleType: "any",
  powertrain: "any",
  zip: "",
  radius: 100,
  brand: null,
  termMonths: 72,
  aprPercent: 7.49,
  downPayment: 0,
};

function paramsFromUrl(sp: URLSearchParams): BestDealSearchParams {
  const numberOrNull = (key: string) => {
    const raw = sp.get(key);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };
  const oneOf = <T extends string>(key: string, allowed: readonly T[], fallback: T): T => {
    const raw = sp.get(key);
    return raw && (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
  };

  return {
    dealType: oneOf("dealType", ["any", "lease", "purchase"] as const, "any"),
    maxMonthlyPayment: numberOrNull("maxMonthly"),
    annualMileage: oneOf(
      "mileage",
      ["any", "7500", "10000", "12000", "15000"] as const,
      "any"
    ),
    maxDueAtSigning: numberOrNull("maxDue"),
    vehicleType: oneOf("vehicleType", ["any", "sedan", "truck", "suv"] as const, "any"),
    powertrain: oneOf("powertrain", ["any", "ev", "hybrid", "gas"] as const, "any"),
    zip: (sp.get("zip") ?? "").replace(/\D/g, "").slice(0, 5),
    radius: ([25, 50, 100].includes(Number(sp.get("radius")))
      ? Number(sp.get("radius"))
      : 100) as BestDealSearchParams["radius"],
    brand: sp.get("brand") || null,
    termMonths: ([48, 60, 72, 84].includes(Number(sp.get("term")))
      ? Number(sp.get("term"))
      : 72) as BestDealSearchParams["termMonths"],
    aprPercent: numberOrNull("apr") ?? 7.49,
    downPayment: numberOrNull("down") ?? 0,
  };
}

function urlFromParams(p: BestDealSearchParams): URLSearchParams {
  const sp = new URLSearchParams();
  sp.set("zip", p.zip);
  sp.set("radius", String(p.radius));
  if (p.dealType !== "any") sp.set("dealType", p.dealType);
  if (p.maxMonthlyPayment) sp.set("maxMonthly", String(p.maxMonthlyPayment));
  if (p.annualMileage !== "any") sp.set("mileage", p.annualMileage);
  if (p.maxDueAtSigning !== null) sp.set("maxDue", String(p.maxDueAtSigning));
  if (p.vehicleType !== "any") sp.set("vehicleType", p.vehicleType);
  if (p.powertrain !== "any") sp.set("powertrain", p.powertrain);
  if (p.brand) sp.set("brand", p.brand);
  if (p.termMonths !== 72) sp.set("term", String(p.termMonths));
  if (p.aprPercent !== 7.49) sp.set("apr", String(p.aprPercent));
  if (p.downPayment) sp.set("down", String(p.downPayment));
  return sp;
}

function summarize(p: BestDealSearchParams): string[] {
  const chips: string[] = [`ZIP ${p.zip}`, `${p.radius} mi`];
  chips.push(p.dealType === "any" ? "Lease or purchase" : p.dealType === "lease" ? "Lease" : "Purchase");
  if (p.brand) chips.push(p.brand);
  if (p.vehicleType !== "any") chips.push(p.vehicleType.toUpperCase());
  if (p.powertrain !== "any") chips.push(p.powertrain.toUpperCase());
  if (p.maxMonthlyPayment) chips.push(`≤ $${p.maxMonthlyPayment}/mo`);
  if (p.maxDueAtSigning !== null) chips.push(`≤ $${p.maxDueAtSigning} down`);
  if (p.annualMileage !== "any") chips.push(`${Number(p.annualMileage).toLocaleString()} mi/yr`);
  return chips;
}

export default function BestDealPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [form, setForm] = useState<BestDealSearchParams>(() => paramsFromUrl(searchParams));
  const [submitted, setSubmitted] = useState<BestDealSearchParams | null>(null);
  const [showForm, setShowForm] = useState(true);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<BestDealResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ranInitial = useRef(false);

  const runSearch = useCallback(async (params: BestDealSearchParams) => {
    setLoading(true);
    setError(null);
    setSubmitted(params);
    try {
      const { data, error: fnError } = await supabase.functions.invoke<BestDealResponse>(
        "find-best-deals",
        { body: params }
      );
      if (fnError) throw new Error(fnError.message);
      if (!data) throw new Error("No response from the deal search service.");
      setResponse(data);
      if (!data.success) setError(data.error ?? "The deal search could not be completed.");
    } catch (err) {
      setResponse(null);
      setError(
        err instanceof Error
          ? err.message
          : "The deal search could not be completed. Please retry."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // Run once on load when the URL already carries a valid ZIP (shareable search).
  useEffect(() => {
    if (ranInitial.current) return;
    ranInitial.current = true;
    const initial = paramsFromUrl(searchParams);
    if (/^\d{5}$/.test(initial.zip)) {
      setShowForm(false);
      void runSearch(initial);
    }
  }, [searchParams, runSearch]);

  const handleSubmit = () => {
    setSearchParams(urlFromParams(form), { replace: false });
    setShowForm(false);
    void runSearch(form);
  };

  const deals = response?.deals ?? [];
  const summaryChips = useMemo(() => (submitted ? summarize(submitted) : []), [submitted]);

  return (
    <>
      <SEO
        title="Find the Best Lease & Purchase Car Deals"
        description="Search live dealer inventory near you and rank the strongest lease and finance opportunities with transparent, deterministic CarWise deal math."
        keywords="best car lease deals, best car purchase deals, car deal search, lease effective monthly, car finance payment estimate"
      />
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 bg-gradient-hero py-10 md:py-14">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-5xl space-y-6">
              <div className="text-center">
                <Badge variant="secondary" className="mb-3">
                  Beta
                </Badge>
                <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                  Find me the best deal
                </h1>
                <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
                  Enter a ZIP code to rank real lease and purchase opportunities from live dealer
                  inventory. Every number shown is either advertised by the dealer or clearly
                  labeled as a CarWise estimate.
                </p>
              </div>

              {showForm ? (
                <BestDealSearchForm
                  value={form}
                  onChange={setForm}
                  onSubmit={handleSubmit}
                  loading={loading}
                />
              ) : (
                <Card className="border-2 bg-gradient-card">
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      {summaryChips.map((chip) => (
                        <Badge key={chip} variant="outline">
                          {chip}
                        </Badge>
                      ))}
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit search
                    </Button>
                  </CardContent>
                </Card>
              )}

              {(loading || response || error) && <ValidationExplainer />}

              {loading && (
                <div className="space-y-4">
                  {[0, 1, 2].map((i) => (
                    <Card key={i} className="border-2">
                      <CardContent className="flex flex-col gap-4 p-5 md:flex-row">
                        <Skeleton className="h-40 w-full md:w-60" />
                        <div className="flex-1 space-y-3">
                          <Skeleton className="h-6 w-2/3" />
                          <Skeleton className="h-4 w-1/2" />
                          <Skeleton className="h-20 w-full" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {!loading && error && (
                <Card className="border-2 border-destructive/40">
                  <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
                    <AlertTriangle className="h-10 w-10 text-destructive" />
                    <div>
                      <h2 className="text-lg font-semibold text-foreground">
                        We couldn&apos;t complete this search
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">{error}</p>
                    </div>
                    <Button onClick={() => submitted && runSearch(submitted)} disabled={!submitted}>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Retry search
                    </Button>
                  </CardContent>
                </Card>
              )}

              {!loading && !error && response?.success && deals.length === 0 && (
                <Card className="border-2">
                  <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
                    <SearchX className="h-10 w-10 text-muted-foreground" />
                    <div>
                      <h2 className="text-lg font-semibold text-foreground">
                        No matching opportunities right now
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {response.notices[0] ??
                          "Try widening the radius or relaxing your filters."}
                      </p>
                    </div>
                    <Button variant="outline" onClick={() => setShowForm(true)}>
                      Edit search
                    </Button>
                  </CardContent>
                </Card>
              )}

              {!loading && !error && deals.length > 0 && (
                <>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="text-xl font-bold tracking-tight text-foreground">
                      Top {deals.length} opportunities
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {response?.candidatesEvaluated ?? 0} live listings evaluated ·{" "}
                      {response?.leaseCandidates ?? 0} lease · {response?.purchaseCandidates ?? 0}{" "}
                      purchase
                    </p>
                  </div>
                  {response?.notices?.map((n) => (
                    <p key={n} className="text-xs text-muted-foreground">
                      {n}
                    </p>
                  ))}
                  <div className="space-y-5">
                    {deals.map((deal) => (
                      <DealResultCard key={`${deal.listingId}-${deal.dealType}`} deal={deal} />
                    ))}
                  </div>
                  <p className="text-center text-xs text-muted-foreground">
                    Inventory and terms can change at any time. Verify eligibility, taxes, fees,
                    mileage allowance, credit tier, and availability directly with the dealer.
                  </p>
                </>
              )}
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
}
