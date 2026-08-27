import { ExternalLink, Info, ShieldCheck } from "lucide-react";
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
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
} as const;

function money(n: number | null): string | null {
  return n === null ? null : `$${Math.round(n).toLocaleString()}`;
}

export function ProgramOfferCard({ offer }: { offer: NormalizedOffer }) {
  const title =
    [offer.year, offer.make, offer.model].filter(Boolean).join(" ") ||
    offer.programName ||
    "Published offer";

  return (
    <Card className="border-2">
      <CardContent className="space-y-3 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{SOURCE_LABEL[offer.sourceType]}</Badge>
          <Badge variant="outline">{CONFIDENCE_LABEL[offer.confidence]}</Badge>
          {offer.hasMatchedInventory ? (
            <Badge variant="outline" className="border-primary text-primary">
              Matching nearby vehicle found
            </Badge>
          ) : (
            <Badge variant="outline">Program only — inventory not confirmed</Badge>
          )}
          {offer.eligibility.map((e) => (
            <Badge key={e} variant="outline" className="border-amber-500 text-amber-600">
              {e} required
            </Badge>
          ))}
        </div>

        <div>
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground">{offer.geographicScope}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          {offer.monthly !== null && (
            <div>
              <p className="text-xs text-muted-foreground">Advertised monthly</p>
              <p className="font-semibold text-foreground">{money(offer.monthly)}/mo</p>
            </div>
          )}
          {offer.termMonths !== null && (
            <div>
              <p className="text-xs text-muted-foreground">Term</p>
              <p className="font-semibold text-foreground">{offer.termMonths} mo</p>
            </div>
          )}
          {offer.totalDueAtSigning !== null && (
            <div>
              <p className="text-xs text-muted-foreground">Total due at signing</p>
              <p className="font-semibold text-foreground">{money(offer.totalDueAtSigning)}</p>
            </div>
          )}
          {offer.downPayment !== null && (
            <div>
              <p className="text-xs text-muted-foreground">Down / cap reduction</p>
              <p className="font-semibold text-foreground">{money(offer.downPayment)}</p>
            </div>
          )}
          {offer.effectiveMonthly !== null && (
            <div>
              <p className="text-xs text-muted-foreground">
                Effective monthly
                {offer.effectiveMonthlyBasis === "total_due_at_signing"
                  ? " (DAS amortized)"
                  : offer.effectiveMonthlyBasis === "down_payment"
                    ? " (down amortized)"
                    : ""}
              </p>
              <p className="font-semibold text-foreground">{money(offer.effectiveMonthly)}/mo</p>
            </div>
          )}
          {offer.annualMileage !== null && (
            <div>
              <p className="text-xs text-muted-foreground">Mileage</p>
              <p className="font-semibold text-foreground">
                {offer.annualMileage.toLocaleString()} mi/yr
              </p>
            </div>
          )}
        </div>

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
