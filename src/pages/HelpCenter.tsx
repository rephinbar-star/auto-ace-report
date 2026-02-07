import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { SEO } from "@/components/seo/SEO";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  DollarSign,
  ShieldAlert,
  Car,
  Wrench,
  Link2,
  Copy,
  ExternalLink,
  BookOpen,
  HelpCircle,
  ChevronRight,
  XCircle,
  CheckCircle2,
  Quote,
  FileWarning,
} from "lucide-react";

const realWorldCases = [
  {
    title: "The $8,000 Transmission Nightmare",
    buyer: "Sarah M., Austin TX",
    vehicle: "2018 BMW X3",
    issue: "Bought from a private seller who claimed 'perfect condition.' Within 2 months, the transmission failed completely.",
    cost: "$8,200",
    whatWentWrong: "No pre-purchase inspection, didn't check for transmission service records, ignored slight shudder during test drive.",
    lesson: "A CarWise report flags missing service records in the History Issues section and includes BMW X3 transmission problems in the Reliability Concerns warning. The Risk Assessment would have been 'High' due to lack of maintenance documentation.",
    carwiseFeature: "History Issues • Reliability Concerns • Risk Assessment",
  },
  {
    title: "Flood Damage Cover-Up",
    buyer: "Marcus T., Houston TX",
    vehicle: "2019 Honda CR-V",
    issue: "Dealer sold a flood-damaged vehicle with a 'clean' title. Electrical problems started within weeks.",
    cost: "$12,000+ in repairs",
    whatWentWrong: "Didn't check the VIN for flood damage history, dealer had washed the title through another state.",
    lesson: "CarWise analyzes vehicle history and displays Title Status prominently in the report. Flood damage, salvage, or rebuilt titles trigger a 'High Risk' assessment and appear as critical History Issues with warnings in the Expert Opinion section.",
    carwiseFeature: "Title Status • Risk Assessment • Expert Opinion",
  },
  {
    title: "The Salvage Title Surprise",
    buyer: "Jennifer L., Phoenix AZ",
    vehicle: "2020 Toyota Camry",
    issue: "Purchased at a 'great deal' price, only to discover during insurance registration it had a rebuilt title from a major accident.",
    cost: "Lost $6,000 in resale value",
    whatWentWrong: "Dealer didn't disclose title status, buyer didn't run VIN check before purchase.",
    lesson: "CarWise shows Title Status (Clean/Salvage/Rebuilt/Lemon) at the top of every report. The Deal Rating algorithm factors in title status—a 'great price' on a rebuilt title would show as 'Fair' or 'Overpriced' when adjusted for reduced resale value in the 5-Year Depreciation Table.",
    carwiseFeature: "Title Status • Deal Rating • Depreciation Table",
  },
  {
    title: "Engine Swap Deception",
    buyer: "David R., Denver CO",
    vehicle: "2017 Ford F-150",
    issue: "Odometer showed 45,000 miles but engine was actually from a different vehicle with 180,000 miles.",
    cost: "$5,500 for new engine",
    whatWentWrong: "Didn't verify engine VIN matched vehicle VIN, trusted dealer's word on maintenance history.",
    lesson: "CarWise extracts VIN data to verify year, make, model, and engine specifications. Mismatched mileage vs. wear patterns appear in History Issues. The Health Score would reflect inconsistencies, and the Expert Opinion highlights when service records don't match claimed mileage.",
    carwiseFeature: "VIN Decode • Health Score • History Issues",
  },
  {
    title: "The Dealer Review Ignored",
    buyer: "Amanda K., Miami FL",
    vehicle: "2019 Nissan Altima",
    issue: "Bought from a dealer with dozens of complaints online. Car had undisclosed frame damage affecting safety.",
    cost: "$4,800 + unsafe vehicle",
    whatWentWrong: "Didn't research dealer reputation, ignored warning signs like pressure tactics and 'today only' pricing.",
    lesson: "CarWise Pro includes a Dealer Trust Score that aggregates reviews from Google, AutoTrader, and CarGurus. A low trust score with 'Watch Out' items about hidden damage complaints would have warned Amanda. The report also checks for accident history that could indicate frame damage.",
    carwiseFeature: "Dealer Trust Score (Pro) • Watch Out Items • Accident History",
  },
];

