import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { SEO } from "@/components/seo/SEO";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Clock, Rocket, Calendar, Sparkles } from "lucide-react";

const changelogEntries = [
  {
    version: "0.5.0",
    date: "February 2026",
    title: "Side-by-Side Comparison",
    items: [
      "Compare up to 3 vehicles with UVPRS scoring",
      "Financial outlook and total cost of ownership cards",
      "PDF export for comparison reports",
    ],
  },
  {
    version: "0.4.0",
    date: "January 2026",
    title: "Dealer Trust & History Analysis",
    items: [
      "AI-powered dealer reputation scoring",
      "Vehicle history report parsing (Carfax / AutoCheck)",
      "Service gap detection and timeline view",
    ],
  },
  {
    version: "0.3.0",
    date: "December 2025",
    title: "Pricing Intelligence",
    items: [
      "Fair market value from multiple sources",
      "Deal rating (excellent → overpriced)",
      "Depreciation forecasting with tables",
    ],
  },
  {
    version: "0.2.0",
    date: "November 2025",
    title: "Core Analysis Engine",
    items: [
      "VIN decoding and spec lookup",
      "Risk scoring and health assessment",
      "Listing URL scraping with image caching",
    ],
  },
  {
    version: "0.1.0",
    date: "October 2025",
    title: "Initial Launch",
    items: [
      "User authentication and profiles",
      "Dashboard with saved reports",
      "Basic vehicle input wizard",
    ],
  },
];

const roadmapItems = [
  {
    status: "done" as const,
    title: "Vehicle Comparison Tool",
    description: "Compare multiple vehicles side-by-side with scoring.",
  },
  {
    status: "done" as const,
    title: "Dealer Trust Analysis",
    description: "AI-powered dealer reputation and review analysis.",
  },
  {
    status: "in-progress" as const,
    title: "Mobile App (PWA)",
    description: "Installable progressive web app with offline support.",
  },
  {
    status: "in-progress" as const,
    title: "Insurance Cost Estimates",
    description: "Estimated insurance premiums based on vehicle and driver profile.",
  },
  {
    status: "planned" as const,
    title: "OBD-II Integration",
    description: "Connect a Bluetooth OBD scanner for live vehicle diagnostics.",
  },
  {
    status: "planned" as const,
    title: "Recall Alerts",
    description: "Automatic NHTSA recall notifications for saved vehicles.",
  },
  {
    status: "planned" as const,
    title: "Market Trend Tracker",
    description: "Track price trends for specific makes/models over time.",
  },
  {
    status: "planned" as const,
    title: "Community Reviews",
    description: "User-submitted reviews and ratings for vehicles and dealers.",
  },
];

const statusConfig = {
  done: { label: "Done", icon: CheckCircle2, color: "bg-green-500/15 text-green-600 ring-green-500/30" },
  "in-progress": { label: "In Progress", icon: Clock, color: "bg-amber-500/15 text-amber-600 ring-amber-500/30" },
  planned: { label: "Planned", icon: Rocket, color: "bg-blue-500/15 text-blue-600 ring-blue-500/30" },
};

export default function Roadmap() {
  return (
    <>
      <SEO
        title="Changelog & Roadmap | CarWise"
        description="See what's new in CarWise and what we're building next. Track our progress and upcoming features."
      />
      <Header />
      <main className="container mx-auto px-4 py-16">
        <div className="mx-auto max-w-3xl text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight mb-4">
            Changelog & Roadmap
          </h1>
          <p className="text-lg text-muted-foreground">
            Track our progress — see what we've shipped and what's coming next.
          </p>
        </div>

        <div className="mx-auto max-w-3xl">
          <Tabs defaultValue="changelog" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="changelog" className="gap-2">
                <Calendar className="h-4 w-4" />
                Changelog
              </TabsTrigger>
              <TabsTrigger value="roadmap" className="gap-2">
                <Sparkles className="h-4 w-4" />
                Roadmap
              </TabsTrigger>
            </TabsList>

            <TabsContent value="changelog" className="mt-8 space-y-6">
              {changelogEntries.map((entry) => (
                <Card key={entry.version}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{entry.title}</CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{entry.version}</Badge>
                        <span className="text-xs text-muted-foreground">{entry.date}</span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {entry.items.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="roadmap" className="mt-8 space-y-4">
              {roadmapItems.map((item, i) => {
                const config = statusConfig[item.status];
                const Icon = config.icon;
                return (
                  <Card key={i}>
                    <CardContent className="flex items-start gap-4 py-4">
                      <div className="mt-0.5">
                        <Icon className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{item.title}</span>
                          <Badge variant="outline" className={`text-[10px] ${config.color} ring-1`}>
                            {config.label}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <Footer />
    </>
  );
}
