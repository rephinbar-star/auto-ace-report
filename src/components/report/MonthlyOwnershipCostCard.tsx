import { useState } from "react";
import { HelpCircle, ChevronDown, ChevronUp, MapPin, Loader2, Zap, Fuel } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { FinancingDetailsCard } from "./FinancingDetailsCard";
import type { MonthlyOwnershipBreakdown } from "@/lib/tco-calculations";
import type { FinancingInfo } from "@/types/vehicle";

interface MonthlyOwnershipCostCardProps {
  monthlyCostRange: string;
  breakdown: MonthlyOwnershipBreakdown;
  isElectric: boolean;
  hasFinancing: boolean;
  verdict?: string;
  fuelType?: string | null;
  mpgCity?: number | null;
  mpgCombined?: number | null;
  mpgHighway?: number | null;
  annualFuelCost?: number;
  annualMiles?: number;
  electricityPrice?: number;
  localGasLocation?: string;
  onAnnualMilesChange?: (miles: number) => void;
  // Inline financing props
  financing?: FinancingInfo | null;
  financingSkipped?: boolean;
  askingPrice?: number;
  onFinancingChange?: (updated: FinancingInfo) => void;
}

export function MonthlyOwnershipCostCard({
  monthlyCostRange,
  breakdown,
  isElectric,
  hasFinancing,
  verdict,
  fuelType,
  mpgCity,
  mpgCombined,
  mpgHighway,
  annualFuelCost,
  annualMiles = 12000,
  electricityPrice,
  localGasLocation,
  onAnnualMilesChange,
  financing,
  financingSkipped,
  askingPrice,
  onFinancingChange,
}: MonthlyOwnershipCostCardProps) {
  const [energyExpanded, setEnergyExpanded] = useState(false);
  const [financingExpanded, setFinancingExpanded] = useState(false);

  const rows: Array<{ label: string; value: string; key: string }> = [];

  if (hasFinancing && breakdown.monthlyPayment > 0) {
    rows.push({ label: "Loan Payment", value: `$${breakdown.monthlyPayment.toLocaleString()}`, key: "loan" });
  } else {
    rows.push({ label: "Loan Payment", value: "—", key: "loan" });
  }

  const energyLabel = isElectric ? "Electricity" : fuelType?.toLowerCase() === "diesel" ? "Diesel" : "Gas";

  rows.push({
    label: energyLabel,
    value: `$${breakdown.fuel.toLocaleString()}`,
    key: "energy",
  });

  if (breakdown.insuranceLow > 0) {
    const insuranceVal =
      breakdown.insuranceHigh > 0 && breakdown.insuranceHigh !== breakdown.insuranceLow
        ? `$${breakdown.insuranceLow.toLocaleString()}–$${breakdown.insuranceHigh.toLocaleString()}`
        : `$${breakdown.insuranceLow.toLocaleString()}`;
    rows.push({ label: "Insurance", value: insuranceVal, key: "insurance" });
  }

  rows.push({ label: "Maintenance", value: `$${breakdown.maintenance.toLocaleString()}`, key: "maintenance" });
  rows.push({ label: "Expected Repairs", value: `$${breakdown.repairs.toLocaleString()}`, key: "repairs" });

  const totalVal =
    breakdown.totalHigh > 0 && breakdown.totalHigh !== breakdown.totalLow
      ? `$${breakdown.totalLow.toLocaleString()}–$${breakdown.totalHigh.toLocaleString()}`
      : `$${breakdown.totalLow.toLocaleString()}`;

  const handleScrollTo = (targetId: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    const el = document.getElementById(targetId);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const verdictColor = verdict === "Avoid" ? "#DC2626" : verdict === "Caution" ? "#D97706" : "#059669";

  const showFinancingInline = financing && !financingSkipped && askingPrice != null && onFinancingChange;

  return (
    <div>
      <div id="section-financials" className="bg-card border border-border rounded-xl p-4 md:p-6">
        {/* Headline */}
        <p className="text-xs uppercase tracking-[0.08em] text-neutral mb-1">
          Estimated Monthly Ownership Cost
        </p>
        <p className="text-[32px] font-bold text-foreground leading-tight">
          {totalVal} / month
        </p>
        <p className="text-[13px] text-neutral mt-1">
          All-in: payment + {energyLabel.toLowerCase()} + maintenance + insurance + expected repairs
        </p>

        {/* Component Breakdown */}
        <div className="mt-6">
        {rows.map((row, i) => (
            <div key={row.key}>
              <div
                className="flex items-center justify-between py-3 text-[14px]"
                style={i < rows.length - 1 ? { borderBottom: row.key === "energy" && energyExpanded ? undefined : row.key === "loan" && financingExpanded ? undefined : "1px solid hsl(var(--border))" } : undefined}
              >
                <span className="text-foreground flex items-center gap-1.5">
                  {row.label}
                  {row.key === "repairs" && (
                    <TooltipProvider delayDuration={100}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-3.5 w-3.5 text-neutral/60 hover:text-primary cursor-help transition-colors" />
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          className="max-w-[220px] rounded-md bg-foreground text-background text-xs p-3"
                        >
                          Probability-weighted based on documented failure rates for this make/model/year. Each identified concern is multiplied by its estimated likelihood of occurring in the 5-year window. Range: expected cost (low) to maximum plausible scenario (high).
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </span>
                <span className="font-semibold text-foreground flex items-center gap-2">
                  {row.value}
                  {row.key === "insurance" && (
                    <a
                      href="#"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium hover:underline transition-colors"
                      style={{ color: verdictColor }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      Get quotes →
                    </a>
                  )}
                </span>
              </div>

              {/* Inline financing details after loan row */}
              {row.key === "loan" && showFinancingInline && (
                <Collapsible open={financingExpanded} onOpenChange={setFinancingExpanded}>
                  <CollapsibleTrigger className="w-full flex items-center justify-center py-1 text-xs text-neutral hover:text-foreground transition-colors"
                    style={{ borderBottom: "1px solid hsl(var(--border))" }}>
                    <span className="flex items-center gap-1">
                      Edit financing details
                      {financingExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </span>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="py-3" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
                    <FinancingDetailsCard
                      financing={financing!}
                      askingPrice={askingPrice!}
                      onChange={onFinancingChange!}
                      embedded
                    />
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Expandable energy details */}
              {row.key === "energy" && (
                <Collapsible open={energyExpanded} onOpenChange={setEnergyExpanded}>
                  <CollapsibleTrigger className="w-full flex items-center justify-center py-1 text-xs text-neutral hover:text-foreground transition-colors"
                    style={{ borderBottom: "1px solid hsl(var(--border))" }}>
                    {energyExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </CollapsibleTrigger>
                  <CollapsibleContent className="py-3 space-y-3" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
                    {mpgCombined && (
                      <div className="flex items-center gap-3 text-xs text-neutral">
                        {isElectric ? <Zap className="h-3.5 w-3.5 shrink-0" /> : <Fuel className="h-3.5 w-3.5 shrink-0" />}
                        <span>
                          {mpgCity || "—"} City / {mpgCombined} Combined / {mpgHighway || "—"} Highway {isElectric ? "MPGe" : "MPG"}
                        </span>
                      </div>
                    )}
                    <p className="text-xs text-neutral">
                      {annualMiles?.toLocaleString()} mi/yr assumed
                      {electricityPrice != null && isElectric && ` · $${electricityPrice.toFixed(2)}/kWh`}
                      {localGasLocation && ` · ${localGasLocation}`}
                    </p>
                    {annualFuelCost != null && (
                      <p className="text-xs text-neutral">
                        Annual {energyLabel.toLowerCase()}: ${annualFuelCost.toLocaleString()} (~${Math.round(annualFuelCost / 12)}/mo)
                      </p>
                    )}
                    {onAnnualMilesChange && (
                      <div className="space-y-2 pt-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-neutral">Expected Annual Mileage</span>
                          <Badge variant="secondary" className="text-xs font-bold">
                            {annualMiles.toLocaleString()} mi/yr
                          </Badge>
                        </div>
                        <Slider
                          value={[annualMiles]}
                          onValueChange={(v) => onAnnualMilesChange(v[0])}
                          min={5000}
                          max={19000}
                          step={1000}
                          className="w-full"
                        />
                        <div className="flex justify-between text-[10px] text-neutral">
                          <span>5,000 mi</span>
                          <span>12,000 mi (avg)</span>
                          <span>19,000 mi</span>
                        </div>
                      </div>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          ))}
        </div>

        {/* Divider + Total */}
        <div className="border-t border-border my-4" />
        <div className="flex items-center justify-between">
          <span className="text-[15px] font-semibold text-foreground">Total Monthly Cost</span>
          <span className="text-[15px] font-semibold text-foreground">{totalVal}</span>
        </div>

        {/* Footnote */}
        <p className="text-[11px] text-muted-foreground mt-2">
          Repair estimate is probability-weighted. Range reflects expected cost (low) to maximum plausible scenario (high).
        </p>
      </div>

      {/* Links below the card */}
      <div className="flex items-center gap-4 mt-3">
        <a
          href="#section-tco"
          onClick={handleScrollTo("section-tco")}
          className="text-[13px] text-neutral hover:text-foreground hover:underline transition-colors"
        >
          View 5-year cost breakdown ↓
        </a>
      </div>
    </div>
  );
}
