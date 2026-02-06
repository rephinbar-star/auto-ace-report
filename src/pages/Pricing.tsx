import { useState } from "react";
import { Link } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { SEO } from "@/components/seo/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  Check, 
  X, 
  Zap, 
  Building2, 
  User,
  ArrowRight,
  HelpCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const plans = [
  {
    name: "Free",
    description: "Perfect for trying out CarWise",
    monthlyPrice: 0,
    yearlyPrice: 0,
    icon: User,
    features: [
      { name: "3 vehicle analyses per month", included: true },
      { name: "Basic price assessment", included: true },
      { name: "Deal rating", included: true },
      { name: "5-year depreciation forecast", included: false },
      { name: "Expert AI opinion", included: false },
      { name: "History report parsing", included: false },
      { name: "PDF report export", included: false },
      { name: "Priority support", included: false },
    ],
    cta: "Get Started",
    ctaLink: "/signup",
    popular: false,
  },
  {
    name: "Pro",
    description: "For serious car buyers",
    monthlyPrice: 19,
    yearlyPrice: 190,
    icon: Zap,
    features: [
      { name: "Unlimited vehicle analyses", included: true },
      { name: "Advanced price assessment", included: true },
      { name: "Deal rating with confidence score", included: true },
      { name: "5-year depreciation forecast", included: true },
      { name: "Expert AI opinion", included: true },
      { name: "History report parsing (Carfax, AutoCheck)", included: true },
      { name: "PDF report export", included: true },
      { name: "Priority support", included: false },
    ],
    cta: "Start Free Trial",
    ctaLink: "/signup?plan=pro",
    popular: true,
  },
  {
    name: "Dealer",
    description: "For dealerships & professionals",
    monthlyPrice: 99,
    yearlyPrice: 990,
    icon: Building2,
    features: [
      { name: "Unlimited vehicle analyses", included: true },
      { name: "Advanced price assessment", included: true },
      { name: "Deal rating with confidence score", included: true },
      { name: "5-year depreciation forecast", included: true },
      { name: "Expert AI opinion", included: true },
      { name: "History report parsing (Carfax, AutoCheck)", included: true },
      { name: "PDF report export & white-labeling", included: true },
      { name: "Priority support & API access", included: true },
    ],
    cta: "Contact Sales",
    ctaLink: "/contact",
    popular: false,
  },
];

const faqs = [
  {
    question: "How accurate are the vehicle valuations?",
    answer: "Our AI analyzes real-time market data from multiple sources to provide valuations within 3-5% of actual market prices. We update our models daily to reflect current market conditions.",
  },
  {
    question: "Can I cancel my subscription anytime?",
    answer: "Yes, you can cancel your subscription at any time. If you cancel, you'll continue to have access until the end of your billing period. No refunds are provided for partial months.",
  },
  {
    question: "What vehicle history reports do you support?",
    answer: "We currently support Carfax and AutoCheck reports. Simply upload a PDF or paste a URL, and our AI will extract all relevant information including accidents, ownership history, and service records.",
  },
  {
    question: "Do you offer refunds?",
    answer: "We offer a 7-day money-back guarantee for Pro and Dealer plans. If you're not satisfied with the service, contact us within 7 days of purchase for a full refund.",
  },
  {
    question: "Can I upgrade or downgrade my plan?",
    answer: "Yes, you can change your plan at any time. Upgrades take effect immediately, and downgrades take effect at the start of your next billing cycle.",
  },
  {
    question: "Is there a free trial?",
    answer: "The Pro plan includes a 7-day free trial with full access to all features. No credit card required to start. The Free plan is always available with limited features.",
  },
];

