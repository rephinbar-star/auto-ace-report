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
    year: 2021,
    make: "Honda",
    model: "Accord",
    trim: "Sport 2.0T",
    mileage: 42500,
    asking_price: 26995,
    condition: "good",
    financing_type: "loan",
    status: "complete",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deal_rating: "good",
    risk_level: "low",
    title_status: "clean",
    accident_count: 0,
    owner_count: 1,
    health_score: 87,
    fair_market_private: 25800,
    fair_market_trade_in: 23200,
    fair_offer_price: 25500,
    price_difference: 1195,
    fuel_type: "gasoline",
    mpg_city: 22,
    mpg_highway: 32,
    mpg_combined: 26,
    reliability_concerns: ["Turbo wear after 80k miles", "Infotainment glitches"],
    depreciation_table: [
      { year: 1, privateValue: 24500, tradeInValue: 22100, loanBalance: 22000, repairCosts: 650, netEquityPrivate: 2300 },
      { year: 2, privateValue: 22800, tradeInValue: 20500, loanBalance: 17500, repairCosts: 700, netEquityPrivate: 4850 },
      { year: 3, privateValue: 20900, tradeInValue: 18800, loanBalance: 12800, repairCosts: 800, netEquityPrivate: 7300 },
      { year: 4, privateValue: 18700, tradeInValue: 16800, loanBalance: 7900, repairCosts: 900, netEquityPrivate: 9600 },
      { year: 5, privateValue: 16200, tradeInValue: 14600, loanBalance: 2800, repairCosts: 1000, netEquityPrivate: 11600 },
    ],
    // Additional fields
    body_style: "Sedan",
    drivetrain: "FWD",
    transmission: "Automatic",
    engine_size: "2.0L Turbo",
    seller_type: "dealer",
    listing_url: null,
    listing_images: null,
    vin: null,
    apr: 6.5,
    loan_amount: 24000,
    loan_term: 60,
    monthly_payment: 469,
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
    fair_market_dealer: 27500,
    risk_score: null,
  },
  {
    id: "sample-2",
    user_id: "demo",
    year: 2022,
    make: "Toyota",
    model: "Camry",
    trim: "SE",
    mileage: 28000,
    asking_price: 27500,
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
    health_score: 92,
    fair_market_private: 27200,
    fair_market_trade_in: 24800,
    fair_offer_price: 27000,
    price_difference: 300,
    fuel_type: "gasoline",
    mpg_city: 28,
    mpg_highway: 39,
    mpg_combined: 32,
    reliability_concerns: [],
    depreciation_table: [
      { year: 1, privateValue: 25500, tradeInValue: 23200, loanBalance: 22500, repairCosts: 400, netEquityPrivate: 2600 },
      { year: 2, privateValue: 23800, tradeInValue: 21700, loanBalance: 18000, repairCosts: 500, netEquityPrivate: 5300 },
      { year: 3, privateValue: 22000, tradeInValue: 20000, loanBalance: 13200, repairCosts: 600, netEquityPrivate: 8200 },
      { year: 4, privateValue: 20100, tradeInValue: 18300, loanBalance: 8200, repairCosts: 700, netEquityPrivate: 11200 },
      { year: 5, privateValue: 18000, tradeInValue: 16400, loanBalance: 3000, repairCosts: 850, netEquityPrivate: 14150 },
    ],
    body_style: "Sedan",
    drivetrain: "FWD",
    transmission: "Automatic",
    engine_size: "2.5L",
    seller_type: "dealer",
    listing_url: null,
    listing_images: null,
    vin: null,
    apr: 5.9,
    loan_amount: 25000,
    loan_term: 60,
    monthly_payment: 483,
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
    fair_market_dealer: 28200,
    risk_score: null,
  },
  {
    id: "sample-3",
    user_id: "demo",
    year: 2019,
    make: "BMW",
    model: "330i",
    trim: "xDrive",
    mileage: 52000,
    asking_price: 29900,
    condition: "good",
    financing_type: "loan",
    status: "complete",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deal_rating: "fair",
    risk_level: "medium",
    title_status: "clean",
    accident_count: 1,
    owner_count: 2,
    health_score: 74,
    fair_market_private: 28500,
    fair_market_trade_in: 25200,
    fair_offer_price: 27500,
    price_difference: 1400,
    fuel_type: "gasoline",
    mpg_city: 26,
    mpg_highway: 36,
    mpg_combined: 30,
    reliability_concerns: [
      "Oil consumption issues common",
      "Timing chain tensioner failures",
      "Electronic component issues",
      "Expensive maintenance costs",
    ],
    depreciation_table: [
      { year: 1, privateValue: 26000, tradeInValue: 23000, loanBalance: 24500, repairCosts: 1400, netEquityPrivate: 100 },
      { year: 2, privateValue: 23500, tradeInValue: 20800, loanBalance: 19600, repairCosts: 1800, netEquityPrivate: 2100 },
      { year: 3, privateValue: 21000, tradeInValue: 18500, loanBalance: 14400, repairCosts: 2200, netEquityPrivate: 4400 },
      { year: 4, privateValue: 18500, tradeInValue: 16200, loanBalance: 8900, repairCosts: 2600, netEquityPrivate: 7000 },
      { year: 5, privateValue: 16000, tradeInValue: 14000, loanBalance: 3200, repairCosts: 3000, netEquityPrivate: 9800 },
    ],
    body_style: "Sedan",
    drivetrain: "AWD",
    transmission: "Automatic",
    engine_size: "2.0L Turbo",
    seller_type: "dealer",
    listing_url: null,
    listing_images: null,
    vin: null,
    apr: 7.2,
    loan_amount: 27000,
    loan_term: 60,
    monthly_payment: 537,
    lease_term_months: null,
    mileage_allowance: null,
    residual_value: null,
    depreciation_risk: null,
    value_proposition: null,
    expert_opinion: null,
    history_issues: null,
    history_positives: null,
    has_service_records: false,
    pricing_last_updated: null,
    pricing_sources: [],
    fair_market_dealer: 30500,
    risk_score: null,
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
