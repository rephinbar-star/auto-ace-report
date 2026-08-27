import { ExternalLink, Gauge, MapPin, ShieldCheck, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { resolveValidationLabel } from "@/lib/best-deal/validation-labels";
import type { BestDeal } from "@/types/best-deal";

const money = (n: number | null | undefined) =>
  typeof n === "number" ? `$${Math.round(n).toLocaleString()}` : null;

function badgeClass(badge: BestDeal["badge"]) {
  if (badge === "Exceptional") return "bg-success text-success-foreground hover:bg-success/90";
  if (badge === "Strong") return "bg-primary text-primary-foreground hover:bg-primary/90";
  return "bg-secondary text-secondary-foreground";
}

export function DealResultCard({ deal }: { deal: BestDeal }) {
  const title =
    [deal.year, deal.make, deal.model, deal.trim].filter(Boolean).join(" ") ||
    deal.heading ||
    "Vehicle listing";

  const analyzeHref = deal.vin
    ? `/analyze?vin=${encodeURIComponent(deal.vin)}`
    : deal.vdpUrl
      ? `/analyze?url=${encodeURIComponent(deal.vdpUrl)}`
      : "/analyze";

  return (
    <Card className="overflow-hidden border-2 bg-gradient-card transition-all duration-200 hover:border-primary/20 hover:shadow-card">
      <CardContent className="p-0">
        <div className="flex flex-col md:flex-row">
          <div className="relative w-full shrink-0 bg-muted md:w-64">
            <img
              src={deal.imageUrl ?? "/placeholder.svg"}
              alt={`${title} listing photo`}
              loading="lazy"
              className="h-48 w-full object-cover md:h-full"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = "/placeholder.svg";
              }}
            />
            <div className="absolute left-3 top-3 flex items-center gap-2">
              <span className="rounded-full bg-background/90 px-2.5 py-1 text-xs font-bold text-foreground">
                #{deal.rank}
              </span>
              <Badge className={cn("text-xs", badgeClass(deal.badge))}>{deal.badge}</Badge>
            </div>
          </div>

          <div className="flex-1 space-y-4 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold tracking-tight text-foreground">{title}</h3>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  {deal.inventoryType && (
                    <span className="capitalize">{deal.inventoryType}</span>
                  )}
                  {deal.dealerName && <span>{deal.dealerName}</span>}
                  {(deal.city || deal.state) && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {[deal.city, deal.state].filter(Boolean).join(", ")}
                    </span>
                  )}
                  {deal.distanceMiles !== null && <span>{Math.round(deal.distanceMiles)} mi away</span>}
                </p>
              </div>
              <Badge variant="outline" className="capitalize">
                {deal.dealType}
              </Badge>
            </div>

            <div className="grid gap-3 rounded-xl border bg-card/50 p-4 sm:grid-cols-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-foreground">
                    {money(deal.monthlyPayment) ?? "—"}
                    <span className="text-base font-medium text-muted-foreground">/mo</span>
                  </span>
                  <Badge
                    variant={deal.paymentBasis === "advertised" ? "default" : "secondary"}
                    className="text-[11px] uppercase tracking-wide"
                  >
                    {deal.paymentBasis === "advertised" ? "Advertised" : "Estimated"}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{deal.paymentLabel}</p>
              </div>
              <dl className="space-y-1 text-sm">
                {deal.price !== null && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Advertised price</dt>
                    <dd className="font-medium">{money(deal.price)}</dd>
                  </div>
                )}
                {deal.msrp !== null && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">MSRP</dt>
                    <dd className="font-medium">
                      {money(deal.msrp)}
                      {deal.discountPercent !== null && deal.discountPercent > 0 && (
                        <span className="ml-1 text-success">(-{deal.discountPercent}%)</span>
                      )}
                    </dd>
                  </div>
                )}
                {deal.termMonths !== null && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Term</dt>
                    <dd className="font-medium">{deal.termMonths} months</dd>
                  </div>
                )}
                {deal.advertisedDownPayment !== null && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Advertised down payment</dt>
                    <dd className="font-medium">{money(deal.advertisedDownPayment)}</dd>
                  </div>
                )}
                {deal.effectiveMonthly !== null && deal.dealType === "lease" && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Effective monthly</dt>
                    <dd className="font-medium">{money(deal.effectiveMonthly)}</dd>
                  </div>
                )}
                {deal.leaseValueRatio !== null && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Lease value ratio</dt>
                    <dd className="font-medium">{deal.leaseValueRatio}% of MSRP/mo</dd>
                  </div>
                )}
                {deal.assumedAprPercent !== null && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Your assumptions</dt>
                    <dd className="font-medium">
                      {deal.assumedAprPercent}% APR · {deal.termMonths} mo ·{" "}
                      {money(deal.assumedDownPayment ?? 0)} down
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            {deal.dealType === "lease" && deal.advertisedDownPayment !== null && (
              <p className="text-xs text-muted-foreground">
                This is the <strong>advertised down payment</strong>, not full due at signing.
                Actual due at signing can also include the first payment, taxes, registration,
                acquisition, and dealer fees.
              </p>
            )}

            {deal.mileageNote && (
              <p className="inline-flex items-center gap-2 rounded-lg bg-warning/10 px-3 py-2 text-xs text-foreground">
                <Gauge className="h-3.5 w-3.5" />
                {deal.mileageNote}
              </p>
            )}

            {deal.evidence.length > 0 && (
              <div>
                <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  Why it ranked
                </h4>
                <ul className="space-y-1.5">
                  {deal.evidence.map((item) => (
                    <li key={item.label} className="flex gap-2 text-sm text-muted-foreground">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      <span>
                        <span className="font-medium text-foreground">{item.label}:</span>{" "}
                        {item.detail}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                Market validation
              </h4>
              <ul className="space-y-2">
                {deal.validations.map((v) => (
                  <li key={v.sourceName} className="rounded-lg border bg-card/50 p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={
                          v.status === "corroborated_numeric"
                            ? "default"
                            : v.status === "editorial_match"
                              ? "secondary"
                              : "outline"
                        }
                        className="text-[11px]"
                      >
                        {resolveValidationLabel(v.sourceName, v.status)}
                      </Badge>
                      <a
                        href={v.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="text-xs text-primary underline-offset-2 hover:underline"
                      >
                        {v.sourceName}
                      </a>
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground">{v.note}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Match basis: {v.matchBasis} · Retrieved{" "}
                      {new Date(v.retrievedAt).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              {deal.vdpUrl ? (
                <Button asChild className="flex-1">
                  <a href={deal.vdpUrl} target="_blank" rel="noopener noreferrer nofollow">
                    View dealer listing
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              ) : (
                <Button className="flex-1" disabled>
                  Dealer listing unavailable
                </Button>
              )}
              <Button asChild variant="outline" className="flex-1">
                <Link to={analyzeHref}>Analyze this vehicle</Link>
              </Button>
            </div>

            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Source: {deal.dataSource} · Updated {new Date(deal.retrievedAt).toLocaleString()}.
              Inventory and terms can change. Verify eligibility, taxes, fees, mileage, credit
              tier, and availability with the dealer.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
