import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getVerdictColorToken } from "@/lib/risk-colors";

interface MobileBottomBarProps {
  verdict: string;
  monthlyCostRange: string;
  onCheatSheetClick?: () => void;
  isPaid: boolean;
  heroRef: React.RefObject<HTMLDivElement>;
}

export function MobileBottomBar({ verdict, monthlyCostRange, onCheatSheetClick, isPaid, heroRef }: MobileBottomBarProps) {
  const [visible, setVisible] = useState(false);

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

  if (!visible) return null;

  const colorToken = getVerdictColorToken(verdict);
  const badgeClasses: Record<string, string> = {
    "risk-green": "bg-risk-green text-white",
    "risk-amber": "bg-risk-amber text-white",
    "risk-red": "bg-risk-red text-white",
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[60] border-t border-border-card bg-surface h-[56px] flex items-center px-4 md:hidden animate-fade-in">
      <div className="flex w-full items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <Badge className={cn("text-xs font-bold uppercase shrink-0", badgeClasses[colorToken])}>
            {verdict}
          </Badge>
          <span className="text-sm text-neutral truncate">· {monthlyCostRange}</span>
        </div>
        {isPaid && onCheatSheetClick && (
          <Button size="sm" className="h-8 text-xs shrink-0 ml-2" onClick={onCheatSheetClick}>
            Cheat Sheet
          </Button>
        )}
      </div>
    </div>
  );
}
