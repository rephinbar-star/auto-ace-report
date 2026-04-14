import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  DollarSign, TrendingDown, CheckCircle, XCircle, Car, ArrowRight,
  Loader2, ShieldCheck, ShieldAlert, ExternalLink, Scale, AlertTriangle,
  Download, BadgeCheck, Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SEO } from "@/components/seo/SEO";
import { generateReportPDF } from "@/lib/generatePDF";
import { calculateTCO, calculateMonthlyOwnershipBreakdown } from "@/lib/tco-calculations";
import { convertLegacyTable } from "@/lib/depreciation-engine";
import { toast } from "sonner";
import { SampleComparisonReport } from "@/components/sample/SampleComparisonReport";
import { ServiceHistoryTimeline } from "@/components/report/ServiceHistoryTimeline";
import { calculateUVPRS } from "@/lib/uvprs-scoring";
import { VerdictHero } from "@/components/report/VerdictHero";
import { MetricsStrip } from "@/components/report/MetricsStrip";
import { ExpertAnalysisCard } from "@/components/report/ExpertAnalysisCard";
import { ExpertFindingsStrip } from "@/components/report/ExpertFindingsStrip";
import { MonthlyOwnershipCostCard } from "@/components/report/MonthlyOwnershipCostCard";
import type { AiFindings } from "@/types/vehicle";

// ─── Sample data ───

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
  bodyStyle: "SUV",
  drivetrain: "AWD",
  fuelType: "Gasoline",
  exteriorColor: "Midnight Black",
};

const sampleAnalysis = {
  priceAssessment: {
    fairMarketPrivate: 33200,
    fairMarketDealer: 35200,
    fairMarketTradeIn: 30800,
    dealRating: "good" as const,
    priceDifference: -700,
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
    depreciationRisk: "The Toyota RAV4 is one of the strongest value holders in the compact SUV segment, with an average depreciation of 10-13% annually.",
    reliabilityConcerns: [
      { concern: "Infotainment system may need software updates periodically", costLow: 0, costHigh: 150 },
      { concern: "AWD system fluid change recommended at 30k miles", costLow: 120, costHigh: 200 },
    ],
    valueProposition: "This RAV4 XLE Premium represents excellent value with its combination of Toyota reliability, low mileage, and comprehensive safety features.",
    fairOfferPrice: 33500,
    expertOpinion: "This 2024 Toyota RAV4 XLE Premium AWD is an outstanding choice for buyers seeking a reliable, practical, and well-equipped compact SUV. With only 18,200 miles, this vehicle is barely broken in.\n\nThe 2.5-liter Dynamic Force engine delivers a smooth 203 hp while achieving impressive fuel economy for an AWD SUV. Toyota's Safety Sense 3.0 suite provides comprehensive driver assistance features.\n\nThe XLE Premium adds SofTex heated seats, an 8-inch touchscreen with wireless Apple CarPlay/Android Auto, a power liftgate, and dual-zone climate control.\n\nAt $34,500, the asking price is approximately $1,300 above fair market value. Given the low mileage and excellent condition, I recommend negotiating toward $33,500 for a fair deal.\n\nOverall verdict: A top-tier choice with minimal ownership risk and strong long-term value retention.",
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
    concerns: ["Minor paint chip on front bumper noted"],
  },
  aiFindings: {
    activeServiceFaults: [],
    knownFailurePatterns: [
      {
        issue: "Infotainment",
        description: "Infotainment system may need periodic software updates",
        probabilityTier: "low" as const,
        probabilityPercent: 15,
        alreadyPresent: false,
      },
    ],
    odometerIntegrity: { status: "verified" as const, gapMiles: null },
    chassisSignal: { level: 1 as const, isProblemGeneration: false },
  } as AiFindings,
  warrantyAnalysis: {
    warrantyStatus: "active" as const,
    warrantyMonthsRemaining: 24,
    riskReductionFactor: 70,
    warrantyNotes: "Factory bumper-to-bumper warranty still active with 24 months remaining.",
  },
  finalVerdict: {
    verdict: "Conditional Buy",
    justification: "Excellent deal on a low-mileage, well-maintained vehicle with active warranty. Negotiate toward $33,500.",
  },
};

