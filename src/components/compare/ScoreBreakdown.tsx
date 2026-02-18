import { useState } from "react";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { HelpCircle, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { VehicleScoreResult } from "./scoring-utils";

interface ScoreBreakdownProps {
  scoredVehicles: VehicleScoreResult[];
}

const categoryColors: Record<string, string> = {
  "Deal Rating": "bg-primary",
  "Title Status": "bg-emerald-500",
  "Accident History": "bg-amber-500",
  "5-Year Equity": "bg-blue-500",
  "Vehicle Age": "bg-violet-500",
  "Warranty": "bg-teal-500",
  "Reliability & Risk": "bg-rose-500",
  "Mileage": "bg-cyan-500",
  "5-Year TCO": "bg-orange-500",
};

const categoryTooltips: Record<string, { title: string; details: string[] }> = {
  "Deal Rating": {
    title: "How good is the price? (14 pts max)",
    details: [
      "Excellent: 14 pts — Priced well below market",
      "Good: 11 pts — Fair price, some savings",
      "Fair: 8 pts — At market value",
      "Overpriced: 5 pts — Above market value",
      "Poor: 2 pts — Significantly inflated",
    ],
  },
  "Title Status": {
    title: "Vehicle title history impact (18 pts max)",
    details: [
      "Clean: 18 pts — Full value, no issues",
      "Rebuilt: 9 pts — 20-40% value reduction",
      "Salvage: 4 pts — 40-60% value loss, financing issues",
      "Lemon: 2 pts — Manufacturer buyback history",
    ],
  },
  "Accident History": {
    title: "Prior accident impact on value (18 pts max)",
    details: [
      "0 accidents: 18 pts — Clean history",
      "1 accident: 14 pts — ~10% value impact",
      "2 accidents: 9 pts — ~20% value impact",
      "3+ accidents: 4 pts — ~30% value impact",
    ],
  },
  "5-Year Equity": {
    title: "Projected equity after 5 years (10 pts max)",
    details: [
      ">$5,000 positive: 10 pts — Strong investment",
      "$1K-$5K positive: 7 pts — Good equity",
      "Break-even: 5 pts — Neutral position",
      "$1K-$5K negative: 2 pts — Underwater",
      ">$5K negative: 0 pts — Deep loss",
    ],
  },
  "Vehicle Age": {
    title: "Vehicle age assessment (6 pts max)",
    details: [
      "Each year: ~0.6 pt decrease",
      "0 years: 6 pts — Brand new",
      "3 years: 4 pts — Still young",
      "5 years: 3 pts — Mid-age",
      "8+ years: 1 pt — Older vehicle",
      "+1 bonus if health score ≥90",
    ],
  },
  "Warranty": {
    title: "Warranty coverage status (6 pts max)",
    details: [
      "CPO: 6 pts — Extended warranty coverage",
      "24+ months remaining: 6 pts — Well covered",
      "12-23 months remaining: 4 pts — Some coverage",
      "1-11 months remaining: 2 pts — Expiring soon",
      "Expired: 1 pt — No warranty protection",
      "Uses CarFax data when available, otherwise estimates from manufacturer specs",
    ],
  },
  "Reliability & Risk": {
    title: "Brand reliability + concerns (10 pts max)",
    details: [
      "60%: Brand rating (J.D. Power/Consumer Reports)",
      "40%: Model-specific concerns",
      "Toyota/Honda/Lexus: Excellent (9/10)",
      "Hyundai/Kia/Genesis: Good (7/10)",
      "Ford/Chevy/Nissan: Average (5/10)",
      "BMW/Jeep/Land Rover: Below avg (3-4/10)",
    ],
  },
  "Mileage": {
    title: "Annual mileage assessment (8 pts max)",
    details: [
      "Under 10k/year: 8 pts — Excellent",
      "10k-12k/year: 6 pts — Below average",
      "12k-15k/year: 5 pts — Average (industry std)",
      "15k-18k/year: 3 pts — Above average",
      "Over 18k/year: 1 pt — High mileage",
    ],
  },
  "5-Year TCO": {
    title: "Total Cost of Ownership (10 pts max)",
    details: [
      "Includes: Purchase + Fuel + Repairs",
      "Fuel: Based on EPA MPG × 12k miles/yr × $3.50/gal",
      "Repairs: From 5-year depreciation table",
      "Lowest TCO: 10 pts — Best value",
      "Highest TCO: 2 pts — Most expensive",
      "Score is relative to other vehicles compared",
    ],
  },
};

export function ScoreBreakdown({ scoredVehicles }: ScoreBreakdownProps) {
  const [expandedVehicles, setExpandedVehicles] = useState<Set<string>>(new Set());

  if (scoredVehicles.length === 0) return null;

  // Get all category names from the first vehicle's breakdown
  const categories = scoredVehicles[0]?.breakdown.map((b) => b.category) || [];

  const toggleExpanded = (vehicleId: string) => {
    setExpandedVehicles((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(vehicleId)) {
        newSet.delete(vehicleId);
      } else {
        newSet.add(vehicleId);
      }
      return newSet;
    });
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        <h4 className="font-semibold text-sm flex items-center gap-2">
          📊 Score Breakdown
          <span className="text-xs font-normal text-muted-foreground">
            (out of 100 points)
          </span>
        </h4>

        <div className="space-y-6">
          {scoredVehicles.map((scored, vehicleIndex) => {
            const v = scored.vehicle;
            const isWinner = vehicleIndex === 0;
            const isExpanded = expandedVehicles.has(v.id);

            return (
              <Collapsible
                key={v.id}
                open={isExpanded}
                onOpenChange={() => toggleExpanded(v.id)}
              >
                <div
                  className={cn(
                    "p-4 rounded-lg border",
                    isWinner ? "bg-primary/5 border-primary/30" : "bg-muted/30"
                  )}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {isWinner && <span className="text-lg">🏆</span>}
                      <span className="font-semibold text-sm">
                        {v.year} {v.make} {v.model}
                      </span>
                    </div>
                    <div
                      className={cn(
                        "text-lg font-bold",
                        isWinner ? "text-primary" : "text-muted-foreground"
                      )}
                    >
                      {scored.totalScore}/100
                    </div>
                  </div>

                  <div className="space-y-2">
                    {scored.breakdown.map((item) => {
                      const tooltip = categoryTooltips[item.category];
                      return (
                        <div key={item.category} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <div className="flex items-center gap-1">
                              <span className="text-muted-foreground">
                                {item.category}
                              </span>
                              {tooltip && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <HelpCircle className="h-3 w-3 text-muted-foreground/60 cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent
                                    side="top"
                                    className="max-w-[280px] p-3"
                                  >
                                    <p className="font-semibold text-sm mb-2">
                                      {tooltip.title}
                                    </p>
                                    <ul className="space-y-1">
                                      {tooltip.details.map((detail, i) => (
                                        <li
                                          key={i}
                                          className="text-xs text-muted-foreground"
                                        >
                                          {detail}
                                        </li>
                                      ))}
                                    </ul>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                            <span className="font-medium">
                              {item.score}/{item.maxScore}
                            </span>
                          </div>
                          <div className="relative">
                            <Progress
                              value={(item.score / item.maxScore) * 100}
                              className="h-2"
                            />
                            <div
                              className={cn(
                                "absolute inset-0 rounded-full opacity-80",
                                categoryColors[item.category] || "bg-primary"
                              )}
                              style={{
                                width: `${(item.score / item.maxScore) * 100}%`,
                                height: "100%",
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Collapsible trigger button */}
                  <CollapsibleTrigger asChild>
                    <button
                      className="w-full mt-3 pt-2 border-t flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <span>{isExpanded ? "Hide details" : "Show details"}</span>
                      <ChevronDown
                        className={cn(
                          "h-3.5 w-3.5 transition-transform",
                          isExpanded && "rotate-180"
                        )}
                      />
                    </button>
                  </CollapsibleTrigger>

                  {/* Collapsible content with vehicle-specific details */}
                  <CollapsibleContent className="mt-3">
                    <div className="space-y-2 pt-2 border-t">
                      {scored.breakdown.map((item) => (
                        <div
                          key={item.category}
                          className="flex items-start gap-2 text-xs"
                        >
                          <div
                            className={cn(
                              "w-2 h-2 rounded-full mt-1 flex-shrink-0",
                              categoryColors[item.category] || "bg-primary"
                            )}
                          />
                          <div className="flex-1 min-w-0">
                            <span className="font-medium">{item.category}:</span>{" "}
                            <span className="text-muted-foreground">
                              {item.description}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 pt-2">
          {categories.map((category) => {
            const tooltip = categoryTooltips[category];
            return (
              <Tooltip key={category}>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1.5 text-xs cursor-help">
                    <div
                      className={cn(
                        "w-2.5 h-2.5 rounded-full",
                        categoryColors[category] || "bg-primary"
                      )}
                    />
                    <span className="text-muted-foreground">{category}</span>
                  </div>
                </TooltipTrigger>
                {tooltip && (
                  <TooltipContent side="top" className="max-w-[280px] p-3">
                    <p className="font-semibold text-sm mb-2">{tooltip.title}</p>
                    <ul className="space-y-1">
                      {tooltip.details.map((detail, i) => (
                        <li key={i} className="text-xs text-muted-foreground">
                          {detail}
                        </li>
                      ))}
                    </ul>
                  </TooltipContent>
                )}
              </Tooltip>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}
