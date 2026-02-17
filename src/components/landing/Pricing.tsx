import { Check, X, User, Zap, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { STRIPE_PRICES } from "@/hooks/useSubscription";
import { cn } from "@/lib/utils";

const plans = [
  {
    name: "Free",
    price: 0,
    description: "Perfect for trying out CarWise",
    icon: User,
    features: [
      { name: "1 vehicle per report", included: true },
      { name: "Up to 4 reports per month", included: true },
      { name: "Advanced price assessment", included: true },
      { name: "5-year depreciation forecast", included: true },
      { name: "Expert AI opinion", included: true },
      { name: "History report parsing", included: true },
      { name: "PDF report export", included: false },
      { name: "Vehicle comparison", included: false },
      { name: "Dealership review", included: false },
    ],
    cta: "Get Started Free",
    href: "/signup",
    popular: false,
  },
  {
    name: "Premium",
    price: STRIPE_PRICES.premium.price,
    description: "For occasional car shoppers",
    icon: Zap,
    features: [
      { name: "Compare up to 2 vehicles", included: true },
      { name: "PDF report export", included: true },
      { name: "Advanced price assessment", included: true },
      { name: "5-year depreciation forecast", included: true },
      { name: "Expert AI opinion", included: true },
      { name: "History report parsing", included: true },
      { name: "Dealership review", included: false },
    ],
    cta: "Buy Report",
    href: "/pricing",
    popular: true,
  },
  {
    name: "Pro",
    price: STRIPE_PRICES.pro.price,
    description: "For serious car buyers",
    icon: Crown,
    features: [
      { name: "Compare up to 6 vehicles", included: true },
      { name: "Dealership review", included: true },
      { name: "PDF report export", included: true },
      { name: "Advanced price assessment", included: true },
      { name: "5-year depreciation forecast", included: true },
      { name: "Expert AI opinion", included: true },
      { name: "History report parsing", included: true },
      { name: "Priority support", included: true },
    ],
    cta: "Buy Report",
    href: "/pricing",
    popular: false,
  },
];

export function Pricing() {
  return (
    <section className="py-20 md:py-28">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <Badge variant="outline" className="mb-4">Pricing</Badge>
          <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
            Simple, Transparent Pricing
          </h2>
          <p className="text-lg text-muted-foreground mb-6">
            Start for free. Pay per report when you need more features.
          </p>
        </div>

        <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-3">
          {plans.map((plan) => (
            <Card 
              key={plan.name}
              className={cn(
                "relative flex flex-col",
                plan.popular 
                  ? "border-2 border-primary shadow-card" 
                  : "border-2"
              )}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground">Most Popular</Badge>
                </div>
              )}
              
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <plan.icon className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <div className="mt-4">
                  <span className="text-4xl font-bold">
                    ${plan.price}
                  </span>
                  {plan.price > 0 && (
                    <span className="text-muted-foreground">/report</span>
                  )}
                </div>
                <CardDescription className="mt-2">{plan.description}</CardDescription>
              </CardHeader>

              <CardContent className="flex-1">
                <ul className="space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature.name} className="flex items-start gap-3">
                      {feature.included ? (
                        <Check className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
                      ) : (
                        <X className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground/50" />
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
