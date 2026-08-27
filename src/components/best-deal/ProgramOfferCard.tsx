import { AlertTriangle, ExternalLink, Info, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { NormalizedOffer, OfferSourceType } from "@/types/best-deal";

const SOURCE_LABEL: Record<OfferSourceType, string> = {
  inventory_specific: "Local inventory",
  dealer_advertised: "Dealer advertised",
  oem_regional: "OEM / regional program",
  broker_prenegotiated: "Broker pre-negotiated",
  independent_index: "Independent index",
  editorial: "Editorial mention",
};

const CONFIDENCE_LABEL = {
  high: "High source confidence",
  medium: "Medium source confidence",
  low: "Low source confidence",
} as const;

const COMPLETENESS_LABEL = {
  complete: "Complete advertised terms",
  estimated_range: "Estimated range — some charges undisclosed",
  incomplete: "Incomplete advertised terms",
} as const;

function money(n: number | null | undefined): string | null {
  return typeof n === "number" && Number.isFinite(n)
    ? `$${Math.round(n).toLocaleString()}`
    : null;
}

function range(low: number | null | undefined, high: number | null | undefined): string {
  const lo = money(low);
  const hi = money(high);
  if (lo && hi && lo !== hi) return `${lo} – ${hi}`;
  return lo ?? hi ?? "Unknown / verify";
}

function Figure({
  label,
  value,
  tag,
}: {
  label: string;
  value: string;
  tag: "Advertised" | "Parsed from disclosure" | "CarWise estimate" | "Unknown / verify";
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold text-foreground">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{tag}</p>
    </div>
  );
}

export function ProgramOfferCard({ offer }: { offer: NormalizedOffer }) {
  const title =
    [offer.year, offer.make, offer.model].filter(Boolean).join(" ") ||
    offer.programName ||
    "Published offer";

  const completeness = offer.costCompleteness ?? "incomplete";
  const taxStatus = offer.advertisedMonthlyTaxStatus ?? "unknown";
  const baseMonthly = offer.advertisedMonthlyBeforeTax ?? offer.monthly ?? null;
  const warnings = offer.costWarnings ?? [];

  return (
    <Card className="border-2">
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{SOURCE_LABEL[offer.sourceType]}</Badge>
          <Badge variant="outline">{CONFIDENCE_LABEL[offer.confidence]}</Badge>
          <Badge
            variant="outline"
            className={
              completeness === "complete"
                ? "border-primary text-primary"
                : "border-amber-500 text-amber-600"
            }
          >
            {COMPLETENESS_LABEL[completeness]}
          </Badge>
          {offer.hasMatchedInventory ? (
            <Badge variant="outline" className="border-primary text-primary">
              Matching nearby vehicle found
            </Badge>
          ) : (
            <Badge variant="outline">Program only — inventory not confirmed</Badge>
          )}
        </div>

        <div>
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground">{offer.geographicScope}</p>
        </div>

        {offer.eligibility.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-2">
            <span className="text-xs font-medium text-foreground">Conditional eligibility:</span>
            {offer.eligibility.map((e) => (
              <Badge key={e} variant="outline" className="border-amber-500 text-amber-600">
                {e} required
              </Badge>
            ))}
          </div>
        )}

        {/* Dealer headline — raw advertised facts only */}
        <div className="rounded-md border border-border/70 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Dealer headline
          </p>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <Figure
              label={`Advertised monthly${taxStatus === "included" ? " (tax included)" : taxStatus === "excluded" ? " (before tax)" : ""}`}
              value={money(baseMonthly) ? `${money(baseMonthly)}/mo` : "Unknown / verify"}
              tag="Advertised"
            />
            <Figure
              label="Term"
              value={offer.termMonths ? `${offer.termMonths} mo` : "Unknown / verify"}
              tag="Advertised"
            />
            <Figure
              label="Advertised cap-cost reduction"
              value={money(offer.advertisedCapReduction ?? offer.downPayment) ?? "None published"}
              tag="Advertised"
            />
            <Figure
              label="Mileage"
              value={
                offer.annualMileage ? `${offer.annualMileage.toLocaleString()} mi/yr` : "Unknown / verify"
              }
              tag="Advertised"
            />
          </div>
          {offer.headlinePlusCapReductionMonthly != null && (
            <p className="mt-2 text-xs text-muted-foreground">
              Headline + advertised cap reduction only (taxes/fees excluded):{" "}
              {money(offer.headlinePlusCapReductionMonthly)}/mo
            </p>
          )}
        </div>

        {/* CarWise reality check */}
        <div className="rounded-md border-2 border-primary/40 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">
            CarWise reality check
          </p>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <Figure
              label={`Monthly with local tax${offer.taxRateLabel ? ` (${offer.taxRateLabel})` : ""}`}
              value={
                money(offer.estimatedMonthlyWithTaxLow)
                  ? `${money(offer.estimatedMonthlyWithTaxLow)}/mo`
                  : "Unknown / verify"
              }
              tag={offer.estimatedMonthlyWithTaxLow == null ? "Unknown / verify" : "CarWise estimate"}
            />
            <Figure
              label={
                offer.advertisedTotalDAS != null
                  ? "Total due at signing"
                  : "Known minimum / estimated due at signing"
              }
              value={
                offer.advertisedTotalDAS != null
                  ? money(offer.advertisedTotalDAS)!
                  : range(offer.estimatedTotalDASLow, offer.estimatedTotalDASHigh)
              }
              tag={offer.advertisedTotalDAS != null ? "Parsed from disclosure" : "CarWise estimate"}
            />
            <Figure
              label="All-in effective monthly"
              value={
                offer.allInEffectiveMonthlyLow == null
                  ? "Unknown / verify"
                  : `${range(offer.allInEffectiveMonthlyLow, offer.allInEffectiveMonthlyHigh)}/mo`
              }
              tag={offer.allInEffectiveMonthlyLow == null ? "Unknown / verify" : "CarWise estimate"}
            />
            <Figure
              label="Estimated total lease cost"
              value={range(offer.estimatedTotalLeaseCostLow, offer.estimatedTotalLeaseCostHigh)}
              tag={offer.estimatedTotalLeaseCostLow == null ? "Unknown / verify" : "CarWise estimate"}
            />
          </div>
          {offer.securityDeposit != null && (
            <p className="mt-2 text-xs text-muted-foreground">
              Refundable security deposit {money(offer.securityDeposit)} is cash needed at signing
              but is excluded from non-refundable cost.
            </p>
          )}
          {offer.dispositionFee != null && (
            <p className="mt-1 text-xs text-muted-foreground">
              Disposition fee {money(offer.dispositionFee)} is an end-of-lease charge, not due at
              signing.
            </p>
          )}
        </div>

        {warnings.length > 0 && (
          <ul className="space-y-1 rounded-md border border-amber-500/40 bg-amber-500/5 p-2 text-xs text-foreground">
            {warnings.map((w) => (
              <li key={w.code} className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                {w.message}
              </li>
            ))}
          </ul>
        )}

        {offer.limitedDataNote && (
          <p className="flex items-start gap-2 rounded-md bg-muted/60 p-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {offer.limitedDataNote}
          </p>
        )}

        <details className="rounded-md border border-border/60 p-2">
          <summary className="cursor-pointer text-xs font-medium text-foreground">
            <ShieldCheck className="mr-1 inline h-3.5 w-3.5" />
            Why this is credible
          </summary>
          <div className="mt-2 space-y-2 text-xs text-muted-foreground">
            {offer.applicabilityText && <p>{offer.applicabilityText}</p>}
            <p>
              Retrieved {new Date(offer.retrievedAt).toLocaleString()}
              {offer.expiresAt
                ? ` · published expiration ${new Date(offer.expiresAt).toLocaleDateString()}`
                : " · no published expiration"}
              .
            </p>
            {offer.taxRateSource && (
              <p>Tax rate source: {offer.taxRateSource} (estimate, verify with the dealer).</p>
            )}
            <ul className="space-y-1">
              {offer.citations.map((c) => (
                <li key={`${c.sourceName}-${c.sourceUrl}`}>
                  <a
                    href={c.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    {c.sourceName}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
