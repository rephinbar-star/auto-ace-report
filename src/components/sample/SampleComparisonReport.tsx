import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, Scale } from "lucide-react";
import { ComparisonSummary } from "@/components/compare/ComparisonSummary";
import { CompareVehicleCard } from "@/components/compare/CompareVehicleCard";
import type { Tables } from "@/integrations/supabase/types";

type VehicleReport = Tables<"vehicle_reports">;

// Sample vehicles for comparison demo
const sampleComparisonVehicles: VehicleReport[] = [
  {
    id: "sample-1",
    user_id: "demo",
    year: 2024,
    make: "Toyota",
    model: "RAV4",
    trim: "XLE Premium AWD",
    mileage: 18200,
    asking_price: 34500,
    condition: "excellent",
    financing_type: "loan",
    status: "complete",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deal_rating: "good",
    risk_level: "low",
    title_status: "clean",
    accident_count: 0,
    owner_count: 1,
    health_score: 94,
    fair_market_private: 33200,
    fair_market_trade_in: 30800,
    fair_offer_price: 33500,
    price_difference: -700,
    fuel_type: "gasoline",
    mpg_city: 27,
    mpg_highway: 35,
    mpg_combined: 30,
    reliability_concerns: ["Infotainment updates needed", "AWD fluid change at 30k"],
    depreciation_table: [
      { year: 1, privateValue: 31500, tradeInValue: 29200, loanBalance: 28000, repairCosts: 180, netEquityPrivate: 3320 },
      { year: 2, privateValue: 29200, tradeInValue: 27000, loanBalance: 22400, repairCosts: 220, netEquityPrivate: 6580 },
      { year: 3, privateValue: 26800, tradeInValue: 24800, loanBalance: 16500, repairCosts: 530, netEquityPrivate: 9770 },
      { year: 4, privateValue: 24200, tradeInValue: 22400, loanBalance: 10300, repairCosts: 820, netEquityPrivate: 12880 },
      { year: 5, privateValue: 21500, tradeInValue: 19900, loanBalance: 3800, repairCosts: 1180, netEquityPrivate: 15720 },
    ],
    body_style: "SUV",
    drivetrain: "AWD",
    transmission: "Automatic",
    engine_size: "2.5L",
    seller_type: "dealer",
    listing_url: null,
    listing_images: null,
    vin: null,
    apr: 5.9,
    loan_amount: 31000,
    loan_term: 60,
    monthly_payment: 598,
    lease_term_months: null,
    mileage_allowance: null,
    residual_value: null,
    depreciation_risk: null,
    value_proposition: null,
    expert_opinion: null,
    history_issues: null,
    history_positives: null,
    has_service_records: true,
    pricing_last_updated: null,
    pricing_sources: [],
    fair_market_dealer: 35200,
    risk_score: null,
    service_gap_miles: null,
    major_services_due: [],
    major_services_done: [],
    chronic_repair_systems: [],
    warranty_months_remaining: 24,
    is_cpo: false,
    warranty_status: "active",
    warranty_risk_reduction: 70,
    warranty_notes: "Factory bumper-to-bumper warranty still active with 24 months remaining.",
    final_verdict: "Buy",
    final_verdict_justification: "Excellent deal on a low-mileage, well-maintained vehicle with active warranty.",
    zip_code: null,
    negotiated_price: null,
    source_breakdown: [],
    ai_findings: null,
    sales_tax_rate: null,
    fees: null,
    down_payment: null,
    days_on_market: null,
    days_on_market_as_of: null,
  },
  {
    id: "sample-2",
    user_id: "demo",
    year: 2023,
    make: "Honda",
    model: "CR-V",
    trim: "EX-L AWD",
    mileage: 24500,
    asking_price: 33900,
    condition: "excellent",
    financing_type: "loan",
    status: "complete",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deal_rating: "good",
    risk_level: "low",
    title_status: "clean",
    accident_count: 0,
    owner_count: 1,
    health_score: 91,
    fair_market_private: 33000,
    fair_market_trade_in: 30500,
    fair_offer_price: 33200,
    price_difference: -900,
    fuel_type: "gasoline",
    mpg_city: 28,
    mpg_highway: 34,
    mpg_combined: 30,
    reliability_concerns: [],
    depreciation_table: [
      { year: 1, privateValue: 31000, tradeInValue: 28700, loanBalance: 27500, repairCosts: 200, netEquityPrivate: 3300 },
      { year: 2, privateValue: 28800, tradeInValue: 26600, loanBalance: 22000, repairCosts: 250, netEquityPrivate: 6550 },
      { year: 3, privateValue: 26500, tradeInValue: 24500, loanBalance: 16200, repairCosts: 400, netEquityPrivate: 9900 },
      { year: 4, privateValue: 24000, tradeInValue: 22200, loanBalance: 10100, repairCosts: 600, netEquityPrivate: 13300 },
      { year: 5, privateValue: 21400, tradeInValue: 19800, loanBalance: 3700, repairCosts: 850, netEquityPrivate: 16850 },
    ],
    body_style: "SUV",
    drivetrain: "AWD",
    transmission: "CVT",
    engine_size: "1.5L Turbo",
    seller_type: "dealer",
    listing_url: null,
    listing_images: null,
    vin: null,
    apr: 6.2,
    loan_amount: 30500,
    loan_term: 60,
    monthly_payment: 592,
    lease_term_months: null,
    mileage_allowance: null,
    residual_value: null,
    depreciation_risk: null,
    value_proposition: null,
    expert_opinion: null,
    history_issues: null,
    history_positives: null,
    has_service_records: true,
    pricing_last_updated: null,
    pricing_sources: [],
    fair_market_dealer: 34800,
    risk_score: null,
    service_gap_miles: null,
    major_services_due: [],
    major_services_done: [],
    chronic_repair_systems: [],
    warranty_months_remaining: 12,
    is_cpo: false,
    warranty_status: "active",
    warranty_risk_reduction: 40,
    warranty_notes: "Limited factory warranty remaining with 12 months left.",
    final_verdict: "Negotiate",
    final_verdict_justification: "Good vehicle but priced slightly above market — negotiate toward fair market value.",
    zip_code: null,
    negotiated_price: null,
    source_breakdown: [],
    ai_findings: null,
    sales_tax_rate: null,
    fees: null,
    down_payment: null,
  },
  {
    id: "sample-3",
    user_id: "demo",
    year: 2023,
    make: "Mazda",
    model: "CX-50",
    trim: "Turbo Premium Plus AWD",
    mileage: 31000,
    asking_price: 36500,
    condition: "good",
    financing_type: "loan",
    status: "complete",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deal_rating: "fair",
    risk_level: "low",
    title_status: "clean",
    accident_count: 0,
    owner_count: 1,
    health_score: 85,
    fair_market_private: 34800,
    fair_market_trade_in: 31500,
    fair_offer_price: 35000,
    price_difference: -1000,
    fuel_type: "gasoline",
    mpg_city: 23,
    mpg_highway: 30,
    mpg_combined: 26,
    reliability_concerns: [
      "Turbo engine requires premium fuel",
      "Higher maintenance costs than non-turbo",
    ],
    depreciation_table: [
      { year: 1, privateValue: 32500, tradeInValue: 29500, loanBalance: 30000, repairCosts: 300, netEquityPrivate: 2200 },
      { year: 2, privateValue: 29800, tradeInValue: 27000, loanBalance: 24000, repairCosts: 450, netEquityPrivate: 5350 },
      { year: 3, privateValue: 27000, tradeInValue: 24500, loanBalance: 17600, repairCosts: 700, netEquityPrivate: 8700 },
      { year: 4, privateValue: 24200, tradeInValue: 21900, loanBalance: 10900, repairCosts: 1000, netEquityPrivate: 12300 },
      { year: 5, privateValue: 21200, tradeInValue: 19200, loanBalance: 3900, repairCosts: 1400, netEquityPrivate: 15900 },
    ],
    body_style: "SUV",
    drivetrain: "AWD",
    transmission: "Automatic",
    engine_size: "2.5L Turbo",
    seller_type: "dealer",
    listing_url: null,
    listing_images: null,
    vin: null,
    apr: 6.9,
    loan_amount: 33000,
    loan_term: 60,
    monthly_payment: 652,
    lease_term_months: null,
    mileage_allowance: null,
    residual_value: null,
    depreciation_risk: null,
    value_proposition: null,
    expert_opinion: null,
    history_issues: null,
    history_positives: null,
    has_service_records: true,
    pricing_last_updated: null,
    pricing_sources: [],
    fair_market_dealer: 37500,
    risk_score: null,
    service_gap_miles: null,
    major_services_due: [],
    major_services_done: [],
    chronic_repair_systems: [],
    warranty_months_remaining: 6,
    is_cpo: false,
    warranty_status: "expired",
    warranty_risk_reduction: 10,
    warranty_notes: "Factory warranty nearly expired — upcoming repairs will be out of pocket.",
    final_verdict: "Walk Away",
    final_verdict_justification: "High mileage with significant reliability concerns and minimal warranty coverage.",
    zip_code: null,
    negotiated_price: null,
    source_breakdown: [],
    ai_findings: null,
    sales_tax_rate: null,
    fees: null,
    down_payment: null,
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5 },
  },
};

export function SampleComparisonReport() {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Scale className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Sample Vehicle Comparison</h2>
          <p className="text-muted-foreground">
            See how we help you find the best value across multiple vehicles
          </p>
        </div>
      </motion.div>

      {/* Comparison Summary - The Verdict */}
      <motion.div variants={itemVariants}>
        <ComparisonSummary vehicles={sampleComparisonVehicles} />
      </motion.div>

      {/* Vehicle Cards Grid */}
      <motion.div variants={itemVariants}>
        <h3 className="text-lg font-semibold mb-4">Vehicles Compared</h3>
        <div className="grid gap-4 md:grid-cols-3">
          {sampleComparisonVehicles.map((vehicle, index) => (
            <motion.div
              key={vehicle.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
            >
              <CompareVehicleCard
                report={vehicle}
                onRemove={() => {}}
                isBestBuy={index === 0}
                rank={index + 1}
              />
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* CTA */}
      <motion.div variants={itemVariants}>
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-6 text-center">
            <h3 className="font-semibold mb-2">
              Compare your own vehicles
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Analyze multiple vehicles and find the best deal with our comprehensive comparison tool.
            </p>
            <Button asChild>
              <Link to="/analyze">
                Start Comparing
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
