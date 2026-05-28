import { useEffect, useState, useRef, useCallback } from "react";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Tooltip as RadixTooltip, TooltipContent as RadixTooltipContent, TooltipProvider, TooltipTrigger as RadixTooltipTrigger } from "@/components/ui/tooltip";
import { getRiskColorToken } from "@/lib/risk-colors";
import type { RecallItem } from "@/lib/nhtsa";
import { getWithExpiry, removeExpirableItem } from "@/lib/storage-utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/hooks/useSubscription";
import { VehicleImageGallery } from "@/components/report/VehicleImageGallery";
import { DealerReview } from "@/components/report/DealerReview";
// FuelEconomyCard removed — fuel economy details collapsed into MonthlyOwnershipCostCard (Fix 7)
import { FinancingDetailsCard } from "@/components/report/FinancingDetailsCard";
import { RiskScoreBreakdown } from "@/components/report/RiskScoreBreakdown";
import { ServiceHistoryTimeline } from "@/components/report/ServiceHistoryTimeline";
import { generateReportPDF } from "@/lib/generatePDF";
import { NegotiationCheatSheet, type NegotiationCheatSheetHandle } from "@/components/report/NegotiationCheatSheet";
import { StickyNavBar } from "@/components/report/StickyNavBar";
import { VerdictHero } from "@/components/report/VerdictHero";
import { MetricsStrip } from "@/components/report/MetricsStrip";
import { ExpertAnalysisCard } from "@/components/report/ExpertAnalysisCard";
import { ExpertFindingsStrip } from "@/components/report/ExpertFindingsStrip";
import { FinancingStep } from "@/components/analysis/FinancingStep";
import type { FinancingInfo, AiFindings } from "@/types/vehicle";
import { cacheImages, getCachedUrls } from "@/lib/api/cache-images";
import { calculateTCO } from "@/lib/tco-calculations";
import { toast as sonnerToast } from "sonner";
import { convertLegacyTable, computeDepreciationTable, type ComputedDepreciationRow, type DepreciationInputs } from "@/lib/depreciation-engine";
import { calculateUVPRS, uvprsToLegacyRiskLevel, getRiskLevel, type UVPRSResult } from "@/lib/uvprs-scoring";
import { lookupRecalls } from "@/lib/nhtsa";
import { parseHistoryReport } from "@/lib/api/parse-history";
import { MobileBottomBar } from "@/components/report/MobileBottomBar";
import { MonthlyOwnershipCostCard } from "@/components/report/MonthlyOwnershipCostCard";
import { calculateMonthlyOwnershipBreakdown } from "@/lib/tco-calculations";
import { getStateFromZip } from "@/lib/sales-tax-data";

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
  worstCaseRepairCosts?: number;
  maintenanceCosts?: number;
  netEquityPrivate: number;
  netEquityTradeIn: number;
}

