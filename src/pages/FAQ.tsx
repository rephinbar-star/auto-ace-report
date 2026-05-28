import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { SEO } from "@/components/seo/SEO";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { HelpCircle, CreditCard, Car, Shield, FileText, Users } from "lucide-react";

const faqCategories = [
  {
    id: "general",
    title: "General Questions",
    icon: HelpCircle,
    questions: [
      {
        question: "What is CarWise?",
        answer:
          "CarWise is an AI-powered vehicle analysis platform that helps car buyers make informed purchasing decisions. We provide fair market value estimates, depreciation forecasts, risk assessments, and deal ratings based on comprehensive data analysis.",
      },
      {
        question: "How accurate are CarWise valuations?",
        answer:
          "Our valuations are based on extensive market data, including recent sales, current listings, and historical pricing trends. While we strive for the highest accuracy, our estimates should be used as one of several factors in your purchasing decision. Actual market conditions, vehicle-specific factors, and negotiation can affect final prices.",
      },
      {
        question: "What information do I need to get a vehicle analysis?",
        answer:
          "To generate a comprehensive analysis, you'll need basic vehicle information including the year, make, model, trim, mileage, and asking price. For more detailed analysis, you can also provide the VIN, vehicle condition details, and financing information.",
      },
      {
        question: "How long does it take to generate a report?",
        answer:
          "Most reports are generated within 30 seconds to 2 minutes, depending on the complexity of the analysis and the amount of data being processed. Premium reports with more detailed analysis may take slightly longer.",
      },
    ],
  },
  {
    id: "pricing",
    title: "Pricing & Subscriptions",
    icon: CreditCard,
    questions: [
      {
        question: "Is CarWise free to use?",
        answer:
          "CarWise offers a free tier that allows you to generate basic vehicle analysis reports. For more comprehensive features, including detailed depreciation forecasts, unlimited reports, and premium support, we offer paid subscription plans.",
      },
      {
        question: "What subscription plans are available?",
        answer:
          "We offer several subscription tiers: a Free plan with limited reports, a Compare Pass for occasional users, and a Pro plan for active car shoppers with unlimited analyses. Visit our Pricing page for current pricing and feature details.",
      },
      {
        question: "Can I cancel my subscription at any time?",
        answer:
          "Yes, you can cancel your subscription at any time. Your access will continue until the end of your current billing period. We do not offer prorated refunds for partial months.",
      },
      {
        question: "What payment methods do you accept?",
        answer:
          "We accept all major credit cards (Visa, MasterCard, American Express, Discover) through our secure payment processor. We also support Apple Pay and Google Pay for your convenience.",
      },
    ],
  },
  {
    id: "analysis",
    title: "Vehicle Analysis",
    icon: Car,
    questions: [
      {
        question: "How do you calculate the fair market value?",
        answer:
          "Our fair market value is calculated using multiple data sources including recent comparable sales, current market listings, auction data, and regional pricing variations. We factor in the vehicle's age, mileage, condition, and specific features to provide an accurate estimate.",
      },
      {
        question: "What is the Deal Rating and how is it determined?",
        answer:
          "The Deal Rating (Excellent, Good, Fair, Poor, or Overpriced) compares the asking price against our fair market value estimate, factoring in the vehicle's condition and history. An 'Excellent' deal is typically 10% or more below market value, while 'Overpriced' indicates the asking price significantly exceeds fair value.",
      },
      {
        question: "How accurate are the depreciation forecasts?",
        answer:
          "Our depreciation forecasts are based on historical depreciation curves for similar vehicles, industry trends, and market conditions. While past performance doesn't guarantee future results, our models provide a reasonable estimate of expected value retention over time.",
      },
      {
        question: "Can CarWise detect if a vehicle has been in an accident?",
        answer:
          "CarWise can analyze vehicle history reports to identify reported accidents, but we cannot detect unreported damage. We recommend always obtaining a professional pre-purchase inspection before buying any used vehicle.",
      },
      {
        question: "Do you support analysis for all vehicle types?",
        answer:
          "CarWise currently supports analysis for most passenger cars, trucks, SUVs, and crossovers. We have limited support for motorcycles, RVs, commercial vehicles, and specialty/exotic vehicles. Coverage varies by make, model, and year.",
      },
    ],
  },
  {
    id: "privacy",
    title: "Privacy & Security",
    icon: Shield,
    questions: [
      {
        question: "How do you protect my personal information?",
        answer:
          "We use industry-standard encryption and security practices to protect your data. All data transmission is encrypted using SSL/TLS, and we never share your personal information with third parties without your consent. Please review our Privacy Policy for complete details.",
      },
      {
        question: "Do you sell my data to dealerships or other parties?",
        answer:
          "No, we do not sell, rent, or share your personal information or vehicle search data with dealerships, data brokers, or any other third parties for marketing purposes.",
      },
      {
        question: "How long do you retain my data?",
        answer:
          "We retain your account information and report history for as long as your account is active. You can request deletion of your data at any time by contacting our support team or through your account settings.",
      },
    ],
  },
  {
    id: "reports",
    title: "Reports & History",
    icon: FileText,
    questions: [
      {
        question: "Can I access my previous reports?",
        answer:
          "Yes, all your generated reports are saved to your account and can be accessed anytime from your Dashboard. Free users can access reports for 30 days, while paid subscribers have unlimited access to their report history.",
      },
      {
        question: "Can I download or print my reports?",
        answer:
          "Yes, all reports can be downloaded as PDF files for offline access or printing. Simply click the 'Download PDF' button on any report page.",
      },
      {
        question: "Can I share my report with others?",
        answer:
          "Yes, you can share reports via email or generate a shareable link. Shared reports are read-only and can be accessed by anyone with the link for 7 days.",
      },
    ],
  },
  {
    id: "account",
    title: "Account & Support",
    icon: Users,
    questions: [
      {
        question: "How do I reset my password?",
        answer:
          "Click on 'Forgot Password' on the login page and enter your email address. You'll receive a password reset link within a few minutes. If you don't see the email, check your spam folder.",
      },
      {
        question: "How can I contact customer support?",
        answer:
          "You can reach our support team via email at carwise.expert@gmail.com or through the contact form on our website.",
      },
      {
        question: "Can I delete my account?",
        answer:
          "Yes, you can delete your account at any time through your account settings or by contacting our support team. Please note that account deletion is permanent and cannot be undone.",
      },
    ],
  },
];

