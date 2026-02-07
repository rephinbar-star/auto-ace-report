import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Crown, TrendingUp, Shield, DollarSign, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

type VehicleReport = Tables<"vehicle_reports">;

interface ComparisonSummaryProps {
  vehicles: VehicleReport[];
}

const dealRatingScore: Record<string, number> = {
  excellent: 5,
  good: 4,
  fair: 3,
  poor: 2,
  overpriced: 1,
};

const riskScore: Record<string, number> = {
  low: 3,
  medium: 2,
  high: 1,
};

const dealRatingLabels: Record<string, string> = {
  excellent: "excellent",
  good: "good",
  fair: "fair",
  poor: "poor",
  overpriced: "overpriced",
};

const riskLabels: Record<string, string> = {
  low: "low",
  medium: "medium",
  high: "high",
};

export function ComparisonSummary({ vehicles }: ComparisonSummaryProps) {
  const analysis = useMemo(() => {
    if (vehicles.length === 0) return null;

    // Calculate scores for each vehicle
    const scored = vehicles.map((v) => {
      const dealScore = v.deal_rating ? dealRatingScore[v.deal_rating] || 3 : 3;
      const riskScoreVal = v.risk_level ? riskScore[v.risk_level] || 2 : 2;
      
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
    const others = scored.slice(1);
    const lowestPrice = [...vehicles].sort((a, b) => Number(a.asking_price) - Number(b.asking_price))[0];
    const lowestMileage = [...vehicles].sort((a, b) => a.mileage - b.mileage)[0];
    const lowestRisk = [...vehicles].sort((a, b) => {
      const aScore = a.risk_level ? riskScore[a.risk_level] || 2 : 2;
      const bScore = b.risk_level ? riskScore[b.risk_level] || 2 : 2;
      return bScore - aScore;
    })[0];

    // Generate detailed recommendation text with "why not" explanations
    let recommendation = "";
    let whyNotExplanations: { vehicle: VehicleReport; reason: string }[] = [];
    
    if (bestBuy) {
      const v = bestBuy.vehicle;
      const title = `${v.year} ${v.make} ${v.model}`;
      
      // Build strengths for the winner
      const strengths: string[] = [];
      if (bestBuy.dealScore >= 4) strengths.push("excellent deal rating");
      if (bestBuy.riskScoreVal >= 3) strengths.push("low risk profile");
      if (bestBuy.priceDiffPct < 0) strengths.push("priced below market value");
      if (bestBuy.priceDiffPct >= 0 && bestBuy.priceDiffPct < 5) strengths.push("fairly priced");
      if (v.mileage === lowestMileage.mileage) strengths.push("lowest mileage in the comparison");
      if (v.accident_count === 0) strengths.push("clean accident history");
      if ((v.reliability_concerns?.length || 0) === 0) strengths.push("no major reliability concerns");
      
      recommendation = `The **${title}** stands out as the best overall choice`;
      if (strengths.length > 0) {
        recommendation += ` thanks to its ${strengths.slice(0, 3).join(", ")}`;
      }
      recommendation += `. Our analysis weighs deal quality (30%), risk level (25%), price fairness (20%), and mileage (15%) to find you the best value.`;
      
      // Generate "why not" explanations for other vehicles
      others.forEach((scored, index) => {
        const other = scored.vehicle;
        const otherTitle = `${other.year} ${other.make} ${other.model}`;
        const concerns: string[] = [];
        
        // Compare deal ratings
        if (scored.dealScore < bestBuy.dealScore) {
          const rating = other.deal_rating ? dealRatingLabels[other.deal_rating] || "fair" : "fair";
          concerns.push(`has a ${rating} deal rating (vs. ${bestBuy.vehicle.deal_rating || "fair"} for the winner)`);
        }
        
        // Compare risk levels
        if (scored.riskScoreVal < bestBuy.riskScoreVal) {
          const risk = other.risk_level ? riskLabels[other.risk_level] || "medium" : "medium";
          concerns.push(`carries ${risk} risk which may lead to higher ownership costs`);
        }
        
        // Compare pricing
        if (scored.priceDiffPct > bestBuy.priceDiffPct + 5) {
          const overPrice = Math.round(scored.priceDiffPct);
          concerns.push(`is priced ${overPrice}% above its fair market value`);
        }
        
        // Compare mileage
        if (other.mileage > bestBuy.vehicle.mileage * 1.2) {
          const mileageDiff = Math.round(((other.mileage - bestBuy.vehicle.mileage) / bestBuy.vehicle.mileage) * 100);
          concerns.push(`has ${mileageDiff}% higher mileage which affects long-term value`);
        }
        
        // Compare accidents
        if ((other.accident_count || 0) > (bestBuy.vehicle.accident_count || 0)) {
          concerns.push(`has ${other.accident_count} accident${other.accident_count !== 1 ? "s" : ""} on record`);
        }
        
        // Build the reason string
        let reason = "";
        if (concerns.length > 0) {
          reason = concerns.slice(0, 2).join(" and ");
        } else {
          // Fallback if scores are close
          const scoreDiff = Math.round(bestBuy.totalScore - scored.totalScore);
          reason = `scored ${scoreDiff} points lower in our overall value analysis`;
        }
        
        whyNotExplanations.push({
          vehicle: other,
          reason,
        });
      });
    }

    return {
      scored,
      bestBuy,
      others,
      lowestPrice,
      lowestMileage,
      lowestRisk,
      recommendation,
      whyNotExplanations,
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

  const { bestBuy, lowestPrice, lowestMileage, lowestRisk, recommendation, whyNotExplanations } = analysis;

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
            <Badge variant="outline" className={cn(
              "mt-1",
              lowestRisk.risk_level === "low" ? "bg-success/10 text-success" :
              lowestRisk.risk_level === "medium" ? "bg-warning/10 text-warning" :
              "bg-danger/10 text-danger"
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
                        savings > 0 ? "text-destructive" : "text-success"
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

        {/* Why Not Other Vehicles - Educational Section */}
        {whyNotExplanations && whyNotExplanations.length > 0 && (
          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-muted-foreground" />
              <h4 className="font-semibold text-sm">Why Not the Others?</h4>
            </div>
            <div className="space-y-2">
              {whyNotExplanations.map(({ vehicle, reason }, index) => (
                <div 
                  key={vehicle.id} 
                  className="p-3 rounded-lg bg-muted/50 border border-muted"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-muted-foreground font-bold text-sm">
                      #{index + 2}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">
                        {vehicle.year} {vehicle.make} {vehicle.model}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        This vehicle {reason}.
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground italic">
              💡 Tip: These factors affect long-term ownership costs and resale value. A higher upfront price with better ratings often saves money over time.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
