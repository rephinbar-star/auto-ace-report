import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Fuel, DollarSign, Gauge, TrendingUp, Car, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  calculateTCO, 
  calculateMonthlyOwnershipCost,
  type TCOResult 
} from "@/lib/tco-calculations";

interface FuelEconomyCardProps {
  mpgCity: number | null;
  mpgHighway: number | null;
  mpgCombined: number | null;
  fuelType: string | null;
  askingPrice: number;
  make: string;
  year: number;
  depreciationTable?: unknown;
}

export function FuelEconomyCard({
  mpgCity,
  mpgHighway,
  mpgCombined,
  fuelType,
  askingPrice,
  make,
  year,
  depreciationTable,
}: FuelEconomyCardProps) {
  const [annualMiles, setAnnualMiles] = useState(12000);

  // Calculate TCO with user-adjustable mileage
  const tco = calculateTCO(
    askingPrice,
    mpgCombined,
    fuelType,
    depreciationTable,
    { annualMiles },
    { make, year }
  );

  const monthlyOwnership = calculateMonthlyOwnershipCost(tco);

  // Determine fuel efficiency rating
  const getFuelRating = () => {
    if (!mpgCombined) return { label: "Unknown", color: "bg-muted text-muted-foreground" };
    if (mpgCombined >= 35) return { label: "Excellent", color: "bg-success/10 text-success" };
    if (mpgCombined >= 28) return { label: "Good", color: "bg-success/10 text-success" };
    if (mpgCombined >= 22) return { label: "Average", color: "bg-warning/10 text-warning" };
    return { label: "Below Average", color: "bg-destructive/10 text-destructive" };
  };

  const fuelRating = getFuelRating();
  const normalizedFuelType = (fuelType || "Gasoline").charAt(0).toUpperCase() + (fuelType || "gasoline").slice(1).toLowerCase();
  const isElectric = fuelType?.toLowerCase().includes("electric");

  const handleMileageChange = (value: number[]) => {
    setAnnualMiles(value[0]);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Fuel className="h-5 w-5 text-primary" />
          Fuel Economy & Ownership Cost
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Annual Mileage Slider */}
        <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Car className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Expected Annual Mileage</span>
            </div>
            <Badge variant="secondary" className="text-sm font-bold">
              {annualMiles.toLocaleString()} mi/yr
            </Badge>
          </div>
          <Slider
            value={[annualMiles]}
            onValueChange={handleMileageChange}
            min={5000}
            max={19000}
            step={1000}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>5,000 mi</span>
            <span>12,000 mi (avg)</span>
            <span>19,000 mi</span>
          </div>
        </div>

        {/* MPG Stats */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium">Fuel Economy</h4>
            <Badge variant="outline" className={cn("text-xs", fuelRating.color)}>
              {fuelRating.label}
            </Badge>
          </div>
          
          {mpgCombined ? (
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border p-3 text-center">
                <Gauge className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                <p className="text-lg font-bold">{mpgCity || "—"}</p>
                <p className="text-xs text-muted-foreground">City {isElectric ? "MPGe" : "MPG"}</p>
              </div>
              <div className="rounded-lg border p-3 text-center bg-primary/5">
                <Gauge className="h-4 w-4 mx-auto mb-1 text-primary" />
                <p className="text-lg font-bold text-primary">{mpgCombined}</p>
                <p className="text-xs text-muted-foreground">Combined {isElectric ? "MPGe" : "MPG"}</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <Gauge className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                <p className="text-lg font-bold">{mpgHighway || "—"}</p>
                <p className="text-xs text-muted-foreground">Highway {isElectric ? "MPGe" : "MPG"}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Fuel economy data not available for this vehicle.
            </p>
          )}
          
          <p className="text-xs text-muted-foreground mt-2">
            Fuel Type: {normalizedFuelType}
          </p>
        </div>

        {/* 5-Year TCO Summary */}
        <div>
          <h4 className="text-sm font-medium mb-3">5-Year Total Cost of Ownership</h4>
          <div className="rounded-lg bg-muted/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Purchase Price</span>
              <span className="font-medium">${tco.purchasePrice.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Est. Fuel Cost (5 yr)</span>
              <span className="font-medium">${tco.fuelCost5Year.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Est. Maintenance (5 yr)</span>
              <span className="font-medium">${tco.repairCost5Year.toLocaleString()}</span>
            </div>
            {(tco.mileageDepreciation ?? 0) > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  Excess Mileage Depreciation
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-sm">
                          <strong>How it's calculated:</strong> Driving above 12,000 miles/year adds ~$0.18 per excess mile in depreciation. 
                          This reflects the reduced resale value from higher-than-average mileage accumulation over 5 years.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </span>
                <span className="font-medium text-warning">
                  +${tco.mileageDepreciation?.toLocaleString()}
                </span>
              </div>
            )}
            <div className="border-t pt-3 flex items-center justify-between">
              <span className="font-semibold">Total 5-Year Cost</span>
              <span className="text-lg font-bold text-primary">${tco.totalTCO.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Monthly Breakdown */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border p-3">
            <div className="flex items-center gap-2 mb-1">
              <Fuel className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Annual Fuel</span>
            </div>
            <p className="text-lg font-bold">${tco.annualFuelCost.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">~${Math.round(tco.annualFuelCost / 12)}/month</p>
          </div>
          <div className="rounded-lg border p-3">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Monthly Ownership</span>
            </div>
            <p className="text-lg font-bold">${monthlyOwnership}</p>
            <p className="text-xs text-muted-foreground">fuel + maintenance</p>
          </div>
        </div>

        {/* Cost Per Mile */}
        <div className="flex items-center justify-between rounded-lg bg-primary/5 p-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Cost Per Mile</span>
          </div>
          <span className="text-lg font-bold text-primary">${tco.costPerMile.toFixed(2)}</span>
        </div>

        <p className="text-xs text-muted-foreground">
          * Based on {annualMiles.toLocaleString()} miles/year, $3.50/gal gas. Maintenance scales with mileage.
          {annualMiles > 12000 && " Excess mileage (above 12k/yr) adds ~$0.18/mi in depreciation."}
        </p>
      </CardContent>
    </Card>
  );
}