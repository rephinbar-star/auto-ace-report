import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { VehicleScoreResult } from "./scoring-utils";
import { getYearFiveEquity } from "./scoring-utils";
import { calculateMonthlyOwnershipCost } from "@/lib/tco-calculations";

interface FinancialOutlookCardProps {
  scoredVehicles: VehicleScoreResult[];
}

export function FinancialOutlookCard({ scoredVehicles }: FinancialOutlookCardProps) {
  const financialData = useMemo(() => {
    if (scoredVehicles.length < 2) return null;

    const data = scoredVehicles.map((scored) => {
      const equity = getYearFiveEquity(scored.vehicle.depreciation_table);
      const monthlyOwnership = scored.tco
        ? calculateMonthlyOwnershipCost(scored.tco)
        : null;

      return {
        id: scored.vehicle.id,
        title: `${scored.vehicle.year} ${scored.vehicle.make} ${scored.vehicle.model}`,
        shortTitle: `${scored.vehicle.year} ${scored.vehicle.make}`,
        tco: scored.tco?.totalTCO ?? null,
        equity,
        monthlyOwnership,
        annualFuel: scored.tco?.annualFuelCost ?? null,
        repairs5Year: scored.tco?.repairCost5Year ?? null,
      };
    });

    // Find best in each category
    const bestTCO = data.reduce((best, curr) =>
      curr.tco && (!best.tco || curr.tco < best.tco) ? curr : best
    );
    const bestEquity = data.reduce((best, curr) =>
      curr.equity !== null && (best.equity === null || curr.equity > best.equity)
        ? curr
        : best
    );
    const bestMonthly = data.reduce((best, curr) =>
      curr.monthlyOwnership && (!best.monthlyOwnership || curr.monthlyOwnership < best.monthlyOwnership)
        ? curr
        : best
    );

    // Calculate savings for winner
    const winner = data[0]; // First is best overall
    const highestTCO = Math.max(...data.filter(d => d.tco).map(d => d.tco!));
    const savings = winner.tco ? highestTCO - winner.tco : 0;

    return {
      vehicles: data,
      bestTCOId: bestTCO.id,
      bestEquityId: bestEquity.id,
      bestMonthlyId: bestMonthly.id,
      winnerId: winner.id,
      totalSavings: savings,
    };
  }, [scoredVehicles]);

  if (!financialData || financialData.vehicles.length < 2) {
    return null;
  }

  const { vehicles, bestTCOId, bestEquityId, bestMonthlyId, winnerId, totalSavings } = financialData;

  return (
    <Card className="bg-gradient-to-br from-primary/5 to-success/5 border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          📊 5-Year Financial Outlook
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Comparison Grid */}
        <div className="overflow-x-auto -mx-2 px-2">
          <div className="min-w-[400px]">
            {/* Header Row */}
            <div className="grid grid-cols-4 gap-2 text-xs font-medium text-muted-foreground mb-2 px-1">
              <div>Vehicle</div>
              <div className="text-right">Year 5 Equity</div>
              <div className="text-right">Monthly Cost</div>
              <div className="text-right">5-Year TCO</div>
            </div>

            {/* Vehicle Rows */}
            {vehicles.map((v, index) => {
              const isWinner = v.id === winnerId;
              const isBestTCO = v.id === bestTCOId;
              const isBestEquity = v.id === bestEquityId;
              const isBestMonthly = v.id === bestMonthlyId;

              return (
                <div
                  key={v.id}
                  className={cn(
                    "grid grid-cols-4 gap-2 py-2 px-1 rounded-md text-sm",
                    isWinner
                      ? "bg-success/10 border border-success/20"
                      : index % 2 === 0
                      ? "bg-muted/30"
                      : ""
                  )}
                >
                  {/* Vehicle Name */}
                  <div className="flex items-center gap-1.5 min-w-0">
                    {isWinner && (
                      <CheckCircle2 className="h-3.5 w-3.5 text-success flex-shrink-0" />
                    )}
                    <span className="truncate font-medium">{v.shortTitle}</span>
                  </div>

                  {/* Year 5 Equity */}
                  <div className="text-right flex items-center justify-end gap-1">
                    {v.equity !== null ? (
                      <>
                        {v.equity >= 0 ? (
                          <TrendingUp className="h-3.5 w-3.5 text-success" />
                        ) : (
                          <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                        )}
                        <span
                          className={cn(
                            "font-medium",
                            v.equity >= 0 ? "text-success" : "text-destructive",
                            isBestEquity && "font-bold"
                          )}
                        >
                          {v.equity >= 0 ? "+" : ""}${v.equity.toLocaleString()}
                        </span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>

                  {/* Monthly Ownership */}
                  <div className="text-right">
                    {v.monthlyOwnership !== null ? (
                      <span
                        className={cn(
                          "font-medium",
                          isBestMonthly && "text-success font-bold"
                        )}
                      >
                        ${v.monthlyOwnership}/mo
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>

                  {/* 5-Year TCO */}
                  <div className="text-right">
                    {v.tco !== null ? (
                      <span
                        className={cn(
                          "font-medium",
                          isBestTCO && "text-success font-bold"
                        )}
                      >
                        ${v.tco.toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Winner Summary */}
        {totalSavings > 0 && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-success/10 border border-success/20">
            <DollarSign className="h-4 w-4 text-success mt-0.5" />
            <div className="text-sm">
              <span className="font-semibold text-success">
                {vehicles[0].shortTitle}
              </span>{" "}
              has the best long-term financial position.
              <span className="text-muted-foreground ml-1">
                Saves <span className="font-semibold">${totalSavings.toLocaleString()}</span> over 5 years vs the most expensive option.
              </span>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>
            <TrendingUp className="h-3 w-3 inline text-success" /> = positive equity
          </span>
          <span>
            <TrendingDown className="h-3 w-3 inline text-destructive" /> = underwater
          </span>
          <span>Monthly Cost = fuel + prorated repairs</span>
        </div>
      </CardContent>
    </Card>
  );
}
