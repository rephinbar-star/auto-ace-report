import { useState, useEffect, useMemo } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { CompareVehicleCard } from "@/components/compare/CompareVehicleCard";
import { ComparisonSummary } from "@/components/compare/ComparisonSummary";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { SEO } from "@/components/seo/SEO";
import { 
  Plus, 
  ArrowLeft, 
  Car, 
  Scale, 
  AlertCircle,
  Lock,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import type { Tables } from "@/integrations/supabase/types";

type VehicleReport = Tables<"vehicle_reports">;

const TIER_LIMITS = {
  free: 0,
  basic: 3,
  pro: 6,
};

function CompareContent() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { tier, subscribed } = useSubscription();
  
  // Get vehicle IDs from URL
  const vehicleIds = useMemo(() => {
    const ids = searchParams.get("ids");
    return ids ? ids.split(",").filter(Boolean) : [];
  }, [searchParams]);

  // Fetch selected vehicles
  const { data: vehicles, isLoading, error } = useQuery({
    queryKey: ["compare-vehicles", vehicleIds],
    queryFn: async () => {
      if (vehicleIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from("vehicle_reports")
        .select("*")
        .in("id", vehicleIds)
        .eq("status", "complete");

      if (error) throw error;
      return data as VehicleReport[];
    },
    enabled: vehicleIds.length > 0 && !!user,
  });

  // Get comparison limit based on tier
  const comparisonLimit = TIER_LIMITS[tier] || 0;
  const canCompare = tier !== "free";
  const vehicleCount = vehicles?.length || 0;
  const canAddMore = vehicleCount < comparisonLimit;

  // Remove vehicle from comparison
  const removeVehicle = (id: string) => {
    const newIds = vehicleIds.filter((vid) => vid !== id);
    if (newIds.length === 0) {
      setSearchParams({});
    } else {
      setSearchParams({ ids: newIds.join(",") });
    }
  };

  // Calculate best buy
  const bestBuyId = useMemo(() => {
    if (!vehicles || vehicles.length < 2) return null;
    
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

    let best = vehicles[0];
    let bestScore = 0;

    vehicles.forEach((v) => {
      const deal = v.deal_rating ? dealRatingScore[v.deal_rating] : 3;
      const risk = v.risk_level ? riskScore[v.risk_level] : 2;
      const score = deal * 2 + risk;
      
      if (score > bestScore) {
        bestScore = score;
        best = v;
      }
    });

    return best.id;
  }, [vehicles]);

  // Rank vehicles
  const rankedVehicles = useMemo(() => {
    if (!vehicles || vehicles.length === 0) return [];
    
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

    return [...vehicles]
      .map((v) => ({
        vehicle: v,
        score: (v.deal_rating ? dealRatingScore[v.deal_rating] : 3) * 2 + 
               (v.risk_level ? riskScore[v.risk_level] : 2),
      }))
      .sort((a, b) => b.score - a.score);
  }, [vehicles]);

  // Get loading state from subscription hook
  const { isLoading: isSubscriptionLoading } = useSubscription();

  // Show loading while checking subscription (prevents flash of upgrade prompt)
  if (isSubscriptionLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 animate-pulse">
              <Scale className="h-6 w-6 text-primary" />
            </div>
            <p className="text-muted-foreground">Loading comparison...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Show upgrade prompt for free tier
  if (!canCompare) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1">
          <div className="container mx-auto px-4 py-16">
            <Card className="max-w-lg mx-auto text-center">
              <CardContent className="py-12">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                  <Lock className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Upgrade to Compare</h2>
                <p className="text-muted-foreground mb-6">
                  Vehicle comparison is available on Standard and Pro plans. 
                  Compare up to 3 vehicles side-by-side on Standard, or up to 6 on Pro.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button asChild>
                    <Link to="/pricing">View Plans</Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link to="/dashboard">Back to Dashboard</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1">
        <div className="container mx-auto px-4 py-8">
          {/* Page header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" asChild>
                <Link to="/dashboard">
                  <ArrowLeft className="h-5 w-5" />
                </Link>
              </Button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-3xl font-bold">Compare Vehicles</h1>
                  <Badge variant="outline" className="hidden sm:flex">
                    {vehicleCount}/{comparisonLimit} vehicles
                  </Badge>
                </div>
                <p className="text-muted-foreground mt-1">
                  Analyze vehicles side-by-side to find the best deal
                </p>
              </div>
            </div>
            {canAddMore && (
              <Button asChild>
                <Link to="/dashboard?select=true">
                  <Plus className="h-5 w-5 mr-2" />
                  Add Vehicle
                </Link>
              </Button>
            )}
          </div>

          {/* Loading state */}
          {isLoading && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {[...Array(2)].map((_, i) => (
                <Card key={i} className="p-6">
                  <Skeleton className="h-6 w-3/4 mb-4" />
                  <Skeleton className="h-4 w-1/2 mb-6" />
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <Skeleton className="h-20" />
                    <Skeleton className="h-20" />
                  </div>
                  <Skeleton className="h-32" />
                </Card>
              ))}
            </div>
          )}

          {/* Error state */}
          {error && (
            <Card className="text-center py-12">
              <CardContent>
                <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Error Loading Vehicles</h3>
                <p className="text-muted-foreground mb-4">
                  There was a problem loading the comparison. Please try again.
                </p>
                <Button onClick={() => window.location.reload()}>Retry</Button>
              </CardContent>
            </Card>
          )}

          {/* Empty state */}
          {!isLoading && !error && vehicleCount === 0 && (
            <Card className="text-center py-16">
              <CardContent>
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-6">
                  <Scale className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold mb-2">No Vehicles Selected</h3>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  Select vehicles from your dashboard to compare them side-by-side. 
                  You can compare up to {comparisonLimit} vehicles.
                </p>
                <Button asChild size="lg">
                  <Link to="/dashboard?select=true">
                    <Plus className="h-5 w-5 mr-2" />
                    Select Vehicles to Compare
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Comparison content */}
          {!isLoading && !error && vehicles && vehicleCount > 0 && (
            <div className="space-y-8">
              {/* Comparison Summary */}
              <ComparisonSummary vehicles={vehicles} />

              {/* Vehicle Cards Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {rankedVehicles.map(({ vehicle }, index) => (
                  <CompareVehicleCard
                    key={vehicle.id}
                    report={vehicle}
                    onRemove={removeVehicle}
                    isBestBuy={vehicle.id === bestBuyId && vehicleCount >= 2}
                    rank={vehicleCount >= 2 ? index + 1 : undefined}
                  />
                ))}

                {/* Add Vehicle Card */}
                {canAddMore && (
                  <Card className="border-dashed flex items-center justify-center min-h-[300px]">
                    <CardContent className="text-center py-8">
                      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                        <Plus className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <p className="text-muted-foreground mb-4">
                        Add another vehicle to compare
                      </p>
                      <Button variant="outline" asChild>
                        <Link to="/dashboard?select=true">
                          Browse Reports
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Need more slots message */}
              {!canAddMore && tier === "basic" && (
                <Card className="bg-muted/50 border-dashed">
                  <CardContent className="py-6 text-center">
                    <p className="text-muted-foreground mb-3">
                      You've reached your comparison limit. Upgrade to Pro to compare up to 6 vehicles.
                    </p>
                    <Button variant="outline" asChild>
                      <Link to="/pricing">Upgrade to Pro</Link>
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default function ComparePage() {
  return (
    <ProtectedRoute>
      <SEO
        title="Compare Vehicles - CarWise"
        description="Compare multiple vehicles side-by-side to find the best deal"
      />
      <CompareContent />
    </ProtectedRoute>
  );
}
