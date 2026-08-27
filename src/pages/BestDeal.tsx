import { ComingSoonPage } from "@/components/landing/ComingSoonPage";

export default function BestDealPage() {
  return (
    <ComingSoonPage
      title="Find me the best deal"
      description="Search for strong lease and purchase opportunities based on your budget, location, vehicle preferences, and due-at-signing comfort."
      seoTitle="Find the Best Car Deals"
      seoDescription="Coming soon: search lease and purchase opportunities with transparent market context from CarWise."
      seoKeywords="best car deals, car lease search, car purchase deals, vehicle search, car shopping"
      previewItems={[
        "Set budget, ZIP code, and preferred vehicle type / powertrain",
        "Choose mileage allowance and due-at-signing preferences",
        "See ranked opportunities with market-context scoring",
        "Compare total cost of ownership across lease vs. purchase",
      ]}
    />
  );
}