function sanitizeExpertOpinion({
  expertOpinion,
  displayVerdict,
  dealRating,
  sellerType,
  effectivePrice,
  fairMarketPrivate,
  fairMarketDealer,
}: {
  expertOpinion: string;
  displayVerdict: "Conditional Buy" | "Caution" | "Avoid" | "Insufficient Data";
  dealRating: string;
  sellerType: "dealer" | "private";
  effectivePrice: number;
  fairMarketPrivate: number;
  fairMarketDealer?: number;
}): string {
  if (!expertOpinion?.trim()) return expertOpinion;

  let sanitized = expertOpinion.trim();

  // Fix #1: Replace ambiguous "aggressive" pricing language with precise framing
  sanitized = sanitized.replace(
    /(?:MarketCheck|KBB|data)\s+(?:and\s+\w+\s+)?(?:data\s+)?suggest[s]?\s+(?:the\s+)?price\s+is\s+aggressive/gi,
    "The dealer appears to be pricing this unit below typical dealer retail to compensate for the mileage and undocumented history"
  );
  sanitized = sanitized.replace(/\bthe price is aggressive\b/gi, "the price is positioned below dealer retail benchmarks");
  sanitized = sanitized.replace(/\baggressive pricing\b/gi, "pricing below dealer retail");

  const dealRatingSafe = (dealRating || "").toLowerCase();
  if (dealRatingSafe && dealRatingSafe !== "excellent") {
    sanitized = sanitized.replace(/['"]?excellent['"]?\s+deal rating/gi, `${dealRatingSafe} pricing position`);
  }

  if (displayVerdict !== "Avoid") {
    return sanitized;
  }

  sanitized = sanitized.replace(/\b[Nn]egotiate\b/g, (match) => (match[0] === "N" ? "Avoid" : "avoid"));

  const benchmark = sellerType === "dealer" && fairMarketDealer ? fairMarketDealer : fairMarketPrivate;
  const benchmarkLabel = sellerType === "dealer" && fairMarketDealer ? "fair dealer retail" : "fair market value";
  const priceGap = effectivePrice - benchmark;
  const priceSentence = benchmark > 0
    ? priceGap > 0
      ? `The current purchase price of $${effectivePrice.toLocaleString()} is $${Math.abs(priceGap).toLocaleString()} above ${benchmarkLabel} of $${benchmark.toLocaleString()}.`
      : priceGap < 0
        ? `The current purchase price of $${effectivePrice.toLocaleString()} is $${Math.abs(priceGap).toLocaleString()} below ${benchmarkLabel} of $${benchmark.toLocaleString()}.`
        : `The current purchase price of $${effectivePrice.toLocaleString()} matches ${benchmarkLabel}.`
    : `The current purchase price is $${effectivePrice.toLocaleString()}.`;
  const mentionsBatteryDiagnostic = /\bbattery\b|\bdiagnostic\b|\bleafspy\b/i.test(sanitized);
  const conclusion = mentionsBatteryDiagnostic
    ? `${priceSentence} Recommendation: avoid this vehicle unless the seller provides a clean professional battery diagnostic and reprices it to reflect the risk.`
    : `${priceSentence} Recommendation: avoid this vehicle at the current price.`;

  const paragraphs = sanitized.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean);
  if (paragraphs.length === 0) return conclusion;

  paragraphs[paragraphs.length - 1] = conclusion;
  return paragraphs.join("\n\n");
}

/** Reconcile AI verdict with UVPRS score — always take the higher-risk signal */
function getFinalVerdict(
  aiVerdict: string | undefined,
  uvprsScore: number | undefined,
  floorTriggered: boolean,
  pricingDataUnavailable?: boolean
): "Conditional Buy" | "Caution" | "Avoid" | "Insufficient Data" {
  if (pricingDataUnavailable) return "Insufficient Data";
  const riskLevels: Record<string, number> = { "Walk Away": 3, "Negotiate": 2, "Buy": 1 };
  const aiLevel = riskLevels[aiVerdict || "Buy"] ?? 1;
  const scoreLevel = uvprsScore == null ? 1 : uvprsScore > 70 ? 3 : uvprsScore > 50 ? 2 : 1;
  const floorLevel = floorTriggered ? 2 : 1;
  const finalLevel = Math.max(aiLevel, scoreLevel, floorLevel);
  return finalLevel >= 3 ? "Avoid" : finalLevel >= 2 ? "Caution" : "Conditional Buy";
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
      probabilityPercent: avgCost > 2500 ? 70 : 40,
      yearsToFailureWindow: 3,
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
  depreciationInputs?: DepreciationInputs;
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

async function pollAnalysisJob(jobId: string, timeoutMs = 240000): Promise<any> {
  const start = Date.now();
  let delay = 1500;
  while (Date.now() - start < timeoutMs) {
    const { data, error } = await supabase
      .from("analysis_jobs")
      .select("status, result, error")
      .eq("id", jobId)
      .maybeSingle();
    if (error) throw error;
    if (data?.status === "complete") return data.result;
    if (data?.status === "failed") throw new Error(data.error || "Analysis failed");
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay + 500, 4000);
  }
  throw new Error("Analysis timed out. Please try again.");
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
  const heroRef = useRef<HTMLDivElement>(null);
  const cheatSheetRef = useRef<HTMLDivElement>(null);
  const cheatSheetHandle = useRef<NegotiationCheatSheetHandle>(null);
  const scrollToCheatSheet = useCallback(() => {
    cheatSheetRef.current?.scrollIntoView({ behavior: "smooth" });
    // Small delay to let scroll finish, then trigger the dialog
    setTimeout(() => cheatSheetHandle.current?.trigger(), 600);
  }, []);
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
  const [maintenanceSources, setMaintenanceSources] = useState<string[]>([]);
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
  const [daysOnMarket, setDaysOnMarket] = useState<number | null>(null);
  const [daysOnMarketAsOf, setDaysOnMarketAsOf] = useState<Date | null>(null);
  const [isRefreshingPricing, setIsRefreshingPricing] = useState(false);
  const [pricingDataUnavailable, setPricingDataUnavailable] = useState(false);
  const [pricingSource, setPricingSource] = useState<"market" | "estimated">("market");
  const [contributingSources, setContributingSources] = useState<string[]>([]);
  const [uvprsResult, setUvprsResult] = useState<UVPRSResult | null>(null);
  const [isUploadingHistory, setIsUploadingHistory] = useState(false);
  const [recallData, setRecallData] = useState<{
    count: number;
    openCount: number;
    recalls: RecallItem[];
    isLoading: boolean;
  } | null>(null);
  const [showFinancingDialog, setShowFinancingDialog] = useState(false);
  const [historyTab, setHistoryTab] = useState("overview");
  
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
        sales_tax_rate: financing.salesTaxRate ?? null,
        fees: financing.fees ?? null,
        down_payment: financing.downPayment ?? null,
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
        days_on_market: daysOnMarket,
        days_on_market_as_of: daysOnMarketAsOf?.toISOString() || null,
        source_breakdown: sourceBreakdown.length > 0 ? sourceBreakdown : [],
        risk_score: uvprsResult?.totalScore ?? null,
        is_cpo: condition.isCPO || false,
        warranty_months_remaining: history?.warrantyMonthsRemaining ?? null,
        warranty_status: analysis.warrantyAnalysis?.warrantyStatus || null,
        warranty_risk_reduction: analysis.warrantyAnalysis?.riskReductionFactor ?? null,
        warranty_notes: analysis.warrantyAnalysis?.warrantyNotes || null,
        final_verdict: analysis.finalVerdict?.verdict || null,
        final_verdict_justification: analysis.finalVerdict?.justification || null,
        ai_findings: {
          ...((analysis.aiFindings as any) ?? {}),
          ...(analysis.depreciationInputs ? { depreciationInputs: analysis.depreciationInputs } : {}),
        },
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
              salesTaxRate: report.sales_tax_rate ?? undefined,
              fees: report.fees ?? undefined,
              downPayment: report.down_payment ?? undefined,
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
              // Restore depreciationInputs from ai_findings if stored there
              ...((report.ai_findings as any)?.depreciationInputs ? {
                depreciationInputs: (report.ai_findings as any).depreciationInputs as DepreciationInputs,
              } : {}),
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
          if (report.days_on_market != null) {
            setDaysOnMarket(report.days_on_market);
          }
          if (report.days_on_market_as_of) {
            setDaysOnMarketAsOf(new Date(report.days_on_market_as_of));
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
        // Plumbing fix (#14/#15): decode powertrain specs BEFORE analysis so the AI receives
        // ground-truth engine/transmission/drivetrain instead of guessing from make/model/trim.
        // No-op when specs are already present (VIN flow) or when no VIN was entered (manual flow).
        if (data?.vehicle?.vin && !data.vehicle.engine && !data.vehicle.transmission) {
          try {
            const { data: specsResult } = await supabase.functions.invoke("decode-vin-specs", {
              body: { vin: data.vehicle.vin },
            });
            if (specsResult?.success && specsResult.data) {
              const d = specsResult.data;
              const decodedMake = (d.make || "").toLowerCase().trim();
              const enteredMake = (data.vehicle.make || "").toLowerCase().trim();
              // Skip enrichment if the VIN decodes to a different make (likely a wrong/typo'd VIN)
              if (!decodedMake || !enteredMake || decodedMake === enteredMake) {
                data.vehicle = {
                  ...data.vehicle,
                  engine: d.engine || data.vehicle.engine,
                  engineSize: d.engineSize || data.vehicle.engineSize,
                  engineHp: d.engineHp || data.vehicle.engineHp,
                  engineTorque: d.engineTorque || data.vehicle.engineTorque,
                  engineCylinders: d.engineCylinders || data.vehicle.engineCylinders,
                  engineAspiration: d.engineAspiration || data.vehicle.engineAspiration,
                  transmission: d.transmission || data.vehicle.transmission,
                  drivetrain: d.drivetrain || data.vehicle.drivetrain,
                  fuelType: d.fuelType || data.vehicle.fuelType,
                  bodyStyle: d.bodyStyle || data.vehicle.bodyStyle,
                  msrp: d.msrp || data.vehicle.msrp,
                  trim: d.trim || data.vehicle.trim,
                  installedEquipment: d.installedEquipment || data.vehicle.installedEquipment,
                  optionPackages: d.optionPackages || data.vehicle.optionPackages,
                };
                console.log("Pre-analysis VIN decode merged powertrain specs into payload");
              } else {
                console.warn(`VIN ${data.vehicle.vin} decodes to ${d.make} but entry is ${data.vehicle.make} — skipping pre-analysis enrichment`);
              }
            }
          } catch (e) {
            console.error("Pre-analysis VIN decode failed (continuing without enrichment):", e);
          }
        }
        setVehicleData(data);
        
        // Call AI analysis (async job: returns 202 with jobId, then poll)
        console.log("Calling analyze-vehicle edge function...");
        const { data: dispatch, error: invokeError } = await supabase.functions.invoke("analyze-vehicle", {
          body: data,
        });

        console.log("Edge function dispatch:", { dispatch, invokeError });

        if (invokeError) {
          throw new Error(invokeError.message || "Failed to invoke analysis function");
        }
        if (!dispatch?.jobId) {
          throw new Error(dispatch?.error || "Analysis did not start");
        }

        const result = await pollAnalysisJob(dispatch.jobId);

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
          if (result.daysOnMarket != null) {
            setDaysOnMarket(result.daysOnMarket);
            setDaysOnMarketAsOf(result.daysOnMarketAsOf ? new Date(result.daysOnMarketAsOf) : new Date());
          }
          if (result.maintenanceSources?.length) {
            setMaintenanceSources(result.maintenanceSources);
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
          // Store pricing availability flags
          if (result.pricingDataUnavailable != null) setPricingDataUnavailable(result.pricingDataUnavailable);
          if (result.pricingSource) setPricingSource(result.pricingSource);
          if (result.contributingSources?.length) setContributingSources(result.contributingSources);
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
        historyReportProvided: history?.serviceRecords === true || !!(history?.serviceGapMiles != null || history?.majorServicesDone?.length || history?.majorServicesDue?.length || history?.chronicRepairSystems?.length),
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
        pricingDataUnavailable: pricingDataUnavailable,
      });
      console.log("[UVPRS-DEBUG] result:", result.totalScore, result.factors.map(f => `${f.key}=${f.score}(known=${f.known})`));
      setUvprsResult(result);
    };
    computeUVPRS();
  }, [analysis, vehicleData, pricingDataUnavailable]);

  const refreshPricing = async () => {
    if (!vehicleData || isRefreshingPricing) return;
    setIsRefreshingPricing(true);
    try {
      // Re-run the full analysis which includes fresh pricing lookup
      const { data: dispatch, error: invokeError } = await supabase.functions.invoke("analyze-vehicle", {
        body: vehicleData,
      });
      if (invokeError) throw invokeError;
      if (!dispatch?.jobId) throw new Error(dispatch?.error || "Analysis did not start");
      const result = await pollAnalysisJob(dispatch.jobId);
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
        if (result.maintenanceSources?.length) {
          setMaintenanceSources(result.maintenanceSources);
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
        if (result.daysOnMarket != null) {
          setDaysOnMarket(result.daysOnMarket);
          setDaysOnMarketAsOf(result.daysOnMarketAsOf ? new Date(result.daysOnMarketAsOf) : now);
        }
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
            ...(result.daysOnMarket != null ? {
              days_on_market: result.daysOnMarket,
              days_on_market_as_of: (result.daysOnMarketAsOf ? new Date(result.daysOnMarketAsOf) : now).toISOString(),
            } : {}),
            source_breakdown: result.sourceBreakdown || [],
            ...(result.detectedSellerType ? { seller_type: result.detectedSellerType } : {}),
            ...(result.analysis.aiFindings ? { ai_findings: {
              ...(result.analysis.aiFindings as any),
              ...(result.analysis.depreciationInputs ? { depreciationInputs: result.analysis.depreciationInputs } : {}),
            } } : {}),
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
  const { priceAssessment, depreciationTable: rawDepreciationTable, depreciationInputs, riskAssessment, historyAnalysis } = analysis;
  const financingSkipped = financing?.skipped === true;
  const askingPrice = condition.askingPrice;
  const purchasePrice = financing?.negotiatedPrice ?? askingPrice;

  // Deterministic depreciation engine: prefer AI rate inputs, fall back to legacy table
  const startingFMV = priceAssessment.fairMarketPrivate;
  const computedDepTable: ComputedDepreciationRow[] = (() => {
    if (depreciationInputs?.annualDepreciationRates?.length) {
      return computeDepreciationTable(depreciationInputs, {
        startingFMV,
        annualMiles: 12000,
        loanAmount: financing?.loanAmount,
        loanAPR: financing?.apr,
        loanTermMonths: financing?.loanTerm,
        financingSkipped: financing?.skipped,
      });
    }
    // Legacy fallback: clamp AI values deterministically
    return convertLegacyTable(
      rawDepreciationTable,
      startingFMV,
      financing?.loanAmount,
      financing?.apr,
      financing?.loanTerm,
      financing?.skipped
    );
  })();

  const liveLoanMetrics = (() => {
    const isLoan = financing?.type === "loan" && !financingSkipped;
    const fees = financing?.fees ?? 0;
    const downPayment = financing?.downPayment ?? 0;
    const apr = financing?.apr ?? 0;
    const loanTermMonths = financing?.loanTerm ?? 0;
    const salesTaxRate = financing?.salesTaxRate ?? 0;
    const salesTaxAmount = parseFloat(((purchasePrice || 0) * (salesTaxRate / 100)).toFixed(2));
    // Total Amount Financed = price + fees + sales tax - down payment (NO interest)
    const totalAmountFinanced = isLoan ? Math.max(0, purchasePrice + fees + salesTaxAmount - downPayment) : 0;
    const computedInterestAmount = (() => {
      if (!totalAmountFinanced || !loanTermMonths || apr <= 0) return 0;
      const monthlyRate = (apr / 100) / 12;
      const amortizedMonthlyPayment = totalAmountFinanced * (monthlyRate * Math.pow(1 + monthlyRate, loanTermMonths)) / (Math.pow(1 + monthlyRate, loanTermMonths) - 1);
      return amortizedMonthlyPayment * loanTermMonths - totalAmountFinanced;
    })();
    const totalCost = totalAmountFinanced + computedInterestAmount;
    const monthlyPayment = totalCost > 0 && loanTermMonths > 0 ? totalCost / loanTermMonths : 0;

    return {
      totalAmountFinanced: Math.round(totalAmountFinanced),
      totalCost: Math.round(totalCost),
      interestAmount: Math.round(computedInterestAmount),
      fees,
      salesTaxAmount: Math.round(salesTaxAmount),
      balanceAfterMonths: (months: number) => {
        if (!isLoan || !loanTermMonths || totalCost <= 0) return 0;
        if (months >= loanTermMonths) return 0;
        return Math.max(0, Math.round(totalCost - monthlyPayment * months));
      },
    };
  })();

  const depreciationTable = computedDepTable.map((row) => {
    if (financingSkipped || financing?.type !== "loan") return row;
    const loanBalance = liveLoanMetrics.balanceAfterMonths(row.year * 12);
    const equity = row.marketValue - loanBalance;

    return {
      ...row,
      loanBalance,
      equity,
      netEquityPrivate: equity,
      netEquityTradeIn: row.tradeInValue - loanBalance,
    };
  });

  const cumulativeOwnershipCosts = depreciationTable.reduce<Array<{
    year: number;
    cumulativeRepairs: number;
    cumulativeMaintenance: number;
  }>>((acc, row) => {
    const previous = acc[acc.length - 1];
    acc.push({
      year: row.year,
      cumulativeRepairs: (previous?.cumulativeRepairs ?? 0) + row.repairCosts,
      cumulativeMaintenance: (previous?.cumulativeMaintenance ?? 0) + row.maintenanceCosts,
    });
    return acc;
  }, []);
  const cumulativeOwnershipCostMap = new Map(cumulativeOwnershipCosts.map((entry) => [entry.year, entry]));

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
          purchasePrice,
        },
        priceAssessment: {
          fairMarketPrivate: priceAssessment.fairMarketPrivate,
          fairMarketDealer: priceAssessment.fairMarketDealer,
          fairMarketTradeIn: priceAssessment.fairMarketTradeIn,
          dealRating: priceAssessment.dealRating,
          priceDifference: priceAssessment.priceDifference,
        },
        riskAssessment: {
          level: riskAssessment.level,
          fairOfferPrice: riskAssessment.fairOfferPrice,
          expertOpinion: sanitizedExpertOpinion,
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
        maintenanceSources,
        hasServiceRecords: vehicleData?.history?.serviceRecords ?? false,
        warrantyAnalysis: analysis.warrantyAnalysis,
        finalVerdict: analysis.finalVerdict,
        recallData: recallData && !recallData.isLoading ? {
          count: recallData.count,
          openCount: recallData.openCount,
          recalls: recallData.recalls,
        } : undefined,
        vin: vehicle.vin || undefined,
        daysOnMarket,
        daysOnMarketAsOf,
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

  const floorTriggered = !!(analysis.aiFindings?.floorOverrides as any)?.triggered;
  const displayVerdict = getFinalVerdict(
    analysis.finalVerdict?.verdict,
    uvprsResult?.totalScore,
    floorTriggered,
    pricingDataUnavailable
  );
  const overpaymentAmount = condition.askingPrice - priceAssessment.fairMarketPrivate;
  const overpaymentSignificant = priceAssessment.fairMarketPrivate > 0
    && !pricingDataUnavailable
    && overpaymentAmount > priceAssessment.fairMarketPrivate * 0.05;
  const overpaymentPrefix = overpaymentSignificant
    ? `At purchase, you are paying $${Math.round(overpaymentAmount).toLocaleString()} above private party market value. This represents an immediate unrealized loss before any depreciation occurs.\n\n`
    : "";
  const sanitizedExpertOpinion = overpaymentPrefix + sanitizeExpertOpinion({
    expertOpinion: riskAssessment.expertOpinion,
    displayVerdict,
    dealRating: priceAssessment.dealRating,
    sellerType: condition.sellerType,
    effectivePrice: purchasePrice,
    fairMarketPrivate: priceAssessment.fairMarketPrivate,
    fairMarketDealer: priceAssessment.fairMarketDealer,
  });

  // Chart data: values already deterministic from engine, no clamping needed
  const chartData = [
    {
      name: "Year 0",
      "Market Value": startingFMV,
      "Trade-In Value": Math.round(priceAssessment.fairMarketTradeIn || startingFMV * 0.85),
      "Asking Price": askingPrice,
      ...(financingSkipped ? {} : { "Loan Balance": liveLoanMetrics.totalCost }),
    },
    ...depreciationTable.map((row) => ({
      name: `Year ${row.year}`,
      "Market Value": row.marketValue,
      "Trade-In Value": row.tradeInValue,
      "Asking Price": askingPrice,
      ...(financingSkipped ? {} : { "Loan Balance": row.loanBalance }),
    })),
  ];




  // Compute monthly ownership breakdown (single source of truth)
  const monthlyOwnership = (() => {
    const effectivePrice = financing.negotiatedPrice ?? condition.askingPrice;
    const fuelTypeVal = mpgData?.fuelType ?? null;
    const isEV = fuelTypeVal?.toLowerCase().includes("electric") ?? false;
    const resolvedState = condition.zipCode ? getStateFromZip(condition.zipCode) : null;
    const tco = calculateTCO(
      effectivePrice,
      mpgData?.mpgCombined ?? null,
      fuelTypeVal,
      depreciationTable,
      { annualMiles: userAnnualMiles },
      { make: vehicle.make, year: vehicle.year, model: vehicle.model, stateCode: resolvedState }
    );
    const monthlyPmt = liveLoanMetrics.totalCost > 0 && (financing?.loanTerm ?? 0) > 0
      ? liveLoanMetrics.totalCost / (financing?.loanTerm ?? 1)
      : 0;
    const bd = calculateMonthlyOwnershipBreakdown(tco, monthlyPmt);
    const hasFinancing = !financingSkipped && (financing?.type === "loan" || financing?.type === "lease");
    const range = bd.totalLow === bd.totalHigh
      ? `$${bd.totalLow.toLocaleString()}`
      : `$${bd.totalLow.toLocaleString()}–$${bd.totalHigh.toLocaleString()}`;
    return { breakdown: bd, range, isEV, hasFinancing };
  })();
  const monthlyCostRange = monthlyOwnership.range;
  const fmvPriceDifference = condition.askingPrice - priceAssessment.fairMarketPrivate;

  // Warranty context string
  const warrantyContext = (() => {
    if (!analysis.warrantyAnalysis) return "Not available";
    const wa = analysis.warrantyAnalysis;
    if (wa.warrantyStatus === "active" && wa.warrantyMonthsRemaining != null) {
      return `${wa.warrantyMonthsRemaining} months remaining`;
    }
    return wa.warrantyNotes || "See details below";
  })();

  return (
    <div className={cn("flex min-h-screen flex-col", isMobile && "force-mobile")}>
      <Header />

      {/* Sticky Navigation Bar */}
      <StickyNavBar
        verdict={displayVerdict}
        vehicleLabel={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
        heroRef={heroRef}
        isPaid={isPaid}
        onCheatSheetClick={scrollToCheatSheet}
      />
      
      <main className="flex-1 bg-surface-muted py-8 pb-20 md:pb-8">
        <div className="mx-auto max-w-[900px] px-4 space-y-6">
          {/* Back Navigation */}
          {backToComparisonUrl && (
            <Button variant="ghost" className="mb-4 -ml-2" asChild>
              <Link to={backToComparisonUrl}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Comparison
              </Link>
            </Button>
          )}

          {/* ===== SECTION 1: VERDICT HERO ===== */}
          <VerdictHero
            ref={heroRef}
            vehicle={vehicle}
            mileage={condition.mileage}
            askingPrice={condition.askingPrice}
            images={condition.images}
            verdict={displayVerdict}
            riskScore={uvprsResult?.totalScore}
            riskLabel={uvprsResult?.riskLabel}
            aiFindings={analysis.aiFindings}
            openRecallCount={recallData?.openCount ?? 0}
            recallComponents={recallData?.recalls?.map((recall) => recall.component) ?? []}
            onReAnalyze={refreshPricing}
            onUploadHistory={() => headerHistoryInputRef.current?.click()}
            onDownloadPDF={handleDownloadPDF}
            isRefreshing={isRefreshingPricing}
            isDownloading={isDownloading}
            onCheatSheetClick={scrollToCheatSheet}
            isPaid={isPaid}
          />
          {/* Hidden file input for header upload */}
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
                  if (analysisResult.daysOnMarket != null) {
                    setDaysOnMarket(analysisResult.daysOnMarket);
                    setDaysOnMarketAsOf(analysisResult.daysOnMarketAsOf ? new Date(analysisResult.daysOnMarketAsOf) : new Date());
                  }
                  if (analysisResult.maintenanceSources?.length) {
                    setMaintenanceSources(analysisResult.maintenanceSources);
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
                      ...(analysisResult.daysOnMarket != null ? {
                        days_on_market: analysisResult.daysOnMarket,
                        days_on_market_as_of: (analysisResult.daysOnMarketAsOf ? new Date(analysisResult.daysOnMarketAsOf) : new Date()).toISOString(),
                      } : {}),
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

          {/* ===== SECTION 2: METRICS STRIP ===== */}
          <MetricsStrip
            priceDifference={fmvPriceDifference}
            fairMarketPrivate={priceAssessment.fairMarketPrivate}
            riskScore={uvprsResult?.totalScore ?? null}
            riskLabel={uvprsResult?.riskLabel || "Calculating..."}
            healthScore={historyAnalysis.healthScore}
            monthlyCostRange={monthlyCostRange}
            openRecalls={recallData?.openCount ?? 0}
            resolvedRecalls={(recallData?.count ?? 0) - (recallData?.openCount ?? 0)}
            warrantyStatus={analysis.warrantyAnalysis?.warrantyStatus || "unknown"}
            warrantyContext={warrantyContext}
            pricingDataUnavailable={pricingDataUnavailable}
            daysOnMarket={daysOnMarket}
            daysOnMarketAsOf={daysOnMarketAsOf}
            onHistoryTabChange={setHistoryTab}
          />

          {/* Pricing data warning banners */}
          {pricingDataUnavailable && pricingSource !== "estimated" && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800">Market pricing data unavailable for this vehicle</p>
                <p className="text-sm text-amber-700 mt-1">Price comparisons may be inaccurate. Deal rating and verdict are withheld until pricing can be verified.</p>
              </div>
            </div>
          )}
          {pricingSource === "estimated" && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800">Pricing estimated from asking price</p>
                <p className="text-sm text-amber-700 mt-1">No independent market data was available. Fair market values are estimated — verify with local dealers.</p>
              </div>
            </div>
          )}
          {contributingSources.length > 0 && (
            <p className="text-xs text-muted-foreground text-center -mt-2">
              Pricing via {contributingSources.join(" · ")}
            </p>
          )}

          {/* Persistent CTA: Upload history report */}
          {!vehicleData?.condition?.isBrandNew && !vehicleData?.history?.serviceRecords && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-start gap-3">
              <FileText className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Upload a CarFax or AutoCheck report to complete your vehicle analysis</p>
                <p className="text-sm text-muted-foreground mt-1">Get a more accurate and comprehensive risk assessment, service history verification, and refined scoring.</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                onClick={() => headerHistoryInputRef.current?.click()}
                disabled={isUploadingHistory}
              >
                {isUploadingHistory ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}
                {isUploadingHistory ? "Processing..." : "Upload Report"}
              </Button>
            </div>
          )}

          {/* ===== SECTION 3: EXPERT ANALYSIS ===== */}
          <ExpertFindingsStrip
            aiFindings={analysis.aiFindings}
            reliabilityConcerns={riskAssessment.reliabilityConcerns}
            verdict={displayVerdict}
            riskScore={uvprsResult?.totalScore}
          />
          <div id="section-expert">
          <ExpertAnalysisCard
            aiFindings={analysis.aiFindings}
            sanitizedExpertOpinion={sanitizedExpertOpinion}
            verdict={displayVerdict}
            riskScore={uvprsResult?.totalScore}
            reliabilityConcerns={riskAssessment.reliabilityConcerns}
          />
          </div>


          {/* ===== SECTION 4: MONTHLY OWNERSHIP COST ===== */}
          <MonthlyOwnershipCostCard
            monthlyCostRange={monthlyCostRange}
            breakdown={monthlyOwnership.breakdown}
            isElectric={monthlyOwnership.isEV}
            hasFinancing={monthlyOwnership.hasFinancing}
            verdict={displayVerdict}
            fuelType={mpgData?.fuelType}
            mpgCity={mpgData?.mpgCity}
            mpgCombined={mpgData?.mpgCombined}
            mpgHighway={mpgData?.mpgHighway}
            annualFuelCost={(() => {
              const effectivePrice = financing.negotiatedPrice ?? condition.askingPrice;
              const tco = calculateTCO(
                effectivePrice,
                mpgData?.mpgCombined ?? null,
                mpgData?.fuelType ?? null,
                depreciationTable,
                { annualMiles: userAnnualMiles },
                { make: vehicle.make, year: vehicle.year, model: vehicle.model }
              );
              return tco.annualFuelCost;
            })()}
            annualMiles={userAnnualMiles}
            onAnnualMilesChange={setUserAnnualMiles}
            financing={financing}
            financingSkipped={financingSkipped}
            askingPrice={condition.askingPrice}
            onFinancingChange={async (updated: FinancingInfo) => {
              const effectivePrice = updated.negotiatedPrice ?? condition.askingPrice;
              const taxAmt = parseFloat(((effectivePrice || 0) * ((updated.salesTaxRate || 0) / 100)).toFixed(2));
              const computedLoanAmount = Math.max(0, effectivePrice + (updated.fees || 0) + taxAmt - (updated.downPayment || 0));
              const withLoanAmount = { ...updated, loanAmount: computedLoanAmount };
              const updatedDepTable = (() => {
                const table = analysis.depreciationTable;
                if (!table || !computedLoanAmount || !withLoanAmount.loanTerm) return table;
                const P = computedLoanAmount;
                const monthlyRate = ((withLoanAmount.apr || 0) / 100) / 12;
                const totalMonths = withLoanAmount.loanTerm;
                const monthlyPmt = monthlyRate > 0
                  ? P * (monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) / (Math.pow(1 + monthlyRate, totalMonths) - 1)
                  : P / totalMonths;
                const balanceAfter = (months: number) => {
                  if (months >= totalMonths) return 0;
                  if (monthlyRate > 0) return P * Math.pow(1 + monthlyRate, months) - monthlyPmt * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
                  return Math.max(0, P - monthlyPmt * months);
                };
                return table.map((row) => ({ ...row, loanBalance: Math.max(0, Math.round(balanceAfter(row.year * 12))) }));
              })();
              setVehicleData((prev: any) => ({ ...prev, financing: withLoanAmount }));
              setAnalysis((prev) => prev ? { ...prev, depreciationTable: updatedDepTable } : prev);
              if (isSavedReport && id) {
                await supabase.from("vehicle_reports").update({
                  financing_type: withLoanAmount.type,
                  loan_amount: computedLoanAmount || null,
                  loan_term: withLoanAmount.loanTerm || null,
                  apr: withLoanAmount.apr || null,
                  monthly_payment: withLoanAmount.monthlyPayment || null,
                  lease_term_months: withLoanAmount.leaseTermMonths || null,
                  residual_value: withLoanAmount.residualValue || null,
                  negotiated_price: withLoanAmount.negotiatedPrice && withLoanAmount.negotiatedPrice !== condition.askingPrice ? withLoanAmount.negotiatedPrice : null,
                  sales_tax_rate: withLoanAmount.salesTaxRate ?? null,
                  fees: withLoanAmount.fees ?? null,
                  down_payment: withLoanAmount.downPayment ?? null,
                  depreciation_table: updatedDepTable as any,
                }).eq("id", id);
              }
            }}
          />

          {/* Financing Dialog (for adding financing from cash) */}
          {financingSkipped && (
            <Dialog open={showFinancingDialog} onOpenChange={setShowFinancingDialog}>
              <DialogContent className="max-w-md">
                <VisuallyHidden><DialogTitle>Edit Financing Details</DialogTitle></VisuallyHidden>
                <div className="py-2">
                  <FinancingStep
                    askingPrice={condition.askingPrice}
                    onBack={() => setShowFinancingDialog(false)}
                    onComplete={async (newFinancing) => {
                      setShowFinancingDialog(false);
                      const effectivePrice = newFinancing.negotiatedPrice ?? condition.askingPrice;
                      const taxAmt = parseFloat(((effectivePrice || 0) * ((newFinancing.salesTaxRate || 0) / 100)).toFixed(2));
                      const computedLoanAmount = Math.max(0, effectivePrice + (newFinancing.fees || 0) + taxAmt - (newFinancing.downPayment || 0));
                      const withLoanAmount = { ...newFinancing, loanAmount: computedLoanAmount };
                      const updatedDepTable = (() => {
                        const table = analysis.depreciationTable;
                        if (!table || !computedLoanAmount || !withLoanAmount.loanTerm) return table;
                        const P = computedLoanAmount;
                        const monthlyRate = ((withLoanAmount.apr || 0) / 100) / 12;
                        const totalMonths = withLoanAmount.loanTerm;
                        const monthlyPmt = monthlyRate > 0
                          ? P * (monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) / (Math.pow(1 + monthlyRate, totalMonths) - 1)
                          : P / totalMonths;
                        const balanceAfter = (months: number) => {
                          if (months >= totalMonths) return 0;
                          if (monthlyRate > 0) return P * Math.pow(1 + monthlyRate, months) - monthlyPmt * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
                          return Math.max(0, P - monthlyPmt * months);
                        };
                        return table.map((row) => ({ ...row, loanBalance: Math.max(0, Math.round(balanceAfter(row.year * 12))) }));
                      })();
                      setVehicleData((prev: any) => ({ ...prev, financing: { ...withLoanAmount, skipped: false } }));
                      setAnalysis((prev) => prev ? { ...prev, depreciationTable: updatedDepTable } : prev);
                      if (isSavedReport && id) {
                        await supabase.from("vehicle_reports").update({
                          financing_type: withLoanAmount.type,
                          loan_amount: computedLoanAmount || null,
                          loan_term: withLoanAmount.loanTerm || null,
                          apr: withLoanAmount.apr || null,
                          monthly_payment: withLoanAmount.monthlyPayment || null,
                          negotiated_price: withLoanAmount.negotiatedPrice && withLoanAmount.negotiatedPrice !== condition.askingPrice ? withLoanAmount.negotiatedPrice : null,
                          sales_tax_rate: withLoanAmount.salesTaxRate ?? null,
                          fees: withLoanAmount.fees ?? null,
                          down_payment: withLoanAmount.downPayment ?? null,
                          depreciation_table: updatedDepTable as any,
                        }).eq("id", id);
                      }
                    }}
                  />
                </div>
              </DialogContent>
            </Dialog>
          )}

          {/* ===== SECTION 6: 5-YEAR TCO (Fix 7: Fuel Economy collapsed into Monthly Cost) ===== */}
          <div id="section-tco" className="space-y-6">

          {/* ===== SECTION 7: DEPRECIATION CHART (kept as-is) ===== */}
          <Card className="overflow-hidden max-w-[calc(100vw-2rem)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 flex-wrap">
                <TrendingDown className="h-5 w-5 text-primary shrink-0" />
                <span>5-Year Depreciation & Equity</span>
                {pricingSources.length > 0 ? (
                  <Badge variant="outline" className="ml-auto gap-1 border-risk-green/30 bg-risk-green/10 text-risk-green text-xs font-medium">
                    <BadgeCheck className="h-3 w-3" />
                    Market Verified
                  </Badge>
                ) : (
                  <Badge variant="outline" className="ml-auto gap-1 border-neutral/30 bg-muted text-neutral text-xs font-medium">
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
                    <Line type="monotone" dataKey="Market Value" stroke="hsl(var(--success))" strokeWidth={2} />
                    <Line type="monotone" dataKey="Trade-In Value" stroke="hsl(var(--warning))" strokeWidth={2} />
                    {!financingSkipped && (
                      <Line type="monotone" dataKey="Loan Balance" stroke="#3b82f6" strokeWidth={2} strokeDasharray="5 5" />
                    )}
                    <Line type="monotone" dataKey="Asking Price" stroke="hsl(var(--danger))" strokeWidth={2} strokeDasharray="6 3" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Depreciation Table — collapsed by default */}
              <Collapsible className="mt-6">
                <CollapsibleTrigger className="flex items-center gap-1 text-[13px] text-neutral hover:text-foreground">
                  Detailed Year-by-Year Breakdown
                  <svg className="h-5 w-5 shrink-0 transition-transform duration-200 [[data-state=open]>&]:rotate-180" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  {overpaymentSignificant && (
                    <div className="mt-3 rounded-lg border border-risk-red/30 bg-risk-red/5 p-3">
                      <p className="text-xs font-semibold text-risk-red">
                        Instant equity position at purchase: −${Math.round(overpaymentAmount).toLocaleString()}
                      </p>
                      <p className="text-[11px] text-neutral mt-0.5">
                        You are paying ${condition.askingPrice.toLocaleString()} for a vehicle with a private-party fair market value of ${priceAssessment.fairMarketPrivate.toLocaleString()}. The Year-by-Year market values below start from FMV — the gap is your immediate unrealized loss.
                      </p>
                    </div>
                  )}
                  <div className="overflow-x-auto -mx-3 px-3 md:mx-0 md:px-0 mt-3" style={{ maxWidth: 'calc(100vw - 2rem)' }}>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs whitespace-nowrap px-1.5 md:px-4">Year</TableHead>
                          {!financingSkipped && <TableHead className="text-right text-xs px-1.5 md:px-4 leading-tight">Loan<br/>Balance</TableHead>}
                          <TableHead className="text-right text-xs whitespace-nowrap px-1.5 md:px-4">Repairs</TableHead>
                          <TableHead className="text-right text-xs whitespace-nowrap px-1.5 md:px-4">Maint.</TableHead>
                          <TableHead className="text-right text-xs whitespace-nowrap px-1.5 md:px-4">Depreciation</TableHead>
                          <TableHead className="text-right text-xs px-1.5 md:px-4 leading-tight">Market<br/>Value</TableHead>
                          <TableHead className="text-right text-xs px-1.5 md:px-4 leading-tight">Trade-In<br/>Value</TableHead>
                          <TableHead className="text-right text-xs px-1.5 md:px-4 leading-tight">Est. Vehicle<br/>Value</TableHead>
                          {!financingSkipped && <TableHead className="text-right text-xs whitespace-nowrap px-1.5 md:px-4">Equity</TableHead>}
                          <TooltipProvider>
                            <RadixTooltip>
                              <RadixTooltipTrigger asChild>
                                <TableHead className="text-right text-xs px-1.5 md:px-4 leading-tight cursor-help">Net<br/>Position <span className="text-[10px]">ⓘ</span></TableHead>
                              </RadixTooltipTrigger>
                              <RadixTooltipContent side="top" className="max-w-xs p-2">
                                <p className="text-xs">Total financial gain/loss vs. all costs including purchase price</p>
                              </RadixTooltipContent>
                            </RadixTooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <RadixTooltip>
                              <RadixTooltipTrigger asChild>
                                <TableHead className="text-right text-xs px-1.5 md:px-4 leading-tight cursor-help">Value vs.<br/>What You Paid <span className="text-[10px]">ⓘ</span></TableHead>
                              </RadixTooltipTrigger>
                              <RadixTooltipContent side="top" className="max-w-xs p-2">
                                <p className="text-xs">Market value minus your purchase price. Negative means the vehicle is worth less than you paid (unrealized loss).</p>
                              </RadixTooltipContent>
                            </RadixTooltip>
                          </TooltipProvider>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(() => {
                          const loanAmt = liveLoanMetrics.totalCost;
                          const tradeInVal = Math.round(priceAssessment.fairMarketTradeIn || startingFMV * 0.85);
                          const yr0Equity = startingFMV - loanAmt;
                          const yr0NetPosition = startingFMV - purchasePrice;
                          return (
                            <TableRow>
                              <TableCell className="font-medium text-xs whitespace-nowrap px-1.5 md:px-4">Yr 0</TableCell>
                              {!financingSkipped && <TableCell className="text-right text-xs whitespace-nowrap px-1.5 md:px-4">${Math.round(loanAmt).toLocaleString()}</TableCell>}
                              <TableCell className="text-right text-xs whitespace-nowrap px-1.5 md:px-4 text-danger">$0</TableCell>
                              <TableCell className="text-right text-xs whitespace-nowrap px-1.5 md:px-4 text-danger">$0</TableCell>
                              <TableCell className="text-right text-xs whitespace-nowrap px-1.5 md:px-4 font-bold text-destructive">$0</TableCell>
                              <TableCell className="text-right text-xs whitespace-nowrap px-1.5 md:px-4">${startingFMV.toLocaleString()}</TableCell>
                              <TableCell className="text-right text-xs whitespace-nowrap px-1.5 md:px-4">${tradeInVal.toLocaleString()}</TableCell>
                              <TableCell className="text-right text-xs whitespace-nowrap px-1.5 md:px-4 font-bold text-foreground">${startingFMV.toLocaleString()}</TableCell>
                              {!financingSkipped && (
                                <TableCell className={cn("text-right text-xs whitespace-nowrap px-1.5 md:px-4 font-bold", yr0Equity >= 0 ? "text-risk-green" : "text-destructive")}>
                                  {yr0Equity < 0 ? "-" : ""}${Math.abs(yr0Equity).toLocaleString()}
                                </TableCell>
                              )}
                              <TableCell className={cn("text-right text-xs whitespace-nowrap px-1.5 md:px-4 font-bold", yr0NetPosition >= 0 ? "text-risk-green" : "text-destructive")}>
                                {yr0NetPosition < 0 ? "-" : ""}${Math.abs(yr0NetPosition).toLocaleString()}
                              </TableCell>
                              {(() => {
                                const yr0VsPaid = startingFMV - purchasePrice;
                                return (
                                  <TableCell className={cn("text-right text-xs whitespace-nowrap px-1.5 md:px-4 font-bold", yr0VsPaid >= 0 ? "text-risk-green" : "text-destructive")}>
                                    {yr0VsPaid < 0 ? "-" : ""}${Math.abs(yr0VsPaid).toLocaleString()}
                                  </TableCell>
                                );
                              })()}
                            </TableRow>
                          );
                        })()}
                        {depreciationTable.map((row) => {
                          const estValue = row.marketValue;
                          const isZeroValue = estValue === 0;
                          const cumulativeCosts = cumulativeOwnershipCostMap.get(row.year);
                          const netPosition = estValue - purchasePrice - (cumulativeCosts?.cumulativeRepairs ?? 0) - (cumulativeCosts?.cumulativeMaintenance ?? 0);
                          return (
                            <TableRow key={row.year}>
                              <TableCell className="font-medium text-xs whitespace-nowrap px-1.5 md:px-4">Yr {row.year}</TableCell>
                              {!financingSkipped && <TableCell className="text-right text-xs whitespace-nowrap px-1.5 md:px-4">${row.loanBalance.toLocaleString()}</TableCell>}
                              <TableCell className="text-right text-xs whitespace-nowrap px-1.5 md:px-4 text-danger">${row.repairCosts.toLocaleString()}</TableCell>
                              <TableCell className="text-right text-xs whitespace-nowrap px-1.5 md:px-4 text-danger">${row.maintenanceCosts.toLocaleString()}</TableCell>
                              <TableCell className="text-right text-xs whitespace-nowrap px-1.5 md:px-4 font-bold text-destructive">-${row.depreciation.toLocaleString()}</TableCell>
                              <TableCell className="text-right text-xs whitespace-nowrap px-1.5 md:px-4">${row.marketValue.toLocaleString()}</TableCell>
                              <TableCell className="text-right text-xs whitespace-nowrap px-1.5 md:px-4">${row.tradeInValue.toLocaleString()}</TableCell>
                              <TableCell className={cn("text-right text-xs whitespace-nowrap px-1.5 md:px-4 font-bold", isZeroValue ? "text-destructive" : "text-foreground")}>
                                ${estValue.toLocaleString()}
                                {isZeroValue && <span className="text-[10px] block text-neutral">Repair costs may exceed value</span>}
                              </TableCell>
                              {!financingSkipped && (
                                <TableCell className={cn("text-right text-xs whitespace-nowrap px-1.5 md:px-4 font-bold", row.equity >= 0 ? "text-risk-green" : "text-destructive")}>
                                  {row.equity < 0 ? "-" : ""}${Math.abs(row.equity).toLocaleString()}
                                </TableCell>
                              )}
                              <TableCell className={cn("text-right text-xs whitespace-nowrap px-1.5 md:px-4 font-bold", netPosition >= 0 ? "text-risk-green" : "text-destructive")}>
                                {netPosition < 0 ? "-" : ""}${Math.abs(netPosition).toLocaleString()}
                              </TableCell>
                              {(() => {
                                const vsPaid = row.marketValue - purchasePrice;
                                return (
                                  <TableCell className={cn("text-right text-xs whitespace-nowrap px-1.5 md:px-4 font-bold", vsPaid >= 0 ? "text-risk-green" : "text-destructive")}>
                                    {vsPaid < 0 ? "-" : ""}${Math.abs(vsPaid).toLocaleString()}
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
                    <p className="text-xs text-neutral mt-2">
                      <span className="font-bold">*Does not include Taxes and Fees included in the purchase since no financing data was provided</span>
                    </p>
                  )}
                </CollapsibleContent>
              </Collapsible>

              {/* Cost Data Sources */}
              {maintenanceSources.length > 0 && (
                <div className="mt-4 rounded-lg border border-dashed p-3">
                  <p className="text-xs font-medium text-neutral mb-2">Repair & Maintenance Cost Sources</p>
                  <div className="flex flex-wrap gap-2">
                    {(() => {
                      const seen = new Map<string, { displayName: string; url: string }>();
                      for (const url of maintenanceSources) {
                        try {
                          const hostname = new URL(url).hostname.replace("www.", "");
                          const domain = hostname.split(".")[0];
                          if (!seen.has(domain)) seen.set(domain, { displayName: domain.charAt(0).toUpperCase() + domain.slice(1), url });
                        } catch {}
                      }
                      return Array.from(seen.values()).map(({ displayName, url }) => (
                        <a key={displayName} href={url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs text-neutral hover:text-foreground transition-colors">
                          <ExternalLink className="h-3 w-3" />{displayName}
                        </a>
                      ));
                    })()}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          </div>

          {/* ===== SECTION 5: PRICING ANALYSIS ===== */}
          <div id="section-pricing" className="report-card">
            {/* "Is this a good deal?" header */}
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-foreground">Asking Price vs. Market Assessment</h2>
              {(() => {
                const hasMarketData = !pricingDataUnavailable && (priceAssessment.fairMarketPrivate > 0 || (priceAssessment.fairMarketDealer ?? 0) > 0);
                if (!hasMarketData) return <p className="text-sm text-neutral mt-1">Market pricing data is not available for this vehicle. Deal rating is withheld.</p>;
                // Fix 2: Use seller-type-appropriate benchmark
                const isDealer = condition.sellerType === "dealer";
                const benchmark = isDealer
                  ? (priceAssessment.fairMarketDealer || priceAssessment.fairMarketPrivate)
                  : priceAssessment.fairMarketPrivate;
                const benchmarkLabel = isDealer ? "dealer retail" : "fair market value";
                const diff = condition.askingPrice - benchmark;
                const below = diff <= 0;
                return (
                  <p className={cn("text-sm font-medium mt-1", below ? "text-risk-green" : "text-risk-red")}>
                    {below ? "Yes — " : ""}Priced ${Math.abs(diff).toLocaleString()} {below ? "below" : "above"} {benchmarkLabel}
                  </p>
                );
              })()}
            </div>

            {/* Price Assessment header with badges */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <DollarSign className="h-5 w-5 text-primary" />
              <span className="font-semibold">Price Assessment</span>
              {pricingLastUpdated && (
                <span className="text-xs text-neutral">
                  (last updated {pricingLastUpdated.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "2-digit" })})
                </span>
              )}
              <div className="ml-auto flex items-center gap-2">
                {pricingSources.length > 0 ? (
                  <Badge variant="outline" className="gap-1 border-risk-green/30 bg-risk-green/10 text-risk-green text-xs font-medium">
                    <BadgeCheck className="h-3 w-3" />
                    Market Verified
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1 border-neutral/30 bg-muted text-neutral text-xs font-medium">
                    <Bot className="h-3 w-3" />
                    AI Estimated
                  </Badge>
                )}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7" disabled={isRefreshingPricing} title="Refresh pricing data">
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
            </div>

            {/* Existing price bar visualization — kept as-is */}
            <div className="space-y-4">
              {(() => {
                const hasMarketData = (priceAssessment.fairMarketPrivate > 0 || (priceAssessment.fairMarketDealer ?? 0) > 0);

                if (!hasMarketData) {
                  return (
                    <div className="relative pt-14 pb-4 mt-2">
                      <div className="absolute top-0 right-4 flex flex-col items-center">
                        <p className="text-[10px] text-neutral text-center mb-0.5">Asking Price</p>
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
                      <p className="text-xs text-neutral mt-3 text-center">Market comparison unavailable — only asking price is shown.</p>
                    </div>
                  );
                }

                const fairMarketValue = condition.sellerType === "dealer"
                  ? (priceAssessment.fairMarketDealer || priceAssessment.fairMarketPrivate)
                  : priceAssessment.fairMarketPrivate;
                const markers: { label: string; value: number; isAsking?: boolean; isFairMarket?: boolean }[] = [];
                if (priceAssessment.fairMarketTradeIn > 0) markers.push({ label: "Trade-In", value: priceAssessment.fairMarketTradeIn });
                if (fairMarketValue > 0) markers.push({ label: "Fair Market Value", value: fairMarketValue, isFairMarket: true });
                if (priceAssessment.fairMarketDealer && priceAssessment.fairMarketDealer > 0 && condition.sellerType !== "dealer") markers.push({ label: "Dealer Retail", value: priceAssessment.fairMarketDealer });
                if (condition.sellerType === "dealer" && priceAssessment.fairMarketPrivate > 0) markers.push({ label: "Private Sale", value: priceAssessment.fairMarketPrivate });
                markers.push({ label: "Asking Price", value: condition.askingPrice, isAsking: true });

                const tradeInVal = priceAssessment.fairMarketTradeIn > 0 ? priceAssessment.fairMarketTradeIn : fairMarketValue * 0.85;
                const fmvVal = fairMarketValue;
                const barMin = tradeInVal * 0.90;
                const barMax = fmvVal * 1.35;
                const barRange = barMax - barMin || 1;
                const toPct = (v: number) => Math.max(5, Math.min(92, ((v - barMin) / barRange) * 100));
                const fmvPct = toPct(fmvVal);

                return (
                  <div className={cn("relative pb-14 mt-2", financing?.negotiatedPrice && financing.negotiatedPrice !== condition.askingPrice ? "pt-24" : "pt-14")}>
                    {(() => {
                      const askPct = toPct(condition.askingPrice);
                      const hasNegotiated = !!(financing?.negotiatedPrice && financing.negotiatedPrice !== condition.askingPrice);
                      const clampStyle = askPct > 80
                        ? { left: `${askPct}%`, transform: "translateX(-80%)" }
                        : askPct < 20 ? { left: `${askPct}%`, transform: "translateX(-20%)" }
                        : { left: `${askPct}%`, transform: "translateX(-50%)" };
                      const topStyle = hasNegotiated ? { top: "2.5rem" } : { top: 0 };
                      return (
                        <div className="absolute flex flex-col items-center" style={{ ...clampStyle, ...topStyle }}>
                          <p className="text-[10px] text-neutral text-center mb-0.5">Asking Price</p>
                          <div className="rounded-lg border bg-card px-3 py-1.5 text-sm font-bold shadow-sm whitespace-nowrap">
                            ${condition.askingPrice.toLocaleString()}
                          </div>
                        </div>
                      );
                    })()}

                    {financing?.negotiatedPrice && financing.negotiatedPrice !== condition.askingPrice && (() => {
                      const negPct = toPct(financing.negotiatedPrice);
                      const clampStyle = negPct > 80
                        ? { left: `${negPct}%`, transform: "translateX(-80%)" }
                        : negPct < 20 ? { left: `${negPct}%`, transform: "translateX(-20%)" }
                        : { left: `${negPct}%`, transform: "translateX(-50%)" };
                      return (
                        <div className="absolute top-0 flex flex-col items-center" style={{ ...clampStyle, bottom: "3.5rem" }}>
                          <p className="text-[10px] text-risk-green text-center mb-0.5 font-medium">Negotiated Price</p>
                          <div className="rounded-lg border border-risk-green/40 bg-risk-green/10 px-3 py-1.5 text-sm font-bold shadow-sm whitespace-nowrap text-risk-green">
                            ${financing.negotiatedPrice.toLocaleString()}
                          </div>
                          <div className="flex-1 mt-1 w-px bg-risk-green/60" />
                        </div>
                      );
                    })()}

                    <div className="relative h-2.5 w-full">
                      <div className="absolute inset-0 rounded-full overflow-hidden">
                        <div className="absolute inset-0 rounded-full" style={{
                          background: `linear-gradient(to right, hsl(145 60% 36%) 0%, hsl(var(--success)) ${fmvPct * 0.5}%, hsl(var(--success)) ${fmvPct}%, hsl(var(--warning)) ${fmvPct + (100 - fmvPct) * 0.6}%, hsl(var(--danger)) 100%)`
                        }} />
                      </div>
                      {(() => {
                        const askPct = toPct(condition.askingPrice);
                        return (
                          <div className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${askPct}%`, top: "50%" }}>
                            <div className="h-5 w-5 rounded-full border-[3px] border-warning bg-background shadow-md" />
                          </div>
                        );
                      })()}
                      {financing?.negotiatedPrice && financing.negotiatedPrice !== condition.askingPrice && (() => {
                        const negPct = toPct(financing.negotiatedPrice);
                        return (
                          <div className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${negPct}%`, top: "50%" }}>
                            <div className="h-5 w-5 rounded-full border-[3px] border-risk-green bg-background shadow-md" />
                          </div>
                        );
                      })()}
                    </div>

                    <div className="relative mt-5">
                      {markers.filter(m => !m.isAsking).map((m) => {
                        const mPct = toPct(m.value);
                        const markerStyle = mPct > 85
                          ? { left: `${mPct}%`, transform: "translateX(-90%)" }
                          : mPct < 15 ? { left: `${mPct}%`, transform: "translateX(-10%)" }
                          : { left: `${mPct}%`, transform: "translateX(-50%)" };
                        const textAlign = mPct > 85 ? "text-right" : mPct < 15 ? "text-left" : "text-center";
                        return (
                          <div key={m.label} className={cn("absolute", textAlign)} style={markerStyle}>
                            <div className={cn("mb-0.5 h-2.5 w-px", m.isFairMarket ? "bg-primary" : "bg-neutral/40", mPct > 85 ? "ml-auto" : mPct < 15 ? "" : "mx-auto")} />
                            <p className={cn("text-[10px] leading-tight whitespace-nowrap", m.isFairMarket ? "font-medium text-primary" : "text-neutral")}>{m.label}</p>
                            <p className={cn("text-xs font-semibold whitespace-nowrap", m.isFairMarket && "text-primary")}>${m.value.toLocaleString()}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Pricing Sources — collapsible */}
            {pricingSources.length > 0 && (
              <Collapsible>
                <CollapsibleTrigger className="flex items-center gap-1 text-[13px] text-neutral hover:text-foreground mt-4">
                  View All Pricing Sources
                  <svg className="h-5 w-5 shrink-0 transition-transform duration-200 [[data-state=open]>&]:rotate-180" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="rounded-lg border border-dashed p-3 space-y-3 mt-2">
                    {sourceBreakdown.length > 0 && (
                      <div className="space-y-2">
                        {sourceBreakdown.map((src) => {
                          const range = (low?: number | null, high?: number | null, mid?: number | null) => {
                            if (low && high) return `$${low.toLocaleString()} – $${high.toLocaleString()}`;
                            if (mid) return `$${mid.toLocaleString()}`;
                            return null;
                          };
                          const privateVal = range(src.privatePartyLow, src.privatePartyHigh, src.privateParty);
                          const dealerVal = range(src.dealerRetailLow, src.dealerRetailHigh, src.dealerRetail);
                          const tradeInVal = range(src.tradeInLow, src.tradeInHigh, src.tradeIn);
                          if (!privateVal && !dealerVal && !tradeInVal) return null;
                          return (
                            <div key={src.source} className="rounded-md bg-muted/50 p-2.5">
                              <p className="text-xs font-semibold text-foreground mb-1.5">{src.source}</p>
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                                {tradeInVal && <div><span className="text-neutral">Trade-In</span><p className="font-medium text-foreground">{tradeInVal}</p></div>}
                                {privateVal && <div><span className="text-neutral">Private Party</span><p className="font-medium text-foreground">{privateVal}</p></div>}
                                {dealerVal && <div><span className="text-neutral">Dealer Retail</span><p className="font-medium text-foreground">{dealerVal}</p></div>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {(() => {
                        const knownSources: Record<string, string> = {
                          kbb: "Kelley Blue Book", repairpal: "RepairPal", edmunds: "Edmunds",
                          carfax: "CARFAX", autocheck: "AutoCheck", cargurus: "CarGurus",
                          nada: "NADA Guides", nadaguides: "NADA Guides", truecar: "TrueCar",
                          marketcheck: "MarketCheck", yourmechanic: "YourMechanic",
                        };
                        const seen = new Map<string, { displayName: string; url: string }>();
                        for (const url of pricingSources) {
                          try {
                            const hostname = new URL(url).hostname.replace("www.", "");
                            const domain = hostname.split(".")[0];
                            if (!seen.has(domain)) {
                              seen.set(domain, { displayName: knownSources[domain] || domain.charAt(0).toUpperCase() + domain.slice(1), url });
                            }
                          } catch {}
                        }
                        return Array.from(seen.values()).map(({ displayName, url }) => (
                          <a key={displayName} href={url} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs text-neutral hover:text-foreground transition-colors">
                            <ExternalLink className="h-3 w-3" />{displayName}
                          </a>
                        ));
                      })()}
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>

          {/* ===== SECTION 8: RISK ASSESSMENT — VISUAL BARS ===== */}
          <div id="section-risk" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-primary" />
                  Purchase Risk Profile
                  {uvprsResult && (
                    <Badge className={cn("ml-auto text-xs", {
                      "bg-risk-green text-white": uvprsResult.totalScore <= 30,
                      "bg-risk-amber text-white": uvprsResult.totalScore > 30 && uvprsResult.totalScore <= 55,
                      "bg-risk-red text-white": uvprsResult.totalScore > 55,
                    })}>
                      {uvprsResult.totalScore} / 100 — {uvprsResult.riskLabel}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Upload CarFax banner */}
                {!vehicleData?.condition?.isBrandNew && !vehicleData?.history?.serviceRecords && (
                  <div className="flex w-full items-center gap-3 text-sm font-medium text-primary">
                    <span className="min-w-0 flex-1">📋 Service history not verified — upload a CarFax/AutoCheck for a more accurate analysis</span>
                    <input
                      ref={headerHistoryInputRef}
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        e.target.value = "";
                        setIsUploadingHistory(true);
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
                            vehicle: { ...vehicleData.vehicle, ...(extractedVin && !vehicleData.vehicle.vin ? { vin: extractedVin } : {}) },
                            history: { ...vehicleData.history, ...result.history, serviceRecords: true },
                          };
                          setVehicleData(updatedVehicleData);
                          sessionStorage.setItem("analysisData", JSON.stringify(updatedVehicleData));
                          sonnerToast.success("History report uploaded! Re-analyzing...");
                          const { data: analysisResult, error: invokeError } = await supabase.functions.invoke("analyze-vehicle", { body: updatedVehicleData });
                          if (invokeError) throw invokeError;
                          if (analysisResult?.success) {
                            const newAn2 = analysisResult.analysis;
                            if (analysis && newAn2.priceAssessment && !(newAn2.priceAssessment.fairMarketPrivate > 0 || newAn2.priceAssessment.fairMarketDealer > 0)) {
                              newAn2.priceAssessment = { ...newAn2.priceAssessment, ...analysis.priceAssessment };
                            }
                            setAnalysis(newAn2);
                            if (analysisResult.mpgData) setMpgData({ mpgCity: analysisResult.mpgData.mpgCity, mpgHighway: analysisResult.mpgData.mpgHighway, mpgCombined: analysisResult.mpgData.mpgCombined, fuelType: analysisResult.mpgData.fuelType, evRange: analysisResult.mpgData.evRange ?? null });
                            if (analysisResult.pricingSources?.length) { setPricingSources(analysisResult.pricingSources); setPricingLastUpdated(new Date()); }
                            if (analysisResult.maintenanceSources?.length) setMaintenanceSources(analysisResult.maintenanceSources);
                            if (analysisResult.sourceBreakdown?.length) setSourceBreakdown(analysisResult.sourceBreakdown);
                            if (isSavedReport && id) {
                              const { priceAssessment: pa, depreciationTable: dt, riskAssessment: ra, historyAnalysis: ha } = analysisResult.analysis;
                              const sideUpd: Record<string, any> = {
                                deal_rating: pa.dealRating, price_difference: pa.priceDifference, risk_level: ra.level,
                                depreciation_risk: ra.depreciationRisk, reliability_concerns: ra.reliabilityConcerns,
                                value_proposition: ra.valueProposition, fair_offer_price: ra.fairOfferPrice, expert_opinion: ra.expertOpinion,
                                health_score: ha.healthScore, history_issues: ha.concerns || [], history_positives: ha.positives || [],
                                depreciation_table: dt as any, has_service_records: true,
                                accident_count: result.history?.accidentCount ?? null, owner_count: result.history?.ownerCount ?? null,
                                title_status: result.history?.titleStatus ?? null, service_gap_miles: result.history?.serviceGapMiles ?? null,
                                major_services_due: result.history?.majorServicesDue ?? null, major_services_done: result.history?.majorServicesDone ?? null,
                                chronic_repair_systems: result.history?.chronicRepairSystems ?? null,
                                ...(extractedVin && !vehicleData.vehicle.vin ? { vin: extractedVin } : {}),
                                pricing_sources: analysisResult.pricingSources || [], pricing_last_updated: new Date().toISOString(),
                                source_breakdown: analysisResult.sourceBreakdown || [],
                              };
                              if (pa.fairMarketPrivate > 0 || pa.fairMarketDealer > 0) {
                                sideUpd.fair_market_private = pa.fairMarketPrivate;
                                sideUpd.fair_market_dealer = pa.fairMarketDealer || null;
                                sideUpd.fair_market_trade_in = pa.fairMarketTradeIn;
                              }
                              await supabase.from("vehicle_reports").update(sideUpd).eq("id", id);
                            }
                            sonnerToast.success("Report updated with history data!");
                          } else { throw new Error(analysisResult?.error || "Re-analysis failed"); }
                        } catch (err) { console.error("History upload error:", err); sonnerToast.error("Failed to process history report"); }
                        finally { setIsUploadingHistory(false); }
                      }}
                    />
                    <Button variant="outline" size="sm" className="ml-auto shrink-0 border-primary bg-primary text-primary-foreground hover:bg-primary/90"
                      onClick={() => headerHistoryInputRef.current?.click()} disabled={isUploadingHistory}>
                      {isUploadingHistory ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}
                      {isUploadingHistory ? "Processing..." : "Upload CarFax/AutoCheck"}
                    </Button>
                  </div>
                )}

                {/* Visual bar chart rows */}
                {uvprsResult && (
                  <div className="space-y-2.5">
                    {[...uvprsResult.factors]
                      .sort((a, b) => (b.weight * b.score) - (a.weight * a.score))
                      .map((factor) => {
                        const barColor = !factor.known ? "bg-muted-foreground/30"
                          : factor.score <= 30 ? "bg-risk-green"
                          : factor.score <= 65 ? "bg-risk-amber"
                          : "bg-risk-red";
                        const textColor = !factor.known ? "text-neutral"
                          : factor.score <= 30 ? "text-risk-green"
                          : factor.score <= 65 ? "text-risk-amber"
                          : "text-risk-red";
                        return (
                          <div key={factor.key} className="grid grid-cols-[120px_minmax(0,1fr)_3rem] items-center gap-x-3 gap-y-1 md:grid-cols-[180px_minmax(0,1fr)_3rem]">
                            <span className="text-[13px] text-foreground">
                              {factor.label} <span className="text-neutral">({Math.round(factor.weight * 100)}%)</span>
                            </span>
                            <div className="h-2 rounded bg-muted">
                              <div
                                className={cn("h-2 rounded transition-all", barColor)}
                                style={{ width: `${factor.known ? factor.score : 50}%` }}
                              />
                            </div>
                            <span className={cn("w-12 text-right text-[13px] font-semibold", textColor)}>
                              {factor.known ? Math.round(factor.score) : "N/A"}
                            </span>
                            {factor.description && (
                              factor.key === "aiFindings" ? (
                                <button
                                  type="button"
                                  className="col-start-2 col-span-2 text-xs text-primary hover:underline text-left cursor-pointer"
                                  onClick={() => {
                                    const el = document.getElementById("section-expert");
                                    if (el) {
                                      const offset = 120;
                                      const top = el.getBoundingClientRect().top + window.pageYOffset - offset;
                                      window.scrollTo({ top, behavior: "smooth" });
                                    }
                                  }}
                                >
                                  Read Expert Analysis above
                                </button>
                              ) : (
                                <p className="col-start-2 col-span-2 text-xs text-neutral">{factor.description}</p>
                              )
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}

                {/* Reliability Concerns */}
                {riskAssessment.reliabilityConcerns.length > 0 && (
                  <div className="border-t pt-4 space-y-2">
                    <p className="text-sm font-semibold">Reliability Concerns</p>
                    {riskAssessment.reliabilityConcerns.map((item, i) => {
                      const avgCost = ((item.costLow ?? 0) + (item.costHigh ?? 0)) / 2;
                      const prob = avgCost > 3000 ? "High" : avgCost > 1000 ? "Moderate" : "Low";
                      const probColor = prob === "High" ? "bg-risk-red/15 text-risk-red" : prob === "Moderate" ? "bg-risk-amber/15 text-risk-amber" : "bg-muted text-neutral";
                      return (
                        <div key={i} className="flex items-center gap-2 text-[13px]">
                          <span className="flex-1 text-foreground">{item.concern}</span>
                          <Badge className={cn("text-[10px] font-medium px-2 py-0.5 shrink-0", probColor)}>
                            {prob} likelihood
                          </Badge>
                          {(item.costLow || item.costHigh) && (
                            <span className="text-xs text-risk-red font-medium shrink-0 w-28 text-right">
                              {item.costLow && item.costHigh
                                ? `$${item.costLow.toLocaleString()}–$${item.costHigh.toLocaleString()}`
                                : item.costLow ? `$${item.costLow.toLocaleString()}+`
                                : `Up to $${item.costHigh!.toLocaleString()}`}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Depreciation Risk & Value Proposition */}
                <div className="border-t pt-4 space-y-3">
                  <div>
                    <p className="text-sm font-medium">Depreciation Risk</p>
                    <p className="text-sm text-neutral">{riskAssessment.depreciationRisk}</p>
                  </div>
                  <div className="rounded-lg bg-muted p-4">
                    <p className="text-sm font-medium">Value Proposition</p>
                    <p className="text-sm text-neutral">
                      {(() => {
                        let vp = riskAssessment.valueProposition;
                        if (displayVerdict === "Avoid") {
                          const batteryConcern = riskAssessment.reliabilityConcerns?.find((item) => /battery/i.test(item.concern));
                          const batteryLow = batteryConcern?.costLow ?? 3500;
                          const batteryHigh = batteryConcern?.costHigh ?? 12000;
                          const dealerRetailGap = priceAssessment.fairMarketDealer
                            ? priceAssessment.fairMarketDealer - condition.askingPrice
                            : null;
                          if (batteryConcern && (recallData?.openCount ?? 0) > 0) {
                            return `The $${condition.askingPrice.toLocaleString()} asking price creates the appearance of value${dealerRetailGap != null ? ` at $${Math.round(dealerRetailGap).toLocaleString()} below dealer retail` : ""} — but this discount is almost certainly priced to reflect the battery and odometer risks. At ${condition.mileage.toLocaleString()} miles with no State of Health documentation, a $${batteryLow.toLocaleString()}–$${batteryHigh.toLocaleString()} battery replacement risk effectively exceeds the vehicle's market value. This vehicle represents genuine value only if a battery diagnostic confirms SoH above 80% AND the seller resolves all ${recallData!.openCount} open recalls — without both conditions, it is a financial liability at any price.`;
                          }
                        }
                        return vp;
                      })()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ===== SECTION 9: VEHICLE HISTORY — TABBED ===== */}
          <div id="section-history">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Car className="h-5 w-5 text-primary" />
                  Vehicle History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs value={historyTab} onValueChange={setHistoryTab} className="w-full">
                  <TabsList className="w-full mb-4 overflow-x-auto">
                    <TabsTrigger value="overview" className="flex-1">Overview</TabsTrigger>
                    <TabsTrigger value="service" className="flex-1">Service Records</TabsTrigger>
                    <TabsTrigger value="recalls" className="flex-1">
                      Safety Recalls
                      {recallData && recallData.openCount > 0 && (
                        <Badge className="ml-1.5 bg-risk-red text-white text-[10px] px-1.5 py-0">{recallData.openCount}</Badge>
                      )}
                    </TabsTrigger>
                  </TabsList>

                  {/* Tab: Overview — Vehicle Health */}
                  <TabsContent value="overview">
                    {(() => {
                      const score = historyAnalysis.healthScore;
                      const scoreColor = score <= 33 ? 'text-risk-red' : score <= 66 ? 'text-risk-amber' : 'text-risk-green';
                      const barColor = score <= 33 ? '[&>div]:bg-risk-red' : score <= 66 ? '[&>div]:bg-risk-amber' : '[&>div]:bg-risk-green';
                      return (
                        <>
                          <div className="mb-4 text-center">
                            <div className={`text-4xl font-bold ${scoreColor}`}>{score}</div>
                            <p className="text-sm text-neutral">out of 100</p>
                          </div>
                          <Progress value={score} className={`h-3 ${barColor}`} />
                        </>
                      );
                    })()}
                    <div className="mt-6 space-y-4">
                      <div>
                        <h4 className="mb-2 flex items-center gap-2 text-sm font-medium text-risk-green">
                          <CheckCircle className="h-4 w-4" />
                          Positives
                        </h4>
                        <ul className="space-y-1 text-sm">
                          {historyAnalysis.positives
                            .filter((item) => {
                              const lower = item.toLowerCase();
                              return !(lower.includes("below market") || lower.includes("above market") || lower.includes("asking price") || lower.includes("dealer retail") || lower.includes("below fmv") || lower.includes("above fmv"));
                            })
                            .map((item, i) => (
                              <li key={i} className="text-neutral">• {item}</li>
                            ))}
                        </ul>
                      </div>
                      <div>
                        <h4 className="mb-2 flex items-center gap-2 text-sm font-medium text-risk-red">
                          <XCircle className="h-4 w-4" />
                          Concerns
                        </h4>
                        <ul className="space-y-1 text-sm">
                          {historyAnalysis.concerns.map((item, i) => (
                            <li key={i} className="text-neutral">• {item}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </TabsContent>

                  {/* Tab: Service Records */}
                  <TabsContent value="service">
                    <ServiceHistoryTimeline
                      serviceGapMiles={vehicleData?.history?.serviceGapMiles}
                      majorServicesDue={vehicleData?.history?.majorServicesDue}
                      majorServicesDone={vehicleData?.history?.majorServicesDone}
                      chronicRepairSystems={vehicleData?.history?.chronicRepairSystems}
                      hasServiceRecords={vehicleData?.history?.serviceRecords}
                      mileage={condition.mileage}
                    />
                  </TabsContent>

                  {/* Tab: Safety Recalls + Warranty */}
                  <TabsContent value="recalls" className="space-y-4">
                    {recallData && !recallData.isLoading && (
                      <div className={cn("rounded-lg border-2 p-4", recallData.openCount > 0 ? "border-risk-red bg-risk-red/5" : "border-risk-green bg-risk-green/5")}>
                        <div className="flex items-center gap-2 mb-3">
                          {recallData.openCount > 0 ? <ShieldAlert className="h-5 w-5 text-risk-red" /> : <ShieldCheck className="h-5 w-5 text-risk-green" />}
                          <span className="text-sm font-semibold">Safety Recalls</span>
                          <Badge className={cn("ml-auto text-xs", recallData.openCount > 0 ? "bg-risk-red text-white" : "bg-risk-green text-white")}>
                            {recallData.openCount > 0 ? `${recallData.openCount} Open` : recallData.count > 0 ? "All Resolved" : "None on Record"}
                          </Badge>
                        </div>
                        <p className="text-xs text-neutral mb-3">Via NHTSA · {vehicle.year} {vehicle.make} {vehicle.model}</p>
                        {recallData.openCount > 0 && (
                          <div className="flex items-start gap-2 rounded-md border border-risk-red/30 bg-risk-red/10 px-3 py-2 mb-3">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-risk-red" />
                            <p className="text-xs text-risk-red font-medium">
                              {recallData.openCount} open {recallData.openCount === 1 ? "recall" : "recalls"} found. Ensure resolved before purchasing.
                            </p>
                          </div>
                        )}
                        {recallData.count === 0 && (
                          <div className="flex items-center gap-2 rounded-md border border-risk-green/30 bg-risk-green/10 px-3 py-2">
                            <CheckCircle className="h-4 w-4 shrink-0 text-risk-green" />
                            <p className="text-xs text-risk-green font-medium">No recalls on record for this year/make/model.</p>
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
                                  {recall.campaignNumber && <p className="text-xs text-neutral"><span className="font-medium">Campaign:</span> {recall.campaignNumber}</p>}
                                  <p className="text-xs text-neutral leading-relaxed">{recall.summary}</p>
                                  {recall.remedyDescription && (
                                    <div className="rounded-md bg-muted px-3 py-2">
                                      <p className="text-xs font-medium mb-0.5">Remedy</p>
                                      <p className="text-xs text-neutral">{recall.remedyDescription}</p>
                                    </div>
                                  )}
                                </AccordionContent>
                              </AccordionItem>
                            ))}
                          </Accordion>
                        )}
                        <div className="flex flex-wrap gap-2 pt-2">
                          {vehicle.vin ? (
                            <a href={`https://www.nhtsa.gov/vehicle/${vehicle.vin}/complaints`} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs text-neutral hover:text-foreground transition-colors">
                              <ExternalLink className="h-3 w-3" />VIN Complaints on NHTSA
                            </a>
                          ) : (
                            <a href={`https://www.nhtsa.gov/vehicle-safety/recalls#recall--${encodeURIComponent(vehicle.make)}`} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs text-neutral hover:text-foreground transition-colors">
                              <ExternalLink className="h-3 w-3" />Search Recalls on NHTSA
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                    {recallData?.isLoading && (
                      <div className="flex items-center gap-3 p-4">
                        <Loader2 className="h-4 w-4 animate-spin text-neutral" />
                        <p className="text-sm text-neutral">Checking NHTSA recall database...</p>
                      </div>
                    )}

                    {/* Warranty Analysis */}
                    {analysis.warrantyAnalysis && (
                      <div className={cn("rounded-lg border-2 p-4", {
                        "border-risk-green bg-risk-green/5": analysis.warrantyAnalysis.warrantyStatus === "active",
                        "border-risk-red bg-risk-red/5": analysis.warrantyAnalysis.warrantyStatus === "expired",
                        "border-risk-amber bg-risk-amber/5": analysis.warrantyAnalysis.warrantyStatus === "unknown",
                      })}>
                        <div className="flex items-center gap-2 mb-3">
                          <ShieldCheck className="h-5 w-5" />
                          <span className="text-sm font-semibold">Warranty Analysis</span>
                        </div>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-neutral">Status</span>
                            <Badge variant={analysis.warrantyAnalysis.warrantyStatus === "active" ? "default" : "destructive"}>
                              {analysis.warrantyAnalysis.warrantyStatus === "active" ? "Active" : analysis.warrantyAnalysis.warrantyStatus === "expired" ? "Expired" : "Unknown"}
                            </Badge>
                          </div>
                          {analysis.warrantyAnalysis.warrantyMonthsRemaining != null && (
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-neutral">Months Remaining</span>
                              <span className="font-semibold">{analysis.warrantyAnalysis.warrantyMonthsRemaining}</span>
                            </div>
                          )}
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-neutral">Risk Reduction</span>
                            <span className="font-semibold">{analysis.warrantyAnalysis.riskReductionFactor}%</span>
                          </div>
                          <Progress value={analysis.warrantyAnalysis.riskReductionFactor} className="h-2" />
                          <p className="text-sm text-neutral">{analysis.warrantyAnalysis.warrantyNotes}</p>
                        </div>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* Vehicle Specs moved to Verdict Hero (Fix 8) — section removed */}

          {/* ===== SECTION 11: VEHICLE IMAGES ===== */}
          {condition?.images && condition.images.length > 1 && (
            <VehicleImageGallery
              images={condition.images}
              vehicleName={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
              listingUrl={condition.listingUrl}
            />
          )}

          {/* ===== SECTION 12: DEALER REVIEW ===== */}
          <DealerReview
            dealerName={condition?.sellerName}
            listingUrl={condition?.listingUrl}
            sellerType={condition?.sellerType}
            isPro={isPro}
            onAnalysisComplete={setDealerAnalysis}
          />




          {/* ===== VERDICT DECISION GATE ===== */}
          <Card id="section-verdict" className="overflow-hidden">
            {/* Top band — verdict repeat */}
            <div className={cn("p-5 border-b-2", {
              "bg-risk-red/10 border-risk-red": displayVerdict === "Avoid",
              "bg-risk-amber/10 border-risk-amber": displayVerdict === "Caution",
              "bg-risk-green/10 border-risk-green": displayVerdict === "Conditional Buy",
            })}>
              <div className="flex items-center gap-3 flex-wrap">
                <Badge className={cn("text-base px-4 py-1", {
                  "bg-risk-red text-white": displayVerdict === "Avoid",
                  "bg-risk-amber text-white": displayVerdict === "Caution",
                  "bg-risk-green text-white": displayVerdict === "Conditional Buy",
                })}>
                  {displayVerdict}
                </Badge>
                {uvprsResult && (
                  <span className="text-sm text-neutral">Risk Score: <span className="font-bold text-foreground">{uvprsResult.totalScore}/100</span></span>
                )}
              </div>
              {analysis.finalVerdict?.justification && (
                <p className="text-sm text-neutral mt-2 leading-relaxed">{analysis.finalVerdict.justification}</p>
              )}
            </div>

            {/* Contingency block — Fix 5: semantic accuracy */}
            {(displayVerdict === "Avoid" || displayVerdict === "Caution") && (
              <div className="mx-5 mt-4 border-l-4 border-risk-amber bg-risk-amber/5 rounded-r-md p-4">
                <p className="text-sm font-semibold mb-2">This vehicle may be reconsidered if:</p>
                <ul className="space-y-1.5">
                  {/* Battery diagnostic condition for EVs/PHEVs */}
                  {mpgData?.fuelType?.toLowerCase().includes("electric") && (
                    <li className="text-sm text-neutral flex items-start gap-2">
                      <span className="text-risk-amber mt-0.5">•</span>
                      <span>Seller provides LeafSpy Pro battery diagnostic confirming State of Health above 80% (minimum 10 of 12 capacity bars)</span>
                    </li>
                  )}
                  {/* Open recalls */}
                  {recallData && recallData.openCount > 0 && (
                    <li className="text-sm text-neutral flex items-start gap-2">
                      <span className="text-risk-amber mt-0.5">•</span>
                      <span>All {recallData.openCount} open NHTSA safety {recallData.openCount === 1 ? "recall" : "recalls"} confirmed resolved in writing prior to purchase</span>
                    </li>
                  )}
                  {/* Deferred maintenance */}
                  {vehicleData?.history?.majorServicesDue && vehicleData.history.majorServicesDue.length > 0 && (
                    <li className="text-sm text-neutral flex items-start gap-2">
                      <span className="text-risk-amber mt-0.5">•</span>
                      <span>Seller credits buyer for immediate deferred maintenance ({vehicleData.history.majorServicesDue.join(", ")})</span>
                    </li>
                  )}
                  {/* Severe service gap / no service records */}
                  {(() => {
                    const gap = (analysis.historyAnalysis as any)?.serviceGap;
                    const hasNoRecords = vehicleData?.history?.serviceRecords === false;
                    const isSevereGap = gap?.gapSeverity === "severe" || gap?.gapSeverity === "significant";
                    if (hasNoRecords || isSevereGap) {
                      return (
                        <li className="text-sm text-neutral flex items-start gap-2">
                          <span className="text-risk-amber mt-0.5">•</span>
                          <span>Seller provides complete documented service history covering the vehicle's full ownership period</span>
                        </li>
                      );
                    }
                    return null;
                  })()}
                  {(() => {
                    const odo = (analysis.aiFindings as any)?.odometerIntegrity;
                    if (odo && odo.status === "discrepancy" && odo.gapMiles) {
                      return (
                        <li className="text-sm text-neutral flex items-start gap-2">
                          <span className="text-risk-amber mt-0.5">•</span>
                          <span>Seller provides documentation explaining the {Number(odo.gapMiles).toLocaleString()}-mile odometer discrepancy</span>
                        </li>
                      );
                    }
                    return null;
                  })()}
                </ul>
              </div>
            )}

            {/* Action buttons */}
            <div className="p-5 space-y-3">
              <NegotiationCheatSheet
                isPaid={isPaid}
                year={vehicle.year}
                make={vehicle.make}
                model={vehicle.model}
                trim={vehicle.trim}
                mileage={condition.mileage}
                askingPrice={condition.askingPrice}
                condition={condition.condition}
                sellerType={condition.sellerType}
                fairMarketPrivate={priceAssessment.fairMarketPrivate}
                fairMarketDealer={priceAssessment.fairMarketDealer}
                fairMarketTradeIn={priceAssessment.fairMarketTradeIn}
                dealRating={priceAssessment.dealRating}
                priceDifference={priceAssessment.priceDifference}
                accidentCount={historyAnalysis?.concerns?.filter(c => c.toLowerCase().includes("accident")).length || 0}
                ownerCount={vehicleData?.history?.ownerCount || 1}
                titleStatus={vehicleData?.history?.titleStatus || "clean"}
                serviceGapMiles={vehicleData?.history?.serviceGapMiles}
                majorServicesDue={vehicleData?.history?.majorServicesDue}
                chronicRepairSystems={vehicleData?.history?.chronicRepairSystems}
                reliabilityConcerns={riskAssessment.reliabilityConcerns}
                openRecallCount={recallData?.openCount || 0}
                recallDetails={recallData?.recalls?.slice(0, 3).map(r => r.summary || r.component).join("; ")}
                verdict={displayVerdict}
                fairOfferPrice={riskAssessment.fairOfferPrice}
                activeFaults={analysis.aiFindings?.activeServiceFaults?.map(f => ({ system: f.system, costLow: f.estimatedCostPerIncident || 500 }))}
                failurePatterns={analysis.aiFindings?.knownFailurePatterns?.map(p => ({ issue: p.issue, probability: p.probabilityTier, costLow: p.probabilityPercent > 50 ? 1500 : 800 }))}
                financingType={financing?.type}
              />
              <div>
                <Button variant="outline" className="w-full h-11 text-base bg-yellow-300 border-yellow-400 text-black hover:bg-yellow-400 hover:border-yellow-500">
                  Get Personalized Insurance Quotes
                </Button>
                <p className="text-xs text-neutral text-center mt-1">Compare rates from 80+ insurers</p>
              </div>
              <div>
                <Button variant="outline" className="w-full h-11 text-base bg-yellow-300 border-yellow-400 text-black hover:bg-yellow-400 hover:border-yellow-500">
                  Get Extended Warranty Quotes
                </Button>
                <p className="text-xs text-neutral text-center mt-1">Compare coverage from top providers</p>
              </div>
              <div className="text-center pt-4">
                <div className="flex flex-col sm:flex-row gap-3 w-full">
                  <Button asChild size="lg" className="flex-1">
                    <Link to="/analyze">
                      Analyze a Different Vehicle
                    </Link>
                  </Button>
                  <Button asChild size="lg" className="flex-1 bg-[hsl(220,70%,50%)] text-white hover:bg-[hsl(220,70%,40%)]">
                    <Link to="/dashboard">
                      Compare to Another Vehicle
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </main>

      <Footer />

      <MobileBottomBar
        verdict={displayVerdict}
        monthlyCostRange={monthlyCostRange}
        onCheatSheetClick={scrollToCheatSheet}
        isPaid={isPaid}
        heroRef={heroRef}
      />
    </div>
  );
}

