import { Badge } from "@/components/ui/badge";

const steps = [
  {
    number: "01",
    title: "Enter Vehicle Details",
    description: "Provide a VIN number, paste a listing URL, or manually enter the make, model, and trim. Add mileage and asking price.",
  },
  {
    number: "02",
    title: "Add Vehicle History",
    description: "Upload a Carfax PDF or paste a link. Our AI extracts accident history, service records, and ownership details.",
  },
  {
    number: "03",
    title: "Set Financing Terms",
    description: "Enter your loan or lease details including term, amount financed, APR, or monthly payment to see equity projections.",
  },
  {
    number: "04",
    title: "Get Expert Analysis",
    description: "Receive a comprehensive report with fair price, depreciation forecast, repair costs, and an expert buying recommendation.",
  },
];

export function HowItWorks() {
  return (
    <section className="bg-secondary/30 py-20 md:py-28">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <Badge variant="outline" className="mb-4">Simple Process</Badge>
          <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
            How It Works
          </h2>
          <p className="text-lg text-muted-foreground">
            Get a professional vehicle analysis in just a few minutes.
          </p>
        </div>

        <div className="mx-auto max-w-4xl">
          <div className="relative">
            {/* Connecting line */}
            <div className="absolute left-8 top-0 hidden h-full w-px bg-border md:block" />

            <div className="space-y-8 md:space-y-12">
              {steps.map((step, index) => (
                <div key={step.number} className="relative flex gap-6 md:gap-8">
                  {/* Step number */}
                  <div className="relative z-10 flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary text-xl font-bold text-primary-foreground shadow-lg">
                    {step.number}
                  </div>

                  {/* Content */}
                  <div className="flex-1 pt-2">
                    <h3 className="mb-2 text-xl font-semibold">{step.title}</h3>
                    <p className="text-muted-foreground">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
