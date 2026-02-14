import { useEffect, useState, useRef } from "react";
import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
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
  Upload,
  Download,
  Loader2,
  Scale,
  Save,
  ArrowLeft,
  ExternalLink,
  BadgeCheck,
  Bot,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getWithExpiry, removeExpirableItem } from "@/lib/storage-utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/hooks/useSubscription";
import { VehicleImageGallery } from "@/components/report/VehicleImageGallery";
import { DealerReview } from "@/components/report/DealerReview";
import { FuelEconomyCard } from "@/components/report/FuelEconomyCard";
import { RiskScoreBreakdown } from "@/components/report/RiskScoreBreakdown";
import { ServiceHistoryTimeline } from "@/components/report/ServiceHistoryTimeline";
import { generateReportPDF } from "@/lib/generatePDF";
import { calculateTCO } from "@/lib/tco-calculations";
import { toast as sonnerToast } from "sonner";
import { calculateUVPRS, uvprsToLegacyRiskLevel, type UVPRSResult } from "@/lib/uvprs-scoring";
import { lookupRecalls } from "@/lib/nhtsa";
import { parseHistoryReport } from "@/lib/api/parse-history";

// Parse reliability_concerns from DB (jsonb) into typed array
function parseReliabilityConcerns(raw: unknown): Array<{ concern: string; costLow?: number | null; costHigh?: number | null }> {
  if (!raw) return [];
  if (!Array.isArray(raw)) return [];
  return raw.map((item: unknown) => {
    if (typeof item === "string") return { concern: item };
    if (typeof item === "object" && item !== null && "concern" in item) {
      const obj = item as { concern: string; costLow?: number | null; costHigh?: number | null };
      return { concern: obj.concern, costLow: obj.costLow ?? null, costHigh: obj.costHigh ?? null };
    }
    return { concern: String(item) };
  });
}

interface DepreciationYear {
  year: number;
  privateValue: number;
  tradeInValue: number;
  loanBalance: number;
  repairCosts: number;
  maintenanceCosts?: number;
  netEquityPrivate: number;
  netEquityTradeIn: number;
}

