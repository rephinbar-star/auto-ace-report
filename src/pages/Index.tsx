import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { SolutionHub } from "@/components/landing/SolutionHub";
import { SEO } from "@/components/seo/SEO";

const Index = () => {
  return (
    <>
      <SEO
        title="CarWise.Expert - Automotive Decision Platform"
        description="CarWise.Expert is your one place for every car decision: find the best deal, value your car, escape negative equity, and get expert AI used-car analysis."
        keywords="car buying platform, best car deals, car value calculator, negative equity car, used car analysis, car buying guide, fair car price, VIN decoder, car loan calculator"
      />
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1">
          <SolutionHub />
        </main>
        <Footer />
      </div>
    </>
  );
};

export default Index;
