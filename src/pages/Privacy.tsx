import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { SEO } from "@/components/seo/SEO";

export default function PrivacyPage() {
  return (
    <>
      <SEO
        title="Privacy Policy | CarWise"
        description="CarWise Privacy Policy - Learn how we collect, use, and protect your personal information."
      />
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-12 max-w-4xl">
          <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
          <p className="text-muted-foreground mb-8">Last Updated: February 7, 2026</p>

          <div className="prose prose-gray dark:prose-invert max-w-none space-y-8">
            <section>
              <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
              <p className="text-muted-foreground leading-relaxed">
                CarWise ("Company," "we," "us," or "our") respects your privacy and is committed to protecting your personal data. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our vehicle analysis service and website (collectively, the "Service").
              </p>
              <p className="text-muted-foreground leading-relaxed mt-4">
                By accessing or using our Service, you acknowledge that you have read, understood, and agree to be bound by this Privacy Policy. If you do not agree with the terms of this Privacy Policy, please do not access or use the Service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">2. Information We Collect</h2>
              
              <h3 className="text-xl font-medium mb-3">2.1 Personal Information</h3>
              <p className="text-muted-foreground leading-relaxed">
                We may collect personal information that you voluntarily provide to us when you:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-3">
                <li>Register for an account</li>
                <li>Use our vehicle analysis service</li>
                <li>Subscribe to our newsletter or marketing communications</li>
                <li>Contact us for support or inquiries</li>
                <li>Participate in surveys or promotions</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-4">
                This information may include your name, email address, phone number, billing address, payment information, and any other information you choose to provide.
              </p>

              <h3 className="text-xl font-medium mb-3 mt-6">2.2 Vehicle Information</h3>
              <p className="text-muted-foreground leading-relaxed">
                When you use our vehicle analysis service, we collect information about the vehicles you are researching, including but not limited to:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-3">
                <li>Vehicle Identification Numbers (VINs)</li>
                <li>Make, model, year, and trim information</li>
                <li>Mileage and condition details</li>
                <li>Pricing and financing information</li>
                <li>Vehicle history report data (when provided)</li>
              </ul>

              <h3 className="text-xl font-medium mb-3 mt-6">2.3 Automatically Collected Information</h3>
              <p className="text-muted-foreground leading-relaxed">
                When you access our Service, we automatically collect certain information, including:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-3">
                <li>Device information (browser type, operating system, device identifiers)</li>
                <li>IP address and approximate location</li>
                <li>Usage data (pages visited, time spent, clicks, and navigation patterns)</li>
                <li>Cookies and similar tracking technologies</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">3. How We Use Your Information</h2>
              <p className="text-muted-foreground leading-relaxed">
                We use the information we collect for various purposes, including to:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-3">
                <li>Provide, operate, and maintain our Service</li>
                <li>Generate vehicle analysis reports and recommendations</li>
                <li>Process transactions and send related information</li>
                <li>Send administrative information, updates, and security alerts</li>
                <li>Respond to your comments, questions, and customer service requests</li>
                <li>Send promotional communications (with your consent)</li>
                <li>Monitor and analyze usage trends to improve our Service</li>
                <li>Detect, prevent, and address technical issues and fraud</li>
                <li>Comply with legal obligations and enforce our terms</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">4. Sharing Your Information</h2>
              <p className="text-muted-foreground leading-relaxed">
                We may share your information in the following circumstances:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-3">
                <li><strong>Service Providers:</strong> We may share your information with third-party vendors, consultants, and service providers who perform services on our behalf, such as payment processing, data analysis, email delivery, hosting, and customer service.</li>
                <li><strong>Business Transfers:</strong> In connection with any merger, sale of company assets, financing, or acquisition of all or a portion of our business, your information may be transferred as part of that transaction.</li>
                <li><strong>Legal Requirements:</strong> We may disclose your information if required to do so by law or in response to valid requests by public authorities.</li>
                <li><strong>Protection of Rights:</strong> We may disclose your information to protect the rights, property, or safety of CarWise, our users, or others.</li>
                <li><strong>With Your Consent:</strong> We may share your information for any other purpose with your consent.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">5. Data Security</h2>
              <p className="text-muted-foreground leading-relaxed">
                We implement appropriate technical and organizational security measures designed to protect the security of any personal information we process. However, no method of transmission over the Internet or electronic storage is 100% secure. While we strive to use commercially acceptable means to protect your personal information, we cannot guarantee its absolute security.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">6. Data Retention</h2>
              <p className="text-muted-foreground leading-relaxed">
                We will retain your personal information only for as long as is necessary for the purposes set out in this Privacy Policy. We will retain and use your information to the extent necessary to comply with our legal obligations, resolve disputes, and enforce our policies.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">7. Your Privacy Rights</h2>
              <p className="text-muted-foreground leading-relaxed">
                Depending on your location, you may have certain rights regarding your personal information, including:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-3">
                <li><strong>Access:</strong> The right to request copies of your personal information.</li>
                <li><strong>Rectification:</strong> The right to request that we correct any information you believe is inaccurate or complete information you believe is incomplete.</li>
                <li><strong>Erasure:</strong> The right to request that we erase your personal information, under certain conditions.</li>
                <li><strong>Restriction:</strong> The right to request that we restrict the processing of your personal information, under certain conditions.</li>
                <li><strong>Data Portability:</strong> The right to request that we transfer the data we have collected to another organization, or directly to you, under certain conditions.</li>
                <li><strong>Objection:</strong> The right to object to our processing of your personal information, under certain conditions.</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-4">
                To exercise any of these rights, please contact us using the information provided below.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">8. Cookies and Tracking Technologies</h2>
              <p className="text-muted-foreground leading-relaxed">
                We use cookies and similar tracking technologies to track activity on our Service and hold certain information. Cookies are files with a small amount of data that may include an anonymous unique identifier. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent. However, if you do not accept cookies, you may not be able to use some portions of our Service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">9. Third-Party Links</h2>
              <p className="text-muted-foreground leading-relaxed">
                Our Service may contain links to third-party websites or services that are not operated by us. We have no control over and assume no responsibility for the content, privacy policies, or practices of any third-party websites or services. We strongly advise you to review the privacy policy of every site you visit.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">10. Children's Privacy</h2>
              <p className="text-muted-foreground leading-relaxed">
                Our Service is not intended for use by children under the age of 18. We do not knowingly collect personal information from children under 18. If you are a parent or guardian and you are aware that your child has provided us with personal information, please contact us. If we become aware that we have collected personal information from children without verification of parental consent, we will take steps to remove that information from our servers.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">11. Changes to This Privacy Policy</h2>
              <p className="text-muted-foreground leading-relaxed">
                We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last Updated" date. You are advised to review this Privacy Policy periodically for any changes. Changes to this Privacy Policy are effective when they are posted on this page.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">12. Contact Us</h2>
              <p className="text-muted-foreground leading-relaxed">
                If you have any questions about this Privacy Policy or our privacy practices, please contact us at:
              </p>
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <p className="font-medium">CarWise</p>
                <p className="text-muted-foreground">Email: privacy@carwise.com</p>
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
