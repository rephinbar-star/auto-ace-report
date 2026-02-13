import { useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ShieldAlert, Info, HelpCircle, Upload, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UVPRSResult } from "@/lib/uvprs-scoring";

const factorTooltips: Record<string, { meaning: string; advice: string }> = {
  title: {
    meaning: "Measures title brand risk. Clean titles score low; salvage/rebuilt/lemon titles dramatically increase risk due to structural damage or fraud history.",
    advice: "Always request a title history check. Avoid salvage/lemon titles unless you're a mechanic buying at steep discount.",
  },
  accidents: {
    meaning: "Scores risk from reported accidents. Even minor incidents can hide frame damage that surfaces later as alignment or safety issues.",
    advice: "Get a pre-purchase inspection (PPI) focusing on frame/unibody. Negotiate harder for 2+ accident vehicles.",
  },
  service: {
    meaning: "Evaluates maintenance consistency — service gaps, overdue major items (timing belt, transmission flush), and chronic repeat repairs.",
    advice: "Ask the seller for full service records. Budget for any overdue major maintenance before buying.",
  },
  mileage: {
    meaning: "Compares actual mileage to expected mileage for the vehicle's age (~12,000 mi/year). High-mileage vehicles face accelerated wear.",
    advice: "High mileage isn't always bad if service records are strong. Low mileage on old cars can mean sitting damage.",
  },
  brand: {
    meaning: "Reflects the manufacturer's long-term reliability track record based on industry data (Consumer Reports, J.D. Power).",
    advice: "Less reliable brands aren't deal-breakers — just budget 20-40% more for maintenance reserves.",
  },
  price: {
    meaning: "Compares the asking price to fair market value. Overpriced vehicles carry financial risk; suspiciously underpriced ones may hide problems.",
    advice: "Use the fair market values in this report to negotiate. Aim for within 5% of fair market.",
  },
  owners: {
    meaning: "More previous owners generally correlates with inconsistent maintenance and harder-to-verify history.",
    advice: "1-2 owners is ideal. For 3+ owners, insist on comprehensive service records.",
  },
  age: {
    meaning: "Older vehicles face higher risk from age-related deterioration — rubber seals, hoses, electronics, and rust.",
    advice: "For 8+ year old vehicles, inspect rubber components, undercarriage rust, and electrical systems carefully.",
  },
  recall: {
    meaning: "Uses NHTSA (the official federal database) as the primary source for all recalls issued for this year/make/model, then subtracts any recalls confirmed as resolved by your CarFax/AutoCheck report. This cross-reference gives the most accurate open recall count, though minor discrepancies can occur if CarFax hasn't recorded a recent repair.",
    advice: "Check NHTSA.gov with the VIN for the definitive list. All recall repairs are free at any authorized dealer — complete them before driving.",
  },
};

interface RiskScoreBreakdownProps {
  result: UVPRSResult;
  missingHistoryReport?: boolean;
  onUploadHistory?: (file: File) => void;
  isUploadingHistory?: boolean;
}

const riskColors: Record<string, string> = {
  low: "bg-success text-success-foreground",
  moderate: "bg-warning text-warning-foreground",
  high: "bg-danger text-danger-foreground",
};

const riskProgressColors: Record<string, string> = {
  low: "[&>div]:bg-success",
  moderate: "[&>div]:bg-warning",
  high: "[&>div]:bg-danger",
};

function getFactorBarColor(score: number): string {
  if (score <= 20) return "[&>div]:bg-success";
  if (score <= 40) return "[&>div]:bg-warning";
  if (score <= 60) return "[&>div]:bg-orange-500";
  return "[&>div]:bg-danger";
}

export function RiskScoreBreakdown({ result, missingHistoryReport, onUploadHistory, isUploadingHistory }: RiskScoreBreakdownProps) {
  const { totalScore, riskLevel, riskLabel, factors, knownFactorCount } = result;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUploadHistory) {
      onUploadHistory(file);
    }
    // Reset so the same file can be re-selected
    e.target.value = "";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-primary" />
          Purchase Risk Score
        </CardTitle>
        {missingHistoryReport && (
          <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-destructive">
            <span>⚠ Risk Score adversely affected because no available CarFax/AutoCheck was provided by user</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              variant="outline"
              size="sm"
              className="border-success bg-success text-success-foreground hover:bg-success/90"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingHistory}
            >
              {isUploadingHistory ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="mr-1.5 h-3.5 w-3.5" />
              )}
              {isUploadingHistory ? "Processing..." : "Upload CarFax/AutoCheck"}
            </Button>
          </div>
        )}
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
        <TooltipProvider delayDuration={200}>
          <div className="space-y-3">
            {factors.map((factor) => {
              const tip = factorTooltips[factor.key];
              return (
                <div key={factor.key} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium flex items-center gap-1">
                      {factor.label}
                      <span className="text-xs text-muted-foreground">
                        ({Math.round(factor.weight * 100)}%)
                      </span>
                      {tip && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60 hover:text-primary cursor-help transition-colors" />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs space-y-2 p-3">
                            <p className="text-xs font-medium">{tip.meaning}</p>
                            <p className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">Tip:</span> {tip.advice}</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </span>
                    <span className={cn(
                      "text-xs font-medium",
                      !factor.known && "text-muted-foreground italic"
                    )}>
                      {factor.known ? `${Math.round(factor.score)} / 100` : "N/A"}
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
              );
            })}
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
