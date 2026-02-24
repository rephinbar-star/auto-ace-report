import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  ArrowLeft,
  X,
  Search,
  Camera,
  Upload,
  Sparkles,
  Globe,
  Car,
  DollarSign,
  Gauge,
  Calendar,
  CheckCircle,
} from "lucide-react";

const TOTAL_STEPS = 4;
const AUTO_ADVANCE_MS = 5000;

interface ScreenshotTutorialProps {
  open: boolean;
  onClose: () => void;
}

/* ─── Step 1: Find Your Listing ─── */
function StepFindListing() {
  return (
    <div className="flex flex-col items-center gap-4">
      {/* Browser mockup */}
      <div className="w-full max-w-[280px] rounded-lg border bg-muted/30 shadow-sm overflow-hidden">
        {/* Browser chrome */}
        <div className="flex items-center gap-1.5 px-3 py-2 bg-muted/60 border-b">
          <span className="h-2 w-2 rounded-full bg-destructive/60" />
          <span className="h-2 w-2 rounded-full bg-yellow-400/60" />
          <span className="h-2 w-2 rounded-full bg-green-500/60" />
          <div className="ml-2 flex-1 rounded-md bg-background/80 px-2 py-0.5 text-[10px] text-muted-foreground flex items-center gap-1">
            <Globe className="h-2.5 w-2.5" />
            autotrader.com/listing...
          </div>
        </div>
        {/* Fake listing */}
        <div className="p-3 space-y-2">
          <div className="h-20 rounded-md bg-primary/10 flex items-center justify-center">
            <Car className="h-8 w-8 text-primary/40" />
          </div>
          <div className="space-y-1">
            <div className="h-3 w-3/4 rounded bg-foreground/10" />
            <div className="h-2 w-1/2 rounded bg-foreground/5" />
          </div>
          <div className="flex gap-2">
            <div className="h-5 w-16 rounded bg-primary/15 flex items-center justify-center text-[8px] font-semibold text-primary">$24,995</div>
            <div className="h-5 w-20 rounded bg-muted flex items-center justify-center text-[8px] text-muted-foreground">45,000 mi</div>
          </div>
        </div>
      </div>
      <p className="text-sm text-muted-foreground text-center max-w-[260px]">
        Find a car you like on any marketplace — AutoTrader, CarGurus, Cars.com, dealer sites, or Facebook.
      </p>
    </div>
  );
}

/* ─── Step 2: Take a Screenshot ─── */
function StepTakeScreenshot() {
  const [flashed, setFlashed] = useState(false);
  const [captured, setCaptured] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setFlashed(true), 800);
    const t2 = setTimeout(() => {
      setFlashed(false);
      setCaptured(true);
    }, 1100);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Phone mockup */}
      <div className="relative w-[140px]">
        <div className="rounded-2xl border-2 border-foreground/20 bg-muted/30 p-1.5 shadow-lg">
          <div className="rounded-xl bg-background overflow-hidden">
            {/* Status bar */}
            <div className="flex justify-between px-2 py-0.5 text-[7px] text-muted-foreground">
              <span>9:41</span>
              <span>●●●</span>
            </div>
            {/* Screen content */}
            <div className="p-2 space-y-1.5">
              <div className="h-14 rounded bg-primary/10 flex items-center justify-center">
                <Car className="h-5 w-5 text-primary/40" />
              </div>
              <div className="h-2 w-3/4 rounded bg-foreground/10" />
              <div className="h-2 w-1/2 rounded bg-foreground/5" />
              <div className="h-3.5 w-12 rounded bg-primary/15 flex items-center justify-center text-[6px] font-bold text-primary">$24,995</div>
            </div>
          </div>
        </div>

        {/* Flash overlay */}
        <AnimatePresence>
          {flashed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.9 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 rounded-2xl bg-white z-10"
            />
          )}
        </AnimatePresence>

        {/* Camera icon pulse */}
        <motion.div
          className="absolute -bottom-2 -right-2 rounded-full bg-primary p-1.5 shadow-md"
          animate={captured ? { scale: [1, 1.3, 1] } : {}}
          transition={{ duration: 0.3 }}
        >
          <Camera className="h-3.5 w-3.5 text-primary-foreground" />
        </motion.div>
      </div>

      {/* Captured thumbnail */}
      <AnimatePresence>
        {captured && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-1.5"
          >
            <div className="h-8 w-6 rounded border bg-primary/10 flex items-center justify-center">
              <Car className="h-3 w-3 text-primary/50" />
            </div>
            <div>
              <p className="text-[10px] font-medium">screenshot_listing.png</p>
              <p className="text-[8px] text-muted-foreground">Saved to camera roll</p>
            </div>
            <CheckCircle className="h-3.5 w-3.5 text-green-500" />
          </motion.div>
        )}
      </AnimatePresence>

      <p className="text-sm text-muted-foreground text-center max-w-[260px]">
        Take a screenshot of the listing page. On iPhone press <strong>Side + Volume Up</strong>; on Android press <strong>Power + Volume Down</strong>.
      </p>
    </div>
  );
}

