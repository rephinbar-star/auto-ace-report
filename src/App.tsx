import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { ThemeProvider } from "next-themes";
import Index from "./pages/Index";
import AnalyzePage from "./pages/Analyze";
import ReportPage from "./pages/Report";
import DashboardPage from "./pages/Dashboard";
import ComparePage from "./pages/Compare";
import ProfilePage from "./pages/Profile";
import HowItWorksPage from "./pages/HowItWorks";
import SampleReportPage from "./pages/SampleReport";
import PricingPage from "./pages/Pricing";
import LoginPage from "./pages/Login";
import SignupPage from "./pages/Signup";
import PrivacyPage from "./pages/Privacy";
import TermsPage from "./pages/Terms";
import ContactPage from "./pages/Contact";
import FAQPage from "./pages/FAQ";
import HelpCenterPage from "./pages/HelpCenter";
import AdminPage from "./pages/Admin";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
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
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </HelmetProvider>
);

export default App;
