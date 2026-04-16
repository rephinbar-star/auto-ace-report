import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { ScrollToTop } from "@/components/layout/ScrollToTop";
import { ThemeProvider } from "next-themes";
import { FeedbackWidget } from "@/components/feedback/FeedbackWidget";
import { PendingReportGuard } from "@/components/auth/PendingReportGuard";

// Critical path - load immediately (non-lazy)
import Index from "./pages/Index";

// Lazy load non-critical routes to reduce initial bundle size
const AnalyzePage = lazy(() => import("./pages/Analyze"));
const ReportPage = lazy(() => import("./pages/Report"));
const DashboardPage = lazy(() => import("./pages/Dashboard"));
const ComparePage = lazy(() => import("./pages/Compare"));
const ProfilePage = lazy(() => import("./pages/Profile"));
const HowItWorksPage = lazy(() => import("./pages/HowItWorks"));
const SampleReportPage = lazy(() => import("./pages/SampleReport"));
const PricingPage = lazy(() => import("./pages/Pricing"));
const LoginPage = lazy(() => import("./pages/Login"));
const SignupPage = lazy(() => import("./pages/Signup"));
const PrivacyPage = lazy(() => import("./pages/Privacy"));
const TermsPage = lazy(() => import("./pages/Terms"));
const ContactPage = lazy(() => import("./pages/Contact"));
const FAQPage = lazy(() => import("./pages/FAQ"));
const HelpCenterPage = lazy(() => import("./pages/HelpCenter"));
const AdminPage = lazy(() => import("./pages/Admin"));
const RoadmapPage = lazy(() => import("./pages/Roadmap"));
const MarketplacePage = lazy(() => import("./pages/Marketplace"));
const MarketplaceListPage = lazy(() => import("./pages/MarketplaceList"));
const MarketplaceDetailPage = lazy(() => import("./pages/MarketplaceDetail"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Loading fallback component
const PageLoader = () => (
  <div className="flex min-h-screen items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
  </div>
);

const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ScrollToTop />
            <PendingReportGuard />
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/compare" element={<ComparePage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/how-it-works" element={<HowItWorksPage />} />
                <Route path="/sample-report" element={<SampleReportPage />} />
                <Route path="/pricing" element={<PricingPage />} />
                <Route path="/analyze" element={<AnalyzePage />} />
                <Route path="/report/:id" element={<ReportPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />
                <Route path="/privacy" element={<PrivacyPage />} />
                <Route path="/terms" element={<TermsPage />} />
                <Route path="/contact" element={<ContactPage />} />
                <Route path="/faq" element={<FAQPage />} />
                <Route path="/help" element={<HelpCenterPage />} />
                <Route path="/admin" element={<AdminPage />} />
                <Route path="/roadmap" element={<RoadmapPage />} />
                <Route path="/marketplace" element={<MarketplacePage />} />
                <Route path="/marketplace/list" element={<MarketplaceListPage />} />
                <Route path="/marketplace/:id" element={<MarketplaceDetailPage />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
            <FeedbackWidget />
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </HelmetProvider>
);

export default App;
