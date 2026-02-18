import { useState, useMemo, useCallback } from "react";
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
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { SEO } from "@/components/seo/SEO";
import { 
  Plus, 
  ArrowLeft, 
  Car, 
  Scale, 
  AlertCircle,
  Lock,
  Download,
  Loader2,
  Gauge,
  Fuel,
  HelpCircle,
  Zap,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { generateComparisonPDF } from "@/lib/generateComparisonPDF";
import { toast } from "sonner";
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
  const { tier, subscribed, isLoading: isSubscriptionLoading } = useSubscription();
  const [isDownloading, setIsDownloading] = useState(false);
  const [annualMiles, setAnnualMiles] = useState(12000);
  const [gasPricePerGallon, setGasPricePerGallon] = useState(3.25);
  const [gasPriceInput, setGasPriceInput] = useState("3.25");
  const [electricityPrice, setElectricityPrice] = useState(0.15);
  const [electricityPriceInput, setElectricityPriceInput] = useState("0.15");
  
  // Get vehicle IDs from URL - memoize to prevent unnecessary recalculations
  const idsParam = searchParams.get("ids") || "";
  const vehicleIds = useMemo(() => {
    return idsParam ? idsParam.split(",").filter(Boolean) : [];
  }, [idsParam]);

  // Fetch selected vehicles - with staleTime to prevent unnecessary refetches
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
    staleTime: 30000, // Data is fresh for 30 seconds
    refetchOnWindowFocus: false, // Prevent refetch on tab focus
  });

  // Get comparison limit based on tier
  const comparisonLimit = TIER_LIMITS[tier] || 0;
  const canCompare = tier !== "free";
  const vehicleCount = vehicles?.length || 0;
  const canAddMore = vehicleCount < comparisonLimit;

  // Remove vehicle from comparison - memoized to prevent child re-renders
  const removeVehicle = useCallback((id: string) => {
    const newIds = vehicleIds.filter((vid) => vid !== id);
    if (newIds.length === 0) {
      setSearchParams({});
    } else {
      setSearchParams({ ids: newIds.join(",") });
    }
  }, [vehicleIds, setSearchParams]);

  // Download comparison as PDF
  const handleDownloadPDF = async () => {
    if (!vehicles || vehicles.length < 2) {
      toast.error("Add at least 2 vehicles to download comparison");
      return;
    }
    
    setIsDownloading(true);
    try {
      await generateComparisonPDF({ vehicles, annualMiles });
      toast.success("Comparison PDF downloaded!");
    } catch (err) {
      console.error("PDF generation error:", err);
      toast.error("Failed to generate PDF");
    } finally {
      setIsDownloading(false);
    }
  };

  // Calculate best buy
  const bestBuyId = useMemo(() => {
    if (!vehicles || vehicles.length < 2) return null;
    
    const dealRatingScore: Record<string, number> = {
      excellent: 5,
      good: 4,
      fair: 3,
      overpriced: 2,
      poor: 1,
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
      overpriced: 2,
      poor: 1,
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
                  Analyze vehicles side-by-side to find the best buy
                </p>
                <div className="mt-3 text-sm text-muted-foreground max-w-2xl">
                  <span className="font-semibold text-foreground">Methodology:</span>{" "}
                  Our scoring system evaluates each vehicle across multiple dimensions including 
                  deal quality relative to market value, title history and its impact on resale, 
                  accident records and their long-term value implications, projected 5-year equity position, 
                  vehicle age and warranty coverage, brand and model reliability ratings based on 
                  industry data from J.D. Power and Consumer Reports, annual mileage accumulation, 
                  and total cost of ownership including fuel economy and anticipated repair costs.
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              {vehicleCount >= 2 && (
                <Button 
                  variant="outline" 
                  onClick={handleDownloadPDF}
                  disabled={isDownloading}
                >
                  {isDownloading ? (
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-5 w-5 mr-2" />
                  )}
                  {isDownloading ? "Generating..." : "Download PDF"}
                </Button>
              )}
              {canAddMore && (
                <Button asChild>
                  <Link to="/dashboard?select=true">
                    <Plus className="h-5 w-5 mr-2" />
                    Add Vehicle
                  </Link>
                </Button>
              )}
            </div>
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
              {/* Cost Assumptions Card */}
              <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                <CardContent className="py-4 space-y-4">
                  {/* Annual Mileage Slider */}
                  <div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="flex items-center gap-2 min-w-fit">
                        <Gauge className="h-5 w-5 text-primary" />
                        <span className="font-medium">Expected Annual Mileage</span>
                      </div>
                      <div className="flex-1 flex items-center gap-4">
                        <div className="flex-1 space-y-2">
                          <Slider
                            value={[annualMiles]}
                            onValueChange={(value) => setAnnualMiles(value[0])}
                            min={5000}
                            max={19000}
                            step={1000}
                          />
                          <div className="relative text-xs text-muted-foreground">
                            <div className="flex justify-between">
                              <span>5,000 mi</span>
                              <span>19,000 mi</span>
                            </div>
                            <span className="absolute left-1/2 -translate-x-1/2 top-0">12,000 mi (avg)</span>
                          </div>
                        </div>
                        <Badge variant="secondary" className="text-sm font-bold min-w-[100px] justify-center">
                          {annualMiles.toLocaleString()} mi/yr
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Energy Price Inputs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t">
                    {/* Gas Price Input */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <div className="flex items-center gap-2 min-w-fit">
                        <Fuel className="h-5 w-5 text-primary" />
                        <span className="font-medium text-sm">Gas Price</span>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p className="text-sm">
                                National average price for 89 octane (mid-grade) gasoline.
                                Adjust to match your local fuel prices for gas vehicles.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-medium">$</span>
                        <Input
                          type="number"
                          value={gasPriceInput}
                          onChange={(e) => {
                            const value = e.target.value;
                            setGasPriceInput(value);
                            const parsed = parseFloat(value);
                            if (!isNaN(parsed) && parsed > 0 && parsed <= 10) {
                              setGasPricePerGallon(parsed);
                            }
                          }}
                          onBlur={() => {
                            const parsed = parseFloat(gasPriceInput);
                            if (isNaN(parsed) || parsed <= 0 || parsed > 10) {
                              setGasPriceInput(gasPricePerGallon.toFixed(2));
                            } else {
                              setGasPriceInput(parsed.toFixed(2));
                              setGasPricePerGallon(parsed);
                            }
                          }}
                          step="0.01"
                          min="1"
                          max="10"
                          className="w-16 h-8 text-right font-medium"
                        />
                        <span className="text-sm text-muted-foreground">/gal</span>
                      </div>
                    </div>

                    {/* Electricity Price Input */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <div className="flex items-center gap-2 min-w-fit">
                        <Zap className="h-5 w-5 text-primary" />
                        <span className="font-medium text-sm">Electricity Price</span>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p className="text-sm">
                                National average residential electricity rate.
                                Home charging is typically $0.10-0.20/kWh; public charging can be $0.30-0.50/kWh.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-medium">$</span>
                        <Input
                          type="number"
                          value={electricityPriceInput}
                          onChange={(e) => {
                            const value = e.target.value;
                            setElectricityPriceInput(value);
                            const parsed = parseFloat(value);
                            if (!isNaN(parsed) && parsed > 0 && parsed <= 1) {
                              setElectricityPrice(parsed);
                            }
                          }}
                          onBlur={() => {
                            const parsed = parseFloat(electricityPriceInput);
                            if (isNaN(parsed) || parsed <= 0 || parsed > 1) {
                              setElectricityPriceInput(electricityPrice.toFixed(2));
                            } else {
                              setElectricityPriceInput(parsed.toFixed(2));
                              setElectricityPrice(parsed);
                            }
                          }}
                          step="0.01"
                          min="0.05"
                          max="1"
                          className="w-16 h-8 text-right font-medium"
                        />
                        <span className="text-sm text-muted-foreground">/kWh</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Adjust to see how driving habits and energy prices affect ownership costs across all vehicles.
                  </p>
                </CardContent>
              </Card>

              {/* Comparison Summary */}
              <ComparisonSummary 
                vehicles={vehicles} 
                annualMiles={annualMiles} 
                gasPricePerGallon={gasPricePerGallon} 
                electricityPricePerKwh={electricityPrice}
              />

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
              {!canAddMore && tier === "premium" && (
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