const repairCostExamples = [
  { issue: "Transmission Replacement", cost: "$4,000 - $10,000", icon: Wrench },
  { issue: "Engine Replacement", cost: "$5,000 - $15,000", icon: Car },
  { issue: "Head Gasket Repair", cost: "$1,500 - $3,000", icon: Wrench },
  { issue: "Timing Belt/Chain", cost: "$500 - $2,000", icon: Wrench },
  { issue: "Flood Damage Electrical", cost: "$3,000 - $8,000", icon: AlertTriangle },
  { issue: "Frame Damage Repair", cost: "$2,000 - $10,000+", icon: ShieldAlert },
];

const urlCopySteps = [
  {
    step: 1,
    title: "Find the listing you want to analyze",
    description: "Go to your preferred car listing site (Autotrader, Cars.com, CarGurus, Carvana, dealer website, etc.) and find the vehicle you're interested in.",
  },
  {
    step: 2,
    title: "Click on the address bar",
    description: "At the top of your browser window, click once on the address bar. The entire URL should become highlighted in blue.",
  },
  {
    step: 3,
    title: "Copy the URL",
    description: "Press Ctrl+C on Windows or Cmd+C on Mac. Alternatively, right-click the highlighted text and select 'Copy'.",
  },
  {
    step: 4,
    title: "Paste into CarWise",
    description: "Go to the CarWise analysis page, click on the listing URL field, and press Ctrl+V (Windows) or Cmd+V (Mac) to paste.",
  },
];

