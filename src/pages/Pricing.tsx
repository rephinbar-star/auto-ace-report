import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { SEO } from "@/components/seo/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Check, 
  X, 
  Zap, 
  User,
  ArrowRight,
  HelpCircle,
  Loader2,
  Crown
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription, STRIPE_PRICES } from "@/hooks/useSubscription";
import { toast } from "sonner";

type PlanKey = "free" | "premium" | "pro";

interface Plan {
  key: PlanKey;
  name: string;
  description: string;
  price: number;
  icon: React.ComponentType<{ className?: string }>;
  features: { name: string; included: boolean }[];
  priceId?: string;
  popular: boolean;
}

const plans: Plan[] = [
  {
    key: "free",
    name: "Free",
    description: "Perfect for trying out CarWise",
    price: 0,
    icon: User,
    features: [
      { name: "1 vehicle per report", included: true },
      { name: "Up to 4 reports per month", included: true },
      { name: "Advanced price assessment", included: true },
      { name: "Deal rating with confidence score", included: true },
      { name: "5-year depreciation forecast", included: true },
      { name: "Expert AI opinion", included: true },
      { name: "History report parsing (Carfax, AutoCheck)", included: true },
      { name: "PDF report export", included: false },
      { name: "Vehicle comparison", included: false },
      { name: "Dealership review", included: false },
    ],
    popular: false,
  },
  {
    key: "premium",
    name: "Premium",
    description: "For occasional car shoppers",
    price: STRIPE_PRICES.premium.price,
    icon: Zap,
    priceId: STRIPE_PRICES.premium.priceId,
    features: [
      { name: "Compare up to 2 vehicles", included: true },
      { name: "PDF report export", included: true },
      { name: "Advanced price assessment", included: true },
      { name: "Deal rating with confidence score", included: true },
      { name: "5-year depreciation forecast", included: true },
      { name: "Expert AI opinion", included: true },
      { name: "History report parsing (Carfax, AutoCheck)", included: true },
      { name: "Dealership review", included: false },
    ],
    popular: true,
  },
  {
    key: "pro",
    name: "Pro",
    description: "For serious car buyers",
    price: STRIPE_PRICES.pro.price,
    icon: Crown,
    priceId: STRIPE_PRICES.pro.priceId,
    features: [
      { name: "Compare up to 6 vehicles", included: true },
      { name: "Dealership review", included: true },
      { name: "PDF report export", included: true },
      { name: "Advanced price assessment", included: true },
      { name: "Deal rating with confidence score", included: true },
      { name: "5-year depreciation forecast", included: true },
      { name: "Expert AI opinion", included: true },
      { name: "History report parsing (Carfax, AutoCheck)", included: true },
    ],
    popular: false,
  },
];

const faqs = [
  {
    question: "How accurate are the vehicle valuations?",
    answer: "Our AI analyzes real-time market data from multiple sources to provide valuations within 3-5% of actual market prices. We update our models daily to reflect current market conditions.",
  },
  {
    question: "How does the one-time payment work?",
    answer: "Premium and Pro reports are one-time purchases. Pay once per report and get instant access to all the features included in that tier. No subscriptions or recurring charges.",
  },
  {
    question: "What vehicle history reports do you support?",
    answer: "We currently support Carfax and AutoCheck reports. Simply upload a PDF or paste a URL, and our AI will extract all relevant information including accidents, ownership history, and service records.",
  },
  {
    question: "Do you offer refunds?",
    answer: "We offer a 7-day money-back guarantee for all paid reports. If you're not satisfied with the report, contact us within 7 days of purchase for a full refund.",
  },
  {
    question: "What's the difference between Premium and Pro?",
    answer: "Premium reports let you compare up to 2 vehicles with PDF export. Pro reports include comparison of up to 6 vehicles, dealership reviews, and priority support.",
  },
  {
    question: "Is the free tier really free?",
    answer: "Yes! The Free plan gives you up to 4 single-vehicle reports per month with our core analysis features, completely free. No credit card required.",
  },
];

export default function PricingPage() {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const { user } = useAuth();
  const { createCheckout } = useSubscription();
  const navigate = useNavigate();

  const handlePlanAction = async (plan: Plan) => {
    if (plan.key === "free") {
      if (user) {
        navigate("/dashboard");
      } else {
        navigate("/signup");
      }
      return;
    }

    if (!user) {
      toast.info("Please sign up or log in to purchase a report");
      navigate("/signup", { state: { returnTo: "/pricing" } });
      return;
    }

    if (plan.priceId) {
      try {
        setLoadingPlan(plan.key);
        await createCheckout(plan.priceId);
      } catch (error) {
        toast.error("Failed to start checkout");
      } finally {
        setLoadingPlan(null);
      }
    }
  };

  const getButtonText = (plan: Plan) => {
    if (loadingPlan === plan.key) return "Loading...";
    if (plan.key === "free") return user ? "Go to Dashboard" : "Get Started";
    return "Buy Report";
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO
        title="Pricing - CarWise"
        description="Choose the right CarWise report for your needs. Free basic analysis or pay-per-report for premium features."
        jsonLd={faqJsonLd}
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
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Start free, then pay per report when you need more features. No subscriptions.
            </p>
          </div>
        </section>

        {/* Pricing cards */}
        <section className="py-12 md:py-16">
          <div className="container mx-auto px-4">
            <h2 className="sr-only">Available Plans</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {plans.map((plan) => (
                <Card 
                  key={plan.key}
                  className={cn(
                    "relative flex flex-col",
                    plan.popular && "border-primary shadow-lg"
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
                          ${plan.price}
                        </span>
                        {plan.price > 0 && (
                          <span className="text-muted-foreground">/report</span>
                        )}
                      </div>
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
                      className="w-full" 
                      variant={plan.popular ? "default" : "outline"}
                      onClick={() => handlePlanAction(plan)}
                      disabled={loadingPlan === plan.key}
                    >
                      {loadingPlan === plan.key && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      {getButtonText(plan)}
                      {!loadingPlan && plan.key !== "free" && (
                        <ArrowRight className="ml-2 h-4 w-4" />
                      )}
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
