import { 
  FileSearch, 
  Calculator, 
  LineChart, 
  AlertTriangle, 
  FileText, 
  Scale 
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const features = [
  {
    icon: FileSearch,
    title: "Smart Vehicle Input",
    description: "Enter a VIN for instant decode, paste a listing URL, or manually input vehicle details. We extract everything automatically.",
    color: "text-primary",
    bgColor: "bg-primary/10",
  },
  {
    icon: FileText,
    title: "CarFax/AutoCheck Analysis",
    description: "Upload a PDF or paste a link to your vehicle history report. Our AI extracts accidents, service records, and red flags.",
    color: "text-warning",
    bgColor: "bg-warning/10",
  },
  {
    icon: Scale,
    title: "Fair Market Price",
    description: "Get accurate private sale and trade-in values based on condition, mileage, and current market trends.",
    color: "text-success",
    bgColor: "bg-success/10",
  },
  {
    icon: Calculator,
    title: "Loan & Lease Calculator",
    description: "Input your financing terms and see how your payments compare to depreciation over time.",
    color: "text-primary",
    bgColor: "bg-primary/10",
  },
  {
    icon: LineChart,
    title: "5-Year Projections",
    description: "Interactive charts showing depreciation vs. loan payoff, anticipated repairs, and your equity position.",
    color: "text-danger",
    bgColor: "bg-danger/10",
  },
  {
    icon: AlertTriangle,
    title: "Expert Risk Assessment",
    description: "Low/Medium/High risk rating with detailed analysis from an expert mechanic's perspective.",
    color: "text-warning",
    bgColor: "bg-warning/10",
  },
];

export function Features() {
  return (
    <section className="py-20 md:py-28">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
            Everything You Need to Buy Smart
          </h2>
          <p className="text-lg text-muted-foreground">
            Comprehensive analysis tools that give you the confidence of a professional buyer.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <Card 
              key={feature.title} 
              className="group border-2 bg-gradient-card transition-all hover:border-primary/20 hover:shadow-card"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <CardHeader>
                <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${feature.bgColor}`}>
                  <feature.icon className={`h-6 w-6 ${feature.color}`} />
                </div>
                <CardTitle className="text-xl">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base leading-relaxed">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
