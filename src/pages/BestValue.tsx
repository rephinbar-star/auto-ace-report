import { ComingSoonPage } from "@/components/landing/ComingSoonPage";

export default function BestValuePage() {
  return (
    <ComingSoonPage
      title="Find me the best value"
      description="Compare potential cash offers, trade-in value, and private-party value for your current vehicle."
      seoTitle="Find the Best Value for Your Car"
      seoDescription="Coming soon: compare cash offers, trade-in value, and private-party value for your vehicle with CarWise."
      seoKeywords="car trade in value, sell my car, car cash offer, private party car value, vehicle valuation"
      previewItems={[
        "Enter your vehicle details and current condition",
        "Get estimated private-party, trade-in, and cash-offer ranges",
        "See which channel may net the highest return",
        "Track how mileage, options, and location affect value",
      ]}
    />
  );
}
