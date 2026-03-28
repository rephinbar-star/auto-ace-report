import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  ArrowRight,
  Sparkles,
  Loader2,
  Building2,
  ShieldCheck,
  ShieldAlert,
  Star,
  Scale,
  ThumbsUp,
  ThumbsDown,
  HandCoins,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SEO } from "@/components/seo/SEO";
import { generateReportPDF } from "@/lib/generatePDF";
import { calculateTCO } from "@/lib/tco-calculations";
import { toast } from "sonner";
import { SampleComparisonReport } from "@/components/sample/SampleComparisonReport";
import { RiskScoreBreakdown } from "@/components/report/RiskScoreBreakdown";
import { ServiceHistoryTimeline } from "@/components/report/ServiceHistoryTimeline";
import { calculateUVPRS } from "@/lib/uvprs-scoring";
import type { Variants } from "framer-motion";

// Animation variants
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
    },
  },
};

const statCardVariants: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.4,
    },
  },
};

// Sample data for demonstration
const sampleVehicle = {
  year: 2024,
  make: "Toyota",
  model: "RAV4",
  trim: "XLE Premium AWD",
  mileage: 18200,
  askingPrice: 34500,
  condition: "excellent",
  dealerName: "Bay Area Toyota",
  sellerType: "dealer",
};

const sampleAnalysis = {
  priceAssessment: {
    fairMarketPrivate: 33200,
    fairMarketDealer: 35200,
    fairMarketTradeIn: 30800,
    dealRating: "good" as const,
    priceDifference: -700,
    percentDifference: -2.0,
  },
  depreciationTable: [
    { year: 1, privateValue: 31500, tradeInValue: 29200, loanBalance: 28000, repairCosts: 0, maintenanceCosts: 180, netEquityPrivate: 3320, netEquityTradeIn: 1020 },
    { year: 2, privateValue: 29200, tradeInValue: 27000, loanBalance: 22400, repairCosts: 0, maintenanceCosts: 220, netEquityPrivate: 6580, netEquityTradeIn: 4380 },
    { year: 3, privateValue: 26800, tradeInValue: 24800, loanBalance: 16500, repairCosts: 250, maintenanceCosts: 280, netEquityPrivate: 9770, netEquityTradeIn: 7770 },
    { year: 4, privateValue: 24200, tradeInValue: 22400, loanBalance: 10300, repairCosts: 500, maintenanceCosts: 320, netEquityPrivate: 12880, netEquityTradeIn: 11080 },
    { year: 5, privateValue: 21500, tradeInValue: 19900, loanBalance: 3800, repairCosts: 800, maintenanceCosts: 380, netEquityPrivate: 15720, netEquityTradeIn: 14120 },
  ],
  riskAssessment: {
    level: "low" as const,
    depreciationRisk: "The Toyota RAV4 is one of the strongest value holders in the compact SUV segment, with an average depreciation of 10-13% annually. The XLE Premium trim with AWD retains value particularly well due to strong year-round demand.",
    reliabilityConcerns: [
      { concern: "Infotainment system may need software updates periodically", costLow: 0, costHigh: 150 },
      { concern: "AWD system fluid change recommended at 30k miles", costLow: 120, costHigh: 200 },
    ],
    valueProposition: "This RAV4 XLE Premium represents excellent value with its combination of Toyota reliability, low mileage, and comprehensive safety features. The asking price is slightly above market, but the near-new condition and low mileage justify the premium.",
    fairOfferPrice: 33500,
    expertOpinion: "This 2024 Toyota RAV4 XLE Premium AWD is an outstanding choice for buyers seeking a reliable, practical, and well-equipped compact SUV. With only 18,200 miles, this vehicle is barely broken in.\n\nThe 2.5-liter Dynamic Force engine delivers a smooth 203 hp while achieving impressive fuel economy for an AWD SUV. Toyota's Safety Sense 3.0 suite provides comprehensive driver assistance features that are standard on this trim.\n\nThe XLE Premium adds SofTex heated seats, an 8-inch touchscreen with wireless Apple CarPlay/Android Auto, a power liftgate, and dual-zone climate control — features that significantly enhance daily usability.\n\nAt $34,500, the asking price is approximately $1,300 above fair market value. Given the low mileage and excellent condition, I recommend negotiating toward $33,500 for a fair deal.\n\nOverall verdict: A top-tier choice with minimal ownership risk and strong long-term value retention.",
    repairAnalysis: "**Anticipated Repairs Based on Mileage & History**\n\nBased on the vehicle's current 18,200 miles and service records showing regular maintenance at Toyota dealerships, here's what to expect:\n\n**Completed Maintenance (Per Service Records):**\n• Regular oil changes every 5,000 miles ✓\n• Tire rotation every 5,000 miles ✓\n• Multi-point inspection at 15,000 miles ✓\n\n**Upcoming Service (20k-30k miles):**\n• Cabin air filter replacement (~$40-60)\n• Engine air filter replacement (~$30-50)\n• Brake inspection (~$0-50)\n\n**Mid-Term Repairs (30k-60k miles):**\n• AWD fluid change (~$120-200)\n• Brake pad replacement (~$250-400)\n• Battery replacement (~$150-200) - Typically lasts 4-5 years\n• Spark plug replacement (~$120-180)\n\n**Long-Term Considerations (60k-100k miles):**\n• Transmission fluid change (~$150-250)\n• Coolant flush (~$100-150)\n• Suspension component inspection (~$200-400)\n• Drive belt replacement (~$120-200)\n\n**Total Estimated 5-Year Repair Costs: $1,500-$2,200**\n\nThis is well below average for vehicles in this class, reflecting Toyota's exceptional reliability. The low mileage starting point means most major services are still far out.",
  },
  historyAnalysis: {
    healthScore: 94,
    positives: [
      "Single owner vehicle",
      "Clean title - no accidents reported",
      "Regular maintenance at Toyota dealership",
      "No open recalls",
      "All scheduled services completed on time",
      "Still under factory warranty",
    ],
    concerns: [
      "Minor paint chip on front bumper noted",
    ],
  },
  dealerReview: {
    dealerName: "Bay Area Toyota",
    trustScore: 88,
    trustLevel: "high" as const,
    summary: "Bay Area Toyota has earned a strong reputation for transparent pricing and exceptional customer service. Consistently rated among the top Toyota dealers in the region.",
    positives: [
      "Transparent pricing — no hidden dealer fees",
      "Excellent certified pre-owned program",
      "Responsive and knowledgeable sales team",
      "Comprehensive vehicle inspection reports provided",
    ],
    redFlags: [
      "Weekend wait times can be lengthy for service",
    ],
    sources: ["Google Reviews", "DealerRater", "Cars.com"],
  },
};

