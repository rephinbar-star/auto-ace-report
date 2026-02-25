import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HelpCircle, ChevronLeft, ChevronRight, Camera, Monitor } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const steps = [
  {
    id: "ios",
    label: "iPhone / iPad",
    description: "Press Side button + Volume Up simultaneously. The screen flashes white — screenshot saved to Photos.",
    svg: (
      <svg viewBox="0 0 220 140" className="w-full" aria-hidden="true">
        {/* Phone body */}
        <rect x="70" y="8" width="80" height="128" rx="12" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="2" />
        {/* Screen */}
        <rect x="76" y="18" width="68" height="106" rx="6" fill="hsl(var(--background))" stroke="hsl(var(--border))" strokeWidth="1" />
        {/* Fake listing content */}
        <rect x="80" y="24" width="60" height="30" rx="3" fill="hsl(var(--primary) / 0.1)" />
        <rect x="80" y="60" width="40" height="5" rx="2" fill="hsl(var(--foreground) / 0.1)" />
        <rect x="80" y="68" width="55" height="4" rx="2" fill="hsl(var(--foreground) / 0.06)" />
        <rect x="80" y="76" width="30" height="4" rx="2" fill="hsl(var(--foreground) / 0.06)" />
        {/* Side button (right) */}
        <motion.rect
          x="150" y="44" width="5" height="18" rx="2"
          fill="hsl(var(--primary))"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* Volume up (left) */}
        <motion.rect
          x="65" y="44" width="5" height="14" rx="2"
          fill="hsl(var(--primary))"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut", delay: 0 }}
        />
        {/* Flash overlay */}
        <motion.rect
          x="76" y="18" width="68" height="106" rx="6"
          fill="white"
          animate={{ opacity: [0, 0, 0.85, 0, 0, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", times: [0, 0.45, 0.55, 0.65, 1, 1] }}
        />
        {/* Labels */}
        <text x="165" y="53" fontSize="7.5" fill="hsl(var(--primary))" fontWeight="bold">Side</text>
        <text x="38" y="51" fontSize="7.5" fill="hsl(var(--primary))" fontWeight="bold" textAnchor="middle">Vol ↑</text>
        {/* Plus between */}
        <text x="110" y="115" fontSize="9" fill="hsl(var(--primary))" fontWeight="bold" textAnchor="middle">Simultaneously</text>
      </svg>
    ),
  },
  {
    id: "android",
    label: "Android Phone",
    description: "Press Power + Volume Down at the same time and hold for 1 second. Screenshot saved to Gallery.",
    svg: (
      <svg viewBox="0 0 220 140" className="w-full" aria-hidden="true">
        {/* Phone body */}
        <rect x="70" y="8" width="80" height="128" rx="10" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="2" />
        {/* Screen */}
        <rect x="76" y="18" width="68" height="104" rx="5" fill="hsl(var(--background))" stroke="hsl(var(--border))" strokeWidth="1" />
        {/* Fake content */}
        <rect x="80" y="24" width="60" height="28" rx="3" fill="hsl(var(--primary) / 0.1)" />
        <rect x="80" y="58" width="42" height="4" rx="2" fill="hsl(var(--foreground) / 0.1)" />
        <rect x="80" y="66" width="56" height="4" rx="2" fill="hsl(var(--foreground) / 0.06)" />
        <rect x="80" y="74" width="32" height="4" rx="2" fill="hsl(var(--foreground) / 0.06)" />
        {/* Power button right */}
        <motion.rect
          x="150" y="42" width="5" height="20" rx="2"
          fill="hsl(var(--primary))"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* Volume down right */}
        <motion.rect
          x="150" y="66" width="5" height="14" rx="2"
          fill="hsl(var(--primary))"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut", delay: 0.1 }}
        />
        {/* Flash */}
        <motion.rect
          x="76" y="18" width="68" height="104" rx="5"
          fill="white"
          animate={{ opacity: [0, 0, 0.85, 0, 0, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", times: [0, 0.45, 0.55, 0.65, 1, 1] }}
        />
        <text x="165" y="52" fontSize="7.5" fill="hsl(var(--primary))" fontWeight="bold">Power</text>
        <text x="165" y="74" fontSize="7.5" fill="hsl(var(--primary))" fontWeight="bold">Vol ↓</text>
        <text x="110" y="115" fontSize="9" fill="hsl(var(--primary))" fontWeight="bold" textAnchor="middle">Simultaneously</text>
      </svg>
    ),
  },
  {
    id: "mac",
    label: "Mac (macOS)",
    description: "Press ⌘ Cmd + Shift + 3 for full screen, or ⌘ Cmd + Shift + 4 to drag a selection.",
    svg: (
      <svg viewBox="0 0 220 140" className="w-full" aria-hidden="true">
        {/* Laptop screen */}
        <rect x="25" y="10" width="170" height="100" rx="6" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="2" />
        <rect x="32" y="17" width="156" height="86" rx="3" fill="hsl(var(--background))" />
        {/* Fake browser listing */}
        <rect x="36" y="21" width="148" height="6" rx="2" fill="hsl(var(--muted-foreground) / 0.15)" />
        <rect x="36" y="31" width="148" height="50" rx="3" fill="hsl(var(--primary) / 0.07)" />
        <rect x="40" y="35" width="56" height="38" rx="2" fill="hsl(var(--primary) / 0.12)" />
        <rect x="102" y="35" width="78" height="6" rx="2" fill="hsl(var(--foreground) / 0.1)" />
        <rect x="102" y="45" width="55" height="4" rx="2" fill="hsl(var(--foreground) / 0.06)" />
        <rect x="102" y="53" width="42" height="4" rx="2" fill="hsl(var(--foreground) / 0.06)" />
        {/* Keyboard base */}
        <rect x="15" y="112" width="190" height="18" rx="4" fill="hsl(var(--secondary))" stroke="hsl(var(--border))" strokeWidth="1.5" />
        {/* Shortcut key highlights */}
        {[
          { x: 22, label: "⌘" },
          { x: 40, label: "⇧" },
          { x: 58, label: "3" },
        ].map(({ x, label }) => (
          <motion.g key={label}
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
          >
            <rect x={x} y="115" width="14" height="11" rx="2" fill="hsl(var(--primary))" />
            <text x={x + 7} y="123" textAnchor="middle" fontSize="6.5" fill="hsl(var(--primary-foreground))" fontWeight="bold">{label}</text>
          </motion.g>
        ))}
        {/* Flash */}
        <motion.rect
          x="32" y="17" width="156" height="86" rx="3"
          fill="white"
          animate={{ opacity: [0, 0, 0.8, 0, 0, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", times: [0, 0.45, 0.55, 0.65, 1, 1] }}
        />
        <text x="130" y="124" fontSize="7" fill="hsl(var(--primary))" fontWeight="bold">or ⌘⇧4 for region</text>
      </svg>
    ),
  },
  {
    id: "windows",
    label: "Windows PC",
    description: "Press Win + Shift + S to open Snipping Tool and drag to select any part of the screen.",
    svg: (
      <svg viewBox="0 0 220 140" className="w-full" aria-hidden="true">
        {/* Monitor */}
        <rect x="25" y="8" width="170" height="104" rx="6" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="2" />
        <rect x="32" y="15" width="156" height="89" rx="3" fill="hsl(var(--background))" />
        {/* Fake content */}
        <rect x="36" y="19" width="148" height="6" rx="2" fill="hsl(var(--muted-foreground) / 0.15)" />
        <rect x="36" y="29" width="148" height="50" rx="3" fill="hsl(var(--primary) / 0.07)" />
        <rect x="40" y="33" width="56" height="38" rx="2" fill="hsl(var(--primary) / 0.12)" />
        <rect x="102" y="33" width="78" height="5" rx="2" fill="hsl(var(--foreground) / 0.1)" />
        <rect x="102" y="42" width="55" height="4" rx="2" fill="hsl(var(--foreground) / 0.06)" />
        {/* Snip selection animated box */}
        <motion.rect
          x="38" y="28" width="80" height="55" rx="1"
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="1.5"
          strokeDasharray="4 2"
          animate={{ opacity: [0, 1, 1, 0], width: [10, 80, 80, 80] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", times: [0, 0.4, 0.7, 1] }}
        />
        {/* Stand */}
        <rect x="98" y="114" width="24" height="10" rx="2" fill="hsl(var(--secondary))" stroke="hsl(var(--border))" strokeWidth="1" />
        <rect x="82" y="124" width="56" height="6" rx="3" fill="hsl(var(--secondary))" stroke="hsl(var(--border))" strokeWidth="1" />
        {/* Key highlights */}
        {[
          { x: 30, label: "⊞" },
          { x: 48, label: "⇧" },
          { x: 66, label: "S" },
        ].map(({ x, label }) => (
          <motion.g key={label}
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
          >
            <rect x={x} y="116" width="14" height="11" rx="2" fill="hsl(var(--primary))" />
            <text x={x + 7} y="124" textAnchor="middle" fontSize="6.5" fill="hsl(var(--primary-foreground))" fontWeight="bold">{label}</text>
          </motion.g>
        ))}
        <text x="140" y="124" fontSize="7" fill="hsl(var(--primary))" fontWeight="bold">Snipping Tool</text>
      </svg>
    ),
  },
];

export function ScreenshotTooltip() {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);

  useEffect(() => {
    if (!open) return;
    const timer = setInterval(() => {
      setDirection(1);
      setIndex((i) => (i + 1) % steps.length);
    }, 3400);
    return () => clearInterval(timer);
  }, [open]);

  const go = (dir: 1 | -1) => {
    setDirection(dir);
    setIndex((i) => (i + steps.length + dir) % steps.length);
  };

  const current = steps[index];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors cursor-pointer"
          aria-label="How to take a screenshot"
        >
          <HelpCircle className="h-3.5 w-3.5" />
          <span className="underline underline-offset-2">How to screenshot?</span>
        </button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="start" className="w-72 p-0 overflow-hidden">
        <div className="bg-primary/5 border-b px-3 py-2 flex items-center gap-2">
          <Camera className="h-3.5 w-3.5 text-primary shrink-0" />
          <div>
            <p className="text-xs font-semibold text-foreground">How to take a screenshot</p>
            <p className="text-[11px] text-muted-foreground">Select multiple listing sections</p>
          </div>
        </div>

        <div className="p-3 space-y-2">
          {/* Animated diagram */}
          <div className="relative overflow-hidden rounded-md bg-muted/40 border h-[140px]">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={current.id}
                custom={direction}
                initial={{ opacity: 0, x: direction * 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction * -40 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0 flex items-center justify-center p-2"
              >
                {current.svg}
              </motion.div>
            </AnimatePresence>

            {/* Prev / Next */}
            <button
              type="button"
              onClick={() => go(-1)}
              className="absolute left-1 top-1/2 -translate-y-1/2 rounded-full bg-background/80 border shadow-sm p-0.5 hover:bg-background transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-background/80 border shadow-sm p-0.5 hover:bg-background transition-colors"
            >
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>

          {/* Label & description */}
          <AnimatePresence mode="wait">
            <motion.div
              key={current.id + "-text"}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                {(current.id === "ios" || current.id === "android") ? (
                  <Camera className="h-3 w-3 text-primary" />
                ) : (
                  <Monitor className="h-3 w-3 text-primary" />
                )}
                <p className="text-xs font-semibold text-foreground">{current.label}</p>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{current.description}</p>
            </motion.div>
          </AnimatePresence>

          {/* Dot indicators */}
          <div className="flex justify-center gap-1.5 pt-1">
            {steps.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => { setDirection(i > index ? 1 : -1); setIndex(i); }}
                className={`h-1.5 rounded-full transition-all ${i === index ? "w-4 bg-primary" : "w-1.5 bg-muted-foreground/30"}`}
              />
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
