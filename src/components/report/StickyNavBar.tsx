import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getVerdictColorToken } from "@/lib/risk-colors";

interface StickyNavBarProps {
  verdict: string;
  vehicleLabel: string;
  heroRef: React.RefObject<HTMLDivElement>;
  isPaid: boolean;
  onCheatSheetClick?: () => void;
}

const sections = [
  { id: "section-overview", label: "Overview" },
  { id: "section-pricing", label: "Pricing" },
  { id: "section-financials", label: "Financials" },
  { id: "section-risk", label: "Risk" },
  { id: "section-history", label: "History" },
];

export function StickyNavBar({ verdict, vehicleLabel, heroRef, isPaid, onCheatSheetClick }: StickyNavBarProps) {
  const [visible, setVisible] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("");
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Show/hide based on hero visibility
  useEffect(() => {
    const heroEl = heroRef.current;
    if (!heroEl) return;
    const obs = new IntersectionObserver(
      ([entry]) => setVisible(!entry.isIntersecting),
      { threshold: 0, rootMargin: "-52px 0px 0px 0px" }
    );
    obs.observe(heroEl);
    return () => obs.disconnect();
  }, [heroRef]);

  // Track active section
  useEffect(() => {
    const els = sections.map(s => document.getElementById(s.id)).filter(Boolean) as HTMLElement[];
    if (!els.length) return;
    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: "-60px 0px -60% 0px", threshold: 0.1 }
    );
    els.forEach(el => observerRef.current!.observe(el));
    return () => observerRef.current?.disconnect();
  }, []);

  const colorToken = getVerdictColorToken(verdict);
  const badgeClasses: Record<string, string> = {
    "risk-green": "bg-risk-green text-white",
    "risk-amber": "bg-risk-amber text-white",
    "risk-red": "bg-risk-red text-white",
  };

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (!visible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 border-b border-border-card bg-surface h-[52px] flex items-center px-4 animate-fade-in">
      <div className="mx-auto flex w-full max-w-[900px] items-center justify-between gap-3">
        {/* Left: verdict + vehicle */}
        <div className="flex items-center gap-2 min-w-0">
          <Badge className={cn("text-xs font-bold shrink-0 uppercase", badgeClasses[colorToken])}>
            {verdict}
          </Badge>
          <span className="text-sm font-medium truncate hidden sm:inline">{vehicleLabel}</span>
        </div>

        {/* Center: nav links — hidden on mobile */}
        <nav className="hidden md:flex items-center gap-1">
          {sections.map(s => (
            <button
              key={s.id}
              onClick={() => scrollTo(s.id)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                activeSection === s.id
                  ? "bg-primary/10 text-primary"
                  : "text-neutral hover:text-foreground"
              )}
            >
              {s.label}
            </button>
          ))}
        </nav>

        {/* Right: cheat sheet */}
        {isPaid && onCheatSheetClick && (
          <Button size="sm" className="h-8 text-sm shrink-0" onClick={onCheatSheetClick}>
            Negotiation Cheat Sheet
          </Button>
        )}
      </div>
    </div>
  );
}
