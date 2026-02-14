import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Car,
  ClipboardCheck,
  History,
  DollarSign,
  Sparkles,
  Scale,
  FileText,
  ArrowRight,
  ArrowLeft,
  X,
} from "lucide-react";

const ONBOARDING_KEY = "carwise_onboarding_seen";

interface Step {
  icon: React.ReactNode;
  title: string;
  description: string;
  detail: string;
}

const steps: Step[] = [
  {
    icon: <Sparkles className="h-8 w-8" />,
    title: "Welcome to CarWise Beta!",
    description: "You have full Pro access during the beta period.",
    detail:
      "As a beta tester you can run unlimited analyses, compare up to 6 vehicles side-by-side, and access dealer trust reviews — all at no cost.",
  },
  {
    icon: <Car className="h-8 w-8" />,
    title: "Step 1 — Enter Vehicle Info",
    description: "Start a new analysis from the dashboard.",
    detail:
      'Click "New Analysis" and enter the year, make, model, mileage, and asking price. You can also paste a listing URL to auto-fill details.',
  },
  {
    icon: <ClipboardCheck className="h-8 w-8" />,
    title: "Step 2 — Condition & History",
    description: "Tell us about the vehicle's condition and history.",
    detail:
      "Rate the overall condition, then upload or describe the vehicle history report — accident count, title status, owner history, and service records.",
  },
  {
    icon: <DollarSign className="h-8 w-8" />,
    title: "Step 3 — Financing & Pricing",
    description: "Choose your payment method and get pricing insights.",
    detail:
      "Select cash, loan, or lease. Our AI cross-references market data to show fair market value, deal rating, and a recommended offer price.",
  },
  {
    icon: <FileText className="h-8 w-8" />,
    title: "Step 4 — Your Report",
    description: "Receive a comprehensive AI-powered analysis.",
    detail:
      "Your report includes a risk score, depreciation forecast, reliability concerns, fuel economy, and an expert opinion with a fair offer price.",
  },
  {
    icon: <Scale className="h-8 w-8" />,
    title: "Step 5 — Compare Vehicles",
    description: "Put your top picks head-to-head.",
    detail:
      'Once you have 2+ completed reports, hit "Compare" on the dashboard to select vehicles. Our 100-point scoring algorithm picks the best buy across value, reliability, and total cost of ownership.',
  },
];

interface OnboardingTourProps {
  externalOpen?: boolean;
  onExternalClose?: () => void;
}

export function OnboardingTour({ externalOpen, onExternalClose }: OnboardingTourProps) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const seen = localStorage.getItem(ONBOARDING_KEY);
    if (!seen) {
      const t = setTimeout(() => setOpen(true), 600);
      return () => clearTimeout(t);
    }
  }, []);

  // Allow parent to re-trigger
  useEffect(() => {
    if (externalOpen) {
      setCurrent(0);
      setOpen(true);
    }
  }, [externalOpen]);

  const dismiss = () => {
    localStorage.setItem(ONBOARDING_KEY, "true");
    setOpen(false);
    setCurrent(0);
    onExternalClose?.();
  };

  const next = () => {
    if (current < steps.length - 1) setCurrent((c) => c + 1);
    else dismiss();
  };

  const prev = () => {
    if (current > 0) setCurrent((c) => c - 1);
  };

  const step = steps[current];
  const isLast = current === steps.length - 1;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && dismiss()}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden border-primary/20">
        {/* Close */}
        <button
          onClick={dismiss}
          className="absolute right-4 top-4 z-10 rounded-full p-1 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 pt-5 pb-2">
          {steps.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === current
                  ? "w-6 bg-primary"
                  : i < current
                  ? "w-1.5 bg-primary/40"
                  : "w-1.5 bg-muted-foreground/20"
              }`}
              aria-label={`Go to step ${i + 1}`}
            />
          ))}
        </div>

        {/* Animated content */}
        <div className="px-6 pb-2 pt-4 min-h-[260px] flex flex-col items-center text-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={current}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col items-center"
            >
              <div className="mb-4 flex items-center justify-center rounded-2xl bg-primary/10 p-4 text-primary">
                {step.icon}
              </div>
              <h3 className="text-lg font-bold mb-1">{step.title}</h3>
              <p className="text-sm font-medium text-muted-foreground mb-3">
                {step.description}
              </p>
              <p className="text-sm text-muted-foreground/80 leading-relaxed max-w-sm">
                {step.detail}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer buttons */}
        <div className="flex items-center justify-between border-t px-6 py-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={prev}
            disabled={current === 0}
            className="gap-1"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>

          <span className="text-xs text-muted-foreground">
            {current + 1} / {steps.length}
          </span>

          <Button size="sm" onClick={next} className="gap-1">
            {isLast ? "Get Started" : "Next"}
            {!isLast && <ArrowRight className="h-4 w-4" />}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
