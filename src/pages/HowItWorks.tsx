import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { SEO } from "@/components/seo/SEO";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { 
  Car, 
  Search, 
  FileText, 
  TrendingUp, 
  Shield, 
  Clock, 
  CheckCircle,
  ArrowRight,
  Upload,
  Brain,
  DollarSign
} from "lucide-react";

const steps = [
  {
    number: "01",
    icon: Car,
    title: "Enter Vehicle Details",
    description: "Start by entering the vehicle's VIN or manually input the year, make, model, and trim. We'll fetch additional specifications automatically.",
    details: [
      "VIN lookup for automatic vehicle identification",
      "Manual entry option for flexibility",
      "Support for all makes and models",
    ],
  },
  {
    number: "02",
    icon: Upload,
    title: "Add History Report",
    description: "Upload a vehicle history report (Carfax, AutoCheck) or paste a URL. Our AI extracts accident history, ownership records, and service information.",
    details: [
      "PDF upload or URL paste",
      "AI-powered data extraction",
      "Accident and title status detection",
      "Analyze service and maintenance history",
      "Predict future repairs and cost",
    ],
  },
  {
    number: "03",
    icon: DollarSign,
    title: "Enter Pricing & Financing",
    description: "Input the asking price and your financing details. Whether you're paying cash, financing, or leasing, we'll factor it all into the analysis.",
    details: [
      "Cash, loan, or lease options",
      "APR and term calculations",
      "Total cost of ownership estimates",
    ],
  },
  {
    number: "04",
    icon: Brain,
    title: "AI Analysis",
    description: "Our AI analyzes market data, depreciation trends, and reliability ratings to generate a comprehensive report with actionable insights.",
    details: [
      "Real-time market value comparison",
      "5-year depreciation forecast",
      "Risk assessment and deal rating",
    ],
  },
];

const benefits = [
  {
    icon: Shield,
    title: "Avoid Bad Deals",
    description: "Our AI identifies overpriced vehicles and hidden issues before you commit.",
  },
  {
    icon: TrendingUp,
    title: "Know True Value",
    description: "Get accurate market values based on current data, not outdated estimates.",
  },
  {
    icon: Clock,
    title: "Save Time",
    description: "Get a comprehensive analysis in minutes instead of hours of research.",
  },
  {
    icon: CheckCircle,
    title: "Negotiate Better",
    description: "Use our fair offer price to negotiate with confidence and save money.",
  },
];

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO
        title="How It Works - CarWise"
        description="Learn how CarWise analyzes vehicles and helps you make smarter car buying decisions with AI-powered insights."
      />
      <Header />

      <main className="flex-1">
        {/* Hero section */}
        <section className="py-16 md:py-24 bg-gradient-to-b from-primary/5 to-background">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              How CarWise Works
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
              Get AI-powered vehicle analysis in four simple steps. Make confident 
              car buying decisions with data-driven insights.
            </p>
            <Button asChild size="lg">
              <Link to="/analyze">
                Start Free Analysis
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </section>

        {/* Steps section */}
        <section className="py-16 md:py-24">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              {steps.map((step, index) => (
                <div 
                  key={step.number}
                  className={`flex flex-col md:flex-row gap-8 items-start ${
                    index !== steps.length - 1 ? "mb-16 pb-16 border-b" : ""
                  }`}
                >
                  {/* Step number and icon */}
                  <div className="flex-shrink-0">
                    <div className="relative">
                      <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
                        <step.icon className="h-10 w-10 text-primary" />
                      </div>
                      <span className="absolute -top-2 -left-2 text-5xl font-bold text-primary/20">
                        {step.number}
                      </span>
                    </div>
                  </div>

                  {/* Step content */}
                  <div className="flex-1">
                    <h3 className="text-2xl font-semibold mb-3">{step.title}</h3>
                    <p className="text-muted-foreground mb-4 text-lg">
                      {step.description}
                    </p>
                    <ul className="space-y-2">
                      {step.details.map((detail, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm">
                          <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
                          <span>{detail}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Benefits section */}
        <section className="py-16 md:py-24 bg-muted/50">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Why Use CarWise?
              </h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                Join thousands of smart car buyers who save money and avoid bad deals
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
              {benefits.map((benefit) => (
                <div 
                  key={benefit.title}
                  className="p-6 rounded-xl bg-background border hover:shadow-lg transition-shadow"
                >
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <benefit.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{benefit.title}</h3>
                  <p className="text-sm text-muted-foreground">{benefit.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA section */}
        <section className="py-16 md:py-24">
          <div className="container mx-auto px-4 text-center">
            <div className="max-w-2xl mx-auto">
              <Search className="h-16 w-16 text-primary mx-auto mb-6" />
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Ready to Analyze Your First Vehicle?
              </h2>
              <p className="text-muted-foreground text-lg mb-8">
                Get started in minutes. No credit card required for your first analysis.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg">
                  <Link to="/analyze">
                    Start Free Analysis
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link to="/pricing">View Pricing</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
