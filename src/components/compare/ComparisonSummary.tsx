import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Crown, TrendingUp, Shield, DollarSign, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

type VehicleReport = Tables<"vehicle_reports">;

interface ComparisonSummaryProps {
  vehicles: VehicleReport[];
}

const dealRatingScore = {
  excellent: 5,
  good: 4,
  fair: 3,
  poor: 2,
  overpriced: 1,
};

const riskScore = {
  low: 3,
  medium: 2,
  high: 1,
};

export function ComparisonSummary({ vehicles }: ComparisonSummaryProps) {
  const analysis = useMemo(() => {
    if (vehicles.length === 0) return null;

    // Calculate scores for each vehicle
    const scored = vehicles.map((v) => {
      const dealScore = v.deal_rating ? dealRatingScore[v.deal_rating] : 3;
      const riskScoreVal = v.risk_level ? riskScore[v.risk_level] : 2;
      
      // Price difference as a percentage (lower is better)
      const priceDiffPct = v.fair_offer_price && v.asking_price
        ? ((Number(v.asking_price) - Number(v.fair_offer_price)) / Number(v.fair_offer_price)) * 100
        : 0;
      
      // Mileage score (lower mileage is better, normalized)
      const avgMileage = vehicles.reduce((sum, veh) => sum + veh.mileage, 0) / vehicles.length;
      const mileageScore = avgMileage > 0 ? (avgMileage / v.mileage) : 1;
      
      // Combined score (weighted)
      const totalScore = 
        (dealScore * 30) + 
        (riskScoreVal * 25) + 
        (Math.max(0, 20 - Math.abs(priceDiffPct))) + // Price fairness (max 20)
        (Math.min(mileageScore * 15, 25)); // Mileage bonus (max 25)

      return {
        vehicle: v,
        dealScore,
        riskScoreVal,
        priceDiffPct,
        mileageScore,
        totalScore,
      };
    });

    // Sort by total score descending
    scored.sort((a, b) => b.totalScore - a.totalScore);

    const bestBuy = scored[0];
    const lowestPrice = [...vehicles].sort((a, b) => Number(a.asking_price) - Number(b.asking_price))[0];
    const lowestMileage = [...vehicles].sort((a, b) => a.mileage - b.mileage)[0];
    const lowestRisk = [...vehicles].sort((a, b) => {
      const aScore = a.risk_level ? riskScore[a.risk_level] : 2;
      const bScore = b.risk_level ? riskScore[b.risk_level] : 2;
      return bScore - aScore;
    })[0];

    // Generate recommendation text
    let recommendation = "";
    if (bestBuy) {
      const v = bestBuy.vehicle;
      const title = `${v.year} ${v.make} ${v.model}`;
      
      const reasons: string[] = [];
      if (bestBuy.dealScore >= 4) reasons.push("excellent deal rating");
      if (bestBuy.riskScoreVal >= 3) reasons.push("low risk profile");
      if (bestBuy.priceDiffPct < 0) reasons.push("priced below market value");
      if (v.mileage === lowestMileage.mileage) reasons.push("lowest mileage");
      
      recommendation = `The **${title}** is our recommended choice`;
      if (reasons.length > 0) {
        recommendation += ` due to its ${reasons.slice(0, 2).join(" and ")}`;
      }
      recommendation += `. It offers the best overall value considering price, condition, and risk factors.`;
    }

    return {
      scored,
      bestBuy,
      lowestPrice,
      lowestMileage,
      lowestRisk,
      recommendation,
    };
  }, [vehicles]);

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

  const { bestBuy, lowestPrice, lowestMileage, lowestRisk, recommendation } = analysis;

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
              🏆 Best Buy: {bestBuy.vehicle.year} {bestBuy.vehicle.make} {bestBuy.vehicle.model}
            </h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {recommendation}
            </p>
          </div>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 rounded-lg bg-background border">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-green-600" />
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
              <TrendingUp className="h-4 w-4 text-blue-600" />
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
              <Shield className="h-4 w-4 text-emerald-600" />
              <span className="text-xs text-muted-foreground">Lowest Risk</span>
            </div>
            <p className="font-semibold text-sm truncate">
              {lowestRisk.year} {lowestRisk.make} {lowestRisk.model}
            </p>
            <Badge variant="outline" className={cn(
              "mt-1",
              lowestRisk.risk_level === "low" ? "bg-green-500/10 text-green-600" :
              lowestRisk.risk_level === "medium" ? "bg-yellow-500/10 text-yellow-600" :
              "bg-red-500/10 text-red-600"
            )}>
              {lowestRisk.risk_level || "Unknown"} risk
            </Badge>
          </div>
        </div>

        {/* Price Comparison Table */}
        <div className="space-y-2">
          <h4 className="font-semibold text-sm">Price Comparison</h4>
          <div className="space-y-1">
            {vehicles.map((v) => {
              const savings = v.fair_offer_price 
                ? Number(v.asking_price) - Number(v.fair_offer_price)
                : 0;
              return (
                <div key={v.id} className="flex items-center justify-between text-sm p-2 rounded bg-background">
                  <span className="truncate flex-1">
                    {v.year} {v.make} {v.model}
                  </span>
                  <div className="flex items-center gap-4">
                    <span className="font-medium">
                      ${Number(v.asking_price).toLocaleString()}
                    </span>
                    {savings !== 0 && (
                      <span className={cn(
                        "text-xs font-medium",
                        savings > 0 ? "text-red-600" : "text-green-600"
                      )}>
                        {savings > 0 ? "+" : ""}{savings.toLocaleString()} vs fair
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
