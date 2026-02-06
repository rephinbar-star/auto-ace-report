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
    repairAnalysis: "**Anticipated Repairs Based on Mileage & History**\n\nBased on the vehicle's current 42,500 miles and Carfax service records showing regular maintenance at Honda dealerships, here's what to expect:\n\n**Completed Maintenance (Per Carfax):**\n• Regular oil changes every 5,000 miles ✓\n• Brake fluid flush at 30,000 miles ✓\n• Cabin/engine air filters replaced at 35,000 miles ✓\n• Tire rotation every 7,500 miles ✓\n\n**Upcoming Service (45k-60k miles):**\n• Brake pad replacement (~$300-450) - Front pads typically need replacement around 50,000 miles\n• Transmission fluid change (~$150-200) - Recommended at 60,000 miles for 2.0T models\n• Spark plug inspection (~$50-100)\n\n**Mid-Term Repairs (60k-100k miles):**\n• Rear brake pads & rotors (~$400-550)\n• Drive belt replacement (~$150-250)\n• Battery replacement (~$150-200) - Typically lasts 4-5 years\n• Suspension components inspection - May need bushings/struts (~$500-800)\n\n**Long-Term Considerations (100k+ miles):**\n• Turbo system maintenance (~$200-400 inspection)\n• Timing chain inspection (2.0T uses chain, not belt - good for longevity)\n• Water pump replacement (~$400-600)\n• AC compressor service (~$300-500)\n\n**Total Estimated 5-Year Repair Costs: $1,800-$2,500**\n\nThis is below average for vehicles in this class, reflecting Honda's reliability reputation. The documented service history reduces risk of unexpected failures.",
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
  const [includeRepairs, setIncludeRepairs] = useState(true);

  const chartData = depreciationTable.map((row) => ({
    name: `Year ${row.year}`,
    "Private Value": row.privateValue,
    "Trade-In Value": row.tradeInValue,
    "Loan Balance": row.loanBalance,
    "Cumulative Repairs": depreciationTable
      .filter((r) => r.year <= row.year)
      .reduce((sum, r) => sum + r.repairCosts, 0),
  }));

  const calculateNetEquity = (row: typeof depreciationTable[0]) => {
    const cumulativeRepairs = depreciationTable
      .filter((r) => r.year <= row.year)
      .reduce((sum, r) => sum + r.repairCosts, 0);
    return includeRepairs 
      ? row.tradeInValue - row.loanBalance - cumulativeRepairs
      : row.tradeInValue - row.loanBalance;
  };

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
              <Button variant="outline" size="sm" disabled>
                <Download className="mr-2 h-4 w-4" />
                Download PDF
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
                icon: AlertTriangle,
                label: "Risk Level",
                value: riskAssessment.level,
                iconClass: riskLevelColors[riskAssessment.level],
                capitalize: true,
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

          <div className="grid gap-8 lg:grid-cols-3">
            {/* Left Column - Main Content */}
            <motion.div 
              className="space-y-8 lg:col-span-2"
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
                    <div className="space-y-4">
                      <motion.div 
                        className="flex items-center justify-between rounded-lg bg-muted p-4"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.3 }}
                      >
                        <div>
                          <p className="text-sm text-muted-foreground">Asking Price</p>
                          <p className="text-2xl font-bold">${sampleVehicle.askingPrice.toLocaleString()}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">vs Fair Market</p>
                          <motion.p 
                            className={cn(
                              "text-2xl font-bold",
                              priceAssessment.priceDifference > 0 ? "text-red-600" : "text-green-600"
                            )}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.5 }}
                          >
                            {priceAssessment.priceDifference > 0 ? "+" : ""}
                            ${Math.abs(priceAssessment.priceDifference).toLocaleString()}
                          </motion.p>
                        </div>
                      </motion.div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <motion.div 
                          className="rounded-lg border p-4"
                          whileHover={{ scale: 1.02, borderColor: "hsl(var(--primary))" }}
                          transition={{ duration: 0.2 }}
                        >
                          <p className="text-sm text-muted-foreground">Private Sale Value</p>
                          <p className="text-xl font-semibold">${priceAssessment.fairMarketPrivate.toLocaleString()}</p>
                        </motion.div>
                        <motion.div 
                          className="rounded-lg border p-4"
                          whileHover={{ scale: 1.02, borderColor: "hsl(var(--primary))" }}
                          transition={{ duration: 0.2 }}
                        >
                          <p className="text-sm text-muted-foreground">Trade-In Value</p>
                          <p className="text-xl font-semibold">${priceAssessment.fairMarketTradeIn.toLocaleString()}</p>
                        </motion.div>
                      </div>
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
                          {includeRepairs && <TableHead className="text-right">Cumulative Repairs</TableHead>}
                          <TableHead className="text-right">Net Equity {includeRepairs ? "(w/ repairs)" : "(w/o repairs)"}</TableHead>
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
                                ${depreciationTable
                                  .filter((r) => r.year <= row.year)
                                  .reduce((sum, r) => sum + r.repairCosts, 0)
                                  .toLocaleString()}
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
                        {riskAssessment.reliabilityConcerns.map((concern, i) => (
                          <motion.li 
                            key={i} 
                            className="flex items-start gap-2 text-sm text-muted-foreground"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.3 + i * 0.1 }}
                          >
                            <Wrench className="mt-0.5 h-3 w-3 flex-shrink-0" />
                            {concern}
                          </motion.li>
                        ))}
                      </ul>
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
        </div>
      </main>

      <Footer />
    </div>
  );
}
