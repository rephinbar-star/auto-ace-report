import { Link } from "react-router-dom";
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
  ArrowRight,
  Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SEO } from "@/components/seo/SEO";

// Sample data for demonstration
const sampleVehicle = {
  year: 2021,
  make: "Honda",
  model: "Accord",
  trim: "Sport 2.0T",
  mileage: 42500,
  askingPrice: 26995,
  condition: "good",
};

const sampleAnalysis = {
  priceAssessment: {
    fairMarketPrivate: 25800,
    fairMarketTradeIn: 23200,
    dealRating: "fair" as const,
    priceDifference: 1195,
    percentDifference: 4.6,
  },
  depreciationTable: [
    { year: 1, privateValue: 24500, tradeInValue: 22100, loanBalance: 22000, repairCosts: 200, netEquityPrivate: 2300, netEquityTradeIn: -100 },
    { year: 2, privateValue: 22800, tradeInValue: 20500, loanBalance: 17500, repairCosts: 450, netEquityPrivate: 4850, netEquityTradeIn: 2550 },
    { year: 3, privateValue: 20900, tradeInValue: 18800, loanBalance: 12800, repairCosts: 800, netEquityPrivate: 7300, netEquityTradeIn: 5200 },
    { year: 4, privateValue: 18700, tradeInValue: 16800, loanBalance: 7900, repairCosts: 1200, netEquityPrivate: 9600, netEquityTradeIn: 7700 },
    { year: 5, privateValue: 16200, tradeInValue: 14600, loanBalance: 2800, repairCosts: 1800, netEquityPrivate: 11600, netEquityTradeIn: 10000 },
  ],
  riskAssessment: {
    level: "low" as const,
    depreciationRisk: "The Honda Accord historically holds its value well, with an average depreciation of 12-15% annually. This specific trim with the 2.0T engine tends to retain value slightly better than the base models due to enthusiast demand.",
    reliabilityConcerns: [
      "2.0T engines may experience turbo wear after 80k miles",
      "Infotainment system occasional glitches reported",
    ],
    valueProposition: "This Accord represents solid value with its combination of reliability, fuel efficiency, and sporty performance. The asking price is slightly above market, but the clean history and single ownership justify a modest premium.",
    fairOfferPrice: 25500,
    expertOpinion: "This 2021 Honda Accord Sport 2.0T is a compelling option for buyers seeking a balance of reliability and performance. With only 42,500 miles and a clean title, this vehicle is well within the expected mileage range for its age.\n\nThe 2.0-liter turbocharged engine paired with the 10-speed automatic provides spirited acceleration while maintaining respectable fuel economy. Honda's reputation for longevity means you can expect many trouble-free miles ahead.\n\nWhile the asking price of $26,995 is about $1,195 above the fair market value, the single-owner history and documented service records add peace of mind. I recommend negotiating toward $25,500-$26,000 for a fair deal.\n\nOverall verdict: A smart, practical choice with low ownership risk.",
  },
  historyAnalysis: {
    healthScore: 87,
    positives: [
      "Single owner vehicle",
      "Clean title - no accidents reported",
      "Regular maintenance at Honda dealership",
      "No open recalls",
      "All scheduled services completed on time",
    ],
    concerns: [
      "Minor cosmetic damage reported (door ding)",
      "Last oil change was 4,500 miles ago",
    ],
  },
};

const dealRatingColors = {
  excellent: "bg-green-500 text-white",
  good: "bg-emerald-500 text-white",
  fair: "bg-yellow-500 text-white",
  poor: "bg-orange-500 text-white",
  overpriced: "bg-red-500 text-white",
};

const riskLevelColors = {
  low: "bg-green-500 text-white",
  medium: "bg-yellow-500 text-white",
  high: "bg-red-500 text-white",
};

export default function SampleReportPage() {
  const { priceAssessment, depreciationTable, riskAssessment, historyAnalysis } = sampleAnalysis;

  const chartData = depreciationTable.map((row) => ({
    name: `Year ${row.year}`,
    "Private Value": row.privateValue,
    "Trade-In Value": row.tradeInValue,
    "Loan Balance": row.loanBalance,
  }));

  return (
    <div className="flex min-h-screen flex-col">
      <SEO
        title="Sample Report - CarWise"
        description="See an example of what a CarWise vehicle analysis report looks like."
      />
      <Header />
      
      <main className="flex-1 bg-gradient-to-b from-primary/5 to-background py-8">
        <div className="container mx-auto max-w-6xl px-4">
          {/* Sample Banner */}
          <div className="mb-6 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">This is a sample report</p>
                  <p className="text-sm text-muted-foreground">
                    See what insights you'll get when you analyze a vehicle
                  </p>
                </div>
              </div>
              <Button asChild>
                <Link to="/analyze">
                  Analyze Your Vehicle
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>

          {/* Report Header */}
          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
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
              <Button variant="outline" size="sm" disabled>
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
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10">
                    <TrendingDown className="h-5 w-5 text-green-600" />
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
                        <p className="text-2xl font-bold">${sampleVehicle.askingPrice.toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">vs Fair Market</p>
                        <p className={cn(
                          "text-2xl font-bold",
                          priceAssessment.priceDifference > 0 ? "text-red-600" : "text-green-600"
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
                              row.netEquityTradeIn >= 0 ? "text-green-600" : "text-red-600"
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
                    <p className="whitespace-pre-line text-muted-foreground leading-relaxed">
                      {riskAssessment.expertOpinion}
                    </p>
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
                      <h4 className="mb-2 flex items-center gap-2 text-sm font-medium text-green-600">
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
                      <h4 className="mb-2 flex items-center gap-2 text-sm font-medium text-red-600">
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

              {/* Risk Assessment */}
              <Card>
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
                      {riskAssessment.reliabilityConcerns.map((concern, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <Wrench className="mt-0.5 h-3 w-3 flex-shrink-0" />
                          {concern}
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>

              {/* CTA Card */}
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-6 text-center">
                  <h3 className="font-semibold mb-2">Ready to analyze your vehicle?</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Get the same detailed insights for any car you're considering.
                  </p>
                  <Button asChild className="w-full">
                    <Link to="/analyze">
                      Start Your Analysis
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
