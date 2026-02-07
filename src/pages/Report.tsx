import { useEffect, useState } from "react";
import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from "recharts";
import { 
  DollarSign, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Car,
  Gauge,
  Wrench,
  FileText,
  Share2,
  Download,
  Loader2,
  Scale,
  Save,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/hooks/useSubscription";
import { VehicleImageGallery } from "@/components/report/VehicleImageGallery";
import { DealerReview } from "@/components/report/DealerReview";
import { FuelEconomyCard } from "@/components/report/FuelEconomyCard";
import { generateReportPDF } from "@/lib/generatePDF";
import { toast as sonnerToast } from "sonner";

interface DepreciationYear {
  year: number;
  privateValue: number;
  tradeInValue: number;
  loanBalance: number;
  repairCosts: number;
  netEquityPrivate: number;
  netEquityTradeIn: number;
}

interface Analysis {
  priceAssessment: {
    fairMarketPrivate: number;
    fairMarketTradeIn: number;
    dealRating: "excellent" | "good" | "fair" | "poor" | "overpriced";
    priceDifference: number;
    percentDifference: number;
  };
  depreciationTable: DepreciationYear[];
  riskAssessment: {
    level: "low" | "medium" | "high";
    depreciationRisk: string;
    reliabilityConcerns: string[];
    valueProposition: string;
    fairOfferPrice: number;
    expertOpinion: string;
  };
  historyAnalysis: {
    healthScore: number;
    positives: string[];
    concerns: string[];
  };
}

interface DealerAnalysisData {
  dealerName: string;
  overallTrustScore: number;
  trustLevel: "high" | "medium" | "low" | "unknown";
  summary: string;
  sources: { source: string; reviews: string[]; rating?: number; reviewCount?: number }[];
  redFlags: string[];
  positives: string[];
}

export default function ReportPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { tier } = useSubscription();
  const isPro = tier === "pro";
  const isPaid = tier === "basic" || tier === "pro";
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [excludeRepairs, setExcludeRepairs] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [vehicleData, setVehicleData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [dealerAnalysis, setDealerAnalysis] = useState<DealerAnalysisData | null>(null);
  const [isSavedReport, setIsSavedReport] = useState(false);
  const [mpgData, setMpgData] = useState<{
    mpgCity: number | null;
    mpgHighway: number | null;
    mpgCombined: number | null;
    fuelType: string | null;
  } | null>(null);
  
  // Check if coming from comparison
  const fromComparison = searchParams.get("from") === "compare";
  const comparisonIds = searchParams.get("ids") || "";
  const backToComparisonUrl = fromComparison ? `/compare?ids=${comparisonIds}` : null;

  const handleSaveReport = async (skipNavigation = false): Promise<boolean> => {
    if (!analysis || !vehicleData) return false;
    
    setIsSaving(true);
    try {
      const { vehicle, condition, financing, history } = vehicleData;
      const { priceAssessment, depreciationTable, riskAssessment, historyAnalysis } = analysis;
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Login Required",
          description: "Please log in to save your report.",
          variant: "destructive",
        });
        navigate("/login");
        return false;
      }

      const { error: saveError } = await supabase.from("vehicle_reports").insert({
        user_id: user.id,
        year: vehicle.year,
        make: vehicle.make,
        model: vehicle.model,
        trim: vehicle.trim || null,
        vin: vehicle.vin || null,
        mileage: condition.mileage,
        asking_price: condition.askingPrice,
        condition: condition.condition,
        seller_type: condition.sellerType,
        financing_type: financing.type,
        loan_amount: financing.loanAmount || null,
        loan_term: financing.loanTerm || null,
        apr: financing.apr || null,
        monthly_payment: financing.monthlyPayment || null,
        lease_term_months: financing.leaseTermMonths || null,
        residual_value: financing.residualValue || null,
        accident_count: history?.accidentCount || null,
        owner_count: history?.ownerCount || null,
        title_status: history?.titleStatus || null,
        history_issues: history?.issues || null,
        deal_rating: priceAssessment.dealRating,
        fair_market_private: priceAssessment.fairMarketPrivate,
        fair_market_trade_in: priceAssessment.fairMarketTradeIn,
        price_difference: priceAssessment.priceDifference,
        risk_level: riskAssessment.level,
        depreciation_risk: riskAssessment.depreciationRisk,
        reliability_concerns: riskAssessment.reliabilityConcerns,
        value_proposition: riskAssessment.valueProposition,
        fair_offer_price: riskAssessment.fairOfferPrice,
        expert_opinion: riskAssessment.expertOpinion,
        health_score: historyAnalysis.healthScore,
        history_positives: historyAnalysis.positives,
        depreciation_table: depreciationTable as any,
        listing_images: condition.images || null,
        mpg_city: mpgData?.mpgCity || null,
        mpg_highway: mpgData?.mpgHighway || null,
        mpg_combined: mpgData?.mpgCombined || null,
        fuel_type: mpgData?.fuelType || null,
        status: "complete",
      });

      if (saveError) throw saveError;

      sonnerToast.success("Report saved successfully!");
      sessionStorage.removeItem("analysisData");
      
      if (!skipNavigation) {
        navigate("/dashboard");
      }
      return true;
    } catch (err) {
      console.error("Save error:", err);
      toast({
        title: "Save Failed",
        description: "Failed to save your report. Please try again.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    const loadAnalysis = async () => {
      // First, check if we have a saved report ID (UUID format)
      const isUUID = id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      
      if (isUUID) {
        // Load saved report from database
        try {
          const { data: report, error: fetchError } = await supabase
            .from("vehicle_reports")
            .select("*")
            .eq("id", id)
            .single();
          
          if (fetchError) throw fetchError;
          if (!report) throw new Error("Report not found");
          
          setIsSavedReport(true);
          
          // Convert saved report to vehicleData format
          setVehicleData({
            vehicle: {
              year: report.year,
              make: report.make,
              model: report.model,
              trim: report.trim,
              vin: report.vin,
            },
            condition: {
              mileage: report.mileage,
              askingPrice: report.asking_price,
              condition: report.condition,
              sellerType: report.seller_type,
              images: report.listing_images,
            },
            financing: {
              type: report.financing_type,
              loanAmount: report.loan_amount,
              loanTerm: report.loan_term,
              apr: report.apr,
              monthlyPayment: report.monthly_payment,
              leaseTermMonths: report.lease_term_months,
              residualValue: report.residual_value,
            },
            history: {
              accidentCount: report.accident_count,
              ownerCount: report.owner_count,
              titleStatus: report.title_status,
              issues: report.history_issues,
            },
          });
          
          // Convert saved report to analysis format
          setAnalysis({
            priceAssessment: {
              fairMarketPrivate: report.fair_market_private || 0,
              fairMarketTradeIn: report.fair_market_trade_in || 0,
              dealRating: report.deal_rating || "fair",
              priceDifference: report.price_difference || 0,
              percentDifference: report.price_difference && report.fair_market_private 
                ? (report.price_difference / report.fair_market_private) * 100 
                : 0,
            },
            depreciationTable: (report.depreciation_table as unknown as DepreciationYear[]) || [],
            riskAssessment: {
              level: report.risk_level || "medium",
              depreciationRisk: report.depreciation_risk || "",
              reliabilityConcerns: report.reliability_concerns || [],
              valueProposition: report.value_proposition || "",
              fairOfferPrice: report.fair_offer_price || 0,
              expertOpinion: report.expert_opinion || "",
            },
            historyAnalysis: {
              healthScore: report.health_score || 0,
              positives: report.history_positives || [],
              concerns: report.history_issues || [],
            },
          });
          
          setIsLoading(false);
          return;
        } catch (err) {
          console.error("Error loading saved report:", err);
          // Fall through to try sessionStorage
        }
      }
      
      // For new analysis, load from sessionStorage
      const stored = sessionStorage.getItem("analysisData");
      console.log("Loading analysis data from sessionStorage:", stored ? "found" : "not found");
      
      if (!stored) {
        setError("No analysis data found. Please start a new analysis.");
        setIsLoading(false);
        return;
      }
      
      try {
        const data = JSON.parse(stored);
        console.log("Parsed analysis data:", data);
        setVehicleData(data);
        
        // Call AI analysis
        console.log("Calling analyze-vehicle edge function...");
        const { data: result, error: invokeError } = await supabase.functions.invoke("analyze-vehicle", {
          body: data,
        });

        console.log("Edge function response:", { result, invokeError });

        if (invokeError) {
          throw new Error(invokeError.message || "Failed to invoke analysis function");
        }
        
        if (result?.success) {
          setAnalysis(result.analysis);
          // Store MPG data from the response
          if (result.mpgData) {
            setMpgData({
              mpgCity: result.mpgData.mpgCity,
              mpgHighway: result.mpgData.mpgHighway,
              mpgCombined: result.mpgData.mpgCombined,
              fuelType: result.mpgData.fuelType,
            });
          }
        } else {
          throw new Error(result?.error || "Analysis returned no data");
        }
      } catch (err) {
        console.error("Analysis error:", err);
        const errorMessage = err instanceof Error ? err.message : "Failed to generate analysis";
        setError(errorMessage);
        toast({
          title: "Analysis Error",
          description: errorMessage,
          variant: "destructive",
        });
      }
      setIsLoading(false);
    };

    loadAnalysis();
  }, [id, toast]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
            <p className="mt-4 text-lg font-medium">Analyzing your vehicle...</p>
            <p className="text-sm text-muted-foreground">This may take a moment</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!analysis || !vehicleData) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex flex-1 items-center justify-center">
          <Card className="max-w-md text-center">
            <CardHeader>
              <CardTitle>{error ? "Analysis Error" : "Report Not Found"}</CardTitle>
              <CardDescription>
                {error || "We couldn't find this analysis. Start a new one?"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && vehicleData && (
                <Button 
                  variant="outline" 
                  onClick={() => window.location.reload()}
                  className="w-full"
                >
                  Try Again
                </Button>
              )}
              <Button asChild className="w-full">
                <Link to="/analyze">Start New Analysis</Link>
              </Button>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  const { vehicle, condition, financing } = vehicleData;
  const { priceAssessment, depreciationTable, riskAssessment, historyAnalysis } = analysis;

  const handleDownloadPDF = async () => {
    setIsDownloading(true);
    try {
      // Prepare dealer review data for PDF if available (Pro users only)
      const dealerReviewForPDF = isPro && dealerAnalysis ? {
        dealerName: dealerAnalysis.dealerName,
        trustScore: dealerAnalysis.overallTrustScore,
        sentiment: dealerAnalysis.trustLevel === "high" ? "positive" as const :
                   dealerAnalysis.trustLevel === "medium" ? "mixed" as const :
                   dealerAnalysis.trustLevel === "low" ? "negative" as const : "unknown" as const,
        summary: dealerAnalysis.summary,
        positives: dealerAnalysis.positives,
        watchOuts: dealerAnalysis.redFlags,
        sources: dealerAnalysis.sources.map(s => s.source),
      } : undefined;

      await generateReportPDF({
        vehicle: {
          year: vehicle.year,
          make: vehicle.make,
          model: vehicle.model,
          trim: vehicle.trim,
          mileage: condition.mileage,
          askingPrice: condition.askingPrice,
        },
        priceAssessment: {
          fairMarketPrivate: priceAssessment.fairMarketPrivate,
          fairMarketTradeIn: priceAssessment.fairMarketTradeIn,
          dealRating: priceAssessment.dealRating,
          priceDifference: priceAssessment.priceDifference,
        },
        riskAssessment: {
          level: riskAssessment.level,
          fairOfferPrice: riskAssessment.fairOfferPrice,
          expertOpinion: riskAssessment.expertOpinion,
          depreciationRisk: riskAssessment.depreciationRisk,
          reliabilityConcerns: riskAssessment.reliabilityConcerns,
        },
        historyAnalysis,
        depreciationTable,
        images: condition.images,
        dealerReview: dealerReviewForPDF,
      });
      sonnerToast.success("PDF downloaded successfully!");
    } catch (error) {
      sonnerToast.error("Failed to generate PDF");
      console.error(error);
    } finally {
      setIsDownloading(false);
    }
  };

  const dealRatingColors = {
    excellent: "bg-success text-success-foreground",
    good: "bg-success/80 text-success-foreground",
    fair: "bg-warning text-warning-foreground",
    poor: "bg-warning/80 text-warning-foreground",
    overpriced: "bg-danger text-danger-foreground",
  };

  const riskLevelColors = {
    low: "bg-success text-success-foreground",
    medium: "bg-warning text-warning-foreground",
    high: "bg-danger text-danger-foreground",
  };

  const chartData = depreciationTable.map((row) => ({
    name: `Year ${row.year}`,
    "Private Value": row.privateValue,
    "Trade-In Value": row.tradeInValue,
    "Loan Balance": row.loanBalance,
  }));

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      
      <main className="flex-1 bg-gradient-hero py-8">
        <div className="container mx-auto max-w-6xl px-4">
          {/* Back Navigation */}
          {backToComparisonUrl && (
            <Button 
              variant="ghost" 
              className="mb-4 -ml-2" 
              asChild
            >
              <Link to={backToComparisonUrl}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Comparison
              </Link>
            </Button>
          )}
          
          {/* Report Header */}
          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold">
                {vehicle.year} {vehicle.make} {vehicle.model}
              </h1>
              <p className="text-muted-foreground">
                {condition.mileage.toLocaleString()} miles • Asking ${condition.askingPrice.toLocaleString()}
              </p>
            </div>
            <div className="flex gap-2">
              {!isSavedReport && !backToComparisonUrl && (
                <Button variant="outline" size="sm" asChild>
                  <Link to="/dashboard">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Dashboard
                  </Link>
                </Button>
              )}
              <Button variant="outline" size="sm">
                <Share2 className="mr-2 h-4 w-4" />
                Share
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleDownloadPDF}
                disabled={isDownloading}
              >
                {isDownloading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                {isDownloading ? "Generating..." : "Download PDF"}
              </Button>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="mb-8 grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <DollarSign className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Fair Market Price</p>
                    <p className="text-xl font-bold">${priceAssessment.fairMarketPrivate.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={cn("flex h-10 w-10 items-center justify-center rounded-full", dealRatingColors[priceAssessment.dealRating])}>
                    <Gauge className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Deal Rating</p>
                    <p className="text-xl font-bold capitalize">{priceAssessment.dealRating}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={cn("flex h-10 w-10 items-center justify-center rounded-full", riskLevelColors[riskAssessment.level])}>
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Risk Level</p>
                    <p className="text-xl font-bold capitalize">{riskAssessment.level}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/10">
                    <TrendingDown className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Fair Offer</p>
                    <p className="text-xl font-bold">${riskAssessment.fairOfferPrice.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-8 lg:grid-cols-3">
            {/* Left Column - Main Content */}
            <div className="space-y-8 lg:col-span-2">
              {/* Price Assessment */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-primary" />
                    Price Assessment
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between rounded-lg bg-muted p-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Asking Price</p>
                        <p className="text-2xl font-bold">${condition.askingPrice.toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">vs Fair Market</p>
                        <p className={cn(
                          "text-2xl font-bold",
                          priceAssessment.priceDifference > 0 ? "text-danger" : "text-success"
                        )}>
                          {priceAssessment.priceDifference > 0 ? "+" : ""}
                          ${Math.abs(priceAssessment.priceDifference).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-lg border p-4">
                        <p className="text-sm text-muted-foreground">Private Sale Value</p>
                        <p className="text-xl font-semibold">${priceAssessment.fairMarketPrivate.toLocaleString()}</p>
                      </div>
                      <div className="rounded-lg border p-4">
                        <p className="text-sm text-muted-foreground">Trade-In Value</p>
                        <p className="text-xl font-semibold">${priceAssessment.fairMarketTradeIn.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Fuel Economy & TCO */}
              <FuelEconomyCard
                mpgCity={mpgData?.mpgCity ?? null}
                mpgHighway={mpgData?.mpgHighway ?? null}
                mpgCombined={mpgData?.mpgCombined ?? null}
                fuelType={mpgData?.fuelType ?? null}
                askingPrice={condition.askingPrice}
                make={vehicle.make}
                year={vehicle.year}
                depreciationTable={depreciationTable}
              />

              {/* Depreciation Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingDown className="h-5 w-5 text-primary" />
                    5-Year Depreciation & Equity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="name" className="text-xs" />
                        <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} className="text-xs" />
                        <Tooltip 
                          formatter={(value: number) => `$${value.toLocaleString()}`}
                          contentStyle={{ 
                            backgroundColor: "hsl(var(--card))", 
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px"
                          }}
                        />
                        <Legend />
                        <Line 
                          type="monotone" 
                          dataKey="Private Value" 
                          stroke="hsl(var(--success))" 
                          strokeWidth={2}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="Trade-In Value" 
                          stroke="hsl(var(--warning))" 
                          strokeWidth={2}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="Loan Balance" 
                          stroke="hsl(var(--primary))" 
                          strokeWidth={2}
                          strokeDasharray="5 5"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Depreciation Table */}
                  <div className="mt-6">
                    <div className="mb-4 flex items-center justify-between">
                      <h4 className="text-sm font-medium">Detailed Breakdown</h4>
                      <div className="flex items-center gap-2">
                        <Switch
                          id="exclude-repairs"
                          checked={excludeRepairs}
                          onCheckedChange={setExcludeRepairs}
                        />
                        <Label htmlFor="exclude-repairs" className="text-sm text-muted-foreground cursor-pointer">
                          Exclude repairs from equity
                        </Label>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Year</TableHead>
                          <TableHead className="text-right">Private Value</TableHead>
                          <TableHead className="text-right">Trade-In</TableHead>
                          <TableHead className="text-right">Loan Balance</TableHead>
                          <TableHead className="text-right">Repair Costs</TableHead>
                          <TableHead className="text-right">Net Equity</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {depreciationTable.map((row) => {
                          // Net equity = Trade-In Value - Loan Balance - Repair Costs (unless excluded)
                          const netEquity = excludeRepairs 
                            ? row.tradeInValue - row.loanBalance
                            : row.tradeInValue - row.loanBalance - row.repairCosts;
                          return (
                            <TableRow key={row.year}>
                              <TableCell className="font-medium">Year {row.year}</TableCell>
                              <TableCell className="text-right">${row.privateValue.toLocaleString()}</TableCell>
                              <TableCell className="text-right">${row.tradeInValue.toLocaleString()}</TableCell>
                              <TableCell className="text-right">${row.loanBalance.toLocaleString()}</TableCell>
                              <TableCell className="text-right">
                                ${row.repairCosts.toLocaleString()}
                              </TableCell>
                              <TableCell className={cn(
                                "text-right font-semibold",
                                netEquity >= 0 ? "text-success" : "text-danger"
                              )}>
                                {netEquity >= 0 ? "+" : ""}
                                ${netEquity.toLocaleString()}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Expert Opinion */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    Expert Opinion
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <p className="whitespace-pre-line">{riskAssessment.expertOpinion}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Action Buttons */}
              {!isSavedReport && (
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    onClick={async () => {
                      if (!isPaid) {
                        navigate("/pricing");
                        return;
                      }
                      // Save report first, then navigate to compare
                      const saved = await handleSaveReport(true);
                      if (saved) {
                        navigate("/dashboard?select=true");
                      }
                    }}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Scale className="mr-2 h-4 w-4" />
                    )}
                    Compare with Another Vehicle
                  </Button>
                  <Button 
                    className="flex-1"
                    onClick={() => handleSaveReport()}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    {isSaving ? "Saving..." : "Save Report"}
                  </Button>
                </div>
              )}
            </div>

            {/* Right Column - Sidebar */}
            <div className="space-y-6">
              {/* Vehicle Images Gallery */}
              {condition?.images && condition.images.length > 0 && (
                <VehicleImageGallery 
                  images={condition.images}
                  vehicleName={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                  listingUrl={condition.listingUrl}
                />
              )}

              {/* Dealer Trust Analysis - Pro Feature */}
              <DealerReview
                dealerName={condition?.sellerName}
                listingUrl={condition?.listingUrl}
                sellerType={condition?.sellerType}
                isPro={isPro}
                onAnalysisComplete={setDealerAnalysis}
              />

              {/* Vehicle Health Score */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Car className="h-5 w-5 text-primary" />
                    Vehicle Health
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="mb-4 text-center">
                    <div className="text-4xl font-bold">{historyAnalysis.healthScore}</div>
                    <p className="text-sm text-muted-foreground">out of 100</p>
                  </div>
                  <Progress value={historyAnalysis.healthScore} className="h-3" />

                  <div className="mt-6 space-y-4">
                    <div>
                      <h4 className="mb-2 flex items-center gap-2 text-sm font-medium text-success">
                        <CheckCircle className="h-4 w-4" />
                        Positives
                      </h4>
                      <ul className="space-y-1 text-sm">
                        {historyAnalysis.positives.map((item, i) => (
                          <li key={i} className="text-muted-foreground">• {item}</li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h4 className="mb-2 flex items-center gap-2 text-sm font-medium text-danger">
                        <XCircle className="h-4 w-4" />
                        Concerns
                      </h4>
                      <ul className="space-y-1 text-sm">
                        {historyAnalysis.concerns.map((item, i) => (
                          <li key={i} className="text-muted-foreground">• {item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Risk Factors */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-warning" />
                    Risk Factors
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-medium">Depreciation Risk</p>
                      <p className="text-sm text-muted-foreground">{riskAssessment.depreciationRisk}</p>
                    </div>

                    <div>
                      <p className="mb-2 text-sm font-medium">Reliability Concerns</p>
                      <ul className="space-y-2">
                        {riskAssessment.reliabilityConcerns.map((concern, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <Wrench className="mt-0.5 h-3 w-3 shrink-0 text-warning" />
                            <span className="text-muted-foreground">{concern}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="rounded-lg bg-muted p-4">
                      <p className="text-sm font-medium">Value Proposition</p>
                      <p className="text-sm text-muted-foreground">{riskAssessment.valueProposition}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Recommendation */}
              <Card className={cn(
                "border-2",
                riskAssessment.level === "low" 
                  ? "border-success bg-success/5" 
                  : riskAssessment.level === "medium"
                  ? "border-warning bg-warning/5"
                  : "border-danger bg-danger/5"
              )}>
                <CardContent className="p-6 text-center">
                  <Badge className={cn("mb-4", riskLevelColors[riskAssessment.level])}>
                    {riskAssessment.level.toUpperCase()} RISK
                  </Badge>
                  <p className="mb-2 text-lg font-semibold">Fair Offer Price</p>
                  <p className="text-3xl font-bold">${riskAssessment.fairOfferPrice.toLocaleString()}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Based on condition, market data, and risk factors
                  </p>
                </CardContent>
              </Card>

              {/* Ad Placeholder */}
              <div className="rounded-lg border-2 border-dashed border-muted bg-muted/20 p-4 text-center">
                <p className="text-xs text-muted-foreground">Advertisement</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
