import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Perfect for analyzing individual vehicles",
    features: [
      "Unlimited single vehicle analyses",
      "Fair market price assessment",
      "5-year depreciation projections",
      "Expert risk recommendations",
      "Save reports to your account",
    ],
    cta: "Get Started Free",
    href: "/signup",
    popular: false,
  },
  {
    name: "Compare Pass",
    price: "$7.95",
    period: "one-time",
    description: "One-time access to compare mode",
    features: [
      "Everything in Free",
      "Compare up to 3 vehicles side-by-side",
      "Best buy recommendation",
      "One-time purchase, no subscription",
    ],
    cta: "Buy Compare Pass",
    href: "/signup?plan=compare-pass",
    popular: false,
  },
  {
    name: "Pro",
    price: "$14.95",
    period: "/month",
    description: "For serious car shoppers",
    features: [
      "Everything in Free",
      "Unlimited vehicle comparisons",
      "Priority report generation",
      "Advanced market insights",
      "Cancel anytime",
    ],
    cta: "Start Pro Trial",
    href: "/signup?plan=pro",
    popular: true,
  },
];

export function Pricing() {
  return (
    <section className="py-20 md:py-28">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <Badge variant="outline" className="mb-4">Pricing</Badge>
          <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
            Simple, Transparent Pricing
          </h2>
          <p className="text-lg text-muted-foreground">
            Start for free. Upgrade when you need to compare vehicles.
          </p>
        </div>

        <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-3">
          {plans.map((plan) => (
            <Card 
              key={plan.name}
              className={`relative flex flex-col ${
                plan.popular 
                  ? "border-2 border-primary shadow-card" 
                  : "border-2"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground">Most Popular</Badge>
                </div>
              )}
              
              <CardHeader className="text-center">
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <div className="mt-4">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground">{plan.period}</span>
                </div>
                <CardDescription className="mt-2">{plan.description}</CardDescription>
              </CardHeader>

              <CardContent className="flex-1">
                <ul className="space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <Check className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                      <span className="text-sm">{feature}</span>
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
                  <Link to={plan.href}>{plan.cta}</Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
