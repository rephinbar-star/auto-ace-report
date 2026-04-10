import { useEffect, useState, useRef, useCallback } from "react";
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
  { id: "section-expert", label: "Expert Analysis" },
  { id: "section-financials", label: "Financials" },
  { id: "section-pricing", label: "Pricing" },
  { id: "section-risk", label: "Risk" },
  { id: "section-history", label: "History" },
];

const allTrackedSections = [...sections, { id: "section-verdict" }];

export function StickyNavBar({ verdict, vehicleLabel, heroRef, isPaid, onCheatSheetClick }: StickyNavBarProps) {
  const [activeSection, setActiveSection] = useState<string>("section-overview");

  // Track active section using scroll position (more reliable than IntersectionObserver)
  useEffect(() => {
    const onScroll = () => {
      const offset = 150; // header + sticky nav height
      let current = "section-overview";
      for (const s of allTrackedSections) {
        const el = document.getElementById(s.id);
        if (el) {
          const top = el.getBoundingClientRect().top;
          if (top <= offset) {
            current = s.id;
          }
        }
      }
      setActiveSection(current);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll(); // initial check
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const colorToken = getVerdictColorToken(verdict);
  const badgeClasses: Record<string, string> = {
    "risk-green": "bg-risk-green text-white",
    "risk-amber": "bg-risk-amber text-white",
    "risk-red": "bg-risk-red text-white",
  };

  const scrollTo = (id: string) => {
    if (id === "section-overview") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const el = document.getElementById(id);
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 130;
      window.scrollTo({ top, behavior: "smooth" });
    }
  };

  return (
    <div className="sticky top-16 left-0 right-0 z-40 border-b border-border-card bg-surface h-[52px] flex items-center px-4">
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
          {isPaid && (
            <button
              onClick={() => scrollTo("section-verdict")}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                activeSection === "section-verdict"
                  ? "bg-primary/10 text-primary"
                  : "text-neutral hover:text-foreground"
              )}
            >
              Negotiation Cheat Sheet
            </button>
          )}
        </nav>
      </div>
    </div>
  );
}