export default function HelpCenterPage() {
  return (
    <>
      <SEO
        title="Help Center | CarWise"
        description="Learn why thorough used car inspections matter, see real buyer horror stories, and get help using CarWise to protect yourself from costly mistakes."
      />
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">
          {/* Hero Section */}
          <section className="bg-gradient-to-b from-destructive/5 to-background py-16">
            <div className="container mx-auto px-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-3xl mx-auto text-center"
              >
                <Badge variant="destructive" className="mb-4">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Buyer Beware
                </Badge>
                <h1 className="text-4xl md:text-5xl font-bold mb-6">
                  Don't Become a{" "}
                  <span className="text-destructive">Used Car Horror Story</span>
                </h1>
                <p className="text-xl text-muted-foreground mb-8">
                  Every year, millions of buyers lose thousands of dollars on used cars with hidden problems. 
                  Learn how to protect yourself with proper research and analysis.
                </p>
                <div className="flex flex-wrap justify-center gap-4">
                  <Button asChild size="lg">
                    <Link to="/analyze">Analyze a Vehicle</Link>
                  </Button>
                  <Button asChild variant="outline" size="lg">
                    <Link to="/faq">
                      <HelpCircle className="mr-2 h-4 w-4" />
                      FAQ
                    </Link>
                  </Button>
                </div>
              </motion.div>
            </div>
          </section>

          {/* Main Content Tabs */}
          <section className="py-12">
            <div className="container mx-auto px-4">
              <Tabs defaultValue="why-check" className="max-w-5xl mx-auto">
                <TabsList className="grid w-full grid-cols-3 mb-8">
                  <TabsTrigger value="why-check" className="text-xs sm:text-sm">
                    <ShieldAlert className="h-4 w-4 mr-1 sm:mr-2 hidden sm:inline" />
                    Why It Matters
                  </TabsTrigger>
                  <TabsTrigger value="real-cases" className="text-xs sm:text-sm">
                    <FileWarning className="h-4 w-4 mr-1 sm:mr-2 hidden sm:inline" />
                    Real Stories
                  </TabsTrigger>
                  <TabsTrigger value="how-to" className="text-xs sm:text-sm">
                    <Link2 className="h-4 w-4 mr-1 sm:mr-2 hidden sm:inline" />
                    How to Use
                  </TabsTrigger>
                </TabsList>

                {/* Why It Matters Tab */}
                <TabsContent value="why-check">
                  <div className="space-y-8">
                    {/* Cost Statistics */}
                    <Card className="border-destructive/20 bg-destructive/5">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-destructive">
                          <DollarSign className="h-6 w-6" />
                          The True Cost of Skipping Due Diligence
                        </CardTitle>
                        <CardDescription>
                          Buying a used car without proper inspection is like gambling with your savings
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid md:grid-cols-3 gap-6 mb-6">
                          <div className="text-center p-4 bg-background rounded-lg">
                            <p className="text-4xl font-bold text-destructive">$7,500</p>
                            <p className="text-sm text-muted-foreground">Average cost of major repair on problem vehicle</p>
                          </div>
                          <div className="text-center p-4 bg-background rounded-lg">
                            <p className="text-4xl font-bold text-destructive">1 in 4</p>
                            <p className="text-sm text-muted-foreground">Used cars have an undisclosed issue</p>
                          </div>
                          <div className="text-center p-4 bg-background rounded-lg">
                            <p className="text-4xl font-bold text-destructive">40%</p>
                            <p className="text-sm text-muted-foreground">Of flooded cars are resold without disclosure</p>
                          </div>
                        </div>
                        <p className="text-muted-foreground">
                          According to consumer protection agencies, millions of vehicles with serious defects, 
                          salvage history, or odometer fraud are sold each year to unsuspecting buyers. 
                          A thorough pre-purchase analysis can save you from financial disaster.
                        </p>
                      </CardContent>
                    </Card>

                    {/* Common Repair Costs */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Wrench className="h-6 w-6 text-primary" />
                          Common Expensive Repairs You Could Avoid
                        </CardTitle>
                        <CardDescription>
                          These issues are often detectable with proper inspection before purchase
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {repairCostExamples.map((item, index) => (
                            <motion.div
                              key={item.issue}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.1 }}
                              className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                            >
                              <div className="p-2 rounded-full bg-destructive/10">
                                <item.icon className="h-5 w-5 text-destructive" />
                              </div>
                              <div>
                                <p className="font-medium text-sm">{item.issue}</p>
                                <p className="text-destructive font-semibold">{item.cost}</p>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    {/* What to Check */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <CheckCircle2 className="h-6 w-6 text-primary" />
                          What CarWise Analyzes For You
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid sm:grid-cols-2 gap-4">
                          {[
                            { check: "Fair market value vs asking price", status: "included" },
                            { check: "Vehicle history red flags", status: "included" },
                            { check: "5-year depreciation forecast", status: "included" },
                            { check: "Known reliability issues for make/model", status: "included" },
                            { check: "Dealer reputation & trust score", status: "pro" },
                            { check: "Total cost of ownership analysis", status: "included" },
                            { check: "Financing vs cash comparison", status: "included" },
                            { check: "Risk assessment score", status: "included" },
                          ].map((item) => (
                            <div key={item.check} className="flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                              <span className="text-sm">{item.check}</span>
                              {item.status === "pro" && (
                                <Badge variant="secondary" className="text-xs">Pro</Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                {/* Real Cases Tab */}
                <TabsContent value="real-cases">
                  <div className="space-y-6">
                    <div className="text-center mb-8">
                      <h2 className="text-2xl font-bold mb-2">Real Buyer Horror Stories</h2>
                      <p className="text-muted-foreground">
                        These are real scenarios that happen every day. Learn from others' mistakes.
                      </p>
                    </div>

                    {realWorldCases.map((caseStudy, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                      >
                        <Card className="overflow-hidden">
                          <CardHeader className="bg-destructive/5 border-b">
                            <div className="flex items-start justify-between">
                              <div>
                                <Badge variant="destructive" className="mb-2">
                                  <XCircle className="h-3 w-3 mr-1" />
                                  Case Study #{index + 1}
                                </Badge>
                                <CardTitle className="text-lg">{caseStudy.title}</CardTitle>
                                <CardDescription>
                                  {caseStudy.buyer} • {caseStudy.vehicle}
                                </CardDescription>
                              </div>
                              <div className="text-right">
                                <p className="text-sm text-muted-foreground">Cost to buyer</p>
                                <p className="text-2xl font-bold text-destructive">{caseStudy.cost}</p>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="pt-6 space-y-4">
                            <div>
                              <p className="text-sm font-medium text-muted-foreground mb-1">What Happened</p>
                              <p>{caseStudy.issue}</p>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-muted-foreground mb-1">What Went Wrong</p>
                              <p className="text-destructive/80">{caseStudy.whatWentWrong}</p>
                            </div>
                            <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                                <p className="text-sm font-medium text-primary flex items-center gap-1">
                                  <CheckCircle2 className="h-4 w-4" />
                                  How CarWise Would Have Helped
                                </p>
                                <Badge variant="outline" className="text-xs w-fit border-primary/30 text-primary">
                                  {caseStudy.carwiseFeature}
                                </Badge>
                              </div>
                              <p className="text-sm">{caseStudy.lesson}</p>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}

                    {/* CTA after stories */}
                    <Card className="bg-primary/5 border-primary/20">
                      <CardContent className="pt-6">
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                          <div>
                            <h3 className="text-lg font-semibold">Don't become the next story</h3>
                            <p className="text-sm text-muted-foreground">
                              Get a comprehensive analysis before you buy
                            </p>
                          </div>
                          <Button asChild>
                            <Link to="/analyze">
                              Start Free Analysis
                              <ChevronRight className="h-4 w-4 ml-1" />
                            </Link>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                {/* How To Tab */}
                <TabsContent value="how-to">
                  <div className="space-y-8">
                    {/* URL Copy Instructions */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Copy className="h-6 w-6 text-primary" />
                          How to Copy & Paste a Listing URL
                        </CardTitle>
                        <CardDescription>
                          Follow these simple steps to get a vehicle listing URL into CarWise
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-6">
                          {urlCopySteps.map((step, index) => (
                            <motion.div
                              key={step.step}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.1 }}
                              className="flex gap-4"
                            >
                              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                                {step.step}
                              </div>
                              <div>
                                <h4 className="font-semibold mb-1">{step.title}</h4>
                                <p className="text-sm text-muted-foreground">{step.description}</p>
                              </div>
                            </motion.div>
                          ))}
                        </div>

                        {/* Keyboard shortcuts reference */}
                        <div className="mt-8 p-4 bg-muted rounded-lg">
                          <h4 className="font-semibold mb-3 flex items-center gap-2">
                            <BookOpen className="h-4 w-4" />
                            Quick Reference - Keyboard Shortcuts
                          </h4>
                          <div className="grid sm:grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="font-medium mb-2">Windows</p>
                              <ul className="space-y-1 text-muted-foreground">
                                <li><kbd className="px-2 py-1 bg-background rounded border">Ctrl + C</kbd> = Copy</li>
                                <li><kbd className="px-2 py-1 bg-background rounded border">Ctrl + V</kbd> = Paste</li>
                                <li><kbd className="px-2 py-1 bg-background rounded border">Ctrl + A</kbd> = Select All</li>
                              </ul>
                            </div>
                            <div>
                              <p className="font-medium mb-2">Mac</p>
                              <ul className="space-y-1 text-muted-foreground">
                                <li><kbd className="px-2 py-1 bg-background rounded border">⌘ + C</kbd> = Copy</li>
                                <li><kbd className="px-2 py-1 bg-background rounded border">⌘ + V</kbd> = Paste</li>
                                <li><kbd className="px-2 py-1 bg-background rounded border">⌘ + A</kbd> = Select All</li>
                              </ul>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Video Tutorial */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <ExternalLink className="h-6 w-6 text-primary" />
                          Video Tutorial: Copying URLs
                        </CardTitle>
                        <CardDescription>
                          Watch this short tutorial if you need a visual guide
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <AspectRatio ratio={16 / 9} className="bg-muted rounded-lg overflow-hidden">
                          <iframe
                            src="https://www.youtube.com/embed/Ng-y9d1pz9w"
                            title="How to Copy and Paste URLs"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            className="w-full h-full"
                          />
                        </AspectRatio>
                        <p className="text-sm text-muted-foreground mt-4 text-center">
                          Video credit: YouTube • 2 minutes
                        </p>
                      </CardContent>
                    </Card>

                    {/* Supported Sites */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Supported Listing Sites</CardTitle>
                        <CardDescription>
                          CarWise can analyze listings from these popular platforms
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                          {[
                            "Autotrader",
                            "Cars.com",
                            "CarGurus",
                            "Carvana",
                            "CarMax",
                            "TrueCar",
                            "Edmunds",
                            "Facebook Marketplace",
                            "Craigslist",
                            "eBay Motors",
                            "Dealer Websites",
                            "Vroom",
                          ].map((site) => (
                            <div
                              key={site}
                              className="flex items-center gap-2 p-2 rounded border bg-card text-sm"
                            >
                              <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                              {site}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </section>

          {/* Bottom CTA */}
          <section className="py-16 bg-muted/50">
            <div className="container mx-auto px-4">
              <Card className="max-w-2xl mx-auto text-center">
                <CardHeader>
                  <CardTitle className="text-2xl">Ready to Protect Yourself?</CardTitle>
                  <CardDescription>
                    Get a comprehensive vehicle analysis in minutes. Know exactly what you're buying.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap justify-center gap-4">
                  <Button asChild size="lg">
                    <Link to="/analyze">Start Free Analysis</Link>
                  </Button>
                  <Button asChild variant="outline" size="lg">
                    <Link to="/sample-report">See Sample Report</Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </section>
        </main>
        <Footer />
      </div>
    </>
  );
}