/* ─── Step 3: Upload to CarWise ─── */
function StepUpload() {
  const [tapped, setTapped] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setTapped(true), 600);
    const t2 = setTimeout(() => setSelecting(true), 1200);
    const t3 = setTimeout(() => setSelected(true), 2400);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Phone mockup showing the upload flow */}
      <div className="w-[160px]">
        <div className="rounded-2xl border-2 border-foreground/20 bg-muted/30 p-1.5 shadow-lg">
          <div className="rounded-xl bg-background overflow-hidden">
            {/* Status bar */}
            <div className="flex justify-between px-2 py-0.5 text-[7px] text-muted-foreground">
              <span>9:41</span>
              <span>●●●</span>
            </div>

            <div className="p-2 space-y-2">
              {!selecting ? (
                /* Upload zone on phone */
                <motion.div
                  className="rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1 py-4"
                  animate={tapped
                    ? { borderColor: "hsl(var(--primary))", backgroundColor: "hsl(var(--primary) / 0.08)", scale: [1, 0.97, 1] }
                    : { borderColor: "hsl(var(--primary) / 0.3)" }
                  }
                  transition={{ duration: 0.25 }}
                >
                  <Camera className="h-4 w-4 text-primary/60" />
                  <p className="text-[7px] text-muted-foreground font-medium">Upload Screenshots</p>
                </motion.div>
              ) : (
                /* Photos app / gallery picker */
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-[8px] font-semibold">Recents</p>
                    <p className="text-[7px] text-primary font-medium">Select</p>
                  </div>
                  {/* Photo grid */}
                  <div className="grid grid-cols-3 gap-0.5">
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <motion.div
                        key={i}
                        className="relative aspect-square rounded-sm bg-muted flex items-center justify-center"
                      >
                        <Car className="h-2.5 w-2.5 text-muted-foreground/40" />
                        {selected && i < 3 && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: i * 0.15, type: "spring", stiffness: 400 }}
                            className="absolute top-0.5 right-0.5 h-3 w-3 rounded-full bg-primary flex items-center justify-center"
                          >
                            <CheckCircle className="h-2 w-2 text-primary-foreground" />
                          </motion.div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                  {selected && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="rounded bg-primary py-1 text-center text-[8px] font-semibold text-primary-foreground"
                    >
                      Add 3 Photos
                    </motion.div>
                  )}
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </div>

      <p className="text-sm text-muted-foreground text-center max-w-[260px]">
        Tap the upload area on CarWise — your <strong>photo library</strong> opens so you can select multiple screenshots at once.
      </p>
    </div>
  );
}

/* ─── Step 4: Auto-Extracted Details ─── */
function StepExtracted() {
  const fields = [
    { icon: Calendar, label: "Year", value: "2022" },
    { icon: Car, label: "Make / Model", value: "Honda Civic" },
    { icon: DollarSign, label: "Asking Price", value: "$24,995" },
    { icon: Gauge, label: "Mileage", value: "45,000 mi" },
  ];

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="w-full max-w-[260px] space-y-2">
        {fields.map((f, i) => (
          <motion.div
            key={f.label}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + i * 0.25, duration: 0.35 }}
            className="flex items-center gap-3 rounded-lg border bg-background px-3 py-2"
          >
            <div className="flex items-center justify-center h-7 w-7 rounded-md bg-primary/10">
              <f.icon className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-muted-foreground">{f.label}</p>
              <p className="text-sm font-semibold truncate">{f.value}</p>
            </div>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.5 + i * 0.25, type: "spring", stiffness: 400 }}
            >
              <CheckCircle className="h-4 w-4 text-green-500" />
            </motion.div>
          </motion.div>
        ))}
      </div>
      <p className="text-sm text-muted-foreground text-center max-w-[260px]">
        Our AI reads your screenshot and fills in the details automatically — no typing needed!
      </p>
    </div>
  );
}

/* ─── Main Component ─── */
const stepData = [
  { title: "Find Your Listing", icon: Search, Component: StepFindListing },
  { title: "Take a Screenshot", icon: Camera, Component: StepTakeScreenshot },
  { title: "Upload to CarWise", icon: Upload, Component: StepUpload },
  { title: "Auto-Extracted Details", icon: Sparkles, Component: StepExtracted },
];

export function ScreenshotTutorial({ open, onClose }: ScreenshotTutorialProps) {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);

  // Reset on open
  useEffect(() => {
    if (open) {
      setCurrent(0);
      setPaused(false);
    }
  }, [open]);

  // Auto-advance
  useEffect(() => {
    if (!open || paused || current >= TOTAL_STEPS - 1) return;
    const t = setTimeout(() => setCurrent((c) => c + 1), AUTO_ADVANCE_MS);
    return () => clearTimeout(t);
  }, [open, paused, current]);

  const next = useCallback(() => {
    setPaused(true);
    if (current < TOTAL_STEPS - 1) setCurrent((c) => c + 1);
    else onClose();
  }, [current, onClose]);

  const prev = useCallback(() => {
    setPaused(true);
    if (current > 0) setCurrent((c) => c - 1);
  }, [current]);

  const step = stepData[current];
  const isLast = current === TOTAL_STEPS - 1;

  // Progress for auto-advance bar
  const progressPct = ((current + 1) / TOTAL_STEPS) * 100;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden border-primary/20">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full p-1 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Progress bar */}
        <div className="h-1 bg-muted">
          <motion.div
            className="h-full bg-primary"
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 pt-4 pb-1">
          {stepData.map((_, i) => (
            <button
              key={i}
              onClick={() => { setPaused(true); setCurrent(i); }}
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

        {/* Step content */}
        <div className="px-6 pb-2 pt-3 min-h-[320px] flex flex-col items-center text-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={current}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col items-center w-full"
            >
              <div className="mb-3 flex items-center justify-center rounded-2xl bg-primary/10 p-3 text-primary">
                <step.icon className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold mb-3">
                Step {current + 1}: {step.title}
              </h3>
              <step.Component />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t px-6 py-3">
          <Button variant="ghost" size="sm" onClick={prev} disabled={current === 0} className="gap-1">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <span className="text-xs text-muted-foreground">{current + 1} / {TOTAL_STEPS}</span>
          <Button size="sm" onClick={next} className="gap-1">
            {isLast ? "Got it!" : "Next"}
            {!isLast && <ArrowRight className="h-4 w-4" />}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
