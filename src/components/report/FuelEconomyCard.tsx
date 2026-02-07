import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Fuel, DollarSign, Gauge, TrendingUp } from "lucide-react";
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
  // Calculate TCO
  const tco = calculateTCO(
    askingPrice,
    mpgCombined,
    fuelType,
    depreciationTable,
    {},
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Fuel className="h-5 w-5 text-primary" />
          Fuel Economy & Ownership Cost
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
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
          * Based on 12,000 miles/year, $3.50/gal gas. Maintenance estimated from industry data for {make} vehicles.
        </p>
      </CardContent>
    </Card>
  );
}
