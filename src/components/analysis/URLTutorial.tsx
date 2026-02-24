import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  ArrowLeft,
  X,
  Search,
  Link as LinkIcon,
  Clipboard,
  Sparkles,
  Globe,
  Car,
  DollarSign,
  Gauge,
  Calendar,
  CheckCircle,
  Copy,
} from "lucide-react";

const TOTAL_STEPS = 4;
const AUTO_ADVANCE_MS = 5000;

interface URLTutorialProps {
  open: boolean;
  onClose: () => void;
}

/* ─── Step 1: Find Your Listing ─── */
function StepFindListing() {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="w-full max-w-[280px] rounded-lg border bg-muted/30 shadow-sm overflow-hidden">
        {/* Browser chrome */}
        <div className="flex items-center gap-1.5 px-3 py-2 bg-muted/60 border-b">
          <span className="h-2 w-2 rounded-full bg-destructive/60" />
          <span className="h-2 w-2 rounded-full bg-yellow-400/60" />
          <span className="h-2 w-2 rounded-full bg-green-500/60" />
          <motion.div
            className="ml-2 flex-1 rounded-md bg-background/80 px-2 py-0.5 text-[10px] text-muted-foreground flex items-center gap-1 border"
            animate={{
              borderColor: [
                "hsl(var(--primary) / 0)",
                "hsl(var(--primary) / 0.6)",
                "hsl(var(--primary) / 0)",
              ],
              boxShadow: [
                "0 0 0 0 hsl(var(--primary) / 0)",
                "0 0 6px 1px hsl(var(--primary) / 0.3)",
                "0 0 0 0 hsl(var(--primary) / 0)",
              ],
            }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            <Globe className="h-2.5 w-2.5" />
            cars.com/vehicledetail/12345
          </motion.div>
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
            <div className="h-5 w-16 rounded bg-primary/15 flex items-center justify-center text-[8px] font-semibold text-primary">
              $24,995
            </div>
            <div className="h-5 w-20 rounded bg-muted flex items-center justify-center text-[8px] text-muted-foreground">
              45,000 mi
            </div>
          </div>
        </div>
      </div>
      <p className="text-sm text-muted-foreground text-center max-w-[260px]">
        Find a car you like on any marketplace — Cars.com, CarGurus, AutoTrader,
        dealer sites, or others.
      </p>
    </div>
  );
}

/* ─── Step 2: Copy the URL ─── */
function StepCopyURL() {
  const [tapped, setTapped] = useState(false);
  const [selected, setSelected] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setTapped(true), 800));
    timers.push(setTimeout(() => setSelected(true), 1400));
    timers.push(setTimeout(() => setCopied(true), 2200));
    return () => timers.forEach(clearTimeout);
  }, []);

  const url = "cars.com/vehicledetail/12345";

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="w-full max-w-[280px] rounded-lg border bg-muted/30 shadow-sm overflow-hidden">
        {/* Browser chrome */}
        <div className="flex items-center gap-1.5 px-3 py-2 bg-muted/60 border-b">
          <span className="h-2 w-2 rounded-full bg-destructive/60" />
          <span className="h-2 w-2 rounded-full bg-yellow-400/60" />
          <span className="h-2 w-2 rounded-full bg-green-500/60" />
          <motion.div
            className="ml-2 flex-1 rounded-md px-2 py-0.5 text-[10px] flex items-center gap-1 overflow-hidden relative"
            animate={
              tapped
                ? { backgroundColor: "hsl(var(--background))", borderColor: "hsl(var(--primary))" }
                : { backgroundColor: "hsl(var(--background) / 0.8)" }
            }
            style={{ border: "1px solid hsl(var(--border))" }}
          >
            <Globe className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
            <span className="relative">
              {selected ? (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-blue-500/30 text-foreground px-0.5 rounded-sm"
                >
                  {url}
                </motion.span>
              ) : (
                <span className="text-muted-foreground">{url}</span>
              )}
            </span>
          </motion.div>
        </div>
        {/* Minimal page below */}
        <div className="p-3 space-y-2">
          <div className="h-12 rounded-md bg-primary/10 flex items-center justify-center">
            <Car className="h-5 w-5 text-primary/40" />
          </div>
          <div className="h-2 w-3/4 rounded bg-foreground/5" />
          <div className="h-2 w-1/2 rounded bg-foreground/5" />
        </div>
      </div>

      {/* Finger pointer */}
      <div className="relative w-full max-w-[280px] h-0">
        {!copied && (
          <motion.div
            className="absolute z-20 text-2xl"
            initial={{ opacity: 0, top: -110, left: 60 }}
            animate={
              tapped
                ? { opacity: 1, top: -130, left: 100, scale: [1, 0.85, 1] }
                : { opacity: 1, top: -110, left: 60 }
            }
            transition={{ duration: 0.5, ease: "easeInOut" }}
          >
            👆
          </motion.div>
        )}
      </div>

      {/* Copied toast */}
      <AnimatePresence>
        {copied && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 rounded-lg border bg-background px-4 py-2 shadow-md"
          >
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span className="text-sm font-semibold">Copied!</span>
          </motion.div>
        )}
      </AnimatePresence>

      <p className="text-sm text-muted-foreground text-center max-w-[260px]">
        Tap the <strong>address bar</strong> to select the URL, then tap{" "}
        <strong>Copy</strong>.
      </p>
    </div>
  );
}