export default function PricingPage() {
  const [isYearly, setIsYearly] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO
        title="Pricing - CarWise"
        description="Choose the right CarWise plan for your needs. From free basic analysis to professional dealer tools."
      />
      <Header />

      <main className="flex-1">
        {/* Hero section */}
        <section className="py-16 md:py-24 bg-gradient-to-b from-primary/5 to-background">
          <div className="container mx-auto px-4 text-center">
            <Badge variant="secondary" className="mb-4">Pricing</Badge>
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              Simple, transparent pricing
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
              Choose the plan that fits your needs. Upgrade or downgrade anytime.
            </p>

            {/* Billing toggle */}
            <div className="flex items-center justify-center gap-3">
              <Label htmlFor="billing-toggle" className={cn(!isYearly && "text-foreground", isYearly && "text-muted-foreground")}>
                Monthly
              </Label>
              <Switch
                id="billing-toggle"
                checked={isYearly}
                onCheckedChange={setIsYearly}
              />
              <Label htmlFor="billing-toggle" className={cn(isYearly && "text-foreground", !isYearly && "text-muted-foreground")}>
                Yearly
              </Label>
              {isYearly && (
                <Badge variant="secondary" className="ml-2 bg-green-500/10 text-green-600 border-green-500/20">
                  Save 17%
                </Badge>
              )}
            </div>
          </div>
        </section>

        {/* Pricing cards */}
        <section className="py-12 md:py-16">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {plans.map((plan) => (
                <Card 
                  key={plan.name}
                  className={cn(
                    "relative flex flex-col",
                    plan.popular && "border-primary shadow-lg scale-105 md:scale-110"
                  )}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-primary text-primary-foreground">
                        Most Popular
                      </Badge>
                    </div>
                  )}
                  
                  <CardHeader className="text-center pb-4">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                      <plan.icon className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle className="text-2xl">{plan.name}</CardTitle>
                    <CardDescription>{plan.description}</CardDescription>
                  </CardHeader>

                  <CardContent className="flex-1">
                    <div className="text-center mb-6">
                      <div className="flex items-baseline justify-center gap-1">
                        <span className="text-4xl font-bold">
                          ${isYearly ? Math.round(plan.yearlyPrice / 12) : plan.monthlyPrice}
                        </span>
                        <span className="text-muted-foreground">/month</span>
                      </div>
                      {isYearly && plan.yearlyPrice > 0 && (
                        <p className="text-sm text-muted-foreground mt-1">
                          ${plan.yearlyPrice} billed annually
                        </p>
                      )}
                    </div>

                    <ul className="space-y-3">
                      {plan.features.map((feature) => (
                        <li key={feature.name} className="flex items-start gap-3">
                          {feature.included ? (
                            <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                          ) : (
                            <X className="h-5 w-5 text-muted-foreground/50 flex-shrink-0 mt-0.5" />
                          )}
                          <span className={cn(
                            "text-sm",
                            !feature.included && "text-muted-foreground/50"
                          )}>
                            {feature.name}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>

                  <CardFooter>
                    <Button 
                      asChild 
                      className="w-full" 
                      variant={plan.popular ? "default" : "outline"}
                    >
                      <Link to={plan.ctaLink}>
                        {plan.cta}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Comparison note */}
        <section className="py-8">
          <div className="container mx-auto px-4 text-center">
            <p className="text-muted-foreground">
              All plans include our core vehicle analysis. Need a custom solution?{" "}
              <Link to="/contact" className="text-primary hover:underline">
                Contact us
              </Link>
            </p>
          </div>
        </section>

        {/* FAQ section */}
        <section className="py-16 md:py-24 bg-muted/50">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <div className="flex items-center justify-center gap-2 mb-4">
                <HelpCircle className="h-6 w-6 text-primary" />
                <h2 className="text-3xl font-bold">Frequently Asked Questions</h2>
              </div>
              <p className="text-muted-foreground">
                Have questions? We've got answers.
              </p>
            </div>

            <div className="max-w-3xl mx-auto">
              <Accordion type="single" collapsible className="w-full">
                {faqs.map((faq, index) => (
                  <AccordionItem key={index} value={`item-${index}`}>
                    <AccordionTrigger className="text-left">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>
        </section>

        {/* CTA section */}
        <section className="py-16 md:py-24">
          <div className="container mx-auto px-4 text-center">
            <div className="max-w-2xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Ready to make smarter car decisions?
              </h2>
              <p className="text-muted-foreground text-lg mb-8">
                Start with our free plan and upgrade when you need more.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg">
                  <Link to="/signup">
                    Get Started Free
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link to="/sample-report">View Sample Report</Link>
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
