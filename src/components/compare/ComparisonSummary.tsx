import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Crown, TrendingUp, Shield, DollarSign, Info, Fuel } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScoreBreakdown } from "./ScoreBreakdown";
import { FinancialOutlookCard } from "./FinancialOutlookCard";
import { scoreAndRankVehicles, getYearFiveEquity, type VehicleScoreResult } from "./scoring-utils";
import type { Tables } from "@/integrations/supabase/types";

type VehicleReport = Tables<"vehicle_reports">;

interface ComparisonSummaryProps {
  vehicles: VehicleReport[];
  annualMiles?: number;
}

export function ComparisonSummary({ vehicles, annualMiles = 12000 }: ComparisonSummaryProps) {
  const analysis = useMemo(() => {
    if (vehicles.length === 0) return null;

    // Use the new research-backed scoring algorithm with mileage config
    const scoredVehicles = scoreAndRankVehicles(vehicles, { annualMiles });
    
    const bestBuy = scoredVehicles[0];
    const others = scoredVehicles.slice(1);
    
    // Quick stats helpers
    const lowestPrice = [...vehicles].sort(
      (a, b) => Number(a.asking_price) - Number(b.asking_price)
    )[0];
    const lowestMileage = [...vehicles].sort((a, b) => a.mileage - b.mileage)[0];
    const lowestRisk = [...vehicles].sort((a, b) => {
      const riskOrder: Record<string, number> = { low: 0, medium: 1, high: 2 };
      const aRisk = riskOrder[a.risk_level || "medium"] ?? 1;
      const bRisk = riskOrder[b.risk_level || "medium"] ?? 1;
      return aRisk - bRisk;
    })[0];

    // Find lowest TCO vehicle
    const lowestTCO = scoredVehicles.reduce((best, current) => {
      if (!current.tco || !best.tco) return best;
      return current.tco.totalTCO < best.tco.totalTCO ? current : best;
    }, scoredVehicles[0]);

    // Generate enhanced recommendation text with TCO savings and equity
    let recommendation = "";
    if (bestBuy) {
      const v = bestBuy.vehicle;
      const title = `${v.year} ${v.make} ${v.model}`;
      const strengths: string[] = [];
      
      // Build strength list from breakdown
      bestBuy.breakdown.forEach((item) => {
        const pct = (item.score / item.maxScore) * 100;
        if (pct >= 80) {
          if (item.category === "Deal Rating") strengths.push("excellent deal rating");
          else if (item.category === "Title Status") strengths.push("clean title");
          else if (item.category === "Accident History") strengths.push("clean accident history");
          else if (item.category === "5-Year Equity") strengths.push("strong long-term equity");
          else if (item.category === "Age & Warranty") strengths.push("newer with warranty protection");
          else if (item.category === "Reliability & Risk") strengths.push("low ownership risk");
          else if (item.category === "5-Year TCO") strengths.push("lowest total ownership cost");
        }
      });
      
      recommendation = `The **${title}** scores **${bestBuy.totalScore}/100** in our comprehensive analysis`;
      if (strengths.length > 0) {
        recommendation += `, excelling in ${strengths.slice(0, 3).join(", ")}`;
      }
      recommendation += ".";
      
      // Add TCO savings comparison
      if (bestBuy.tco && others.length > 0) {
        const highestTCO = Math.max(...scoredVehicles.map(s => s.tco?.totalTCO || 0));
        const tcoSavings = highestTCO - bestBuy.tco.totalTCO;
        if (tcoSavings > 1000) {
          recommendation += ` **Over 5 years, you'll save $${tcoSavings.toLocaleString()}** in ownership costs compared to the most expensive option.`;
        }
      }
      
      // Add equity position comparison
      const bestEquity = getYearFiveEquity(bestBuy.vehicle.depreciation_table);
      if (bestEquity !== null && others.length > 0) {
        const otherEquities = others.map(o => getYearFiveEquity(o.vehicle.depreciation_table)).filter(e => e !== null) as number[];
        const worstEquity = otherEquities.length > 0 ? Math.min(...otherEquities) : null;
        
        if (worstEquity !== null && bestEquity > worstEquity + 2000) {
          const equityDesc = bestEquity >= 0 
            ? `**+$${bestEquity.toLocaleString()} positive equity**` 
            : `**$${Math.abs(bestEquity).toLocaleString()} better equity position**`;
          const comparisonDesc = worstEquity < 0
            ? `vs $${Math.abs(worstEquity).toLocaleString()} underwater`
            : `vs $${worstEquity.toLocaleString()}`;
          recommendation += ` At year 5, this vehicle projects ${equityDesc} ${comparisonDesc} for alternatives.`;
        }
      }
    }

    return {
      scoredVehicles,
      bestBuy,
      others,
      lowestPrice,
      lowestMileage,
      lowestRisk,
      lowestTCO,
      recommendation,
    };
  }, [vehicles, annualMiles]);

  if (!analysis || vehicles.length < 2) {
    return (
      <Card className="bg-muted/50 border-dashed">
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">
            Add at least 2 vehicles to see comparison insights
          </p>
        </CardContent>
      </Card>
    );
  }

  const {
    scoredVehicles,
    bestBuy,
    others,
    lowestPrice,
    lowestMileage,
    lowestRisk,
    lowestTCO,
    recommendation,
  } = analysis;

  return (
    <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Crown className="h-5 w-5 text-primary" />
          Comparison Verdict
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Best Buy Recommendation */}
        {bestBuy && (
          <div className="space-y-2">
            <h4 className="font-semibold text-lg text-primary">
              🏆 Best Buy: {bestBuy.vehicle.year} {bestBuy.vehicle.make}{" "}
              {bestBuy.vehicle.model}
            </h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {recommendation}
            </p>
          </div>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-background border">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-success" />
              <span className="text-xs text-muted-foreground">Lowest Price</span>
            </div>
            <p className="font-semibold text-sm truncate">
              {lowestPrice.year} {lowestPrice.make} {lowestPrice.model}
            </p>
            <p className="text-primary font-bold">
              ${Number(lowestPrice.asking_price).toLocaleString()}
            </p>
          </div>

          <div className="p-3 rounded-lg bg-background border">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Lowest Mileage</span>
            </div>
            <p className="font-semibold text-sm truncate">
              {lowestMileage.year} {lowestMileage.make} {lowestMileage.model}
            </p>
            <p className="text-primary font-bold">
              {lowestMileage.mileage.toLocaleString()} mi
            </p>
          </div>

          <div className="p-3 rounded-lg bg-background border">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="h-4 w-4 text-success" />
              <span className="text-xs text-muted-foreground">Lowest Risk</span>
            </div>
            <p className="font-semibold text-sm truncate">
              {lowestRisk.year} {lowestRisk.make} {lowestRisk.model}
            </p>
            <Badge
              variant="outline"
              className={cn(
                "mt-1",
                lowestRisk.risk_level === "low"
                  ? "bg-success/10 text-success"
                  : lowestRisk.risk_level === "medium"
                  ? "bg-warning/10 text-warning"
                  : "bg-danger/10 text-danger"
              )}
            >
              {lowestRisk.risk_level || "Unknown"} risk
            </Badge>
          </div>

          {/* Lowest TCO */}
          {lowestTCO?.tco && (
            <div className="p-3 rounded-lg bg-background border">
              <div className="flex items-center gap-2 mb-1">
                <Fuel className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground">Lowest TCO</span>
              </div>
              <p className="font-semibold text-sm truncate">
                {lowestTCO.vehicle.year} {lowestTCO.vehicle.make} {lowestTCO.vehicle.model}
              </p>
              <p className="text-primary font-bold">
                ${lowestTCO.tco.totalTCO.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">5-year total</p>
            </div>
          )}
        </div>

        {/* Score Breakdown */}
        <ScoreBreakdown scoredVehicles={scoredVehicles} />

        {/* 5-Year Financial Outlook Card */}
        <FinancialOutlookCard scoredVehicles={scoredVehicles} annualMiles={annualMiles} />

        {/* TCO Comparison Table */}
        {scoredVehicles.some(s => s.tco) && (
          <div className="space-y-2">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              ⛽ Total Cost of Ownership (5 Years @ {annualMiles.toLocaleString()} mi/yr)
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-1 font-medium text-muted-foreground">Vehicle</th>
                    <th className="text-right py-2 px-1 font-medium text-muted-foreground">Purchase</th>
                    <th className="text-right py-2 px-1 font-medium text-muted-foreground">Fuel</th>
                    <th className="text-right py-2 px-1 font-medium text-muted-foreground">Repairs</th>
                    {scoredVehicles.some(s => (s.tco?.mileageDepreciation ?? 0) > 0) && (
                      <th className="text-right py-2 px-1 font-medium text-muted-foreground">Mile Dep.</th>
                    )}
                    <th className="text-right py-2 px-1 font-medium text-muted-foreground">Total TCO</th>
                  </tr>
                </thead>
                <tbody>
                  {scoredVehicles.map((scored, index) => {
                    const isLowestTCO = lowestTCO?.vehicle.id === scored.vehicle.id;
                    const hasMileageDepreciation = scoredVehicles.some(s => (s.tco?.mileageDepreciation ?? 0) > 0);
                    return (
                      <tr 
                        key={scored.vehicle.id} 
                        className={cn(
                          "border-b last:border-0",
                          isLowestTCO && "bg-success/5"
                        )}
                      >
                        <td className="py-2 px-1">
                          <div className="flex items-center gap-2">
                            {isLowestTCO && <span className="text-success">✓</span>}
                            <span className="truncate max-w-[120px]">
                              {scored.vehicle.year} {scored.vehicle.make} {scored.vehicle.model}
                            </span>
                          </div>
                        </td>
                        <td className="text-right py-2 px-1">
                          ${Number(scored.vehicle.asking_price).toLocaleString()}
                        </td>
                        <td className="text-right py-2 px-1">
                          {scored.tco ? `$${scored.tco.fuelCost5Year.toLocaleString()}` : "—"}
                        </td>
                        <td className="text-right py-2 px-1">
                          {scored.tco ? `$${scored.tco.repairCost5Year.toLocaleString()}` : "—"}
                        </td>
                        {hasMileageDepreciation && (
                          <td className="text-right py-2 px-1 text-warning">
                            {scored.tco?.mileageDepreciation ? `+$${scored.tco.mileageDepreciation.toLocaleString()}` : "—"}
                          </td>
                        )}
                        <td className={cn(
                          "text-right py-2 px-1 font-bold",
                          isLowestTCO ? "text-success" : ""
                        )}>
                          {scored.tco ? `$${scored.tco.totalTCO.toLocaleString()}` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {lowestTCO?.tco && scoredVehicles.length > 1 && (
              <p className="text-xs text-muted-foreground">
                💡 <strong>{lowestTCO.vehicle.year} {lowestTCO.vehicle.make} {lowestTCO.vehicle.model}</strong> has the lowest 5-year ownership cost at {annualMiles.toLocaleString()} miles/year.
                {(() => {
                  const highestTCO = Math.max(...scoredVehicles.map(s => s.tco?.totalTCO || 0));
                  const savings = highestTCO - lowestTCO.tco.totalTCO;
                  return savings > 0 ? ` Saves $${savings.toLocaleString()} vs the most expensive option.` : "";
                })()}
              </p>
            )}
          </div>
        )}

        {/* Price Comparison Table */}
        <div className="space-y-2">
          <h4 className="font-semibold text-sm">Price Comparison</h4>
          <div className="space-y-1">
            {vehicles.map((v) => {
              const savings = v.fair_offer_price
                ? Number(v.asking_price) - Number(v.fair_offer_price)
                : 0;
              return (
                <div
                  key={v.id}
                  className="flex items-center justify-between text-sm p-2 rounded bg-background"
                >
                  <span className="truncate flex-1">
                    {v.year} {v.make} {v.model}
                  </span>
                  <div className="flex items-center gap-4">
                    <span className="font-medium">
                      ${Number(v.asking_price).toLocaleString()}
                    </span>
                    {savings !== 0 && (
                      <span
                        className={cn(
                          "text-xs font-medium",
                          savings > 0 ? "text-destructive" : "text-success"
                        )}
                      >
                        {savings > 0 ? "+" : ""}
                        {savings.toLocaleString()} vs fair
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Why Not Other Vehicles - Educational Section */}
        {others && others.length > 0 && (
          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-muted-foreground" />
              <h4 className="font-semibold text-sm">Why Not the Others?</h4>
            </div>
            <div className="space-y-2">
              {others.map((scored, index) => (
                <div
                  key={scored.vehicle.id}
                  className="p-3 rounded-lg bg-muted/50 border border-muted"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-muted-foreground font-bold text-sm">
                      #{index + 2}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-sm">
                          {scored.vehicle.year} {scored.vehicle.make}{" "}
                          {scored.vehicle.model}
                        </p>
                        <span className="text-xs text-muted-foreground">
                          {scored.totalScore}/100
                        </span>
                      </div>
                      {scored.whyNotReasons.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {scored.whyNotReasons.slice(0, 2).map((reason, i) => (
                            <li
                              key={i}
                              className="text-xs text-muted-foreground leading-relaxed"
                              dangerouslySetInnerHTML={{
                                __html: reason.replace(
                                  /\*\*(.*?)\*\*/g,
                                  '<strong class="text-foreground">$1</strong>'
                                ),
                              }}
                            />
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground italic">
              💡 These factors are backed by industry research on vehicle values,
              resale data, and total cost of ownership studies.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