/* ─── Step 3: Paste into CarWise ─── */
function StepPaste() {
  const [tapped, setTapped] = useState(false);
  const [typing, setTyping] = useState(false);
  const [typedChars, setTypedChars] = useState(0);
  const [done, setDone] = useState(false);

  const url = "cars.com/vehicledetail/12345";

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    // Finger taps input
    timers.push(setTimeout(() => setTapped(true), 800));
    // Start typing effect
    timers.push(setTimeout(() => setTyping(true), 1400));
    // Type each character
    for (let i = 1; i <= url.length; i++) {
      timers.push(
        setTimeout(() => setTypedChars(i), 1400 + i * 40)
      );
    }
    // Done
    timers.push(
      setTimeout(() => setDone(true), 1400 + url.length * 40 + 300)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="flex flex-col items-center gap-4">
      {/* CarWise input mockup */}
      <div className="w-full max-w-[280px] space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
          <LinkIcon className="h-3.5 w-3.5 text-primary" />
          Listing URL
        </div>
        <motion.div
          className="rounded-md border px-3 py-2 text-sm flex items-center gap-2 min-h-[40px]"
          animate={
            tapped
              ? {
                  borderColor: "hsl(var(--primary))",
                  boxShadow: "0 0 0 2px hsl(var(--primary) / 0.2)",
                }
              : { borderColor: "hsl(var(--border))" }
          }
          transition={{ duration: 0.3 }}
        >
          {typing ? (
            <motion.span className="text-foreground text-xs font-mono truncate">
              {url.slice(0, typedChars)}
              {typedChars < url.length && (
                <motion.span
                  className="inline-block w-px h-3.5 bg-foreground ml-px"
                  animate={{ opacity: [1, 0] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                />
              )}
            </motion.span>
          ) : (
            <span className="text-muted-foreground text-xs">
              Paste listing URL here...
            </span>
          )}
        </motion.div>

        {/* Import button */}
        <motion.div
          className="rounded-md bg-primary py-2 px-4 text-center text-sm font-semibold text-primary-foreground flex items-center justify-center gap-2"
          animate={
            done
              ? {
                  scale: [1, 1.05, 1],
                  boxShadow: [
                    "0 0 0 0 hsl(var(--primary) / 0)",
                    "0 0 12px 2px hsl(var(--primary) / 0.4)",
                    "0 0 0 0 hsl(var(--primary) / 0)",
                  ],
                }
              : {}
          }
          transition={{ duration: 1.2, repeat: done ? Infinity : 0 }}
        >
          <LinkIcon className="h-4 w-4" />
          Import from URL
        </motion.div>
      </div>

      {/* Finger pointer */}
      {!typing && (
        <div className="relative w-full max-w-[280px] h-0">
          <motion.div
            className="absolute z-20 text-2xl"
            initial={{ opacity: 0, bottom: 50, left: 30 }}
            animate={
              tapped
                ? { opacity: 1, bottom: 65, left: 80, scale: [1, 0.85, 1] }
                : { opacity: 1, bottom: 50, left: 30 }
            }
            transition={{ duration: 0.5, ease: "easeInOut" }}
          >
            👆
          </motion.div>
        </div>
      )}

      <p className="text-sm text-muted-foreground text-center max-w-[260px]">
        Tap the <strong>URL field</strong> on CarWise and paste the link you
        copied. Then tap <strong>Import from URL</strong>.
      </p>
    </div>
  );
}

/* ─── Step 4: Auto-Imported Details ─── */
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
              transition={{
                delay: 0.5 + i * 0.25,
                type: "spring",
                stiffness: 400,
              }}
            >
              <CheckCircle className="h-4 w-4 text-green-500" />
            </motion.div>
          </motion.div>
        ))}
      </div>
      <p className="text-sm text-muted-foreground text-center max-w-[260px]">
        CarWise reads the listing and fills in the details automatically — no
        typing needed!
      </p>
    </div>
  );
}

/* ─── Main Component ─── */
const stepData = [
  { title: "Find Your Listing", icon: Search, Component: StepFindListing },
  { title: "Copy the URL", icon: Copy, Component: StepCopyURL },
  { title: "Paste into CarWise", icon: Clipboard, Component: StepPaste },
  { title: "Auto-Imported Details", icon: Sparkles, Component: StepExtracted },
];

export function URLTutorial({ open, onClose }: URLTutorialProps) {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (open) {
      setCurrent(0);
      setPaused(false);
    }
  }, [open]);

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
  const progressPct = ((current + 1) / TOTAL_STEPS) * 100;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden border-primary/20">
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
              onClick={() => {
                setPaused(true);
                setCurrent(i);
              }}
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
            {current + 1} / {TOTAL_STEPS}
          </span>
          <Button size="sm" onClick={next} className="gap-1">
            {isLast ? "Got it!" : "Next"}
            {!isLast && <ArrowRight className="h-4 w-4" />}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
