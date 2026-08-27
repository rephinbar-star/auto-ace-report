import { Search, Scale, TrendingUp, ShieldCheck } from "lucide-react";
import { SolutionCard } from "./SolutionCard";

const solutions = [
  {
    icon: Search,
    title: "Find me the best deal",
    description:
      "Search for strong lease and purchase opportunities based on budget, location, vehicle type, powertrain, mileage allowance, and due-at-signing preferences.",
    ctaLabel: "Explore best deals",
    href: "/best-deal",
    status: "Coming soon" as const,
  },
  {
    icon: Scale,
    title: "Find me the best value",
    description:
      "Compare potential cash offers, trade-in value, and private-party value for your current vehicle.",
    ctaLabel: "Value my car",
    href: "/best-value",
    status: "Coming soon" as const,
  },
  {
    icon: TrendingUp,
    title: "Get me out of my negative equity",
    description:
      "Model realistic purchase and lease scenarios that may absorb an existing loan or lease shortfall without hiding the true cost.",
    ctaLabel: "Explore my options",
    href: "/negative-equity",
    status: "Coming soon" as const,
  },
  {
    icon: ShieldCheck,
    title: "Expert AI used car analysis",
    description:
      "Decode a VIN or listing and get the existing deep AI analysis of price, condition, depreciation, history, financing, and risk.",
    ctaLabel: "Analyze a used car",
    href: "/analyze",
    status: "Available now" as const,
    featured: true,
  },
];

const trustItems = ["Transparent math", "Real market context", "No dealer pressure"];

export function SolutionHub() {
  return (
    <section className="relative overflow-hidden bg-gradient-hero pb-20 pt-16 md:pb-28 md:pt-24">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute right-0 top-0 h-[500px] w-[500px] rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-[400px] w-[400px] rounded-full bg-accent/5 blur-3xl" />
      </div>

      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl text-center">
          <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-sm font-medium text-primary">
            One smart place for every car decision
          </span>

          <h1 className="mb-4 text-4xl font-bold tracking-tight text-foreground md:text-5xl lg:text-6xl">
            What can CarWise help you solve?
          </h1>

          <p className="mb-12 text-lg text-muted-foreground md:text-xl">
            Whether you&apos;re shopping, selling, escaping negative equity, or evaluating a used
            car, start with the goal that matters most.
          </p>
        </div>

        <div className="mx-auto max-w-5xl">
          <div className="grid gap-6 sm:grid-cols-2">
            {solutions.map((solution) => (
              <SolutionCard key={solution.href} {...solution} />
            ))}
          </div>

          <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
            {trustItems.map((item) => (
              <div key={item} className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
