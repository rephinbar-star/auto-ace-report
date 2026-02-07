import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { SEO } from "@/components/seo/SEO";

export default function TermsPage() {
  return (
    <>
      <SEO
        title="Terms of Service | CarWise"
        description="CarWise Terms of Service - Read our terms and conditions for using the CarWise vehicle analysis platform."
      />
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-12 max-w-4xl">
          <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>
          <p className="text-muted-foreground mb-8">Last Updated: February 7, 2026</p>

          <div className="prose prose-gray dark:prose-invert max-w-none space-y-8">
            <section>
              <h2 className="text-2xl font-semibold mb-4">1. Agreement to Terms</h2>
              <p className="text-muted-foreground leading-relaxed">
                These Terms of Service ("Terms") constitute a legally binding agreement between you ("User," "you," or "your") and CarWise ("Company," "we," "us," or "our") governing your access to and use of the CarWise website, mobile application, and all related services (collectively, the "Service").
              </p>
              <p className="text-muted-foreground leading-relaxed mt-4">
                By accessing or using our Service, you agree to be bound by these Terms. If you disagree with any part of these Terms, you may not access the Service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">2. Description of Service</h2>
              <p className="text-muted-foreground leading-relaxed">
                CarWise provides an AI-powered vehicle analysis platform that helps users make informed car buying decisions. Our Service includes, but is not limited to:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-3">
                <li>Fair market value estimates based on vehicle condition, mileage, and market data</li>
                <li>Depreciation forecasts and analysis</li>
                <li>Vehicle history interpretation and risk assessment</li>
                <li>Financing analysis and cost calculations</li>
                <li>Deal rating and recommendation services</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">3. User Accounts</h2>
              
              <h3 className="text-xl font-medium mb-3">3.1 Account Creation</h3>
              <p className="text-muted-foreground leading-relaxed">
                To access certain features of the Service, you must register for an account. When you register, you agree to provide accurate, current, and complete information and to update such information to keep it accurate, current, and complete.
              </p>

              <h3 className="text-xl font-medium mb-3 mt-6">3.2 Account Security</h3>
              <p className="text-muted-foreground leading-relaxed">
                You are responsible for safeguarding the password that you use to access the Service and for any activities or actions under your password. You agree not to disclose your password to any third party. You must notify us immediately upon becoming aware of any breach of security or unauthorized use of your account.
              </p>

              <h3 className="text-xl font-medium mb-3 mt-6">3.3 Account Termination</h3>
              <p className="text-muted-foreground leading-relaxed">
                We reserve the right to suspend or terminate your account at any time for any reason, including but not limited to violation of these Terms, fraudulent activity, or extended periods of inactivity.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">4. Subscriptions and Payments</h2>
              
              <h3 className="text-xl font-medium mb-3">4.1 Subscription Plans</h3>
              <p className="text-muted-foreground leading-relaxed">
                CarWise offers various subscription plans with different features and pricing. The specific features and pricing of each plan are described on our website and may be modified from time to time.
              </p>

              <h3 className="text-xl font-medium mb-3 mt-6">4.2 Payment Terms</h3>
              <p className="text-muted-foreground leading-relaxed">
                By subscribing to a paid plan, you agree to pay all fees associated with your selected plan. Subscription fees are billed in advance on a monthly or annual basis, depending on the plan you select. All payments are non-refundable except as expressly provided in these Terms or as required by applicable law.
              </p>

              <h3 className="text-xl font-medium mb-3 mt-6">4.3 Automatic Renewal</h3>
              <p className="text-muted-foreground leading-relaxed">
                Your subscription will automatically renew at the end of each billing period unless you cancel it before the renewal date. You authorize us to charge your payment method on file for the renewal fee.
              </p>

              <h3 className="text-xl font-medium mb-3 mt-6">4.4 Price Changes</h3>
              <p className="text-muted-foreground leading-relaxed">
                We reserve the right to modify our pricing at any time. Any price changes will be communicated to you in advance and will take effect at the start of the next billing period following the notice.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">5. Acceptable Use</h2>
              <p className="text-muted-foreground leading-relaxed">
                You agree not to use the Service:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-3">
                <li>In any way that violates any applicable federal, state, local, or international law or regulation</li>
                <li>To transmit any material that is defamatory, obscene, or otherwise objectionable</li>
                <li>To impersonate or attempt to impersonate the Company, a Company employee, another user, or any other person or entity</li>
                <li>To engage in any conduct that restricts or inhibits anyone's use or enjoyment of the Service</li>
                <li>To introduce any viruses, trojan horses, worms, or other harmful material</li>
                <li>To attempt to gain unauthorized access to any portion of the Service or any systems or networks connected to the Service</li>
                <li>To scrape, data mine, or use automated systems to extract data from the Service without our express written consent</li>
                <li>To resell, redistribute, or commercially exploit any portion of the Service without our express written consent</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">6. Intellectual Property</h2>
              
              <h3 className="text-xl font-medium mb-3">6.1 Our Intellectual Property</h3>
              <p className="text-muted-foreground leading-relaxed">
                The Service and its original content, features, and functionality are and will remain the exclusive property of CarWise and its licensors. The Service is protected by copyright, trademark, and other laws of both the United States and foreign countries. Our trademarks and trade dress may not be used in connection with any product or service without our prior written consent.
              </p>

              <h3 className="text-xl font-medium mb-3 mt-6">6.2 Your Content</h3>
              <p className="text-muted-foreground leading-relaxed">
                You retain ownership of any content you submit, post, or display on or through the Service ("User Content"). By submitting User Content, you grant us a worldwide, non-exclusive, royalty-free license to use, reproduce, modify, and distribute such content in connection with operating and improving the Service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">7. Disclaimers</h2>
              
              <h3 className="text-xl font-medium mb-3">7.1 Service Provided "As Is"</h3>
              <p className="text-muted-foreground leading-relaxed">
                THE SERVICE IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS WITHOUT ANY WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, AND ANY WARRANTIES ARISING OUT OF COURSE OF DEALING OR USAGE OF TRADE.
              </p>

              <h3 className="text-xl font-medium mb-3 mt-6">7.2 No Guarantee of Accuracy</h3>
              <p className="text-muted-foreground leading-relaxed">
                WHILE WE STRIVE TO PROVIDE ACCURATE AND UP-TO-DATE INFORMATION, WE DO NOT WARRANT THAT THE INFORMATION, ESTIMATES, OR RECOMMENDATIONS PROVIDED BY THE SERVICE ARE ACCURATE, COMPLETE, OR CURRENT. THE VEHICLE VALUATIONS, DEPRECIATION FORECASTS, AND OTHER ANALYSES ARE ESTIMATES BASED ON AVAILABLE DATA AND SHOULD NOT BE RELIED UPON AS THE SOLE BASIS FOR ANY PURCHASING DECISION.
              </p>

              <h3 className="text-xl font-medium mb-3 mt-6">7.3 Not Professional Advice</h3>
              <p className="text-muted-foreground leading-relaxed">
                THE SERVICE IS FOR INFORMATIONAL PURPOSES ONLY AND DOES NOT CONSTITUTE PROFESSIONAL FINANCIAL, LEGAL, OR AUTOMOTIVE ADVICE. YOU SHOULD CONSULT WITH APPROPRIATE PROFESSIONALS BEFORE MAKING ANY VEHICLE PURCHASE OR FINANCIAL DECISION.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">8. Limitation of Liability</h2>
              <p className="text-muted-foreground leading-relaxed">
                TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL CARWISE, ITS AFFILIATES, DIRECTORS, EMPLOYEES, AGENTS, OR LICENSORS BE LIABLE FOR ANY INDIRECT, PUNITIVE, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR EXEMPLARY DAMAGES, INCLUDING WITHOUT LIMITATION DAMAGES FOR LOSS OF PROFITS, GOODWILL, USE, DATA, OR OTHER INTANGIBLE LOSSES, ARISING OUT OF OR RELATING TO YOUR ACCESS TO OR USE OF, OR INABILITY TO ACCESS OR USE, THE SERVICE.
              </p>
              <p className="text-muted-foreground leading-relaxed mt-4">
                IN NO EVENT SHALL OUR TOTAL LIABILITY TO YOU FOR ALL CLAIMS ARISING OUT OF OR RELATING TO THESE TERMS OR YOUR USE OF THE SERVICE EXCEED THE AMOUNT YOU HAVE PAID TO US FOR THE SERVICE DURING THE TWELVE (12) MONTHS IMMEDIATELY PRECEDING THE EVENT GIVING RISE TO THE LIABILITY, OR ONE HUNDRED DOLLARS ($100), WHICHEVER IS GREATER.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">9. Indemnification</h2>
              <p className="text-muted-foreground leading-relaxed">
                You agree to defend, indemnify, and hold harmless CarWise and its officers, directors, employees, contractors, agents, licensors, and suppliers from and against any claims, liabilities, damages, judgments, awards, losses, costs, expenses, or fees (including reasonable attorneys' fees) arising out of or relating to your violation of these Terms or your use of the Service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">10. Governing Law and Dispute Resolution</h2>
              
              <h3 className="text-xl font-medium mb-3">10.1 Governing Law</h3>
              <p className="text-muted-foreground leading-relaxed">
                These Terms shall be governed by and construed in accordance with the laws of the State of California, without regard to its conflict of law provisions.
              </p>

              <h3 className="text-xl font-medium mb-3 mt-6">10.2 Arbitration</h3>
              <p className="text-muted-foreground leading-relaxed">
                Any dispute arising from or relating to these Terms or the Service shall be finally resolved by binding arbitration administered by the American Arbitration Association in accordance with its Commercial Arbitration Rules. The arbitration shall be conducted in San Francisco, California. The arbitrator's award shall be final and binding, and judgment on the award may be entered in any court of competent jurisdiction.
              </p>

              <h3 className="text-xl font-medium mb-3 mt-6">10.3 Class Action Waiver</h3>
              <p className="text-muted-foreground leading-relaxed">
                YOU AGREE THAT ANY CLAIMS RELATING TO THESE TERMS OR THE SERVICE WILL BE RESOLVED ON AN INDIVIDUAL BASIS, AND YOU WAIVE THE RIGHT TO PARTICIPATE IN A CLASS ACTION, CLASS-WIDE ARBITRATION, OR ANY OTHER REPRESENTATIVE PROCEEDING.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">11. Changes to Terms</h2>
              <p className="text-muted-foreground leading-relaxed">
                We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision is material, we will provide at least 30 days' notice prior to any new terms taking effect. What constitutes a material change will be determined at our sole discretion. By continuing to access or use our Service after any revisions become effective, you agree to be bound by the revised terms.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">12. Severability</h2>
              <p className="text-muted-foreground leading-relaxed">
                If any provision of these Terms is held to be invalid or unenforceable, the remaining provisions will continue in full force and effect. The invalid or unenforceable provision will be modified to the minimum extent necessary to make it valid and enforceable while preserving the parties' original intent.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">13. Entire Agreement</h2>
              <p className="text-muted-foreground leading-relaxed">
                These Terms, together with our Privacy Policy and any other agreements expressly incorporated by reference, constitute the entire agreement between you and CarWise regarding the Service and supersede all prior and contemporaneous understandings, agreements, representations, and warranties.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">14. Contact Information</h2>
              <p className="text-muted-foreground leading-relaxed">
                If you have any questions about these Terms, please contact us at:
              </p>
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <p className="font-medium">CarWise</p>
                <p className="text-muted-foreground">Email: legal@carwise.com</p>
                <p className="text-muted-foreground">Address: 123 Auto Drive, Suite 100, San Francisco, CA 94102</p>
              </div>
            </section>
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
}