const dealRatingColors = {
  excellent: "bg-green-500 text-white",
  good: "bg-emerald-500 text-white",
  fair: "bg-yellow-500 text-white",
  overpriced: "bg-orange-500 text-white",
  poor: "bg-red-500 text-white",
};

const riskLevelColors = {
  low: "bg-green-500 text-white",
  medium: "bg-yellow-500 text-white",
  high: "bg-red-500 text-white",
};

export default function SampleReportPage() {
  const { priceAssessment, depreciationTable, riskAssessment, historyAnalysis, dealerReview } = sampleAnalysis;
  const [includeRepairs, setIncludeRepairs] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [activeTab, setActiveTab] = useState("comparison");

  // Sample granular service data
  const sampleServiceHistory = {
    serviceGapMiles: 7500,
    majorServicesDone: [
      "Oil changes every 5,000 mi",
      "Brake fluid flush at 30,000 mi",
      "Cabin & engine air filters at 35,000 mi",
    ],
    majorServicesDue: [
      "Transmission fluid change (due at 60k)",
    ],
    chronicRepairSystems: [] as string[],
  };

  // Compute UVPRS from sample data
  const sampleUVPRS = calculateUVPRS({
    year: sampleVehicle.year,
    make: sampleVehicle.make,
    mileage: sampleVehicle.mileage,
    askingPrice: sampleVehicle.askingPrice,
    titleStatus: "clean",
    accidentCount: 0,
    ownerCount: 1,
    hasServiceRecords: true,
    healthScore: historyAnalysis.healthScore,
    historyIssues: historyAnalysis.concerns,
    historyPositives: historyAnalysis.positives,
    serviceGapMiles: sampleServiceHistory.serviceGapMiles,
    majorServicesDue: sampleServiceHistory.majorServicesDue,
    majorServicesDone: sampleServiceHistory.majorServicesDone,
    chronicRepairSystems: sampleServiceHistory.chronicRepairSystems,
    fairMarketPrivate: priceAssessment.fairMarketPrivate,
    fairMarketDealer: undefined,
    openRecallCount: 0,
    warrantyMonthsRemaining: null,
    isCPO: false,
  });

  const chartData = depreciationTable.map((row) => ({
    name: `Year ${row.year}`,
    "Private Value": row.privateValue,
    "Trade-In Value": row.tradeInValue,
    "Loan Balance": row.loanBalance,
    "Cumulative Repairs": depreciationTable
      .filter((r) => r.year <= row.year)
      .reduce((sum, r) => sum + r.repairCosts + (r.maintenanceCosts || 0), 0),
  }));

  const calculateNetEquity = (row: typeof depreciationTable[0]) => {
    const cumulativeRepairs = depreciationTable
      .filter((r) => r.year <= row.year)
      .reduce((sum, r) => sum + r.repairCosts + (r.maintenanceCosts || 0), 0);
    return includeRepairs 
      ? row.tradeInValue - row.loanBalance - cumulativeRepairs
      : row.tradeInValue - row.loanBalance;
  };

  const handleDownloadPDF = async () => {
    setIsDownloading(true);
    try {
      await generateReportPDF({
        vehicle: sampleVehicle,
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
        serviceHistory: sampleServiceHistory,
        uvprsResult: sampleUVPRS,
        tcoData: (() => {
          const annualMiles = 12000;
          const tco = calculateTCO(
            sampleVehicle.askingPrice,
            30, // Toyota RAV4 combined MPG
            "gasoline",
            depreciationTable,
            { annualMiles },
            { make: sampleVehicle.make, year: sampleVehicle.year }
          );
          return { tco, annualMiles };
        })(),
        recallData: { count: 0, openCount: 0, recalls: [] },
      });
      toast.success("PDF downloaded successfully!");
    } catch (error) {
      toast.error("Failed to generate PDF");
      console.error(error);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden">
      <SEO
        title="Sample Comparison Report - CarWise"
        description="See an example of how CarWise compares multiple vehicles side-by-side to find the best deal."
      />
      <Header />
      
      <main className="flex-1 bg-gradient-to-b from-primary/5 to-background py-8">
        <div className="container mx-auto max-w-6xl px-4 overflow-x-hidden">
          {/* Sample Banner */}
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-6 rounded-lg border border-primary/20 bg-primary/5 p-4"
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <motion.div
                  animate={{ rotate: [0, 15, -15, 0] }}
                  transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                >
                  <Sparkles className="h-5 w-5 text-primary" />
                </motion.div>
                <div>
                  <p className="font-medium">This is a sample report</p>
                  <p className="text-sm text-muted-foreground">
                    See what insights you'll get when you analyze a vehicle
                  </p>
                </div>
              </div>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button asChild>
                  <Link to="/analyze">
                    Analyze Your Vehicle
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </motion.div>
            </div>
          </motion.div>

          {/* Report Type Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
            <TabsList className="grid w-full grid-cols-2 max-w-md">
              <TabsTrigger value="vehicle" className="gap-2 font-bold text-primary data-[state=active]:text-primary">
                <Car className="h-4 w-4" />
                Vehicle Report
              </TabsTrigger>
              <TabsTrigger value="comparison" className="gap-2 font-bold text-primary data-[state=active]:text-primary">
                <Scale className="h-4 w-4" />
                Comparison Report
              </TabsTrigger>
            </TabsList>

            {/* Vehicle Report Tab */}
            <TabsContent value="vehicle" className="mt-6">
              {/* Report Header */}
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
              >
            <div>
              <h1 className="text-3xl font-bold">
                {sampleVehicle.year} {sampleVehicle.make} {sampleVehicle.model}
              </h1>
              <p className="text-muted-foreground">
                {sampleVehicle.mileage.toLocaleString()} miles • Asking ${sampleVehicle.askingPrice.toLocaleString()}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled>
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
          </motion.div>

          {/* Quick Stats */}
          <div className="mb-8 grid gap-4 md:grid-cols-4">
            {[
              {
                icon: DollarSign,
                label: "Fair Market Price",
                value: `$${priceAssessment.fairMarketPrivate.toLocaleString()}`,
                iconClass: "bg-primary/10",
                iconColor: "text-primary",
              },
              {
                icon: Gauge,
                label: "Deal Rating",
                value: priceAssessment.dealRating,
                iconClass: dealRatingColors[priceAssessment.dealRating],
                capitalize: true,
              },
              {
                icon: ShieldAlert,
                label: "Risk Score",
                value: `${sampleUVPRS.totalScore} / 100`,
                iconClass: sampleUVPRS.totalScore <= 20 ? "bg-green-500 text-white"
                  : sampleUVPRS.totalScore <= 40 ? "bg-yellow-500 text-white"
                  : "bg-red-500 text-white",
              },
              {
                icon: TrendingDown,
                label: "Fair Offer",
                value: `$${riskAssessment.fairOfferPrice.toLocaleString()}`,
                iconClass: "bg-green-500/10",
                iconColor: "text-green-600",
              },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1, duration: 0.4 }}
                whileHover={{ scale: 1.05, y: -5 }}
              >
                <Card className="h-full transition-shadow hover:shadow-lg">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <motion.div 
                        className={cn("flex h-10 w-10 items-center justify-center rounded-full", stat.iconClass)}
                        whileHover={{ rotate: 10 }}
                      >
                        <stat.icon className={cn("h-5 w-5", stat.iconColor)} />
                      </motion.div>
                      <div>
                        <p className="text-sm text-muted-foreground">{stat.label}</p>
                        <p className={cn("text-xl font-bold", stat.capitalize && "capitalize")}>{stat.value}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          <div className="grid gap-8 lg:grid-cols-3 min-w-0">
            {/* Left Column - Main Content */}
            <motion.div 
              className="space-y-8 lg:col-span-2 min-w-0"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              {/* Price Assessment */}
              <motion.div variants={itemVariants}>
                <Card className="overflow-hidden">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-primary" />
                      Price Assessment
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {/* Deal rating headline */}
                      {(() => {
                        const dealRatingConfig: Record<string, { label: string; color: string }> = {
                          excellent: { label: "great deal", color: "text-success" },
                          good: { label: "good deal", color: "text-success" },
                          fair: { label: "fair deal", color: "text-warning" },
                          poor: { label: "poor deal", color: "text-warning" },
                          overpriced: { label: "overpriced", color: "text-danger" },
                        };
                        const cfg = dealRatingConfig[priceAssessment.dealRating] || dealRatingConfig.fair;
                        const sellerType = sampleVehicle.sellerType;
                        const referenceValue = sellerType === "dealer"
                          ? (priceAssessment.fairMarketDealer || priceAssessment.fairMarketPrivate)
                          : priceAssessment.fairMarketPrivate;
                        const isBelow = sampleVehicle.askingPrice <= referenceValue;
                        const contextMsg = isBelow
                          ? "This vehicle is priced below the current market average."
                          : (priceAssessment.dealRating as string) === "fair"
                            ? "This vehicle is within the current average market range."
                            : "This vehicle is priced above the current market average.";

                        // Build markers for the price bar
                        const fairMarketValue = sellerType === "dealer"
                          ? (priceAssessment.fairMarketDealer || priceAssessment.fairMarketPrivate)
                          : priceAssessment.fairMarketPrivate;
                        const markers: { label: string; value: number; isAsking?: boolean; isFairMarket?: boolean }[] = [];
                        markers.push({ label: "Trade-In", value: priceAssessment.fairMarketTradeIn });
                        markers.push({ label: "Fair Market Value", value: fairMarketValue, isFairMarket: true });
                        if (priceAssessment.fairMarketDealer && sellerType !== "dealer") {
                          markers.push({ label: "Dealer Retail", value: priceAssessment.fairMarketDealer });
                        }
                        if (sellerType === "dealer") {
                          markers.push({ label: "Private Sale", value: priceAssessment.fairMarketPrivate });
                        }
                        markers.push({ label: "Asking Price", value: sampleVehicle.askingPrice, isAsking: true });

                        // Bar calculations
                        const tradeInVal = priceAssessment.fairMarketTradeIn;
                        const fmvVal = fairMarketValue;
                        const barMin = tradeInVal * 0.90;
                        const barMax = fmvVal * 1.35;
                        const barRange = barMax - barMin || 1;
                        const toPct = (v: number) => Math.max(5, Math.min(92, ((v - barMin) / barRange) * 100));
                        const fmvPct = toPct(fmvVal);

                        return (
                          <div className="space-y-4">
                            <div>
                              <h3 className="text-2xl font-bold">
                                This vehicle is a{" "}
                                <span className={cfg.color}>{cfg.label}</span>
                              </h3>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {contextMsg} Asking price is{" "}
                                <span className={cn("font-semibold", priceAssessment.priceDifference > 0 ? "text-danger" : "text-success")}>
                                  {priceAssessment.priceDifference > 0 ? "higher" : "lower"} by ${Math.abs(priceAssessment.priceDifference).toLocaleString()}
                                </span>
                                {" "}from fair market value.
                              </p>
                            </div>

                            {/* Desktop: horizontal gradient bar */}
                            <div className="relative pt-14 pb-14 mt-2 overflow-hidden hidden md:block">
                              {/* Asking price floating label */}
                              {(() => {
                                const askPct = toPct(sampleVehicle.askingPrice);
                                const clampStyle = askPct > 80
                                  ? { left: `${askPct}%`, transform: "translateX(-80%)" }
                                  : askPct < 20
                                    ? { left: `${askPct}%`, transform: "translateX(-20%)" }
                                    : { left: `${askPct}%`, transform: "translateX(-50%)" };
                                return (
                                  <div className="absolute top-0" style={clampStyle}>
                                    <p className="text-[10px] text-muted-foreground text-center mb-0.5">Asking Price</p>
                                    <div className="rounded-lg border bg-card px-3 py-1.5 text-sm font-bold shadow-sm whitespace-nowrap">
                                      ${sampleVehicle.askingPrice.toLocaleString()}
                                    </div>
                                    <div className="mx-auto mt-1 h-3 w-px bg-border" />
                                  </div>
                                );
                              })()}

                              {/* Gradient bar */}
                              <div className="relative h-2.5 w-full rounded-full overflow-hidden">
                                <div className="absolute inset-0 rounded-full" style={{
                                  background: `linear-gradient(to right, hsl(145 60% 36%) 0%, hsl(var(--success)) ${fmvPct * 0.5}%, hsl(var(--success)) ${fmvPct}%, hsl(var(--warning)) ${fmvPct + (100 - fmvPct) * 0.6}%, hsl(var(--danger)) 100%)`
                                }} />
                              </div>

                              {/* Dot indicator */}
                              {(() => {
                                const askPct = toPct(sampleVehicle.askingPrice);
                                return (
                                  <div
                                    className="absolute -translate-x-1/2"
                                    style={{ left: `${askPct}%`, top: "3.85rem" }}
                                  >
                                    <div className="h-5 w-5 rounded-full border-[3px] border-primary bg-background shadow-md" />
                                  </div>
                                );
                              })()}

                              {/* Desktop markers */}
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

                            {/* Mobile: vertical bar chart */}
                            <div className="mt-4 space-y-2.5 md:hidden">
                              {(() => {
                                const allMarkers = [...markers].sort((a, b) => a.value - b.value);
                                const maxVal = Math.max(...allMarkers.map(m => m.value));
                                const barColor = (m: typeof allMarkers[0]) => {
                                  if (m.isAsking) return "bg-primary";
                                  if (m.isFairMarket) return "bg-success";
                                  return "bg-muted-foreground/30";
                                };
                                return allMarkers.map((m) => {
                                  const widthPct = Math.max(8, (m.value / maxVal) * 100);
                                  return (
                                    <div key={m.label}>
                                      <div className="flex items-center justify-between mb-0.5">
                                        <span className={cn(
                                          "text-xs font-medium",
                                          m.isAsking ? "text-foreground" : m.isFairMarket ? "text-primary" : "text-muted-foreground"
                                        )}>
                                          {m.label}
                                        </span>
                                        <span className={cn(
                                          "text-xs font-semibold",
                                          m.isAsking ? "text-foreground" : m.isFairMarket ? "text-primary" : "text-muted-foreground"
                                        )}>
                                          ${Math.round(m.value).toLocaleString()}
                                        </span>
                                      </div>
                                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                                        <div
                                          className={cn("h-full rounded-full transition-all", barColor(m))}
                                          style={{ width: `${widthPct}%` }}
                                        />
                                      </div>
                                    </div>
                                  );
                                });
                              })()}
                            </div>

                            {/* Negotiation Target */}
                            {(() => {
                              const rating = priceAssessment.dealRating;
                              if ((rating as string) === "excellent") return null;
                              const fmv = sampleVehicle.sellerType === "dealer"
                                ? (priceAssessment.fairMarketDealer || priceAssessment.fairMarketPrivate)
                                : priceAssessment.fairMarketPrivate;
                              const targets = [
                                { label: "Fair Deal Target", desc: "Within 5% of market value", price: fmv, rating: "fair" as const },
                                { label: "Good Deal Target", desc: "5–10% below market value", price: Math.round(fmv * 0.95), rating: "good" as const },
                                { label: "Excellent Deal Target", desc: "10%+ below market value", price: Math.round(fmv * 0.90), rating: "excellent" as const },
                              ];
                              const ratingOrder = ["poor", "overpriced", "fair", "good", "excellent"];
                              const currentIdx = ratingOrder.indexOf(rating);
                              const relevantTargets = targets.filter(t => ratingOrder.indexOf(t.rating) > currentIdx);
                              if (relevantTargets.length === 0) return null;
                              const primaryTarget = relevantTargets[0];
                              const savings = sampleVehicle.askingPrice - primaryTarget.price;

                              return (
                                <div className="rounded-lg border border-success/30 bg-success/5 p-4 mt-4">
                                  <div className="flex items-center gap-2 mb-3">
                                    <DollarSign className="h-4 w-4 text-success" />
                                    <h4 className="text-sm font-semibold">Negotiation Targets</h4>
                                  </div>
                                  <div className="grid gap-3 sm:grid-cols-3">
                                    {relevantTargets.map((t) => (
                                      <div key={t.label} className="rounded-md bg-background border p-3">
                                        <p className="text-xs text-muted-foreground">{t.label}</p>
                                        <p className="text-lg font-bold text-success">${t.price.toLocaleString()}</p>
                                        <p className="text-[11px] text-muted-foreground">{t.desc}</p>
                                      </div>
                                    ))}
                                  </div>
                                  {savings > 0 && (
                                    <p className="mt-3 text-xs text-muted-foreground break-words">
                                      Negotiating to the <span className="font-medium text-foreground">{primaryTarget.label.replace(" Target", "")}</span> price would save you <span className="font-semibold text-success">${savings.toLocaleString()}</span> from the current asking price.
                                    </p>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })()}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Depreciation Chart */}
              <motion.div variants={itemVariants}>
                <Card className="overflow-hidden">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingDown className="h-5 w-5 text-primary" />
                      5-Year Depreciation & Equity
                    </CardTitle>
                  </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-end space-x-2">
                    <Switch
                      id="include-repairs"
                      checked={includeRepairs}
                      onCheckedChange={setIncludeRepairs}
                    />
                    <Label htmlFor="include-repairs" className="text-sm cursor-pointer">
                      Include repair costs in calculations
                    </Label>
                  </div>
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
                          stroke="hsl(142, 76%, 36%)" 
                          strokeWidth={2}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="Trade-In Value" 
                          stroke="hsl(45, 93%, 47%)" 
                          strokeWidth={2}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="Loan Balance" 
                          stroke="hsl(var(--primary))" 
                          strokeWidth={2}
                          strokeDasharray="5 5"
                        />
                        {includeRepairs && (
                          <Line 
                            type="monotone" 
                            dataKey="Cumulative Repairs" 
                            stroke="hsl(0, 84%, 60%)" 
                            strokeWidth={2}
                            strokeDasharray="3 3"
                          />
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Depreciation Table */}
                  <div className="mt-6 overflow-x-auto">
                    <Table>
                      <TableHeader>
                         <TableRow>
                          <TableHead>Year</TableHead>
                          <TableHead className="text-right">Private Value</TableHead>
                          <TableHead className="text-right">Trade-In</TableHead>
                          <TableHead className="text-right">Loan Balance</TableHead>
                          {includeRepairs && <TableHead className="text-right">Repairs</TableHead>}
                          {includeRepairs && <TableHead className="text-right">Maintenance</TableHead>}
                          <TableHead className="text-right">Net Equity {includeRepairs ? "(w/ costs)" : "(w/o costs)"}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {depreciationTable.map((row) => (
                          <TableRow key={row.year}>
                            <TableCell className="font-medium">Year {row.year}</TableCell>
                            <TableCell className="text-right">${row.privateValue.toLocaleString()}</TableCell>
                            <TableCell className="text-right">${row.tradeInValue.toLocaleString()}</TableCell>
                            <TableCell className="text-right">${row.loanBalance.toLocaleString()}</TableCell>
                            {includeRepairs && (
                              <TableCell className="text-right text-destructive">
                                ${row.repairCosts.toLocaleString()}
                              </TableCell>
                            )}
                            {includeRepairs && (
                              <TableCell className="text-right text-muted-foreground">
                                ${(row.maintenanceCosts || 0).toLocaleString()}
                              </TableCell>
                            )}
                            <TableCell className={cn(
                              "text-right font-semibold",
                              calculateNetEquity(row) >= 0 ? "text-green-600" : "text-red-600"
                            )}>
                              {calculateNetEquity(row) >= 0 ? "+" : ""}
                              ${calculateNetEquity(row).toLocaleString()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
                </Card>
              </motion.div>

              {/* Expert Opinion */}
              <motion.div variants={itemVariants}>
                <Card className="overflow-hidden">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" />
                      Expert Opinion
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <motion.div 
                      className="prose prose-sm max-w-none dark:prose-invert"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.4 }}
                    >
                      <p className="whitespace-pre-line text-muted-foreground leading-relaxed">
                        {riskAssessment.expertOpinion}
                      </p>
                    </motion.div>
                    
                    {/* Repair Analysis Section */}
                    <motion.div 
                      className="border-t pt-6"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 }}
                    >
                      <h4 className="flex items-center gap-2 font-semibold mb-4">
                        <motion.div
                          animate={{ rotate: [0, 10, -10, 0] }}
                          transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 5 }}
                        >
                          <Wrench className="h-4 w-4 text-primary" />
                        </motion.div>
                        Anticipated Repairs & Maintenance
                      </h4>
                      <div className="prose prose-sm max-w-none dark:prose-invert">
                        <div className="whitespace-pre-line text-muted-foreground leading-relaxed text-sm">
                          {riskAssessment.repairAnalysis.split('\n').map((line, i) => {
                            if (line.startsWith('**') && line.endsWith('**')) {
                              return <p key={i} className="font-semibold text-foreground mt-4 mb-2">{line.replace(/\*\*/g, '')}</p>;
                            }
                            if (line.startsWith('•')) {
                              return <p key={i} className="ml-2">{line}</p>;
                            }
                            return <p key={i}>{line}</p>;
                          })}
                        </div>
                      </div>
                    </motion.div>
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>

            {/* Right Column - Sidebar */}
            <motion.div 
              className="space-y-6"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              {/* Vehicle Health Score */}
              <motion.div variants={itemVariants} whileHover={{ y: -5 }} transition={{ duration: 0.2 }}>
                <Card className="overflow-hidden transition-shadow hover:shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Car className="h-5 w-5 text-primary" />
                      Vehicle Health
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <motion.div 
                      className="mb-4 text-center"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 200, delay: 0.3 }}
                    >
                      <div className="text-4xl font-bold">{historyAnalysis.healthScore}</div>
                      <p className="text-sm text-muted-foreground">out of 100</p>
                    </motion.div>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: "100%" }}
                      transition={{ delay: 0.5, duration: 0.8 }}
                    >
                      <Progress value={historyAnalysis.healthScore} className="h-3" />
                    </motion.div>

                    <div className="mt-6 space-y-4">
                      <div>
                        <h4 className="mb-2 flex items-center gap-2 text-sm font-medium text-green-600">
                          <CheckCircle className="h-4 w-4" />
                          Positives
                        </h4>
                        <ul className="space-y-1 text-sm">
                          {historyAnalysis.positives.map((item, i) => (
                            <motion.li 
                              key={i} 
                              className="text-muted-foreground"
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.6 + i * 0.1 }}
                            >
                              • {item}
                            </motion.li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <h4 className="mb-2 flex items-center gap-2 text-sm font-medium text-red-600">
                          <XCircle className="h-4 w-4" />
                          Concerns
                        </h4>
                        <ul className="space-y-1 text-sm">
                          {historyAnalysis.concerns.map((item, i) => (
                            <motion.li 
                              key={i} 
                              className="text-muted-foreground"
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 1.1 + i * 0.1 }}
                            >
                              • {item}
                            </motion.li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* UVPRS Risk Score Breakdown */}
              <motion.div variants={itemVariants} whileHover={{ y: -5 }} transition={{ duration: 0.2 }}>
                <RiskScoreBreakdown result={sampleUVPRS} />
              </motion.div>

              {/* NHTSA Safety Recalls */}
              <motion.div variants={itemVariants} whileHover={{ y: -5 }} transition={{ duration: 0.2 }}>
                <Card className="border-2 border-success bg-success/5">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <ShieldCheck className="h-5 w-5 text-success" />
                      Safety Recalls
                      <Badge className="ml-auto text-xs bg-success text-success-foreground">
                        None on Record
                      </Badge>
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Via NHTSA · {sampleVehicle.year} {sampleVehicle.make} {sampleVehicle.model}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <div className="flex items-center gap-2 rounded-md border border-success/30 bg-success/10 px-3 py-2">
                      <CheckCircle className="h-4 w-4 shrink-0 text-success" />
                      <p className="text-xs text-success font-medium">No recalls on record for this year/make/model.</p>
                    </div>
                    <div className="pt-1">
                      <a
                        href={`https://www.nhtsa.gov/vehicle-safety/recalls#recall--Toyota`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Search Recalls on NHTSA
                      </a>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Service History Timeline */}
              <motion.div variants={itemVariants} whileHover={{ y: -5 }} transition={{ duration: 0.2 }}>
                <ServiceHistoryTimeline
                  serviceGapMiles={sampleServiceHistory.serviceGapMiles}
                  majorServicesDue={sampleServiceHistory.majorServicesDue}
                  majorServicesDone={sampleServiceHistory.majorServicesDone}
                  chronicRepairSystems={sampleServiceHistory.chronicRepairSystems}
                  hasServiceRecords={true}
                  mileage={sampleVehicle.mileage}
                />
              </motion.div>

              {/* Risk Assessment */}
              <motion.div variants={itemVariants} whileHover={{ y: -5 }} transition={{ duration: 0.2 }}>
                <Card className="overflow-hidden transition-shadow hover:shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-primary" />
                      Risk Assessment
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h4 className="mb-2 text-sm font-medium">Depreciation Risk</h4>
                      <p className="text-sm text-muted-foreground">{riskAssessment.depreciationRisk}</p>
                    </div>

                    <div>
                      <h4 className="mb-2 text-sm font-medium">Reliability Concerns</h4>
                      <ul className="space-y-1">
                        {riskAssessment.reliabilityConcerns.map((item, i) => (
                          <motion.li 
                            key={i} 
                            className="flex items-start gap-2 text-sm text-muted-foreground"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.3 + i * 0.1 }}
                          >
                            <Wrench className="mt-0.5 h-3 w-3 flex-shrink-0" />
                            <span>
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
                          </motion.li>
                        ))}
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Dealer Trust Analysis */}
              <motion.div variants={itemVariants} whileHover={{ y: -5 }} transition={{ duration: 0.2 }}>
                <Card className="overflow-hidden transition-shadow hover:shadow-lg">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-primary" />
                        <CardTitle className="text-lg">Dealer Trust Analysis</CardTitle>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        PRO
                      </Badge>
                    </div>
                    <CardDescription className="line-clamp-1">
                      {dealerReview.dealerName}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Trust Score */}
                    <div className="flex items-center gap-4">
                      <motion.div 
                        className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500/10"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 200, delay: 0.3 }}
                      >
                        <ShieldCheck className="h-7 w-7 text-green-600" />
                      </motion.div>
                      <div className="flex-1">
                        <div className="mb-1 flex items-center justify-between">
                          <Badge className="bg-green-500 text-white">Highly Trusted</Badge>
                          <span className="text-lg font-bold">{dealerReview.trustScore}/100</span>
                        </div>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: "100%" }}
                          transition={{ delay: 0.5, duration: 0.8 }}
                        >
                          <Progress value={dealerReview.trustScore} className="h-2" />
                        </motion.div>
                      </div>
                    </div>

                    {/* Summary */}
                    <p className="text-sm text-muted-foreground">{dealerReview.summary}</p>

                    {/* Positives */}
                    <div>
                      <h4 className="mb-2 flex items-center gap-1 text-sm font-medium text-green-600">
                        <CheckCircle className="h-4 w-4" />
                        Positives
                      </h4>
                      <ul className="space-y-1">
                        {dealerReview.positives.slice(0, 3).map((item, i) => (
                          <motion.li 
                            key={i} 
                            className="text-xs text-muted-foreground"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.6 + i * 0.1 }}
                          >
                            • {item}
                          </motion.li>
                        ))}
                      </ul>
                    </div>

                    {/* Red Flags */}
                    {dealerReview.redFlags.length > 0 && (
                      <div>
                        <h4 className="mb-2 flex items-center gap-1 text-sm font-medium text-red-600">
                          <AlertTriangle className="h-4 w-4" />
                          Watch Out
                        </h4>
                        <ul className="space-y-1">
                          {dealerReview.redFlags.map((item, i) => (
                            <motion.li 
                              key={i} 
                              className="text-xs text-muted-foreground"
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.9 + i * 0.1 }}
                            >
                              • {item}
                            </motion.li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Sources */}
                    <div className="flex flex-wrap gap-2 border-t pt-3">
                      <span className="text-xs text-muted-foreground">Sources:</span>
                      {dealerReview.sources.map((source) => (
                        <Badge key={source} variant="outline" className="text-xs">
                          <Star className="mr-1 h-3 w-3" />
                          {source}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Verdict Card */}
              <motion.div variants={itemVariants} whileHover={{ y: -5 }} transition={{ duration: 0.2 }}>
                <Card className="border-2 border-warning bg-warning/5">
                  <CardContent className="p-6">
                    <div className="flex flex-col sm:flex-row items-center gap-6">
                      <div className="flex flex-col items-center gap-2 shrink-0">
                        <HandCoins className="h-10 w-10 text-warning" />
                        <Badge className="text-lg px-4 py-1 bg-warning text-warning-foreground">
                          NEGOTIATE
                        </Badge>
                      </div>
                      <div className="flex-1 text-center sm:text-left">
                        <p className="text-sm text-muted-foreground">
                          The asking price is approximately $1,000 above fair market value. Low risk and strong reliability support a purchase, but negotiate toward the fair offer price for the best deal.
                        </p>
                      </div>
                      <div className="shrink-0 text-center sm:border-l sm:pl-6">
                        <p className="mb-1 text-sm font-semibold">Fair Offer Price</p>
                        <p className="text-3xl font-bold">${riskAssessment.fairOfferPrice.toLocaleString()}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* CTA Card */}
              <motion.div 
                variants={itemVariants}
                whileHover={{ scale: 1.03, y: -5 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <Card className="border-primary/20 bg-primary/5 overflow-hidden">
                  <CardContent className="p-6 text-center">
                    <motion.h3 
                      className="font-semibold mb-2"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 }}
                    >
                      Ready to analyze your vehicle?
                    </motion.h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Get the same detailed insights for any car you're considering.
                    </p>
                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                      <Button asChild className="w-full">
                        <Link to="/analyze">
                          Start Your Analysis
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    </motion.div>
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>
          </div>
            </TabsContent>

            {/* Comparison Report Tab */}
            <TabsContent value="comparison" className="mt-6">
              <SampleComparisonReport />
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <Footer />
    </div>
  );
}
