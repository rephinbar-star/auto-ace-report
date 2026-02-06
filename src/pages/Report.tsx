import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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

export default function ReportPage() {
  const { id } = useParams();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [vehicleData, setVehicleData] = useState<any>(null);

  useEffect(() => {
    const loadAnalysis = async () => {
      // For demo, load from sessionStorage
      const stored = sessionStorage.getItem("analysisData");
      if (stored) {
        const data = JSON.parse(stored);
        setVehicleData(data);
        
        // Call AI analysis
        try {
          const { data: result, error } = await supabase.functions.invoke("analyze-vehicle", {
            body: data,
          });

          if (error) throw error;
          
          if (result.success) {
            setAnalysis(result.analysis);
          } else {
            throw new Error(result.error);
          }
        } catch (error) {
          console.error("Analysis error:", error);
          toast({
            title: "Analysis Error",
            description: "Failed to generate analysis. Please try again.",
            variant: "destructive",
          });
        }
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
              <CardTitle>Report Not Found</CardTitle>
              <CardDescription>
                We couldn't find this analysis. Start a new one?
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
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
              <Button variant="outline" size="sm">
                <Share2 className="mr-2 h-4 w-4" />
                Share
              </Button>
              <Button variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" />
                Download PDF
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
                  <div className="mt-6 overflow-x-auto">
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
                        {depreciationTable.map((row) => (
                          <TableRow key={row.year}>
                            <TableCell className="font-medium">Year {row.year}</TableCell>
                            <TableCell className="text-right">${row.privateValue.toLocaleString()}</TableCell>
                            <TableCell className="text-right">${row.tradeInValue.toLocaleString()}</TableCell>
                            <TableCell className="text-right">${row.loanBalance.toLocaleString()}</TableCell>
                            <TableCell className="text-right">${row.repairCosts.toLocaleString()}</TableCell>
                            <TableCell className={cn(
                              "text-right font-semibold",
                              row.netEquityTradeIn >= 0 ? "text-success" : "text-danger"
                            )}>
                              {row.netEquityTradeIn >= 0 ? "+" : ""}
                              ${row.netEquityTradeIn.toLocaleString()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
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
            </div>

            {/* Right Column - Sidebar */}
            <div className="space-y-6">
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
                      <ul className="space-y-1">
                        {riskAssessment.reliabilityConcerns.map((concern, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <Wrench className="mt-0.5 h-3 w-3 shrink-0" />
                            {concern}
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
