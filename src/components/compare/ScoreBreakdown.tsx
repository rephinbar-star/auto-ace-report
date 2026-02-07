import { Progress } from "@/components/ui/progress";
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
  "Age & Warranty": "bg-violet-500",
  "Reliability & Risk": "bg-rose-500",
};

export function ScoreBreakdown({ scoredVehicles }: ScoreBreakdownProps) {
  if (scoredVehicles.length === 0) return null;

  // Get all category names from the first vehicle's breakdown
  const categories = scoredVehicles[0]?.breakdown.map((b) => b.category) || [];

  return (
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
          
          return (
            <div
              key={v.id}
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
                <div className={cn(
                  "text-lg font-bold",
                  isWinner ? "text-primary" : "text-muted-foreground"
                )}>
                  {scored.totalScore}/100
                </div>
              </div>

              <div className="space-y-2">
                {scored.breakdown.map((item) => (
                  <div key={item.category} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{item.category}</span>
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
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 pt-2">
        {categories.map((category) => (
          <div key={category} className="flex items-center gap-1.5 text-xs">
            <div
              className={cn(
                "w-2.5 h-2.5 rounded-full",
                categoryColors[category] || "bg-primary"
              )}
            />
            <span className="text-muted-foreground">{category}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
