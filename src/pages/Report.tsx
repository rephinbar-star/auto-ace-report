import { useEffect, useState, useRef } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
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
  ResponsiveContainer,
  ReferenceLine
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
  Settings,
  FileText,
  Upload,
  Download,
  Loader2,
  ArrowLeft,
  ExternalLink,
  BadgeCheck,
  Bot,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  ThumbsUp,
  ThumbsDown,
  HandCoins,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { RecallItem } from "@/lib/nhtsa";
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
import { FinancingStep } from "@/components/analysis/FinancingStep";
import type { FinancingInfo, AiFindings } from "@/types/vehicle";
import { cacheImages, getCachedUrls } from "@/lib/api/cache-images";
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
/** Synthesize AiFindings from legacy DB fields for reports saved before the aiFindings schema existed */
function synthesizeAiFindingsFromReport(report: any): AiFindings {
  const faults: import("@/types/vehicle").ActiveServiceFault[] = [];
  // Chronic repair systems → Class 4 faults
  if (report.chronic_repair_systems?.length) {
    for (const system of report.chronic_repair_systems) {
      faults.push({
        system,
        severityClass: 4,
        occurrences: 2,
        estimatedCostPerIncident: 2500,
        isAnomalous: false,
        withinTwoYearsOfPrior: true,
        description: `Chronic ${system} system issue identified in service history`,
      });
    }
  }
  // Reliability concerns → known failure patterns
  const patterns: import("@/types/vehicle").KnownFailurePattern[] = [];
  const concerns = Array.isArray(report.reliability_concerns) ? report.reliability_concerns : [];
  for (const c of concerns) {
    const concern = typeof c === "string" ? { concern: c } : c;
    const avgCost = ((concern.costLow ?? 1500) + (concern.costHigh ?? 3000)) / 2;
    patterns.push({
      issue: concern.concern || "Unknown concern",
      probabilityTier: avgCost > 2500 ? "high" : "medium",
      costTier: avgCost > 3000 ? "critical" : avgCost > 1500 ? "major" : "moderate",
      alreadyPresent: false,
      description: concern.concern || "",
    });
  }
  return {
    activeServiceFaults: faults,
    knownFailurePatterns: patterns,
    chassisSignal: {
      level: (report.chronic_repair_systems?.length ?? 0) > 0 ? 3 : 2,
      isProblemGeneration: false,
      isWorstGeneration: false,
      withinFailureWindow: false,
      description: "Estimated from legacy report data",
    },
  };
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
  warrantyAnalysis?: {
    warrantyStatus: "active" | "expired" | "unknown";
    warrantyMonthsRemaining?: number | null;
    riskReductionFactor: number;
    warrantyNotes: string;
  };
  finalVerdict?: {
    verdict: "Buy" | "Negotiate" | "Walk Away";
    justification: string;
  };
  aiFindings?: AiFindings;
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
  const isMobile = useIsMobile();
  const isPro = tier === "pro";
  const isPaid = tier === "premium" || tier === "pro";
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
  const detectedSellerTypeRef = useRef<string | null>(null);
  const [isSavedReport, setIsSavedReport] = useState(false);
  const [mpgData, setMpgData] = useState<{
    mpgCity: number | null;
    mpgHighway: number | null;
    mpgCombined: number | null;
    fuelType: string | null;
    evRange: number | null;
  } | null>(null);
  const [pricingSources, setPricingSources] = useState<string[]>([]);
  const [sourceBreakdown, setSourceBreakdown] = useState<Array<{
    source: string;
    privateParty?: number | null;
    privatePartyLow?: number | null;
    privatePartyHigh?: number | null;
    dealerRetail?: number | null;
    dealerRetailLow?: number | null;
    dealerRetailHigh?: number | null;
    tradeIn?: number | null;
    tradeInLow?: number | null;
    tradeInHigh?: number | null;
  }>>([]);
  const [pricingLastUpdated, setPricingLastUpdated] = useState<Date | null>(null);
  const [isRefreshingPricing, setIsRefreshingPricing] = useState(false);
  const [uvprsResult, setUvprsResult] = useState<UVPRSResult | null>(null);
  const [isUploadingHistory, setIsUploadingHistory] = useState(false);
  const [recallData, setRecallData] = useState<{
    count: number;
    openCount: number;
    recalls: RecallItem[];
    isLoading: boolean;
  } | null>(null);
  const [showFinancingDialog, setShowFinancingDialog] = useState(false);
  
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
        seller_type: detectedSellerTypeRef.current || condition.sellerType,
        zip_code: condition.zipCode || null,
        financing_type: financing.type,
        loan_amount: financing.loanAmount || null,
        loan_term: financing.loanTerm || null,
        apr: financing.apr || null,
        monthly_payment: financing.monthlyPayment || null,
        lease_term_months: financing.leaseTermMonths || null,
        residual_value: financing.residualValue || null,
        negotiated_price: financing.negotiatedPrice && financing.negotiatedPrice !== condition.askingPrice ? financing.negotiatedPrice : null,
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
        source_breakdown: sourceBreakdown.length > 0 ? sourceBreakdown : [],
        risk_score: uvprsResult?.totalScore ?? null,
        is_cpo: condition.isCPO || false,
        warranty_months_remaining: history?.warrantyMonthsRemaining ?? null,
        warranty_status: analysis.warrantyAnalysis?.warrantyStatus || null,
        warranty_risk_reduction: analysis.warrantyAnalysis?.riskReductionFactor ?? null,
        warranty_notes: analysis.warrantyAnalysis?.warrantyNotes || null,
        final_verdict: analysis.finalVerdict?.verdict || null,
        final_verdict_justification: analysis.finalVerdict?.justification || null,
        ai_findings: (analysis.aiFindings as any) ?? null,
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
              engineSize: report.engine_size,
              transmission: report.transmission,
              drivetrain: report.drivetrain,
              fuelType: report.fuel_type,
              bodyStyle: report.body_style,
            },
            condition: {
              mileage: report.mileage,
              askingPrice: report.asking_price,
              condition: report.condition,
              sellerType: report.seller_type,
              zipCode: report.zip_code || undefined,
              images: report.listing_images,
              isCPO: report.is_cpo || false,
            },
            financing: {
              type: report.financing_type,
              loanAmount: report.loan_amount,
              loanTerm: report.loan_term,
              apr: report.apr,
              monthlyPayment: report.monthly_payment,
              leaseTermMonths: report.lease_term_months,
              residualValue: report.residual_value,
              negotiatedPrice: report.negotiated_price ?? undefined,
              skipped: report.financing_type === 'cash' && !report.loan_amount && !report.apr && !report.monthly_payment,
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
              warrantyMonthsRemaining: report.warranty_months_remaining ?? null,
              isCPO: report.is_cpo || false,
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
            ...(report.warranty_status ? {
              warrantyAnalysis: {
                warrantyStatus: report.warranty_status as "active" | "expired" | "unknown",
                warrantyMonthsRemaining: report.warranty_months_remaining ?? null,
                riskReductionFactor: report.warranty_risk_reduction ?? 0,
                warrantyNotes: report.warranty_notes || "",
              },
            } : {}),
            ...(report.final_verdict ? {
              finalVerdict: {
                verdict: report.final_verdict as "Buy" | "Negotiate" | "Walk Away",
                justification: report.final_verdict_justification || "",
              },
            } : {}),
            ...(report.ai_findings ? {
              aiFindings: report.ai_findings as unknown as AiFindings,
            } : {
              // Synthesize aiFindings from legacy DB fields for older reports
              aiFindings: synthesizeAiFindingsFromReport(report),
            }),
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
          if (report.source_breakdown && Array.isArray(report.source_breakdown) && report.source_breakdown.length > 0) {
            setSourceBreakdown(report.source_breakdown as any);
          }
          
          // Enrich with NeoVIN specs if VIN is available and specs are sparse
          if (report.vin && !report.engine_size && !report.transmission) {
            supabase.functions.invoke("decode-vin-specs", {
              body: { vin: report.vin },
            }).then(({ data: specsResult }) => {
              if (specsResult?.success && specsResult.data) {
                const d = specsResult.data;
                // Guard: if decoded make doesn't match report make, VIN is wrong — skip enrichment
                const decodedMake = (d.make || "").toLowerCase().trim();
                const reportMake = (report.make || "").toLowerCase().trim();
                if (decodedMake && reportMake && decodedMake !== reportMake) {
                  console.warn(`VIN ${report.vin} decodes to ${d.make} but report is ${report.make} — skipping spec enrichment`);
                  return;
                }
                setVehicleData((prev: any) => ({
                  ...prev,
                  vehicle: {
                    ...prev.vehicle,
                    engine: d.engine || prev.vehicle.engine,
                    engineSize: d.engineSize || prev.vehicle.engineSize,
                    engineHp: d.engineHp || prev.vehicle.engineHp,
                    engineTorque: d.engineTorque || prev.vehicle.engineTorque,
                    engineCylinders: d.engineCylinders || prev.vehicle.engineCylinders,
                    engineAspiration: d.engineAspiration || prev.vehicle.engineAspiration,
                    msrp: d.msrp || prev.vehicle.msrp,
                    transmission: d.transmission || prev.vehicle.transmission,
                    drivetrain: d.drivetrain || prev.vehicle.drivetrain,
                    bodyStyle: d.bodyStyle || prev.vehicle.bodyStyle,
                    exteriorColor: d.exteriorColor || prev.vehicle.exteriorColor,
                    interiorColor: d.interiorColor || prev.vehicle.interiorColor,
                    installedEquipment: d.installedEquipment || [],
                    categorizedEquipment: d.categorizedEquipment || null,
                    optionPackages: d.optionPackages || [],
                    trim: d.trim || prev.vehicle.trim,
                  },
                }));
              }
            }).catch(console.error);
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
          console.log("AI aiFindings returned:", JSON.stringify(result.analysis?.aiFindings ?? "MISSING"));
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
          if (result.sourceBreakdown?.length) {
            setSourceBreakdown(result.sourceBreakdown);
          }
           // Update seller type if API detected franchise/independent
          if (result.detectedSellerType && vehicleData) {
            detectedSellerTypeRef.current = result.detectedSellerType;
            setVehicleData(prev => prev ? {
              ...prev,
              condition: { ...prev.condition, sellerType: result.detectedSellerType }
            } : prev);
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

  // Auto-save new reports once analysis completes
  const hasAutoSaved = useRef(false);
  useEffect(() => {
    if (!analysis || !vehicleData || isSavedReport || hasAutoSaved.current) return;
    hasAutoSaved.current = true;
    handleSaveReport(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysis, vehicleData, isSavedReport]);

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
      let recallItems: RecallItem[] = [];
      
      // Set loading state
      setRecallData({ count: 0, openCount: 0, recalls: [], isLoading: true });
      
      try {
        const recallResult = await lookupRecalls(vehicle.year, vehicle.make, vehicle.model);
        nhtsaTotalRecalls = recallResult.count;
        recallItems = recallResult.recalls;
        const resolved = resolvedRecallCount ?? 0;
        // Open = NHTSA total minus CarFax-confirmed resolved (floor at 0)
        openRecallCount = Math.max(0, nhtsaTotalRecalls - resolved);
        
        setRecallData({
          count: nhtsaTotalRecalls,
          openCount: openRecallCount,
          recalls: recallItems,
          isLoading: false,
        });
      } catch {
        // If NHTSA fails, fall back to CarFax-only data
        openRecallCount = history?.openRecallCount ?? null;
        setRecallData({ count: 0, openCount: 0, recalls: [], isLoading: false });
      }

      // Detect frame damage from history issues
      const issueTexts = (historyAnalysis?.concerns ?? history?.issues ?? []).map((s: string) => s.toLowerCase());
      const hasFrameDamage = issueTexts.some((i: string) => i.includes("frame") || i.includes("structural"));

      // Map seller type (vehicleData.condition.sellerType may already be refined by API detection)
      const rawSeller = vehicle.sellerType || condition?.sellerType;
      const sellerType = condition?.isCPO || history?.isCPO
        ? "cpo" as const
        : rawSeller === "private" ? "private" as const
        : rawSeller === "franchise" ? "franchise" as const
        : rawSeller === "independent" ? "independent" as const
        : rawSeller === "dealer" ? "dealer" as const
        : rawSeller ? "dealer" as const
        : null;

      console.log("[UVPRS-DEBUG] aiFindings input:", JSON.stringify(analysis.aiFindings, null, 2));
      console.log("[UVPRS-DEBUG] chronicRepairSystems:", history?.chronicRepairSystems);
      const result = calculateUVPRS({
        year: vehicle.year,
        make: vehicle.make,
        mileage: condition.mileage,
        askingPrice: vehicleData.financing?.negotiatedPrice ?? condition.askingPrice,
        titleStatus: history?.titleStatus || null,
        accidentCount: history?.accidentCount ?? null,
        ownerCount: history?.ownerCount ?? null,
        hasFrameDamage,
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
        sellerType,
        isBrandNew: condition?.isBrandNew ?? null,
        aiFindings: analysis.aiFindings ?? null,
      });
      console.log("[UVPRS-DEBUG] result:", result.totalScore, result.factors.map(f => `${f.key}=${f.score}(known=${f.known})`));
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
        // Preserve existing pricing if new analysis returned $0 values
        const newAnalysis = result.analysis;
        if (analysis && newAnalysis.priceAssessment && 
            !(newAnalysis.priceAssessment.fairMarketPrivate > 0 || newAnalysis.priceAssessment.fairMarketDealer > 0)) {
          newAnalysis.priceAssessment = { ...newAnalysis.priceAssessment, ...analysis.priceAssessment };
        }
        console.log("Refresh aiFindings returned:", JSON.stringify(newAnalysis?.aiFindings ?? "MISSING"));
        setAnalysis(newAnalysis);
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
        if (result.sourceBreakdown?.length) {
          setSourceBreakdown(result.sourceBreakdown);
        }
        // Update seller type if API detected franchise/independent
        if (result.detectedSellerType) {
          setVehicleData(prev => prev ? {
            ...prev,
            condition: { ...prev.condition, sellerType: result.detectedSellerType }
          } : prev);
        }
        const now = new Date();
        setPricingLastUpdated(now);
        sonnerToast.success("Analysis refreshed with latest market data");

        // Persist to DB if this is a saved report
        if (isSavedReport && id) {
          const { priceAssessment, depreciationTable, riskAssessment, historyAnalysis } = result.analysis;
          const pricingUpdate: Record<string, any> = {
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
            source_breakdown: result.sourceBreakdown || [],
            ...(result.detectedSellerType ? { seller_type: result.detectedSellerType } : {}),
            ...(result.analysis.aiFindings ? { ai_findings: result.analysis.aiFindings } : {}),
          };
          // Only overwrite pricing if the new values are non-zero
          if (priceAssessment.fairMarketPrivate > 0 || priceAssessment.fairMarketDealer > 0) {
            pricingUpdate.fair_market_private = priceAssessment.fairMarketPrivate;
            pricingUpdate.fair_market_dealer = priceAssessment.fairMarketDealer || null;
            pricingUpdate.fair_market_trade_in = priceAssessment.fairMarketTradeIn;
          }
          await supabase.from("vehicle_reports").update(pricingUpdate).eq("id", id);
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
  const { priceAssessment, depreciationTable: rawDepreciationTable, riskAssessment, historyAnalysis } = analysis;

  // Recompute loan balances using proper amortization math instead of AI-generated values
  const depreciationTable = (() => {
    const principal = financing?.loanAmount;
    const apr = financing?.apr;
    const termMonths = financing?.loanTerm;
    if (!principal || !apr || !termMonths || financing?.skipped) return rawDepreciationTable;

    const r = apr / 12 / 100;
    const n = termMonths;
    const pmt = r > 0
      ? principal * r / (1 - Math.pow(1 + r, -n))
      : principal / n;

    return rawDepreciationTable.map((row) => {
      const k = Math.min(row.year * 12, n);
      let balance: number;
      if (r > 0) {
        balance = principal * Math.pow(1 + r, k) - pmt * ((Math.pow(1 + r, k) - 1) / r);
      } else {
        balance = principal - pmt * k;
      }
      return { ...row, loanBalance: Math.max(0, Math.round(balance)) };
    });
  })();

  const handleDownloadPDF = async () => {
    setIsDownloading(true);
    try {
      // Cache images through our backend to avoid CORS issues
      let pdfImages = condition.images as string[] | undefined;
      if (pdfImages && pdfImages.length > 0) {
        try {
          const cacheResult = await cacheImages(pdfImages);
          if (cacheResult.success && cacheResult.images) {
            pdfImages = getCachedUrls(cacheResult);
          }
        } catch (e) {
          console.warn("Image caching failed, using original URLs:", e);
        }
      }

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
        images: pdfImages,
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
          const effectivePrice = financing.negotiatedPrice ?? condition.askingPrice;
          const tco = calculateTCO(
            effectivePrice,
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
        warrantyAnalysis: analysis.warrantyAnalysis,
        finalVerdict: analysis.finalVerdict,
        recallData: recallData && !recallData.isLoading ? {
          count: recallData.count,
          openCount: recallData.openCount,
          recalls: recallData.recalls,
        } : undefined,
        vin: vehicle.vin || undefined,
      });
      sonnerToast.success("PDF downloaded successfully!");
    } catch (error) {
      sonnerToast.error("Failed to generate PDF");
      console.error(error);
    } finally {
      setIsDownloading(false);
    }
  };


  const riskLevelColors = {
    low: "bg-success text-success-foreground",
    medium: "bg-warning text-warning-foreground",
    high: "bg-danger text-danger-foreground",
  };

  const financingSkipped = financing?.skipped === true;

  const purchasePrice = financing?.negotiatedPrice ?? condition.askingPrice;

  const chartData = depreciationTable.map((row) => ({
    name: `Year ${row.year}`,
    "Private Value": row.privateValue,
    "Trade-In Value": row.tradeInValue,
    "Purchase Price": purchasePrice,
    ...(financingSkipped ? {} : { "Loan Balance": row.loanBalance }),
  }));

  return (
    <div className={cn("flex min-h-screen flex-col", isMobile && "force-mobile")}>
      <Header />
      
      <main className="flex-1 bg-gradient-hero py-8">
        <div className="container mx-auto max-w-6xl px-4 overflow-x-hidden">
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
          <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold">
                {vehicle.year} {vehicle.make} {vehicle.model}
              </h1>
              <p className="text-muted-foreground">
                {vehicle.vin && <>VIN# {vehicle.vin} • </>}{condition.mileage.toLocaleString()} miles • Asking ${condition.askingPrice.toLocaleString()}
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
                  e.target.value = "";
                  setIsRefreshingPricing(true);
                  try {
                    const mileage = vehicleData?.condition?.mileage;
                    const result = await parseHistoryReport(file, undefined, mileage);
                    if (!result.success || !result.history) {
                      sonnerToast.error(result.error || "Failed to parse history report");
                      return;
                    }
                    // Only use extracted VIN if report has no VIN yet AND it looks like it matches
                    const existingVin = vehicleData.vehicle.vin;
                    const extractedVin = result.history.vin;
                    const shouldSetVin = !existingVin && extractedVin;
                    const updatedVehicleData = {
                      ...vehicleData,
                      vehicle: {
                        ...vehicleData.vehicle,
                        ...(shouldSetVin ? { vin: extractedVin } : {}),
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
                      const newAn1 = analysisResult.analysis;
                      if (analysis && newAn1.priceAssessment &&
                          !(newAn1.priceAssessment.fairMarketPrivate > 0 || newAn1.priceAssessment.fairMarketDealer > 0)) {
                        newAn1.priceAssessment = { ...newAn1.priceAssessment, ...analysis.priceAssessment };
                      }
                      setAnalysis(newAn1);
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
                      if (analysisResult.sourceBreakdown?.length) {
                        setSourceBreakdown(analysisResult.sourceBreakdown);
                      }
                      if (isSavedReport && id) {
                        const histUpd: Record<string, any> = {
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
                          pricing_sources: analysisResult.pricingSources || [],
                          pricing_last_updated: new Date().toISOString(),
                          source_breakdown: analysisResult.sourceBreakdown || [],
                          ...(shouldSetVin ? { vin: extractedVin } : {}),
                        };
                        if (priceAssessment.fairMarketPrivate > 0 || priceAssessment.fairMarketDealer > 0) {
                          histUpd.fair_market_private = priceAssessment.fairMarketPrivate;
                          histUpd.fair_market_dealer = priceAssessment.fairMarketDealer || null;
                          histUpd.fair_market_trade_in = priceAssessment.fairMarketTradeIn;
                        }
                        await supabase.from("vehicle_reports").update(histUpd).eq("id", id);
                      }
                      sonnerToast.success("Analysis updated with history data!");
                    } else {
                      throw new Error(analysisResult?.error || "Re-analysis failed");
                    }
                  } catch (err) {
                    console.error("History upload error:", err);
                    sonnerToast.error("Failed to re-analyze with history report");
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

          {/* Non-Standard Options Card */}



          {/* Vehicle Specifications Card - specs always visible, equipment collapsible */}
          <Card className="mb-4">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Settings className="h-5 w-5 text-primary" />
                Vehicle Specifications
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-0">
              <div className="flex flex-col gap-4">
                {/* MSRP highlight */}
                {vehicle.msrp && (
                  <div className="flex items-center gap-2 text-sm">
                    <DollarSign className="h-4 w-4 text-primary" />
                    <span className="text-muted-foreground">Original MSRP:</span>
                    <span className="font-semibold">${Number(vehicle.msrp).toLocaleString()}</span>
                  </div>
                )}

                {/* Basic specs grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {(vehicle.engine || vehicle.engineSize) && (
                    <div className="flex items-center gap-2 text-sm">
                      <Settings className="h-4 w-4 text-muted-foreground" />
                      <span>{vehicle.engine || vehicle.engineSize}</span>
                    </div>
                  )}
                  {vehicle.engineHp && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">HP:</span>{" "}
                      <span className="font-medium">{vehicle.engineHp}</span>
                    </div>
                  )}
                  {vehicle.engineTorque && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Torque:</span>{" "}
                      <span className="font-medium">{vehicle.engineTorque} lb-ft</span>
                    </div>
                  )}
                  {vehicle.engineCylinders && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Cylinders:</span>{" "}
                      <span className="font-medium">{vehicle.engineCylinders}</span>
                    </div>
                  )}
                  {vehicle.transmission && (
                    <div className="flex items-center gap-2 text-sm">
                      <Wrench className="h-4 w-4 text-muted-foreground" />
                      <span>{vehicle.transmission}</span>
                    </div>
                  )}
                  {vehicle.drivetrain && (
                    <div className="flex items-center gap-2 text-sm">
                      <Car className="h-4 w-4 text-muted-foreground" />
                      <span>{vehicle.drivetrain}</span>
                    </div>
                  )}
                  {vehicle.fuelType && (
                    <div className="flex items-center gap-2 text-sm">
                      <Gauge className="h-4 w-4 text-muted-foreground" />
                      <span>{vehicle.fuelType}</span>
                    </div>
                  )}
                  {vehicle.exteriorColor && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Ext:</span>{" "}
                      <span>{vehicle.exteriorColor}</span>
                    </div>
                  )}
                  {vehicle.interiorColor && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Int:</span>{" "}
                      <span>{vehicle.interiorColor}</span>
                    </div>
                  )}
                  {vehicle.bodyStyle && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Body:</span>{" "}
                      <span>{vehicle.bodyStyle}</span>
                    </div>
                  )}
                  {vehicle.trim && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Trim:</span>{" "}
                      <span className="font-medium">{vehicle.trim}</span>
                    </div>
                  )}
                </div>

                {/* Non-Standard Options & Packages */}
                {vehicle.optionPackages && vehicle.optionPackages.length > 0 && (
                  <div className="border-t pt-3">
                    <div className="flex items-center gap-2 mb-2">
                      <BadgeCheck className="h-4 w-4 text-primary" />
                      <p className="text-sm font-semibold">Non-Standard Options &amp; Packages</p>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">Factory-installed options and premium packages beyond standard equipment</p>
                    <div className="flex flex-wrap gap-2">
                      {vehicle.optionPackages.map((pkg: any, i: number) => {
                        const label = typeof pkg === "string" ? pkg : pkg?.name || String(pkg);
                        return (
                          <Badge key={i} variant="outline" className="text-sm px-3 py-1">
                            {label}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                )}

                {vehicle.installedEquipment && vehicle.installedEquipment.length > 0 && (
                  <Collapsible defaultOpen={false}>
                    <div className="border-t pt-3">
                      <CollapsibleTrigger className="flex w-full items-center justify-between text-left hover:opacity-80 transition-opacity">
                        <p className="text-sm font-semibold">Standard Equipment</p>
                        <svg className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 [[data-state=open]>&]:rotate-180" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2">
                        {(vehicle as any).categorizedEquipment && Object.keys((vehicle as any).categorizedEquipment).length > 0 ? (
                          <div className="space-y-3">
                            {Object.entries((vehicle as any).categorizedEquipment as Record<string, string[]>).sort(([a], [b]) => a.localeCompare(b)).map(([category, items]) => (
                              <div key={category}>
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{category}</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {items.map((item: string, i: number) => (
                                    <Badge key={i} variant="secondary" className="text-xs font-normal">
                                      {item}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {vehicle.installedEquipment.map((item: any, i: number) => {
                              const label = typeof item === "string" ? item : item?.name || String(item);
                              return (
                                <Badge key={i} variant="secondary" className="text-xs font-normal">
                                  {label}
                                </Badge>
                              );
                            })}
                          </div>
                        )}
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Financing Details CTA - always shown for what-if scenarios */}
          <>
            <button
              onClick={() => setShowFinancingDialog(true)}
              className="w-full mb-4 flex items-center justify-center gap-3 rounded-xl border-2 border-dashed border-blue-400/50 bg-blue-50 hover:bg-blue-100 hover:border-blue-500/70 dark:bg-blue-950/30 dark:hover:bg-blue-950/50 dark:border-blue-500/40 px-6 py-5 text-base font-semibold text-blue-600 dark:text-blue-400 transition-colors"
            >
              <DollarSign className="h-5 w-5" />
               Add or Edit Financing Details to Explore Your True Cost of Ownership and Break-Even Timing with your Financing
            </button>

            <Dialog open={showFinancingDialog} onOpenChange={setShowFinancingDialog}>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
                <VisuallyHidden>
                  <DialogTitle>{financingSkipped ? "Add" : "Edit"} Financing Details</DialogTitle>
                </VisuallyHidden>
                <div className="p-1">
                  <FinancingStep
                    askingPrice={condition.askingPrice}
                    zipCode={condition.zipCode}
                    onBack={() => setShowFinancingDialog(false)}
                    onComplete={async (newFinancing: FinancingInfo) => {
                      setShowFinancingDialog(false);

                      // Recalculate loan balances in the depreciation table using amortization
                      const updatedDepTable = (() => {
                        const table = analysis.depreciationTable;
                        if (!table || !newFinancing.loanAmount || !newFinancing.loanTerm) return table;

                        const P = newFinancing.loanAmount;
                        const monthlyRate = ((newFinancing.apr || 0) / 100) / 12;
                        const totalMonths = newFinancing.loanTerm;

                        const monthlyPmt = monthlyRate > 0
                          ? P * (monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) / (Math.pow(1 + monthlyRate, totalMonths) - 1)
                          : P / totalMonths;

                        const balanceAfter = (months: number) => {
                          if (months >= totalMonths) return 0;
                          if (monthlyRate > 0) {
                            return P * Math.pow(1 + monthlyRate, months) - monthlyPmt * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
                          }
                          return Math.max(0, P - monthlyPmt * months);
                        };

                        return table.map((row) => ({
                          ...row,
                          loanBalance: Math.max(0, Math.round(balanceAfter(row.year * 12))),
                        }));
                      })();

                      // Update local state — chart & table re-render immediately
                      setVehicleData((prev: any) => ({
                        ...prev,
                        financing: newFinancing,
                      }));
                      setAnalysis((prev) => prev ? {
                        ...prev,
                        depreciationTable: updatedDepTable,
                      } : prev);

                      // Persist to DB
                      if (isSavedReport && id) {
                        await supabase.from("vehicle_reports").update({
                          financing_type: newFinancing.type,
                          loan_amount: newFinancing.loanAmount || null,
                          loan_term: newFinancing.loanTerm || null,
                          apr: newFinancing.apr || null,
                          monthly_payment: newFinancing.monthlyPayment || null,
                          lease_term_months: newFinancing.leaseTermMonths || null,
                          residual_value: newFinancing.residualValue || null,
                          negotiated_price: newFinancing.negotiatedPrice && newFinancing.negotiatedPrice !== condition.askingPrice ? newFinancing.negotiatedPrice : null,
                          depreciation_table: updatedDepTable as any,
                        }).eq("id", id);
                      }
                    }}
                  />
                </div>
              </DialogContent>
            </Dialog>
          </>

          {/* Negotiated Savings Banner */}
          {(() => {
            const negotiated = financing?.negotiatedPrice;
            const asking = condition?.askingPrice;
            if (!negotiated || !asking || negotiated >= asking) return null;
            const saved = asking - negotiated;
            const pct = ((saved / asking) * 100).toFixed(1);
            return (
              <div className="mb-4 flex items-center gap-3 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-500/20">
                  <HandCoins className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-green-700 dark:text-green-400">
                    You negotiated ${saved.toLocaleString()} off the asking price
                  </p>
                  <p className="text-xs text-green-600/80 dark:text-green-500/80">
                    Paying ${negotiated.toLocaleString()} instead of ${asking.toLocaleString()} — a {pct}% discount. Deal rating and TCO reflect your negotiated price.
                  </p>
                </div>
              </div>
            );
          })()}

          <div className="grid gap-8 lg:grid-cols-3 min-w-0">
            {/* Left Column - Main Content */}
            <div className="space-y-8 lg:col-span-2 min-w-0">
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
                  <div className="space-y-6">
                    {/* Price vs. Market visualization */}
                    {(() => {
                      const low = priceAssessment.fairMarketTradeIn;
                      const high = (priceAssessment.fairMarketDealer || priceAssessment.fairMarketPrivate) * 1.15;
                      const range = high - low || 1;

                      const hasMarketData = (priceAssessment.fairMarketPrivate > 0 || (priceAssessment.fairMarketDealer ?? 0) > 0);

                      return (
                        <div className="space-y-4">
                          <div>
                            <h3 className="text-lg font-semibold">Price vs. Market</h3>
                            {hasMarketData ? (
                              <p className="mt-1 text-sm text-muted-foreground">
                                Asking price is{" "}
                                <span className={cn("font-semibold", priceAssessment.priceDifference > 0 ? "text-danger" : "text-success")}>
                                  {priceAssessment.priceDifference > 0 ? "$" + Math.abs(priceAssessment.priceDifference).toLocaleString() + " above" : "$" + Math.abs(priceAssessment.priceDifference).toLocaleString() + " below"}
                                </span>
                                {" "}Dealer Retail
                                {priceAssessment.fairMarketPrivate > 0 && (() => {
                                  const fmvDiff = condition.askingPrice - priceAssessment.fairMarketPrivate;
                                  return (
                                    <>
                                      {" "}and{" "}
                                      <span className={cn("font-semibold", fmvDiff > 0 ? "text-danger" : "text-success")}>
                                        {"$" + Math.abs(fmvDiff).toLocaleString() + (fmvDiff > 0 ? " above" : " below")}
                                      </span>
                                      {" "}Fair Market Value
                                    </>
                                  );
                                })()}
                                .
                              </p>
                            ) : (
                              <p className="mt-1 text-sm text-muted-foreground">
                                Market pricing data is not available for this vehicle.
                              </p>
                            )}
                          </div>

                          {/* Price bar visualization */}
                          {(() => {
                            if (!hasMarketData) {
                              // No market data — show simplified asking price only
                              return (
                                <div className="relative pt-14 pb-4 mt-2">
                                  <div className="absolute top-0 right-4 flex flex-col items-center">
                                    <p className="text-[10px] text-muted-foreground text-center mb-0.5">Asking Price</p>
                                    <div className="rounded-lg border bg-card px-3 py-1.5 text-sm font-bold shadow-sm whitespace-nowrap">
                                      ${condition.askingPrice.toLocaleString()}
                                    </div>
                                  </div>
                                  <div className="relative h-2.5 w-full">
                                    <div className="absolute inset-0 rounded-full overflow-hidden">
                                      <div className="absolute inset-0 rounded-full bg-muted" />
                                    </div>
                                    <div className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: "85%", top: "50%" }}>
                                      <div className="h-5 w-5 rounded-full border-[3px] border-warning bg-background shadow-md" />
                                    </div>
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-3 text-center">Market comparison unavailable — only asking price is shown.</p>
                                </div>
                              );
                            }

                            // Build markers array for all values on the bar
                            const fairMarketValue = condition.sellerType === "dealer"
                              ? (priceAssessment.fairMarketDealer || priceAssessment.fairMarketPrivate)
                              : priceAssessment.fairMarketPrivate;
                            const markers: { label: string; value: number; isAsking?: boolean; isFairMarket?: boolean }[] = [];
                            if (priceAssessment.fairMarketTradeIn > 0) {
                              markers.push({ label: "Trade-In", value: priceAssessment.fairMarketTradeIn });
                            }
                            if (fairMarketValue > 0) {
                              markers.push({ label: "Fair Market Value", value: fairMarketValue, isFairMarket: true });
                            }
                            if (priceAssessment.fairMarketDealer && priceAssessment.fairMarketDealer > 0 && condition.sellerType !== "dealer") {
                              markers.push({ label: "Dealer Retail", value: priceAssessment.fairMarketDealer });
                            }
                            if (condition.sellerType === "dealer" && priceAssessment.fairMarketPrivate > 0) {
                              markers.push({ label: "Private Sale", value: priceAssessment.fairMarketPrivate });
                            }
                            markers.push({ label: "Asking Price", value: condition.askingPrice, isAsking: true });

                            // Anchor gradient to actual values
                            const tradeInVal = priceAssessment.fairMarketTradeIn > 0 ? priceAssessment.fairMarketTradeIn : fairMarketValue * 0.85;
                            const fmvVal = fairMarketValue;
                            const barMin = tradeInVal * 0.90;
                            const barMax = fmvVal * 1.35;
                            const barRange = barMax - barMin || 1;
                            const toPct = (v: number) => Math.max(5, Math.min(92, ((v - barMin) / barRange) * 100));

                            const fmvPct = toPct(fmvVal);

                            return (
                              <>
                                {/* Desktop: horizontal gradient bar */}
                                 <div className={cn("relative pb-14 mt-2", financing?.negotiatedPrice && financing.negotiatedPrice !== condition.askingPrice ? "pt-24" : "pt-14")}>
                                   {/* Asking price floating label */}
                                   {(() => {
                                     const askPct = toPct(condition.askingPrice);
                                     const hasNegotiated = !!(financing?.negotiatedPrice && financing.negotiatedPrice !== condition.askingPrice);
                                     const clampStyle = askPct > 80
                                       ? { left: `${askPct}%`, transform: "translateX(-80%)" }
                                       : askPct < 20
                                         ? { left: `${askPct}%`, transform: "translateX(-20%)" }
                                         : { left: `${askPct}%`, transform: "translateX(-50%)" };
                                     const topStyle = hasNegotiated ? { top: "2.5rem" } : { top: 0 };
                                     return (
                                       <div className="absolute flex flex-col items-center" style={{ ...clampStyle, ...topStyle }}>
                                         <p className="text-[10px] text-muted-foreground text-center mb-0.5">Asking Price</p>
                                         <div className="rounded-lg border bg-card px-3 py-1.5 text-sm font-bold shadow-sm whitespace-nowrap">
                                           ${condition.askingPrice.toLocaleString()}
                                         </div>
                                       </div>
                                     );
                                   })()}

                                   {/* Negotiated price floating label */}
                                   {financing?.negotiatedPrice && financing.negotiatedPrice !== condition.askingPrice && (() => {
                                     const negPct = toPct(financing.negotiatedPrice);
                                     const clampStyle = negPct > 80
                                       ? { left: `${negPct}%`, transform: "translateX(-80%)" }
                                       : negPct < 20
                                         ? { left: `${negPct}%`, transform: "translateX(-20%)" }
                                         : { left: `${negPct}%`, transform: "translateX(-50%)" };
                                     return (
                                       <div className="absolute top-0 flex flex-col items-center" style={{ ...clampStyle, bottom: "3.5rem" }}>
                                         <p className="text-[10px] text-success text-center mb-0.5 font-medium">Negotiated Price</p>
                                         <div className="rounded-lg border border-success/40 bg-success/10 px-3 py-1.5 text-sm font-bold shadow-sm whitespace-nowrap text-success">
                                           ${financing.negotiatedPrice.toLocaleString()}
                                         </div>
                                         <div className="flex-1 mt-1 w-px bg-success/60" />
                                       </div>
                                     );
                                   })()}

                                  {/* Gradient bar + dots */}
                                  <div className="relative h-2.5 w-full">
                                    <div className="absolute inset-0 rounded-full overflow-hidden">
                                      <div className="absolute inset-0 rounded-full" style={{
                                        background: `linear-gradient(to right, hsl(145 60% 36%) 0%, hsl(var(--success)) ${fmvPct * 0.5}%, hsl(var(--success)) ${fmvPct}%, hsl(var(--warning)) ${fmvPct + (100 - fmvPct) * 0.6}%, hsl(var(--danger)) 100%)`
                                      }} />
                                    </div>
                                     {/* Asking price dot */}
                                     {(() => {
                                       const askPct = toPct(condition.askingPrice);
                                       return (
                                         <div
                                           className="absolute -translate-x-1/2 -translate-y-1/2"
                                           style={{ left: `${askPct}%`, top: "50%" }}
                                         >
                                           <div className="h-5 w-5 rounded-full border-[3px] border-warning bg-background shadow-md" />
                                         </div>
                                       );
                                     })()}
                                     {/* Negotiated price dot */}
                                     {financing?.negotiatedPrice && financing.negotiatedPrice !== condition.askingPrice && (() => {
                                       const negPct = toPct(financing.negotiatedPrice);
                                       return (
                                         <div
                                           className="absolute -translate-x-1/2 -translate-y-1/2"
                                           style={{ left: `${negPct}%`, top: "50%" }}
                                         >
                                           <div className="h-5 w-5 rounded-full border-[3px] border-success bg-background shadow-md" />
                                         </div>
                                       );
                                     })()}
                                  </div>

                                  {/* Desktop markers — only non-asking, non-zero */}
                                  <div className="relative mt-5">
                                    {markers.filter(m => !m.isAsking).map((m) => {
                                      const mPct = toPct(m.value);
                                      const markerStyle = mPct > 85
                                        ? { left: `${mPct}%`, transform: "translateX(-90%)" }
                                        : mPct < 15
                                          ? { left: `${mPct}%`, transform: "translateX(-10%)" }
                                          : { left: `${mPct}%`, transform: "translateX(-50%)" };
                                      const textAlign = mPct > 85 ? "text-right" : mPct < 15 ? "text-left" : "text-center";
                                      return (
                                        <div
                                          key={m.label}
                                          className={cn("absolute", textAlign)}
                                          style={markerStyle}
                                        >
                                          <div className={cn("mb-0.5 h-2.5 w-px", m.isFairMarket ? "bg-primary" : "bg-muted-foreground/40", mPct > 85 ? "ml-auto" : mPct < 15 ? "" : "mx-auto")} />
                                          <p className={cn("text-[10px] leading-tight whitespace-nowrap", m.isFairMarket ? "font-medium text-primary" : "text-muted-foreground")}>{m.label}</p>
                                          <p className={cn("text-xs font-semibold whitespace-nowrap", m.isFairMarket && "text-primary")}>${m.value.toLocaleString()}</p>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>

                              </>
                            );
                          })()}

                        </div>
                      );
                    })()}

                    {/* Pricing Sources */}
                    {pricingSources.length > 0 && (
                      <div className="rounded-lg border border-dashed p-3 space-y-3">
                        <p className="text-xs font-medium text-muted-foreground mb-2">Pricing Sources</p>
                        
                        {/* Per-source valuation breakdown */}
                        {sourceBreakdown.length > 0 && (
                          <div className="space-y-2">
                            {sourceBreakdown.map((src) => {
                              const fmt = (v?: number | null) => v ? `$${v.toLocaleString()}` : null;
                              const range = (low?: number | null, high?: number | null, mid?: number | null) => {
                                if (low && high) return `$${low.toLocaleString()} – $${high.toLocaleString()}`;
                                if (mid) return `$${mid.toLocaleString()}`;
                                return null;
                              };
                              const privateVal = range(src.privatePartyLow, src.privatePartyHigh, src.privateParty);
                              const dealerVal = range(src.dealerRetailLow, src.dealerRetailHigh, src.dealerRetail);
                              const tradeInVal = range(src.tradeInLow, src.tradeInHigh, src.tradeIn);
                              const hasAny = privateVal || dealerVal || tradeInVal;
                              if (!hasAny) return null;
                              return (
                                <div key={src.source} className="rounded-md bg-muted/50 p-2.5">
                                  <p className="text-xs font-semibold text-foreground mb-1.5">{src.source}</p>
                                  <div className="grid grid-cols-3 gap-2 text-xs">
                                    {tradeInVal && (
                                      <div>
                                        <span className="text-muted-foreground">Trade-In</span>
                                        <p className="font-medium text-foreground">{tradeInVal}</p>
                                      </div>
                                    )}
                                    {privateVal && (
                                      <div>
                                        <span className="text-muted-foreground">Private Party</span>
                                        <p className="font-medium text-foreground">{privateVal}</p>
                                      </div>
                                    )}
                                    {dealerVal && (
                                      <div>
                                        <span className="text-muted-foreground">Dealer Retail</span>
                                        <p className="font-medium text-foreground">{dealerVal}</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Source links */}
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
                              nadaguides: "NADA Guides",
                              truecar: "TrueCar",
                              marketcheck: "MarketCheck",
                              yourmechanic: "YourMechanic",
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
                askingPrice={financing.negotiatedPrice ?? condition.askingPrice}
                make={vehicle.make}
                year={vehicle.year}
                depreciationTable={depreciationTable}
                evRange={mpgData?.evRange ?? null}
                onAnnualMilesChange={setUserAnnualMiles}
                zipCode={condition?.zipCode}
                onZipCodeSave={async (zip) => {
                  if (!isSavedReport || !id) return;
                  await supabase
                    .from("vehicle_reports")
                    .update({ zip_code: zip })
                    .eq("id", id);
                }}
              />

              {/* Depreciation Chart */}
              <Card className="overflow-hidden max-w-[calc(100vw-2rem)]">
                <CardHeader>
                <CardTitle className="flex items-center gap-2 flex-wrap">
                    <TrendingDown className="h-5 w-5 text-primary shrink-0" />
                    <span>5-Year Depreciation & Equity</span>
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
                <CardContent className="p-3 md:p-6">
                  <div className="h-[300px] w-full min-w-0 overflow-hidden">
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
                        {!financingSkipped && (
                        <Line 
                          type="monotone" 
                          dataKey="Loan Balance" 
                          stroke="#3b82f6"
                          strokeWidth={2}
                          strokeDasharray="5 5"
                        />
                        )}
                        <Line 
                          type="monotone" 
                          dataKey="Purchase Price" 
                          stroke="hsl(var(--danger))" 
                          strokeWidth={2}
                          strokeDasharray="6 3"
                          dot={false}
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
                          Exclude repairs from value
                        </Label>
                      </div>
                    </div>
                    <div className="overflow-x-auto -mx-3 px-3 md:mx-0 md:px-0" style={{ maxWidth: 'calc(100vw - 2rem)' }}>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs whitespace-nowrap px-1.5 md:px-4">Year</TableHead>
                          {!financingSkipped && <TableHead className="text-right text-xs px-1.5 md:px-4 leading-tight">Loan<br/>Balance</TableHead>}
                          <TableHead className="text-right text-xs whitespace-nowrap px-1.5 md:px-4">Repairs</TableHead>
                          <TableHead className="text-right text-xs whitespace-nowrap px-1.5 md:px-4">Maint.</TableHead>
                          <TableHead className="text-right text-xs whitespace-nowrap px-1.5 md:px-4">Depreciation</TableHead>
                          <TableHead className="text-right text-xs px-1.5 md:px-4 leading-tight">Private<br/>Sale Value</TableHead>
                          <TableHead className="text-right text-xs px-1.5 md:px-4 leading-tight">Trade-In<br/>Value</TableHead>
                          <TableHead className="text-right text-xs px-1.5 md:px-4 leading-tight">Est. Vehicle<br/>Value</TableHead>
                          {!financingSkipped && <TableHead className="text-right text-xs whitespace-nowrap px-1.5 md:px-4">Equity</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {/* Year 0 row - purchase starting point */}
                        {(() => {
                          const askPrice = condition?.askingPrice || 0;
                          const loanAmt = financing?.loanAmount || askPrice;
                          const privateVal = Math.round(financing?.negotiatedPrice ?? askPrice);
                          const tradeInVal = Math.round(priceAssessment.fairMarketTradeIn || privateVal * 0.85);
                          const yr0Equity = privateVal - Math.round(loanAmt);
                          return (
                            <TableRow>
                              <TableCell className="font-medium text-xs whitespace-nowrap px-1.5 md:px-4">Yr 0</TableCell>
                              {!financingSkipped && <TableCell className="text-right text-xs whitespace-nowrap px-1.5 md:px-4">${Math.round(loanAmt).toLocaleString()}</TableCell>}
                              <TableCell className="text-right text-xs whitespace-nowrap px-1.5 md:px-4 text-danger">$0</TableCell>
                              <TableCell className="text-right text-xs whitespace-nowrap px-1.5 md:px-4 text-danger">$0</TableCell>
                              <TableCell className="text-right text-xs whitespace-nowrap px-1.5 md:px-4 font-bold text-destructive">$0</TableCell>
                              <TableCell className="text-right text-xs whitespace-nowrap px-1.5 md:px-4">${privateVal.toLocaleString()}</TableCell>
                              <TableCell className="text-right text-xs whitespace-nowrap px-1.5 md:px-4">${tradeInVal.toLocaleString()}</TableCell>
                              <TableCell className="text-right text-xs whitespace-nowrap px-1.5 md:px-4 font-bold text-foreground">${privateVal.toLocaleString()}</TableCell>
                              {!financingSkipped && (
                                <TableCell className={cn("text-right text-xs whitespace-nowrap px-1.5 md:px-4 font-bold", yr0Equity >= 0 ? "text-success" : "text-destructive")}>
                                  {yr0Equity < 0 ? "-" : ""}${Math.abs(yr0Equity).toLocaleString()}
                                </TableCell>
                              )}
                            </TableRow>
                          );
                        })()}
                        {depreciationTable.map((row, idx) => {
                          const repair = Math.round(row.repairCosts);
                          const maint = Math.round(row.maintenanceCosts || 0);
                          const prevValue = idx === 0 ? (condition?.askingPrice || depreciationTable[0].privateValue * 1.15) : depreciationTable[idx - 1].privateValue;
                          const depreciation = Math.max(0, Math.round(prevValue - row.privateValue));
                          const cumulativeRepairs = depreciationTable.slice(0, idx + 1).reduce((sum, r) => sum + Math.round(r.repairCosts), 0);
                          const cumulativeMaint = depreciationTable.slice(0, idx + 1).reduce((sum, r) => sum + Math.round(r.maintenanceCosts || 0), 0);
                          const estValue = excludeRepairs
                            ? Math.round(row.privateValue)
                            : Math.round(row.privateValue) - cumulativeRepairs - cumulativeMaint;
                          return (
                            <TableRow key={row.year}>
                              <TableCell className="font-medium text-xs whitespace-nowrap px-1.5 md:px-4">Yr {row.year}</TableCell>
                              {!financingSkipped && <TableCell className="text-right text-xs whitespace-nowrap px-1.5 md:px-4">${Math.round(row.loanBalance).toLocaleString()}</TableCell>}
                              <TableCell className="text-right text-xs whitespace-nowrap px-1.5 md:px-4 text-danger">
                                ${repair.toLocaleString()}
                              </TableCell>
                              <TableCell className="text-right text-xs whitespace-nowrap px-1.5 md:px-4 text-danger">
                                ${maint.toLocaleString()}
                              </TableCell>
                              <TableCell className="text-right text-xs whitespace-nowrap px-1.5 md:px-4 font-bold text-destructive">
                                -${depreciation.toLocaleString()}
                              </TableCell>
                              <TableCell className="text-right text-xs whitespace-nowrap px-1.5 md:px-4">${Math.round(row.privateValue).toLocaleString()}</TableCell>
                              <TableCell className="text-right text-xs whitespace-nowrap px-1.5 md:px-4">${Math.round(row.tradeInValue).toLocaleString()}</TableCell>
                              <TableCell className="text-right text-xs whitespace-nowrap px-1.5 md:px-4 font-bold text-foreground">
                                {estValue < 0 ? "-" : ""}${Math.abs(estValue).toLocaleString()}
                              </TableCell>
                              {!financingSkipped && (() => {
                                const equity = estValue - Math.round(row.loanBalance);
                                return (
                                  <TableCell className={cn("text-right text-xs whitespace-nowrap px-1.5 md:px-4 font-bold", equity >= 0 ? "text-success" : "text-destructive")}>
                                    {equity < 0 ? "-" : ""}${Math.abs(equity).toLocaleString()}
                                  </TableCell>
                                );
                              })()}
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                    </div>

                    {financingSkipped && (
                      <p className="text-xs text-muted-foreground mt-2">
                        <span className="font-bold">*Does not include Taxes and Fees included in the purchase since no financing data was provided</span>
                      </p>
                    )}

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
                    <p className="whitespace-pre-line text-foreground">{riskAssessment.expertOpinion}</p>
                  </div>
                  
                </CardContent>
              </Card>

              {/* Final Verdict Card - Uses UVPRS-derived verdict */}
              {(() => {
                // Derive verdict from UVPRS score (primary) or fallback
                const scoreVerdict = uvprsResult?.verdict;
                const aiVerdict = analysis.finalVerdict?.verdict;
                
                // Map score-derived verdict to display
                const displayVerdict = scoreVerdict || aiVerdict || (() => {
                  const effectiveRisk = uvprsResult?.riskLevel 
                    ?? (riskAssessment.level === "medium" ? "moderate" : riskAssessment.level);
                  if (effectiveRisk === "low") return "Buy" as const;
                  if (effectiveRisk === "moderate") return "Conditional Buy" as const;
                  if (effectiveRisk === "elevated") return "Caution" as const;
                  return "Avoid" as const;
                })();

                // Always generate justification from actual data — never trust AI-stored text
                const justification = (() => {
                  const askPrice = vehicleData?.condition?.askingPrice ?? 0;
                  const negPrice = vehicleData?.financing?.negotiatedPrice;
                  const effectivePrice = negPrice ?? askPrice;
                  const dealerVal = priceAssessment?.fairMarketDealer;
                  const privateVal = priceAssessment?.fairMarketPrivate ?? 0;
                  const refVal = dealerVal || privateVal;
                  const priceDiff = refVal ? effectivePrice - refVal : 0;
                  const priceDir = priceDiff > 0 ? "above" : "below";
                  const absDiff = Math.abs(priceDiff);
                  const titleClean = vehicleData?.history?.titleStatus === "clean";
                  const accidents = vehicleData?.history?.accidentCount ?? 0;
                  const chronic = vehicleData?.history?.chronicRepairSystems ?? [];
                  const concerns = analysis.riskAssessment?.reliabilityConcerns ?? [];

                  // Build concise parts from structured data
                  const pricePart = refVal
                    ? `Priced $${absDiff.toLocaleString()} ${priceDir} fair market${dealerVal ? " dealer" : ""} value ($${refVal.toLocaleString()})`
                    : "";
                  const titlePart = titleClean ? "clean title" : vehicleData?.history?.titleStatus ? `${vehicleData.history.titleStatus} title` : "";
                  const accidentPart = accidents > 0 ? `${accidents} reported accident(s)` : "";
                  const chronicPart = chronic.length > 0 ? `documented ${chronic.join(" & ")} system issues` : "";
                  // Use short concern names from reliabilityConcerns, NOT raw verbose issue text
                  const topConcerns = concerns.slice(0, 2).map((c: any) => {
                    const name = typeof c === "string" ? c : c.concern || "";
                    // Extract just the first key phrase (before parenthetical or cost details)
                    return name.split("(")[0].split(" - ")[0].trim();
                  }).filter(Boolean);
                  const concernPart = topConcerns.length > 0 ? topConcerns.join(" and ") : "";
                  const riskDetails = [chronicPart, accidentPart, concernPart].filter(Boolean);

                  if (displayVerdict === "Buy") {
                    const positives = [pricePart, titlePart, accidents === 0 ? "no reported accidents" : ""].filter(Boolean).join(", ");
                    return `${positives}. Low overall risk supports a confident purchase at the fair offer price.`;
                  }
                  if (displayVerdict === "Conditional Buy") {
                    return `${pricePart}${titlePart ? ` with ${titlePart}` : ""}, though ${riskDetails.join(", ") || "moderate risk factors"} warrant a pre-purchase inspection (PPI) before committing. Negotiate toward the fair offer price.`;
                  }
                  if (displayVerdict === "Caution") {
                    return `${pricePart}. Elevated risk from ${riskDetails.join(", ") || "multiple concern factors"}. Budget for upcoming repairs and negotiate aggressively toward the fair offer price.`;
                  }
                  return `${pricePart}. High risk: ${riskDetails.join(", ") || "significant concerns identified"}. This vehicle is inadvisable at the current asking price.`;
                })();

                const verdictConfig = {
                  "Buy": { icon: <ThumbsUp className="h-10 w-10 text-success" />, border: "border-success bg-success/5", badge: "bg-success text-success-foreground" },
                  "Conditional Buy": { icon: <HandCoins className="h-10 w-10 text-warning" />, border: "border-warning bg-warning/5", badge: "bg-warning text-warning-foreground" },
                  "Negotiate": { icon: <HandCoins className="h-10 w-10 text-warning" />, border: "border-warning bg-warning/5", badge: "bg-warning text-warning-foreground" },
                  "Caution": { icon: <AlertTriangle className="h-10 w-10 text-orange-500" />, border: "border-orange-500 bg-orange-500/5", badge: "bg-orange-500 text-white" },
                  "Walk Away": { icon: <ThumbsDown className="h-10 w-10 text-danger" />, border: "border-danger bg-danger/5", badge: "bg-danger text-danger-foreground" },
                  "Avoid": { icon: <ThumbsDown className="h-10 w-10 text-danger" />, border: "border-danger bg-danger/5", badge: "bg-danger text-danger-foreground" },
                };
                const config = verdictConfig[displayVerdict] || verdictConfig["Conditional Buy"];

                return (
                  <Card className={cn("border-2", config.border)}>
                    <CardContent className="p-6">
                      <div className="flex flex-col sm:flex-row items-center gap-6">
                        <div className="flex flex-col items-center gap-2 shrink-0">
                          {config.icon}
                          <Badge className={cn("text-lg px-4 py-1", config.badge)}>
                            {displayVerdict.toUpperCase()}
                          </Badge>
                        </div>
                        <div className="flex-1 text-center sm:text-left">
                          <p className="text-sm text-muted-foreground">{justification}</p>
                        </div>
                        <div className="shrink-0 text-center sm:border-l sm:pl-6">
                          <p className="mb-1 text-sm font-semibold">Fair Offer Price</p>
                          <p className="text-3xl font-bold">${riskAssessment.fairOfferPrice.toLocaleString()}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })()}

              {/* Analyze Another Vehicle */}
              <Button asChild className="w-full">
                <Link to="/analyze">
                  <Car className="mr-2 h-4 w-4" />
                  Analyze Another Vehicle
                </Link>
              </Button>
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
                  missingHistoryReport={!vehicleData?.condition?.isBrandNew && !vehicleData?.history?.serviceRecords}
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
                        const newAn2 = analysisResult.analysis;
                        if (analysis && newAn2.priceAssessment &&
                            !(newAn2.priceAssessment.fairMarketPrivate > 0 || newAn2.priceAssessment.fairMarketDealer > 0)) {
                          newAn2.priceAssessment = { ...newAn2.priceAssessment, ...analysis.priceAssessment };
                        }
                        setAnalysis(newAn2);
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
                        if (analysisResult.sourceBreakdown?.length) {
                          setSourceBreakdown(analysisResult.sourceBreakdown);
                        }
                        // Update saved report if applicable
                        if (isSavedReport && id) {
                          const { priceAssessment, depreciationTable, riskAssessment, historyAnalysis } = analysisResult.analysis;
                          const sideUpd: Record<string, any> = {
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
                            ...(extractedVin && !vehicleData.vehicle.vin ? { vin: extractedVin } : {}),
                            pricing_sources: analysisResult.pricingSources || [],
                            pricing_last_updated: new Date().toISOString(),
                            source_breakdown: analysisResult.sourceBreakdown || [],
                          };
                          if (priceAssessment.fairMarketPrivate > 0 || priceAssessment.fairMarketDealer > 0) {
                            sideUpd.fair_market_private = priceAssessment.fairMarketPrivate;
                            sideUpd.fair_market_dealer = priceAssessment.fairMarketDealer || null;
                            sideUpd.fair_market_trade_in = priceAssessment.fairMarketTradeIn;
                          }
                          await supabase.from("vehicle_reports").update(sideUpd).eq("id", id);
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

              {/* NHTSA Recall Card */}
              {recallData && !recallData.isLoading && (
                <Card className={cn(
                  "border-2",
                  recallData.openCount > 0
                    ? "border-danger bg-danger/5"
                    : "border-success bg-success/5"
                )}>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      {recallData.openCount > 0 ? (
                        <ShieldAlert className="h-5 w-5 text-danger" />
                      ) : (
                        <ShieldCheck className="h-5 w-5 text-success" />
                      )}
                      Safety Recalls
                      <Badge
                        className={cn(
                          "ml-auto text-xs",
                          recallData.openCount > 0
                            ? "bg-danger text-danger-foreground"
                            : "bg-success text-success-foreground"
                        )}
                      >
                        {recallData.openCount > 0
                          ? `${recallData.openCount} Open`
                          : recallData.count > 0
                          ? "All Resolved"
                          : "None on Record"}
                      </Badge>
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Via NHTSA · {vehicle.year} {vehicle.make} {vehicle.model}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    {recallData.openCount > 0 && (
                      <div className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger/10 px-3 py-2">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
                        <p className="text-xs text-danger font-medium">
                          {recallData.openCount} open {recallData.openCount === 1 ? "recall" : "recalls"} found for this vehicle. Ensure they have been resolved before purchasing.
                        </p>
                      </div>
                    )}
                    {recallData.count === 0 && (
                      <div className="flex items-center gap-2 rounded-md border border-success/30 bg-success/10 px-3 py-2">
                        <CheckCircle className="h-4 w-4 shrink-0 text-success" />
                        <p className="text-xs text-success font-medium">No recalls on record for this year/make/model.</p>
                      </div>
                    )}
                    {recallData.recalls.length > 0 && (
                      <Accordion type="multiple" className="w-full">
                        {recallData.recalls.map((recall, i) => (
                          <AccordionItem key={i} value={`recall-${i}`} className="border-b border-border/50 last:border-0">
                            <AccordionTrigger className="py-2 text-left hover:no-underline">
                              <span className="text-xs font-semibold leading-snug pr-2">{recall.component || `Recall #${i + 1}`}</span>
                            </AccordionTrigger>
                            <AccordionContent className="pb-3 space-y-2">
                              {recall.campaignNumber && (
                                <p className="text-xs text-muted-foreground">
                                  <span className="font-medium">Campaign:</span> {recall.campaignNumber}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground leading-relaxed">{recall.summary}</p>
                              {recall.remedyDescription && (
                                <div className="rounded-md bg-muted px-3 py-2">
                                  <p className="text-xs font-medium mb-0.5">Remedy</p>
                                  <p className="text-xs text-muted-foreground">{recall.remedyDescription}</p>
                                </div>
                              )}
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    )}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {vehicle.vin ? (
                        <a
                          href={`https://www.nhtsa.gov/vehicle/${vehicle.vin}/complaints`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <ExternalLink className="h-3 w-3" />
                          VIN Complaints on NHTSA
                        </a>
                      ) : (
                        <a
                          href={`https://www.nhtsa.gov/vehicle-safety/recalls#recall--${encodeURIComponent(vehicle.make)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Search Recalls on NHTSA
                        </a>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
              {recallData?.isLoading && (
                <Card>
                  <CardContent className="flex items-center gap-3 p-4">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Checking NHTSA recall database...</p>
                  </CardContent>
                </Card>
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

              {/* Warranty Status Card */}
              {analysis.warrantyAnalysis && (
                <Card className={cn(
                  "border-2",
                  analysis.warrantyAnalysis.warrantyStatus === "active" ? "border-success bg-success/5"
                    : analysis.warrantyAnalysis.warrantyStatus === "expired" ? "border-danger bg-danger/5"
                    : "border-warning bg-warning/5"
                )}>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <ShieldCheck className="h-5 w-5" />
                      Warranty Analysis
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Status</span>
                      <Badge variant={analysis.warrantyAnalysis.warrantyStatus === "active" ? "default" : "destructive"}>
                        {analysis.warrantyAnalysis.warrantyStatus === "active" ? "Active" : analysis.warrantyAnalysis.warrantyStatus === "expired" ? "Expired" : "Unknown"}
                      </Badge>
                    </div>
                    {analysis.warrantyAnalysis.warrantyMonthsRemaining != null && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Months Remaining</span>
                        <span className="font-semibold">{analysis.warrantyAnalysis.warrantyMonthsRemaining}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Risk Reduction</span>
                      <span className="font-semibold">{analysis.warrantyAnalysis.riskReductionFactor}%</span>
                    </div>
                    <Progress value={analysis.warrantyAnalysis.riskReductionFactor} className="h-2" />
                    <p className="text-sm text-muted-foreground">{analysis.warrantyAnalysis.warrantyNotes}</p>
                  </CardContent>
                </Card>
              )}

              {/* Final Verdict moved to main content area */}

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
