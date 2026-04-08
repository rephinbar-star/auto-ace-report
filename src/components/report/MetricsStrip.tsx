import { cn } from "@/lib/utils";
import { getRiskColorToken } from "@/lib/risk-colors";

interface MetricCard {
  label: string;
  value: string;
  context: string;
  colorToken?: string;
  tintRed?: boolean;
  scrollTarget: string;
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
  warrantyStatus, warrantyContext,
}: MetricsStripProps) {
  const priceBelow = priceDifference <= 0;
  const priceToken = priceBelow ? "risk-green" : "risk-red";
  const riskToken = riskScore != null ? getRiskColorToken(riskScore) : "neutral";
  const healthToken = getRiskColorToken(100 - healthScore); // invert: high health = low risk color
  const recallToken = openRecalls > 0 ? "risk-red" : "risk-green";
  const warrantyToken = warrantyStatus === "active" ? "risk-green" : warrantyStatus === "expired" ? "risk-red" : "risk-amber";

  const cards: MetricCard[] = [
    {
      label: "PRICE VS MARKET",
      value: `$${Math.abs(priceDifference).toLocaleString()} ${priceBelow ? "below" : "above"} FMV`,
      context: `vs $${fairMarketPrivate.toLocaleString()} fair market value`,
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
    },
    {
      label: "WARRANTY",
      value: warrantyStatus === "active" ? "Active" : warrantyStatus === "expired" ? "Expired" : "Unknown",
      context: warrantyContext,
      colorToken: warrantyToken,
      scrollTarget: "section-history",
    },
  ];

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div id="section-overview" className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory" style={{ WebkitOverflowScrolling: "touch" }}>
      {cards.map((card) => (
        <button
          key={card.label}
          onClick={() => scrollTo(card.scrollTarget)}
          className={cn(
            "report-card flex-1 min-w-[130px] p-3 text-left snap-start cursor-pointer hover:border-primary/30 transition-colors",
            card.tintRed && "bg-risk-red/5"
          )}
        >
          <p className="text-[11px] uppercase tracking-wider text-neutral font-medium">{card.label}</p>
          <p className={cn("text-lg font-bold mt-1", colorClasses[card.colorToken || "neutral"])}>
            {card.value}
          </p>
          <p className="text-[11px] text-neutral mt-0.5">{card.context}</p>
        </button>
      ))}
    </div>
  );
}