const sampleServiceHistory = {
  serviceGapMiles: 7500,
  majorServicesDone: [
    "Oil changes every 5,000 mi",
    "Brake fluid flush at 30,000 mi",
    "Cabin & engine air filters at 35,000 mi",
  ],
  majorServicesDue: ["Transmission fluid change (due at 60k)"],
  chronicRepairSystems: [] as string[],
};

// ─── Component ───

export default function SampleReportPage() {
  const { priceAssessment, depreciationTable, riskAssessment, historyAnalysis } = sampleAnalysis;
  const [isDownloading, setIsDownloading] = useState(false);
  const [activeTab, setActiveTab] = useState("comparison");
  const [historyTab, setHistoryTab] = useState("overview");
  const heroRef = useRef<HTMLDivElement>(null);

  const startingFMV = priceAssessment.fairMarketPrivate;
  const computedDepTable = convertLegacyTable(depreciationTable, startingFMV, 28000, 4.5, 60, false);

  const sampleUVPRS = calculateUVPRS({
    year: sampleVehicle.year,
    make: sampleVehicle.make,
    mileage: sampleVehicle.mileage,
    askingPrice: sampleVehicle.askingPrice,
    titleStatus: "clean",
    accidentCount: 0,
    ownerCount: 1,
    hasFrameDamage: false,
    hasServiceRecords: true,
    healthScore: historyAnalysis.healthScore,
    historyIssues: historyAnalysis.concerns,
    historyPositives: historyAnalysis.positives,
    serviceGapMiles: sampleServiceHistory.serviceGapMiles,
    majorServicesDue: sampleServiceHistory.majorServicesDue,
    majorServicesDone: sampleServiceHistory.majorServicesDone,
    chronicRepairSystems: sampleServiceHistory.chronicRepairSystems,
    fairMarketPrivate: priceAssessment.fairMarketPrivate,
    fairMarketDealer: priceAssessment.fairMarketDealer,
    openRecallCount: 0,
    sellerType: "dealer",
  });

  const tco = calculateTCO(
    sampleVehicle.askingPrice,
    30,
    "gasoline",
    depreciationTable,
    { annualMiles: 12000 },
    { make: sampleVehicle.make, year: sampleVehicle.year, model: sampleVehicle.model }
  );

  const monthlyBreakdown = calculateMonthlyOwnershipBreakdown(tco, 598);
  const monthlyCostRange =
    monthlyBreakdown.totalHigh > 0 && monthlyBreakdown.totalHigh !== monthlyBreakdown.totalLow
      ? `$${monthlyBreakdown.totalLow.toLocaleString()}–$${monthlyBreakdown.totalHigh.toLocaleString()}`
      : `$${monthlyBreakdown.totalLow.toLocaleString()}`;

  const fmvPriceDifference = sampleVehicle.askingPrice - (priceAssessment.fairMarketDealer || priceAssessment.fairMarketPrivate);

  const chartData = [
    {
      name: "Year 0",
      "Market Value": startingFMV,
      "Trade-In Value": priceAssessment.fairMarketTradeIn,
      "Asking Price": sampleVehicle.askingPrice,
      "Loan Balance": 28000,
    },
    ...computedDepTable.map((row) => ({
      name: `Year ${row.year}`,
      "Market Value": row.marketValue,
      "Trade-In Value": row.tradeInValue,
      "Asking Price": sampleVehicle.askingPrice,
      "Loan Balance": row.loanBalance,
    })),
  ];

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
        tcoData: { tco, annualMiles: 12000 },
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

  const displayVerdict = "Conditional Buy";

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden">
      <SEO
        title="Sample Report - CarWise"
        description="See an example of how CarWise analyzes and compares vehicles to find the best deal."
      />
      <Header />

      <main className="flex-1 bg-gradient-to-b from-primary/5 to-background py-8">
        <div className="container mx-auto max-w-6xl px-4 overflow-x-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
            <div className="flex items-center justify-between gap-4">
              <TabsList className="grid grid-cols-2 max-w-lg h-14 bg-transparent gap-3 p-0">
                <TabsTrigger value="vehicle" className="gap-2 text-base font-bold text-blue-600 bg-white border shadow-md rounded-lg transition-all duration-200 hover:scale-105 hover:bg-blue-600 hover:text-white data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                  <Car className="h-5 w-5" />
                  Vehicle Report
                </TabsTrigger>
                <TabsTrigger value="comparison" className="gap-2 text-base font-bold text-blue-600 bg-white border shadow-md rounded-lg transition-all duration-200 hover:scale-105 hover:bg-blue-600 hover:text-white data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                  <Scale className="h-5 w-5" />
                  Comparison Report
                </TabsTrigger>
              </TabsList>
              <Button asChild className="shadow-md transition-all duration-200 hover:scale-110 hover:shadow-xl">
                <Link to="/analyze">
                  Analyze Your Vehicle
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>

            {/* ===== VEHICLE REPORT TAB ===== */}
            <TabsContent value="vehicle" className="mt-6 space-y-4">

              {/* SECTION 1: Verdict Hero */}
              <VerdictHero
                ref={heroRef}
                vehicle={sampleVehicle}
                mileage={sampleVehicle.mileage}
                askingPrice={sampleVehicle.askingPrice}
                verdict={displayVerdict}
                riskScore={sampleUVPRS.totalScore}
                riskLabel={sampleUVPRS.riskLabel}
                aiFindings={sampleAnalysis.aiFindings}
                openRecallCount={0}
                recallComponents={[]}
                onReAnalyze={() => toast.info("This is a sample report")}
                onUploadHistory={() => toast.info("This is a sample report")}
                onDownloadPDF={handleDownloadPDF}
                isRefreshing={false}
                isDownloading={isDownloading}
                isPaid={true}
              />

              {/* SECTION 2: Metrics Strip */}
              <MetricsStrip
                priceDifference={fmvPriceDifference}
                fairMarketPrivate={priceAssessment.fairMarketPrivate}
                riskScore={sampleUVPRS.totalScore}
                riskLabel={sampleUVPRS.riskLabel}
                healthScore={historyAnalysis.healthScore}
                monthlyCostRange={monthlyCostRange}
                openRecalls={0}
                resolvedRecalls={0}
                warrantyStatus="active"
                warrantyContext="24 months remaining"
                onHistoryTabChange={setHistoryTab}
              />

              {/* SECTION 3: Expert Findings + Analysis */}
              <ExpertFindingsStrip
                aiFindings={sampleAnalysis.aiFindings}
                reliabilityConcerns={riskAssessment.reliabilityConcerns}
                verdict={displayVerdict}
                riskScore={sampleUVPRS.totalScore}
              />
              <div id="section-expert">
                <ExpertAnalysisCard
                  aiFindings={sampleAnalysis.aiFindings}
                  sanitizedExpertOpinion={riskAssessment.expertOpinion}
                  verdict={displayVerdict}
                  riskScore={sampleUVPRS.totalScore}
                  reliabilityConcerns={riskAssessment.reliabilityConcerns}
                />
              </div>

              {/* SECTION 4: Monthly Ownership Cost */}
              <MonthlyOwnershipCostCard
                monthlyCostRange={monthlyCostRange}
                breakdown={monthlyBreakdown}
                isElectric={false}
                hasFinancing={true}
                verdict={displayVerdict}
                fuelType="gasoline"
                mpgCity={27}
                mpgCombined={30}
                mpgHighway={35}
                annualFuelCost={tco.annualFuelCost}
                annualMiles={12000}
              />

              {/* SECTION 5: Pricing Analysis */}
              <div id="section-pricing" className="report-card">
                <div className="mb-4">
                  <h2 className="text-lg font-semibold text-foreground">Asking Price vs. Market Assessment</h2>
                  {(() => {
                    const benchmark = priceAssessment.fairMarketDealer || priceAssessment.fairMarketPrivate;
                    const diff = sampleVehicle.askingPrice - benchmark;
                    const below = diff <= 0;
                    return (
                      <p className={cn("text-sm font-medium mt-1", below ? "text-risk-green" : "text-risk-red")}>
                        {below ? "Yes" : "No"} — priced ${Math.abs(diff).toLocaleString()} {below ? "below" : "above"} dealer retail
                      </p>
                    );
                  })()}
                </div>

                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <DollarSign className="h-5 w-5 text-primary" />
                  <span className="font-semibold">Price Assessment</span>
                  <Badge variant="outline" className="ml-auto gap-1 border-neutral/30 bg-muted text-neutral text-xs font-medium">
                    <Bot className="h-3 w-3" />
                    Sample Data
                  </Badge>
                </div>

                {/* Price bar */}
                {(() => {
                  const fairMarketValue = priceAssessment.fairMarketDealer || priceAssessment.fairMarketPrivate;
                  const markers: { label: string; value: number; isAsking?: boolean; isFairMarket?: boolean }[] = [
                    { label: "Trade-In", value: priceAssessment.fairMarketTradeIn },
                    { label: "Private Sale", value: priceAssessment.fairMarketPrivate },
                    { label: "Fair Market Value", value: fairMarketValue, isFairMarket: true },
                    { label: "Asking Price", value: sampleVehicle.askingPrice, isAsking: true },
                  ];
                  const barMin = priceAssessment.fairMarketTradeIn * 0.90;
                  const barMax = fairMarketValue * 1.35;
                  const barRange = barMax - barMin || 1;
                  const toPct = (v: number) => Math.max(5, Math.min(92, ((v - barMin) / barRange) * 100));
                  const fmvPct = toPct(fairMarketValue);

                  return (
                    <div className="relative pt-14 pb-14 mt-2">
                      {(() => {
                        const askPct = toPct(sampleVehicle.askingPrice);
                        const clampStyle = askPct > 80
                          ? { left: `${askPct}%`, transform: "translateX(-80%)" }
                          : { left: `${askPct}%`, transform: "translateX(-50%)" };
                        return (
                          <div className="absolute top-0 flex flex-col items-center" style={clampStyle}>
                            <p className="text-[10px] text-neutral text-center mb-0.5">Asking Price</p>
                            <div className="rounded-lg border bg-card px-3 py-1.5 text-sm font-bold shadow-sm whitespace-nowrap">
                              ${sampleVehicle.askingPrice.toLocaleString()}
                            </div>
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
                          const askPct = toPct(sampleVehicle.askingPrice);
                          return (
                            <div className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${askPct}%`, top: "50%" }}>
                              <div className="h-5 w-5 rounded-full border-[3px] border-warning bg-background shadow-md" />
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

              {/* SECTION 6: Depreciation */}
              <div id="section-tco">
                <Card className="overflow-hidden max-w-[calc(100vw-2rem)]">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 flex-wrap">
                      <TrendingDown className="h-5 w-5 text-primary shrink-0" />
                      <span>5-Year Depreciation & Equity</span>
                      <Badge variant="outline" className="ml-auto gap-1 border-neutral/30 bg-muted text-neutral text-xs font-medium">
                        <Bot className="h-3 w-3" />
                        Sample Data
                      </Badge>
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
                              borderRadius: "8px",
                            }}
                          />
                          <Legend />
                          <Line type="monotone" dataKey="Market Value" stroke="hsl(var(--success))" strokeWidth={2} />
                          <Line type="monotone" dataKey="Trade-In Value" stroke="hsl(var(--warning))" strokeWidth={2} />
                          <Line type="monotone" dataKey="Loan Balance" stroke="#3b82f6" strokeWidth={2} strokeDasharray="5 5" />
                          <Line type="monotone" dataKey="Asking Price" stroke="hsl(var(--danger))" strokeWidth={2} strokeDasharray="6 3" dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Collapsible table */}
                    <Collapsible className="mt-6">
                      <CollapsibleTrigger className="flex items-center gap-1 text-[13px] text-neutral hover:text-foreground">
                        Detailed Year-by-Year Breakdown
                        <svg className="h-5 w-5 shrink-0 transition-transform duration-200 [[data-state=open]>&]:rotate-180" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="overflow-x-auto mt-3">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs px-2">Year</TableHead>
                                <TableHead className="text-right text-xs px-2">Market Value</TableHead>
                                <TableHead className="text-right text-xs px-2">Trade-In</TableHead>
                                <TableHead className="text-right text-xs px-2">Loan Balance</TableHead>
                                <TableHead className="text-right text-xs px-2">Equity</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {computedDepTable.map((row) => (
                                <TableRow key={row.year}>
                                  <TableCell className="text-xs px-2">Yr {row.year}</TableCell>
                                  <TableCell className="text-right text-xs px-2">${row.marketValue.toLocaleString()}</TableCell>
                                  <TableCell className="text-right text-xs px-2">${row.tradeInValue.toLocaleString()}</TableCell>
                                  <TableCell className="text-right text-xs px-2">${row.loanBalance.toLocaleString()}</TableCell>
                                  <TableCell className={cn("text-right text-xs px-2 font-bold", row.equity >= 0 ? "text-risk-green" : "text-destructive")}>
                                    {row.equity < 0 ? "-" : ""}${Math.abs(row.equity).toLocaleString()}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </CardContent>
                </Card>
              </div>

              {/* SECTION 7: Risk Profile */}
              <div id="section-risk">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ShieldAlert className="h-5 w-5 text-primary" />
                      Purchase Risk Profile
                      <Badge className={cn("ml-auto text-xs", {
                        "bg-risk-green text-white": sampleUVPRS.totalScore <= 30,
                        "bg-risk-amber text-white": sampleUVPRS.totalScore > 30 && sampleUVPRS.totalScore <= 55,
                        "bg-risk-red text-white": sampleUVPRS.totalScore > 55,
                      })}>
                        {sampleUVPRS.totalScore} / 100 — {sampleUVPRS.riskLabel}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2.5">
                      {[...sampleUVPRS.factors]
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
                            <div key={factor.key} className="flex items-center gap-1">
                              <span className="min-w-[120px] md:min-w-[180px] text-[13px] text-foreground">
                                {factor.label} <span className="text-neutral">({Math.round(factor.weight * 100)}%)</span>
                              </span>
                              <div className="flex-1 mx-3 h-2 bg-muted rounded">
                                <div className={cn("h-2 rounded transition-all", barColor)} style={{ width: `${factor.known ? factor.score : 50}%` }} />
                              </div>
                              <span className={cn("w-12 text-right text-[13px] font-semibold", textColor)}>
                                {factor.known ? Math.round(factor.score) : "N/A"}
                              </span>
                            </div>
                          );
                        })}
                    </div>

                    {riskAssessment.reliabilityConcerns.length > 0 && (
                      <div className="border-t pt-4 space-y-2">
                        <p className="text-sm font-semibold">Reliability Concerns</p>
                        {riskAssessment.reliabilityConcerns.map((item, i) => (
                          <div key={i} className="flex items-center gap-2 text-[13px]">
                            <span className="flex-1 text-foreground">{item.concern}</span>
                            {(item.costLow || item.costHigh) && (
                              <span className="text-xs text-risk-red font-medium shrink-0">
                                ${item.costLow?.toLocaleString()}–${item.costHigh?.toLocaleString()}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="border-t pt-4 space-y-3">
                      <div>
                        <p className="text-sm font-medium">Depreciation Risk</p>
                        <p className="text-sm text-neutral">{riskAssessment.depreciationRisk}</p>
                      </div>
                      <div className="rounded-lg bg-muted p-4">
                        <p className="text-sm font-medium">Value Proposition</p>
                        <p className="text-sm text-neutral">{riskAssessment.valueProposition}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* SECTION 8: Vehicle History */}
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
                        <TabsTrigger value="recalls" className="flex-1">Safety Recalls</TabsTrigger>
                      </TabsList>

                      <TabsContent value="overview">
                        {(() => {
                          const score = historyAnalysis.healthScore;
                          const scoreColor = score <= 33 ? "text-risk-red" : score <= 66 ? "text-risk-amber" : "text-risk-green";
                          const barColor = score <= 33 ? "[&>div]:bg-risk-red" : score <= 66 ? "[&>div]:bg-risk-amber" : "[&>div]:bg-risk-green";
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
                              {historyAnalysis.positives.map((item, i) => (
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

                      <TabsContent value="service">
                        <ServiceHistoryTimeline
                          serviceGapMiles={sampleServiceHistory.serviceGapMiles}
                          majorServicesDue={sampleServiceHistory.majorServicesDue}
                          majorServicesDone={sampleServiceHistory.majorServicesDone}
                          chronicRepairSystems={sampleServiceHistory.chronicRepairSystems}
                          hasServiceRecords={true}
                          mileage={sampleVehicle.mileage}
                        />
                      </TabsContent>

                      <TabsContent value="recalls" className="space-y-4">
                        <div className="rounded-lg border-2 border-risk-green bg-risk-green/5 p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <ShieldCheck className="h-5 w-5 text-risk-green" />
                            <span className="text-sm font-semibold">Safety Recalls</span>
                            <Badge className="ml-auto text-xs bg-risk-green text-white">None on Record</Badge>
                          </div>
                          <p className="text-xs text-neutral mb-3">Via NHTSA · {sampleVehicle.year} {sampleVehicle.make} {sampleVehicle.model}</p>
                          <div className="flex items-center gap-2 rounded-md border border-risk-green/30 bg-risk-green/10 px-3 py-2">
                            <CheckCircle className="h-4 w-4 shrink-0 text-risk-green" />
                            <p className="text-xs text-risk-green font-medium">No recalls on record for this year/make/model.</p>
                          </div>
                        </div>

                        {/* Warranty */}
                        <div className="rounded-lg border-2 border-risk-green bg-risk-green/5 p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <ShieldCheck className="h-5 w-5" />
                            <span className="text-sm font-semibold">Warranty Analysis</span>
                          </div>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-neutral">Status</span>
                              <Badge>Active</Badge>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-neutral">Months Remaining</span>
                              <span className="font-semibold">24</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-neutral">Risk Reduction</span>
                              <span className="font-semibold">70%</span>
                            </div>
                            <Progress value={70} className="h-2" />
                            <p className="text-sm text-neutral">{sampleAnalysis.warrantyAnalysis.warrantyNotes}</p>
                          </div>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              </div>

              {/* SECTION 9: Verdict + Footer CTAs */}
              <Card id="section-verdict" className="overflow-hidden">
                <div className="p-5 border-b-2 bg-risk-green/10 border-risk-green">
                  <div className="flex items-center gap-3 flex-wrap">
                    <Badge className="text-base px-4 py-1 bg-risk-green text-white">
                      {displayVerdict}
                    </Badge>
                    <span className="text-sm text-neutral">Risk Score: <span className="font-bold text-foreground">{sampleUVPRS.totalScore}/100</span></span>
                  </div>
                  <p className="text-sm text-neutral mt-2 leading-relaxed">
                    {sampleAnalysis.finalVerdict.justification}
                  </p>
                </div>

                <div className="p-5 space-y-3">
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
            </TabsContent>

            {/* ===== COMPARISON TAB ===== */}
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
