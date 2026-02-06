import { Button } from "@/components/ui/button";
import { Car, ArrowRight, Shield, TrendingDown, DollarSign } from "lucide-react";
import { Link } from "react-router-dom";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-hero pb-20 pt-16 md:pb-32 md:pt-24">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute right-0 top-0 h-[500px] w-[500px] rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-[400px] w-[400px] rounded-full bg-accent/5 blur-3xl" />
      </div>

      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-4xl text-center">
          {/* Badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-sm font-medium text-primary">
            <Car className="h-4 w-4" />
            Expert Car Buying Analysis
          </div>

          {/* Main headline */}
          <h1 className="mb-6 text-4xl font-bold tracking-tight text-foreground md:text-5xl lg:text-6xl">
            Buy Smarter with{" "}
            <span className="text-gradient">Expert Insights</span>
          </h1>

          {/* Subheadline */}
          <p className="mb-8 text-lg text-muted-foreground md:text-xl">
            Get professional analysis on any vehicle's fair price, depreciation forecast, 
            and hidden risks—all powered by AI expertise from mechanics and professional buyers.
          </p>

          {/* CTA buttons */}
          <div className="mb-16 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button asChild size="lg" className="group h-12 px-8 text-base">
              <Link to="/analyze">
                Start Free Analysis
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-12 px-8 text-base">
              <Link to="/how-it-works">
                See How It Works
              </Link>
            </Button>
          </div>

          {/* Trust indicators */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div className="flex flex-col items-center gap-2 rounded-xl border bg-card/50 p-4 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/10">
                <DollarSign className="h-5 w-5 text-success" />
              </div>
              <span className="font-semibold">Fair Price Analysis</span>
              <span className="text-sm text-muted-foreground">Market-based valuations</span>
            </div>
            
            <div className="flex flex-col items-center gap-2 rounded-xl border bg-card/50 p-4 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <TrendingDown className="h-5 w-5 text-primary" />
              </div>
              <span className="font-semibold">5-Year Depreciation</span>
              <span className="text-sm text-muted-foreground">Equity projections</span>
            </div>
            
            <div className="flex flex-col items-center gap-2 rounded-xl border bg-card/50 p-4 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning/10">
                <Shield className="h-5 w-5 text-warning" />
              </div>
              <span className="font-semibold">Risk Assessment</span>
              <span className="text-sm text-muted-foreground">Hidden issue detection</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
