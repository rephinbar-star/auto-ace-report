import { cn } from "@/lib/utils";
import { getRiskColorToken } from "@/lib/risk-colors";

interface MetricCard {
  label: string;
  value: string;
  context: string;
  colorToken?: string;
  tintRed?: boolean;
  scrollTarget: string;
  historyTab?: string;
}

interface MetricsStripProps {
  priceDifference: number;
  fairMarketPrivate: number;
  riskScore: number | null;
  riskLabel: string;
  healthScore: number;
  monthlyCostRange: string;
  openRecalls: number;
  resolvedRecalls: number;
  warrantyStatus: string;
  warrantyContext: string;
  pricingDataUnavailable?: boolean;
  daysOnMarket?: number | null;
  daysOnMarketAsOf?: Date | null;
  onHistoryTabChange?: (tab: string) => void;
}

const colorClasses: Record<string, string> = {
  "risk-green": "text-risk-green",
  "risk-amber": "text-risk-amber",
  "risk-red": "text-risk-red",
  "neutral": "text-neutral",
};

export function MetricsStrip({
  priceDifference, fairMarketPrivate, riskScore, riskLabel,
  healthScore, monthlyCostRange, openRecalls, resolvedRecalls,
  warrantyStatus, warrantyContext, pricingDataUnavailable,
  daysOnMarket, daysOnMarketAsOf, onHistoryTabChange,
}: MetricsStripProps) {
  const priceBelow = priceDifference <= 0;
  const priceToken = pricingDataUnavailable ? "neutral" : (priceBelow ? "risk-green" : "risk-red");
  const riskToken = riskScore != null ? getRiskColorToken(riskScore) : "neutral";
  const healthToken = getRiskColorToken(100 - healthScore);
  const recallToken = openRecalls > 0 ? "risk-red" : "risk-green";
  const warrantyToken = warrantyStatus === "active" ? "risk-green" : warrantyStatus === "expired" ? "risk-red" : "risk-amber";

  const cards: MetricCard[] = [
    {
      label: "PRICE VS MARKET",
      value: pricingDataUnavailable ? "Unavailable" : `$${Math.abs(priceDifference).toLocaleString()} ${priceBelow ? "below" : "above"} FMV`,
      context: pricingDataUnavailable ? "Market pricing data not available" : `vs $${fairMarketPrivate.toLocaleString()} fair market value`,
      colorToken: priceToken,
      scrollTarget: "section-pricing",
    },
    {
      label: "PURCHASE RISK",
      value: riskScore != null ? `${riskScore} / 100` : "N/A",
      context: riskLabel || "Calculating...",
      colorToken: riskToken,
      scrollTarget: "section-risk",
    },
    {
      label: "VEHICLE HEALTH",
      value: `${healthScore} / 100`,
      context: "See condition details",
      colorToken: healthToken,
      scrollTarget: "section-history",
      historyTab: "service",
    },
    {
      label: "MONTHLY OWNERSHIP",
      value: monthlyCostRange,
      context: "All-in estimated cost",
      colorToken: "neutral",
      scrollTarget: "section-financials",
    },
    {
      label: "SAFETY RECALLS",
      value: openRecalls > 0 ? `${openRecalls} Open` : "None",
      context: `${resolvedRecalls} resolved${openRecalls > 0 ? " · action required" : ""}`,
      colorToken: recallToken,
      tintRed: openRecalls > 0,
      scrollTarget: "section-history",
      historyTab: "recalls",
    },
    {
      label: "WARRANTY",
      value: warrantyStatus === "active" ? "Active" : warrantyStatus === "expired" ? "Expired" : "Unknown",
      context: warrantyContext,
      colorToken: warrantyToken,
      scrollTarget: "section-history",
      historyTab: "overview",
    },
  ];

  if (daysOnMarket != null) {
    const asOfLabel = daysOnMarketAsOf
      ? daysOnMarketAsOf.toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : null;
    cards.push({
      label: "LISTED",
      value: `${daysOnMarket} day${daysOnMarket === 1 ? "" : "s"} ago`,
      context: `via MarketCheck${asOfLabel ? ` · as of ${asOfLabel}` : ""}`,
      colorToken: "neutral",
      scrollTarget: "section-pricing",
    });
  }

  const handleClick = (card: MetricCard) => {
    if (card.historyTab && onHistoryTabChange) {
      onHistoryTabChange(card.historyTab);
    }
    document.getElementById(card.scrollTarget)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div id="section-overview" className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory" style={{ WebkitOverflowScrolling: "touch" }}>
      {cards.map((card) => (
        <button
          key={card.label}
          onClick={() => handleClick(card)}
          className={cn(
            "report-card flex-1 min-w-[130px] px-2.5 py-2 md:px-3 md:py-2.5 text-left snap-start cursor-pointer border border-transparent transition-all duration-200 hover:border-primary hover:shadow-md hover:shadow-primary/10 hover:-translate-y-0.5",
            card.tintRed && "bg-risk-red/5"
          )}
        >
          <p className="text-[11px] uppercase tracking-wider text-neutral font-medium leading-tight">{card.label}</p>
          <p className={cn("text-lg font-bold mt-0.5 leading-tight", colorClasses[card.colorToken || "neutral"])}>
            {card.value}
          </p>
          <p className="text-[11px] text-neutral mt-0.5 leading-tight line-clamp-2">{card.context}</p>
        </button>
      ))}
    </div>
  );
}
