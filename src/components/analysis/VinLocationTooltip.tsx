import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HelpCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const locations = [
  {
    id: "dashboard",
    label: "Dashboard (Driver Side)",
    description: "Look through the windshield at the lower-left corner of the dashboard.",
    svg: (
      <svg viewBox="0 0 220 140" className="w-full" aria-hidden="true">
        {/* Windshield outline */}
        <path d="M20 120 L30 30 Q110 10 190 30 L200 120 Z" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="2" />
        {/* Dashboard strip */}
        <rect x="20" y="112" width="180" height="14" rx="3" fill="hsl(var(--secondary))" stroke="hsl(var(--border))" strokeWidth="1.5" />
        {/* Steering wheel */}
        <circle cx="75" cy="118" r="12" fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="2.5" />
        <circle cx="75" cy="118" r="3" fill="hsl(var(--muted-foreground))" />
        <line x1="75" y1="106" x2="75" y2="118" stroke="hsl(var(--muted-foreground))" strokeWidth="2" />
        <line x1="63" y1="118" x2="87" y2="118" stroke="hsl(var(--muted-foreground))" strokeWidth="2" />
        {/* VIN plate highlight */}
        <motion.rect
          x="22" y="113" width="28" height="12" rx="2"
          fill="hsl(var(--primary))"
          opacity={0.9}
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* Arrow */}
        <motion.g
          animate={{ y: [0, 4, 0] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
        >
          <line x1="36" y1="95" x2="36" y2="110" stroke="hsl(var(--primary))" strokeWidth="2" markerEnd="url(#arrow)" />
          <polygon points="36,112 32,104 40,104" fill="hsl(var(--primary))" />
        </motion.g>
        <text x="36" y="88" textAnchor="middle" fontSize="9" fill="hsl(var(--primary))" fontWeight="bold">VIN</text>
      </svg>
    ),
  },
  {
    id: "doorjam",
    label: "Driver's Door Jam",
    description: "Open the driver's door and look for a white sticker on the door frame edge.",
    svg: (
      <svg viewBox="0 0 220 140" className="w-full" aria-hidden="true">
        {/* Car door side view */}
        <rect x="25" y="25" width="110" height="100" rx="6" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="2" />
        {/* Window */}
        <rect x="35" y="33" width="90" height="48" rx="4" fill="hsl(var(--background))" stroke="hsl(var(--border))" strokeWidth="1.5" />
        {/* Door panel lines */}
        <line x1="25" y1="90" x2="135" y2="90" stroke="hsl(var(--border))" strokeWidth="1.5" />
        {/* Door handle */}
        <rect x="105" y="72" width="20" height="8" rx="3" fill="hsl(var(--secondary))" stroke="hsl(var(--border))" strokeWidth="1" />
        {/* Door jam strip */}
        <rect x="133" y="25" width="14" height="100" rx="2" fill="hsl(var(--secondary))" stroke="hsl(var(--border))" strokeWidth="1.5" />
        {/* VIN sticker */}
        <motion.rect
          x="134" y="72" width="12" height="20" rx="1.5"
          fill="hsl(var(--primary))"
          opacity={0.9}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* Arrow from label */}
        <motion.g
          animate={{ x: [0, -4, 0] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
        >
          <polygon points="160,82 168,78 168,86" fill="hsl(var(--primary))" />
        </motion.g>
        <text x="185" y="82" textAnchor="middle" fontSize="9" fill="hsl(var(--primary))" fontWeight="bold" dominantBaseline="middle">VIN</text>
        <text x="185" y="93" textAnchor="middle" fontSize="7" fill="hsl(var(--muted-foreground))">sticker</text>
      </svg>
    ),
  },
  {
    id: "insurance",
    label: "Insurance / Registration Card",
    description: "Your VIN also appears on your insurance card, registration document, and title.",
    svg: (
      <svg viewBox="0 0 220 140" className="w-full" aria-hidden="true">
        {/* Card */}
        <rect x="25" y="30" width="170" height="90" rx="8" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="2" />
        {/* Card header band */}
        <rect x="25" y="30" width="170" height="28" rx="8" fill="hsl(var(--primary) / 0.15)" />
        <rect x="25" y="44" width="170" height="14" fill="hsl(var(--primary) / 0.15)" />
        <text x="110" y="48" textAnchor="middle" fontSize="10" fill="hsl(var(--primary))" fontWeight="bold">INSURANCE CARD</text>
        {/* Lines */}
        <rect x="38" y="70" width="80" height="6" rx="2" fill="hsl(var(--border))" />
        <rect x="38" y="82" width="60" height="6" rx="2" fill="hsl(var(--border))" />
        {/* VIN row highlight */}
        <motion.rect
          x="35" y="95" width="150" height="16" rx="3"
          fill="hsl(var(--primary) / 0.2)"
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        />
        <text x="42" y="107" fontSize="8" fill="hsl(var(--muted-foreground))">VIN:</text>
        <motion.text
          x="58" y="107" fontSize="8" fill="hsl(var(--primary))" fontWeight="bold" fontFamily="monospace"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        >
          1HGBH41JXMN109186
        </motion.text>
      </svg>
    ),
  },
];

export function VinLocationTooltip() {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);

  // Auto-cycle through locations while open
  useEffect(() => {
    if (!open) return;
    const timer = setInterval(() => {
      setDirection(1);
      setIndex((i) => (i + 1) % locations.length);
    }, 3200);
    return () => clearInterval(timer);
  }, [open]);

  const go = (dir: 1 | -1) => {
    setDirection(dir);
    setIndex((i) => (i + locations.length + dir) % locations.length);
  };

  const current = locations[index];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors cursor-pointer"
          aria-label="Where to find the VIN"
        >
          <HelpCircle className="h-3.5 w-3.5" />
          <span className="underline underline-offset-2">Where to find it?</span>
        </button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="start" className="w-72 p-0 overflow-hidden">
        <div className="bg-primary/5 border-b px-3 py-2">
          <p className="text-xs font-semibold text-foreground">Where to find your VIN</p>
          <p className="text-[11px] text-muted-foreground">17-character identifier on every vehicle</p>
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
              <p className="text-xs font-semibold text-foreground">{current.label}</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{current.description}</p>
            </motion.div>
          </AnimatePresence>

          {/* Dot indicators */}
          <div className="flex justify-center gap-1.5 pt-1">
            {locations.map((loc, i) => (
              <button
                key={loc.id}
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