export default function FAQPage() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqCategories.flatMap((cat) =>
      cat.questions.map((q) => ({
        "@type": "Question",
        name: q.question,
        acceptedAnswer: { "@type": "Answer", text: q.answer },
      })),
    ),
  };

  return (
    <>
      <SEO
        title="Frequently Asked Questions"
        description="Find answers to common questions about CarWise vehicle analysis, pricing, subscriptions, and more."
        jsonLd={faqJsonLd}
      />
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-12">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h1 className="text-4xl font-bold mb-4">Frequently Asked Questions</h1>
              <p className="text-xl text-muted-foreground">
                Find answers to common questions about CarWise and our vehicle analysis service.
              </p>
            </div>

            <div className="space-y-8">
              {faqCategories.map((category) => (
                <Card key={category.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-3">
                      <category.icon className="h-6 w-6 text-primary" />
                      {category.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Accordion type="single" collapsible className="w-full">
                      {category.questions.map((faq, index) => (
                        <AccordionItem key={index} value={`${category.id}-${index}`}>
                          <AccordionTrigger className="text-left">
                            {faq.question}
                          </AccordionTrigger>
                          <AccordionContent className="text-muted-foreground">
                            {faq.answer}
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Contact CTA */}
            <Card className="mt-12">
              <CardHeader className="text-center">
                <CardTitle>Still Have Questions?</CardTitle>
                <CardDescription>
                  Can't find the answer you're looking for? Our support team is here to help.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center gap-4 flex-wrap">
                <Button asChild>
                  <Link to="/contact">Contact Support</Link>
                </Button>
                <Button variant="outline" asChild>
                  <a href="mailto:carwise.expert@gmail.com">Email Us</a>
                </Button>
              </CardContent>
            </Card>
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
}