interface Analysis {
  priceAssessment: {
    fairMarketPrivate: number;
    fairMarketDealer?: number;
    fairMarketTradeIn: number;
    dealRating: "excellent" | "good" | "fair" | "poor" | "overpriced";
    priceDifference: number;
    percentDifference: number;
  };
  depreciationTable: DepreciationYear[];
  riskAssessment: {
    level: "low" | "medium" | "high";
    depreciationRisk: string;
    reliabilityConcerns: Array<{ concern: string; costLow?: number | null; costHigh?: number | null }>;
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
  const headerHistoryInputRef = useRef<HTMLInputElement>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [excludeRepairs, setExcludeRepairs] = useState(false);
  const [userAnnualMiles, setUserAnnualMiles] = useState(12000);
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
    evRange: number | null;
  } | null>(null);
  const [pricingSources, setPricingSources] = useState<string[]>([]);
  const [pricingLastUpdated, setPricingLastUpdated] = useState<Date | null>(null);
  const [isRefreshingPricing, setIsRefreshingPricing] = useState(false);
  const [uvprsResult, setUvprsResult] = useState<UVPRSResult | null>(null);
  const [isUploadingHistory, setIsUploadingHistory] = useState(false);
  
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
        accident_count: history?.accidentCount ?? null,
        owner_count: history?.ownerCount ?? null,
        title_status: history?.titleStatus || null,
        history_issues: history?.issues || null,
        has_service_records: history?.serviceRecords ?? false,
        service_gap_miles: history?.serviceGapMiles ?? null,
        major_services_due: history?.majorServicesDue ?? null,
        major_services_done: history?.majorServicesDone ?? null,
        chronic_repair_systems: history?.chronicRepairSystems ?? null,
        deal_rating: priceAssessment.dealRating,
        fair_market_private: priceAssessment.fairMarketPrivate,
        fair_market_dealer: priceAssessment.fairMarketDealer || null,
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
        pricing_sources: pricingSources.length > 0 ? pricingSources : null,
        pricing_last_updated: pricingLastUpdated?.toISOString() || null,
        risk_score: uvprsResult?.totalScore ?? null,
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
              accidentCount: report.accident_count ?? 0,
              ownerCount: report.owner_count ?? 1,
              titleStatus: report.title_status,
              issues: report.history_issues,
              serviceRecords: report.has_service_records,
              serviceGapMiles: report.service_gap_miles,
              majorServicesDue: report.major_services_due,
              majorServicesDone: report.major_services_done,
              chronicRepairSystems: report.chronic_repair_systems,
            },
          });
          
          // Convert saved report to analysis format
          const sellerType = report.seller_type || "private";
          const referencePrice = sellerType === "dealer" 
            ? (report.fair_market_dealer || report.fair_market_private || 0)
            : (report.fair_market_private || 0);
          
          setAnalysis({
            priceAssessment: {
              fairMarketPrivate: report.fair_market_private || 0,
              fairMarketDealer: report.fair_market_dealer || undefined,
              fairMarketTradeIn: report.fair_market_trade_in || 0,
              dealRating: report.deal_rating || "fair",
              priceDifference: report.price_difference || 0,
              percentDifference: report.price_difference && referencePrice 
                ? (report.price_difference / referencePrice) * 100 
                : 0,
            },
            depreciationTable: (report.depreciation_table as unknown as DepreciationYear[]) || [],
            riskAssessment: {
              level: report.risk_level || "medium",
              depreciationRisk: report.depreciation_risk || "",
              reliabilityConcerns: parseReliabilityConcerns(report.reliability_concerns),
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
          
          // Load MPG data from saved report
          setMpgData({
            mpgCity: report.mpg_city,
            mpgHighway: report.mpg_highway,
            mpgCombined: report.mpg_combined,
            fuelType: report.fuel_type,
            evRange: null,
          });

          // Load persisted pricing metadata
          if (report.pricing_sources?.length) {
            setPricingSources(report.pricing_sources);
          }
          if (report.pricing_last_updated) {
            setPricingLastUpdated(new Date(report.pricing_last_updated));
          }
          
          setIsLoading(false);
          return;
        } catch (err) {
          console.error("Error loading saved report:", err);
          // Fall through to try sessionStorage
        }
      }
      
      // For new analysis, check localStorage first (for cross-tab email verification), then sessionStorage
      let stored = sessionStorage.getItem("analysisData");
      
      // If not in sessionStorage, check localStorage with expiry (email verification opens in new tab)
      if (!stored) {
        const pendingData = getWithExpiry<any>("pendingAnalysisData");
        if (pendingData) {
          console.log("Loading analysis data from localStorage (cross-tab)");
          stored = JSON.stringify(pendingData);
          // Move to sessionStorage and clean up localStorage
          sessionStorage.setItem("analysisData", stored);
          removeExpirableItem("pendingAnalysisData");
          localStorage.removeItem("pendingReport");
        }
      }
      
      console.log("Loading analysis data:", stored ? "found" : "not found");
      
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
              evRange: result.mpgData.evRange ?? null,
            });
          }
          // Store pricing sources/citations
          if (result.pricingSources?.length) {
            setPricingSources(result.pricingSources);
            setPricingLastUpdated(new Date());
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Compute UVPRS when analysis data is available
  useEffect(() => {
    if (!analysis || !vehicleData) return;
    const { vehicle, condition, history } = vehicleData;
    const { priceAssessment, historyAnalysis } = analysis;
    
    const computeUVPRS = async () => {
      // Cross-reference NHTSA (primary, all recalls for year/make/model) with CarFax (resolved count for this VIN)
      let openRecallCount: number | null = null;
      let nhtsaTotalRecalls: number | null = null;
      let resolvedRecallCount: number | null = history?.resolvedRecallCount ?? null;
      try {
        const recallResult = await lookupRecalls(vehicle.year, vehicle.make, vehicle.model);
        nhtsaTotalRecalls = recallResult.count;
        const resolved = resolvedRecallCount ?? 0;
        // Open = NHTSA total minus CarFax-confirmed resolved (floor at 0)
        openRecallCount = Math.max(0, nhtsaTotalRecalls - resolved);
      } catch {
        // If NHTSA fails, fall back to CarFax-only data
        openRecallCount = history?.openRecallCount ?? null;
      }

      const result = calculateUVPRS({
        year: vehicle.year,
        make: vehicle.make,
        mileage: condition.mileage,
        askingPrice: condition.askingPrice,
        titleStatus: history?.titleStatus || null,
        accidentCount: history?.accidentCount ?? null,
        ownerCount: history?.ownerCount ?? null,
        hasServiceRecords: history?.serviceRecords ?? null,
        healthScore: historyAnalysis?.healthScore ?? null,
        historyIssues: historyAnalysis?.concerns ?? history?.issues ?? null,
        historyPositives: historyAnalysis?.positives ?? null,
        serviceGapMiles: history?.serviceGapMiles ?? null,
        majorServicesDue: history?.majorServicesDue ?? null,
        majorServicesDone: history?.majorServicesDone ?? null,
        chronicRepairSystems: history?.chronicRepairSystems ?? null,
        fairMarketPrivate: priceAssessment?.fairMarketPrivate ?? null,
        fairMarketDealer: priceAssessment?.fairMarketDealer ?? null,
        openRecallCount,
        nhtsaTotalRecalls,
        resolvedRecallCount,
      });
      setUvprsResult(result);
    };
    computeUVPRS();
  }, [analysis, vehicleData]);

  const refreshPricing = async () => {
    if (!vehicleData || isRefreshingPricing) return;
    setIsRefreshingPricing(true);
    try {
      // Re-run the full analysis which includes fresh pricing lookup
      const { data: result, error: invokeError } = await supabase.functions.invoke("analyze-vehicle", {
        body: vehicleData,
      });
      if (invokeError) throw invokeError;
      if (result?.success) {
        setAnalysis(result.analysis);
        if (result.mpgData) {
          setMpgData({
            mpgCity: result.mpgData.mpgCity,
            mpgHighway: result.mpgData.mpgHighway,
            mpgCombined: result.mpgData.mpgCombined,
            fuelType: result.mpgData.fuelType,
            evRange: result.mpgData.evRange ?? null,
          });
        }
        if (result.pricingSources?.length) {
          setPricingSources(result.pricingSources);
        }
        const now = new Date();
        setPricingLastUpdated(now);
        sonnerToast.success("Analysis refreshed with latest market data");

        // Persist to DB if this is a saved report
        if (isSavedReport && id) {
          const { priceAssessment, depreciationTable, riskAssessment, historyAnalysis } = result.analysis;
          await supabase.from("vehicle_reports").update({
            fair_market_private: priceAssessment.fairMarketPrivate,
            fair_market_dealer: priceAssessment.fairMarketDealer || null,
            fair_market_trade_in: priceAssessment.fairMarketTradeIn,
            deal_rating: priceAssessment.dealRating,
            price_difference: priceAssessment.priceDifference,
            risk_level: riskAssessment.level,
            depreciation_risk: riskAssessment.depreciationRisk,
            reliability_concerns: riskAssessment.reliabilityConcerns,
            value_proposition: riskAssessment.valueProposition,
            fair_offer_price: riskAssessment.fairOfferPrice,
            expert_opinion: riskAssessment.expertOpinion,
            health_score: historyAnalysis.healthScore,
            history_issues: historyAnalysis.concerns || [],
            history_positives: historyAnalysis.positives || [],
            depreciation_table: depreciationTable as any,
            pricing_sources: result.pricingSources || [],
            pricing_last_updated: now.toISOString(),
          }).eq("id", id);
        }
      } else {
        throw new Error(result?.error || "Refresh failed");
      }
    } catch (err) {
      console.error("Pricing refresh error:", err);
      sonnerToast.error("Failed to refresh pricing data");
    }
    setIsRefreshingPricing(false);
  };

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
    const isDataExpired = error?.includes("No analysis data found");
    
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex flex-1 items-center justify-center px-4">
          <Card className="max-w-md text-center">
            <CardHeader>
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Car className="h-6 w-6 text-muted-foreground" />
              </div>
              <CardTitle>
                {isDataExpired ? "Session Expired" : error ? "Analysis Error" : "Report Not Found"}
              </CardTitle>
              <CardDescription className="text-base">
                {isDataExpired ? (
                  <>
                    Your vehicle analysis data has expired. This can happen if you waited too long 
                    before verifying your email, or if your browser cleared its storage.
                  </>
                ) : error ? (
                  error
                ) : (
                  "We couldn't find this analysis. The report may have been deleted or the link is invalid."
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
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
                <Link to="/analyze">
                  <Car className="mr-2 h-4 w-4" />
                  Start New Analysis
                </Link>
              </Button>
              <p className="text-xs text-muted-foreground pt-2">
                {isDataExpired 
                  ? "Don't worry — just re-enter your vehicle info and we'll generate a fresh report."
                  : "Need help? Visit our Help Center for assistance."
                }
              </p>
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
        serviceHistory: {
          serviceGapMiles: vehicleData?.history?.serviceGapMiles,
          majorServicesDue: vehicleData?.history?.majorServicesDue,
          majorServicesDone: vehicleData?.history?.majorServicesDone,
          chronicRepairSystems: vehicleData?.history?.chronicRepairSystems,
        },
        uvprsResult: uvprsResult ?? undefined,
        sellerType: condition.sellerType,
        tcoData: (() => {
          const annualMiles = userAnnualMiles;
          const tco = calculateTCO(
            condition.askingPrice,
            mpgData?.mpgCombined ?? null,
            mpgData?.fuelType ?? null,
            depreciationTable,
            { annualMiles },
            { make: vehicle.make, year: vehicle.year }
          );
          return { tco, annualMiles };
        })(),
        pricingSources,
        hasServiceRecords: vehicleData?.history?.serviceRecords ?? false,
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
                {vehicle.vin && <>{vehicle.vin} • </>}{condition.mileage.toLocaleString()} miles • Asking ${condition.askingPrice.toLocaleString()}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {!isSavedReport && !backToComparisonUrl && (
                <Button variant="outline" size="sm" asChild>
                  <Link to="/dashboard">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Dashboard
                  </Link>
                </Button>
              )}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={refreshPricing}
                disabled={isRefreshingPricing}
              >
                {isRefreshingPricing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                {isRefreshingPricing ? "Re-Analyzing..." : "Re-Analyze"}
              </Button>
              <input
                type="file"
                ref={headerHistoryInputRef}
                accept=".pdf"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  // Reset input so same file can be re-selected
                  e.target.value = "";
                  setIsRefreshingPricing(true);
                  try {
                    const mileage = vehicleData?.condition?.mileage;
                    const result = await parseHistoryReport(file, undefined, mileage);
                    if (!result.success || !result.history) {
                      sonnerToast.error(result.error || "Failed to parse history report");
                      return;
                    }
                    const extractedVin = result.history.vin;
                    const updatedVehicleData = {
                      ...vehicleData,
                      vehicle: {
                        ...vehicleData.vehicle,
                        ...(extractedVin && !vehicleData.vehicle.vin ? { vin: extractedVin } : {}),
                      },
                      history: {
                        ...vehicleData.history,
                        ...result.history,
                        serviceRecords: true,
                      },
                    };
                    setVehicleData(updatedVehicleData);
                    sessionStorage.setItem("analysisData", JSON.stringify(updatedVehicleData));
                    sonnerToast.success("History report uploaded! Re-analyzing...");
                    const { data: analysisResult, error: invokeError } = await supabase.functions.invoke("analyze-vehicle", {
                      body: updatedVehicleData,
                    });
                    if (invokeError) throw invokeError;
                    if (analysisResult?.success) {
                      setAnalysis(analysisResult.analysis);
                      if (analysisResult.mpgData) {
                        setMpgData({
                          mpgCity: analysisResult.mpgData.mpgCity,
                          mpgHighway: analysisResult.mpgData.mpgHighway,
                          mpgCombined: analysisResult.mpgData.mpgCombined,
                          fuelType: analysisResult.mpgData.fuelType,
                          evRange: analysisResult.mpgData.evRange ?? null,
                        });
                      }
                      if (analysisResult.pricingSources?.length) {
                        setPricingSources(analysisResult.pricingSources);
                        setPricingLastUpdated(new Date());
                      }
                      if (isSavedReport && id) {
                        const { priceAssessment, depreciationTable, riskAssessment, historyAnalysis } = analysisResult.analysis;
                        await supabase.from("vehicle_reports").update({
                          fair_market_private: priceAssessment.fairMarketPrivate,
                          fair_market_dealer: priceAssessment.fairMarketDealer || null,
                          fair_market_trade_in: priceAssessment.fairMarketTradeIn,
                          deal_rating: priceAssessment.dealRating,
                          price_difference: priceAssessment.priceDifference,
                          risk_level: riskAssessment.level,
                          depreciation_risk: riskAssessment.depreciationRisk,
                          reliability_concerns: riskAssessment.reliabilityConcerns,
                          value_proposition: riskAssessment.valueProposition,
                          fair_offer_price: riskAssessment.fairOfferPrice,
                          expert_opinion: riskAssessment.expertOpinion,
                          health_score: historyAnalysis.healthScore,
                          history_issues: historyAnalysis.concerns || [],
                          history_positives: historyAnalysis.positives || [],
                          depreciation_table: depreciationTable as any,
                          has_service_records: true,
                          accident_count: result.history?.accidentCount ?? null,
                          owner_count: result.history?.ownerCount ?? null,
                          title_status: result.history?.titleStatus ?? null,
                          service_gap_miles: result.history?.serviceGapMiles ?? null,
                          major_services_due: result.history?.majorServicesDue ?? null,
                          major_services_done: result.history?.majorServicesDone ?? null,
                          chronic_repair_systems: result.history?.chronicRepairSystems ?? null,
                          ...(extractedVin ? { vin: extractedVin } : {}),
                          pricing_sources: analysisResult.pricingSources || [],
                          pricing_last_updated: new Date().toISOString(),
                        }).eq("id", id);
                      }
                      sonnerToast.success("Report updated with history data!");
                    } else {
                      throw new Error(analysisResult?.error || "Re-analysis failed");
                    }
                  } catch (err) {
                    console.error("Header history upload error:", err);
                    sonnerToast.error("Failed to process history report");
                  } finally {
                    setIsRefreshingPricing(false);
                  }
                }}
              />
              <Button 
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white border-none"
                onClick={() => headerHistoryInputRef.current?.click()}
                disabled={isRefreshingPricing}
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload CarFax/AutoCheck
              </Button>
              <Button 
                size="sm"
                className="bg-[#FAA187] hover:bg-[#f08e72] text-black border-none"
                onClick={handleDownloadPDF}
                disabled={isDownloading}
              >
                {isDownloading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <path d="M8.5 21H4a1 1 0 01-1-1V4a1 1 0 011-1h16a1 1 0 011 1v16a1 1 0 01-1 1h-4.5" />
                    <path d="M8.5 21L3 14l4-1.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M15.5 21L21 14l-4-1.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    <text x="7" y="11.5" fontSize="6" fontWeight="bold" fill="currentColor" fontFamily="Arial">PDF</text>
                  </svg>
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
                    <p className="text-sm text-muted-foreground">
                      {condition.sellerType === "dealer" ? "Dealer Retail Value" : "Private Sale Value"}
                    </p>
                    <p className="text-xl font-bold">
                      ${(condition.sellerType === "dealer" && priceAssessment.fairMarketDealer 
                        ? priceAssessment.fairMarketDealer 
                        : priceAssessment.fairMarketPrivate
                      ).toLocaleString()}
                    </p>
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
                  <div className={cn("flex h-10 w-10 items-center justify-center rounded-full", 
                    uvprsResult 
                      ? uvprsResult.riskLevel === "low" ? "bg-success text-success-foreground"
                        : uvprsResult.riskLevel === "moderate" ? "bg-warning text-warning-foreground"
                        : "bg-danger text-danger-foreground"
                      : riskLevelColors[riskAssessment.level]
                  )}>
                    <ShieldAlert className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Risk Score</p>
                    <p className="text-xl font-bold">
                      {uvprsResult ? `${uvprsResult.totalScore} / 100` : riskAssessment.level}
                    </p>
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
                  <CardTitle className="flex flex-wrap items-center gap-2">
                    <DollarSign className="h-5 w-5 text-primary" />
                    Price Assessment
                    {pricingLastUpdated && (
                      <span className="text-xs font-normal text-muted-foreground">
                        (last updated {pricingLastUpdated.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "2-digit" })})
                      </span>
                    )}
                    <div className="ml-auto flex items-center gap-2">
                      {pricingSources.length > 0 ? (
                        <Badge variant="outline" className="gap-1 border-success/30 bg-success/10 text-success text-xs font-medium">
                          <BadgeCheck className="h-3 w-3" />
                          Market Verified
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 border-muted-foreground/30 bg-muted text-muted-foreground text-xs font-medium">
                          <Bot className="h-3 w-3" />
                          AI Estimated
                        </Badge>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            disabled={isRefreshingPricing}
                            title="Refresh pricing data"
                          >
                            <RefreshCw className={cn("h-3.5 w-3.5", isRefreshingPricing && "animate-spin")} />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Refresh Market Data?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will re-run the full AI analysis with the latest market pricing data. This uses credits and may take 10–20 seconds.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={refreshPricing}>Refresh</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
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

                    <div className="grid gap-4 sm:grid-cols-3">
                      {priceAssessment.fairMarketDealer && (
                        <div className={cn("rounded-lg border p-4", condition.sellerType === "dealer" && "border-primary/30 bg-primary/5")}>
                          <p className="text-sm text-muted-foreground">Dealer Retail</p>
                          <p className="text-xl font-semibold">${priceAssessment.fairMarketDealer.toLocaleString()}</p>
                        </div>
                      )}
                      <div className={cn("rounded-lg border p-4", condition.sellerType !== "dealer" && "border-primary/30 bg-primary/5")}>
                        <p className="text-sm text-muted-foreground">Private Sale</p>
                        <p className="text-xl font-semibold">${priceAssessment.fairMarketPrivate.toLocaleString()}</p>
                      </div>
                      <div className="rounded-lg border p-4">
                        <p className="text-sm text-muted-foreground">Trade-In Value</p>
                        <p className="text-xl font-semibold">${priceAssessment.fairMarketTradeIn.toLocaleString()}</p>
                      </div>
                    </div>

                    {/* Pricing Sources */}
                    {pricingSources.length > 0 && (
                      <div className="mt-4 rounded-lg border border-dashed p-3">
                        <p className="text-xs font-medium text-muted-foreground mb-2">Pricing Sources</p>
                        <div className="flex flex-wrap gap-2">
                          {(() => {
                            const knownSources: Record<string, string> = {
                              kbb: "Kelley Blue Book",
                              repairpal: "RepairPal",
                              edmunds: "Edmunds",
                              carfax: "CARFAX",
                              autocheck: "AutoCheck",
                              cargurus: "CarGurus",
                              nada: "NADA Guides",
                              truecar: "TrueCar",
                              marketcheck: "MarketCheck",
                            };
                            const seen = new Map<string, { displayName: string; url: string }>();
                            for (const url of pricingSources) {
                              try {
                                const hostname = new URL(url).hostname.replace("www.", "");
                                const domain = hostname.split(".")[0];
                                if (!seen.has(domain)) {
                                  seen.set(domain, {
                                    displayName: knownSources[domain] || domain.charAt(0).toUpperCase() + domain.slice(1),
                                    url,
                                  });
                                }
                              } catch {
                                // skip malformed URLs
                              }
                            }
                            return Array.from(seen.values()).map(({ displayName, url }) => (
                              <a
                                key={displayName}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                              >
                                <ExternalLink className="h-3 w-3" />
                                {displayName}
                              </a>
                            ));
                          })()}
                        </div>
                      </div>
                    )}
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
                evRange={mpgData?.evRange ?? null}
                onAnnualMilesChange={setUserAnnualMiles}
              />

              {/* Depreciation Chart */}
              <Card>
                <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <TrendingDown className="h-5 w-5 text-primary" />
                    5-Year Depreciation & Equity
                    {pricingSources.length > 0 ? (
                      <Badge variant="outline" className="ml-auto gap-1 border-success/30 bg-success/10 text-success text-xs font-medium">
                        <BadgeCheck className="h-3 w-3" />
                        Market Verified
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="ml-auto gap-1 border-muted-foreground/30 bg-muted text-muted-foreground text-xs font-medium">
                        <Bot className="h-3 w-3" />
                        AI Estimated
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height={300}>
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
                          <TableHead className="text-right">Repairs</TableHead>
                          <TableHead className="text-right">Maintenance</TableHead>
                          <TableHead className="text-right">Net Equity</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {depreciationTable.map((row) => {
                          const totalCosts = row.repairCosts + (row.maintenanceCosts || 0);
                          const netEquity = excludeRepairs 
                            ? row.tradeInValue - row.loanBalance
                            : row.tradeInValue - row.loanBalance - totalCosts;
                          return (
                            <TableRow key={row.year}>
                              <TableCell className="font-medium">Year {row.year}</TableCell>
                              <TableCell className="text-right">${row.privateValue.toLocaleString()}</TableCell>
                              <TableCell className="text-right">${row.tradeInValue.toLocaleString()}</TableCell>
                              <TableCell className="text-right">${row.loanBalance.toLocaleString()}</TableCell>
                              <TableCell className="text-right text-danger">
                                ${row.repairCosts.toLocaleString()}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                ${(row.maintenanceCosts || 0).toLocaleString()}
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

                    {/* Cost Data Sources */}
                    {pricingSources.length > 0 && (
                      <div className="mt-4 rounded-lg border border-dashed p-3">
                        <p className="text-xs font-medium text-muted-foreground mb-2">Repair & Maintenance Cost Sources</p>
                        <div className="flex flex-wrap gap-2">
                          {(() => {
                            const seen = new Map<string, { displayName: string; url: string }>();
                            for (const url of pricingSources) {
                              try {
                                const hostname = new URL(url).hostname.replace("www.", "");
                                const domain = hostname.split(".")[0];
                                if (!seen.has(domain)) {
                                  seen.set(domain, {
                                    displayName: domain.charAt(0).toUpperCase() + domain.slice(1),
                                    url,
                                  });
                                }
                              } catch {
                                // skip malformed URLs
                              }
                            }
                            return Array.from(seen.values()).map(({ displayName, url }) => (
                              <a
                                key={displayName}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                              >
                                <ExternalLink className="h-3 w-3" />
                                {displayName}
                              </a>
                            ));
                          })()}
                        </div>
                      </div>
                    )}
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
                  
                  {/* Analyze Another Vehicle - Only for saved reports */}
                  {isSavedReport && (
                    <div className="mt-6 pt-6 border-t">
                      <Button asChild className="w-full">
                        <Link to="/analyze">
                          <Car className="mr-2 h-4 w-4" />
                          Analyze Another Vehicle
                        </Link>
                      </Button>
                    </div>
                  )}
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

              {/* UVPRS Risk Score Breakdown */}
              {uvprsResult && (
                <RiskScoreBreakdown 
                  result={uvprsResult} 
                  missingHistoryReport={!vehicleData?.history?.serviceRecords}
                  isUploadingHistory={isUploadingHistory}
                  onUploadHistory={async (file: File) => {
                    setIsUploadingHistory(true);
                    try {
                      const mileage = vehicleData?.condition?.mileage;
                      const result = await parseHistoryReport(file, undefined, mileage);
                      if (!result.success || !result.history) {
                        sonnerToast.error(result.error || "Failed to parse history report");
                        return;
                      }
                      // Merge parsed history into vehicleData
                      const extractedVin = result.history.vin;
                      const updatedVehicleData = {
                        ...vehicleData,
                        vehicle: {
                          ...vehicleData.vehicle,
                          // Set VIN if extracted and not already set
                          ...(extractedVin && !vehicleData.vehicle.vin ? { vin: extractedVin } : {}),
                        },
                        history: {
                          ...vehicleData.history,
                          ...result.history,
                          serviceRecords: true,
                        },
                      };
                      setVehicleData(updatedVehicleData);
                      // Update sessionStorage so re-analyze picks it up
                      sessionStorage.setItem("analysisData", JSON.stringify(updatedVehicleData));
                      sonnerToast.success("History report uploaded! Re-analyzing...");
                      // Trigger re-analysis with updated data
                      const { data: analysisResult, error: invokeError } = await supabase.functions.invoke("analyze-vehicle", {
                        body: updatedVehicleData,
                      });
                      if (invokeError) throw invokeError;
                      if (analysisResult?.success) {
                        setAnalysis(analysisResult.analysis);
                        if (analysisResult.mpgData) {
                          setMpgData({
                            mpgCity: analysisResult.mpgData.mpgCity,
                            mpgHighway: analysisResult.mpgData.mpgHighway,
                            mpgCombined: analysisResult.mpgData.mpgCombined,
                            fuelType: analysisResult.mpgData.fuelType,
                            evRange: analysisResult.mpgData.evRange ?? null,
                          });
                        }
                        if (analysisResult.pricingSources?.length) {
                          setPricingSources(analysisResult.pricingSources);
                          setPricingLastUpdated(new Date());
                        }
                        // Update saved report if applicable
                        if (isSavedReport && id) {
                          const { priceAssessment, depreciationTable, riskAssessment, historyAnalysis } = analysisResult.analysis;
                          await supabase.from("vehicle_reports").update({
                            fair_market_private: priceAssessment.fairMarketPrivate,
                            fair_market_dealer: priceAssessment.fairMarketDealer || null,
                            fair_market_trade_in: priceAssessment.fairMarketTradeIn,
                            deal_rating: priceAssessment.dealRating,
                            price_difference: priceAssessment.priceDifference,
                            risk_level: riskAssessment.level,
                            depreciation_risk: riskAssessment.depreciationRisk,
                            reliability_concerns: riskAssessment.reliabilityConcerns,
                            value_proposition: riskAssessment.valueProposition,
                            fair_offer_price: riskAssessment.fairOfferPrice,
                            expert_opinion: riskAssessment.expertOpinion,
                            health_score: historyAnalysis.healthScore,
                            history_issues: historyAnalysis.concerns || [],
                            history_positives: historyAnalysis.positives || [],
                            depreciation_table: depreciationTable as any,
                            has_service_records: true,
                            accident_count: result.history?.accidentCount ?? null,
                            owner_count: result.history?.ownerCount ?? null,
                            title_status: result.history?.titleStatus ?? null,
                            service_gap_miles: result.history?.serviceGapMiles ?? null,
                            major_services_due: result.history?.majorServicesDue ?? null,
                            major_services_done: result.history?.majorServicesDone ?? null,
                            chronic_repair_systems: result.history?.chronicRepairSystems ?? null,
                            ...(extractedVin ? { vin: extractedVin } : {}),
                            pricing_sources: analysisResult.pricingSources || [],
                            pricing_last_updated: new Date().toISOString(),
                          }).eq("id", id);
                        }
                        sonnerToast.success("Report updated with history data!");
                      } else {
                        throw new Error(analysisResult?.error || "Re-analysis failed");
                      }
                    } catch (err) {
                      console.error("History upload error:", err);
                      sonnerToast.error("Failed to process history report");
                    } finally {
                      setIsUploadingHistory(false);
                    }
                  }}
                />
              )}

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

              {/* Service History Timeline */}
              <ServiceHistoryTimeline
                serviceGapMiles={vehicleData?.history?.serviceGapMiles}
                majorServicesDue={vehicleData?.history?.majorServicesDue}
                majorServicesDone={vehicleData?.history?.majorServicesDone}
                chronicRepairSystems={vehicleData?.history?.chronicRepairSystems}
                hasServiceRecords={vehicleData?.history?.serviceRecords}
                mileage={condition.mileage}
              />

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
                        {riskAssessment.reliabilityConcerns.map((item, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <Wrench className="mt-0.5 h-3 w-3 shrink-0 text-warning" />
                            <span className="text-muted-foreground">
                              {item.concern}
                              {(item.costLow || item.costHigh) && (
                                <span className="ml-1 font-medium text-destructive">
                                  — Est. {item.costLow && item.costHigh 
                                    ? `$${item.costLow.toLocaleString()}–$${item.costHigh.toLocaleString()}`
                                    : item.costLow ? `$${item.costLow.toLocaleString()}+` 
                                    : `Up to $${item.costHigh!.toLocaleString()}`}
                                </span>
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="rounded-lg bg-muted p-4">
                      <p className="text-sm font-medium">Value Proposition</p>
                      <p className="text-sm text-muted-foreground">{riskAssessment.valueProposition}</p>
                    </div>

                    {/* Reliability Cost Sources */}
                    {pricingSources.length > 0 && (
                      <div className="mt-4 rounded-lg border border-dashed p-3">
                        <p className="text-xs font-medium text-muted-foreground mb-2">Cost Data Sources</p>
                        <div className="flex flex-wrap gap-2">
                          {(() => {
                            const seen = new Map<string, { displayName: string; url: string }>();
                            for (const url of pricingSources) {
                              try {
                                const hostname = new URL(url).hostname.replace("www.", "");
                                const domain = hostname.split(".")[0];
                                if (!seen.has(domain)) {
                                  seen.set(domain, {
                                    displayName: domain.charAt(0).toUpperCase() + domain.slice(1),
                                    url,
                                  });
                                }
                              } catch {
                                // skip
                              }
                            }
                            return Array.from(seen.values()).map(({ displayName, url }) => (
                              <a
                                key={displayName}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                              >
                                <ExternalLink className="h-3 w-3" />
                                {displayName}
                              </a>
                            ));
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Dealer Trust Analysis - Pro Feature */}
              <DealerReview
                dealerName={condition?.sellerName}
                listingUrl={condition?.listingUrl}
                sellerType={condition?.sellerType}
                isPro={isPro}
                onAnalysisComplete={setDealerAnalysis}
              />

              {/* Recommendation */}
              <Card className={cn(
                "border-2",
                uvprsResult
                  ? uvprsResult.riskLevel === "low" ? "border-success bg-success/5"
                    : uvprsResult.riskLevel === "moderate" ? "border-warning bg-warning/5"
                    : "border-danger bg-danger/5"
                  : riskAssessment.level === "low" ? "border-success bg-success/5"
                    : riskAssessment.level === "medium" ? "border-warning bg-warning/5"
                    : "border-danger bg-danger/5"
              )}>
                <CardContent className="p-6 text-center">
                  <Badge className={cn("mb-4",
                    uvprsResult
                      ? uvprsResult.riskLevel === "low" ? "bg-success text-success-foreground"
                        : uvprsResult.riskLevel === "moderate" ? "bg-warning text-warning-foreground"
                        : "bg-danger text-danger-foreground"
                      : riskLevelColors[riskAssessment.level]
                  )}>
                    {uvprsResult ? uvprsResult.riskLabel.toUpperCase() : `${riskAssessment.level.toUpperCase()} RISK`}
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
