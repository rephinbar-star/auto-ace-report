import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Hero } from "@/components/landing/Hero";
import { Features } from "@/components/landing/Features";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Pricing } from "@/components/landing/Pricing";
import { CTA } from "@/components/landing/CTA";
import { SEO } from "@/components/seo/SEO";

const Index = () => {
  return (
    <>
      <SEO 
        description="CarWise provides expert AI-powered car buying analysis. Get fair market prices, 5-year depreciation forecasts, Carfax analysis, and professional risk assessments for any used or new vehicle."
        keywords="car buying guide, used car analysis, fair car price, car depreciation calculator, vehicle value estimator, Carfax analysis, car buying decision, auto purchase advisor, VIN decoder, car loan calculator"
      />
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1">
          <Hero />
          <Features />
          <HowItWorks />
          <Pricing />
          <CTA />
        </main>
        <Footer />
      </div>
    </>
  );
};

export default Index;
