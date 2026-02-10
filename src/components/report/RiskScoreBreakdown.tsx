import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UVPRSResult } from "@/lib/uvprs-scoring";

interface RiskScoreBreakdownProps {
  result: UVPRSResult;
}

const riskColors: Record<string, string> = {
  low: "bg-success text-success-foreground",
  moderate: "bg-warning text-warning-foreground",
  high: "bg-orange-500 text-white",
  very_high: "bg-danger text-danger-foreground",
  extreme: "bg-red-900 text-white",
};

const riskProgressColors: Record<string, string> = {
  low: "[&>div]:bg-success",
  moderate: "[&>div]:bg-warning",
  high: "[&>div]:bg-orange-500",
  very_high: "[&>div]:bg-danger",
  extreme: "[&>div]:bg-red-900",
};

function getFactorBarColor(score: number): string {
  if (score <= 20) return "[&>div]:bg-success";
  if (score <= 40) return "[&>div]:bg-warning";
  if (score <= 60) return "[&>div]:bg-orange-500";
  return "[&>div]:bg-danger";
}

export function RiskScoreBreakdown({ result }: RiskScoreBreakdownProps) {
  const { totalScore, riskLevel, riskLabel, factors, knownFactorCount } = result;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-primary" />
          Purchase Risk Score (UVPRS)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Score */}
        <div className="flex items-center gap-4">
          <div className="text-center">
            <div className="text-4xl font-bold">{totalScore}</div>
            <p className="text-xs text-muted-foreground">/ 100</p>
          </div>
          <div className="flex-1 space-y-2">
            <Badge className={cn("text-xs", riskColors[riskLevel])}>
              {riskLabel}
            </Badge>
            <Progress 
              value={totalScore} 
              className={cn("h-3", riskProgressColors[riskLevel])} 
            />
          </div>
        </div>

        {knownFactorCount < 9 && (
          <div className="flex items-start gap-2 rounded-md bg-muted p-3 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              {9 - knownFactorCount} factor(s) had missing data. Weights were redistributed across {knownFactorCount} known factors.
            </span>
          </div>
        )}

        {/* Factor Breakdown */}
        <div className="space-y-3">
          {factors.map((factor) => (
            <div key={factor.key} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">
                  {factor.label}
                  <span className="ml-1 text-xs text-muted-foreground">
                    ({Math.round(factor.weight * 100)}%)
                  </span>
                </span>
                <span className={cn(
                  "text-xs font-medium",
                  !factor.known && "text-muted-foreground italic"
                )}>
                  {factor.known ? `${factor.score} / 100` : "N/A"}
                </span>
              </div>
              <Progress 
                value={factor.known ? factor.score : 50} 
                className={cn(
                  "h-2",
                  factor.known ? getFactorBarColor(factor.score) : "[&>div]:bg-muted-foreground/30"
                )} 
              />
              <p className="text-xs text-muted-foreground">
                {factor.description}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
