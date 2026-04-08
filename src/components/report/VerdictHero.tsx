import { forwardRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Upload, Loader2, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { getVerdictColorToken, getRiskColorToken, getRiskHsl, getVerdictHsl } from "@/lib/risk-colors";
import type { AiFindings } from "@/types/vehicle";

interface VerdictHeroProps {
  vehicle: { year: number; make: string; model: string; trim?: string; vin?: string };
  mileage: number;
  askingPrice: number;
  images?: string[];
  verdict: string;
  riskScore?: number;
  riskLabel?: string;
  aiFindings?: AiFindings;
  onReAnalyze: () => void;
  onUploadHistory: () => void;
  onDownloadPDF: () => void;
  isRefreshing: boolean;
  isDownloading: boolean;
  onCheatSheetClick?: () => void;
  isPaid: boolean;
}

function CircularGauge({ score, size = 80 }: { score: number; size?: number }) {
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color = getRiskHsl(score);

  return (
    <svg width={size} height={size} className="block">
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke="hsl(var(--border-card))" strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={circumference - progress}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="transition-all duration-700"
      />
      <text x="50%" y="50%" textAnchor="middle" dy="0.35em"
        className="text-xl font-bold fill-foreground"
      >
        {score}
      </text>
    </svg>
  );
}

export const VerdictHero = forwardRef<HTMLDivElement, VerdictHeroProps>(({
  vehicle, mileage, askingPrice, images, verdict, riskScore, riskLabel,
  aiFindings, onReAnalyze, onUploadHistory, onDownloadPDF,
  isRefreshing, isDownloading, onCheatSheetClick, isPaid,
}, ref) => {
  const verdictToken = getVerdictColorToken(verdict);
  const verdictHsl = getVerdictHsl(verdict);
  const vehicleTitle = `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ` ${vehicle.trim}` : ""}`;

  // Get top 3 findings
  const topFindings: string[] = [];
  if (aiFindings?.activeServiceFaults) {
    for (const f of aiFindings.activeServiceFaults.slice(0, 2)) {
      topFindings.push(f.description || f.system);
    }
  }
  if (aiFindings?.knownFailurePatterns) {
    for (const p of aiFindings.knownFailurePatterns.slice(0, 3 - topFindings.length)) {
      topFindings.push(p.description || p.issue);
    }
  }

  const badgeClasses: Record<string, string> = {
    "risk-green": "bg-risk-green text-white",
    "risk-amber": "bg-risk-amber text-white",
    "risk-red": "bg-risk-red text-white",
  };

  const initials = `${vehicle.make[0] || ""}${vehicle.model[0] || ""}`.toUpperCase();

  return (
    <div ref={ref} className="report-card p-0 overflow-hidden">
      <div className="flex flex-col-reverse md:flex-row">
        {/* Left zone */}
        <div className="flex-1 p-4 md:p-6 md:w-[55%]">
          {/* Image or initials */}
          {images && images.length > 0 ? (
            <div className="h-[200px] w-full rounded-lg overflow-hidden mb-4">
              <img src={images[0]} alt={vehicleTitle} className="h-full w-full object-cover" />
            </div>
          ) : (
            <div className="h-[200px] w-full rounded-lg bg-muted flex items-center justify-center mb-4"
                 style={{ backgroundColor: `color-mix(in srgb, ${verdictHsl} 15%, transparent)` }}>
              <span className="text-4xl font-bold text-muted-foreground">{initials}</span>
            </div>
          )}

          <h1 className="text-[22px] font-semibold text-foreground">{vehicleTitle}</h1>
          <p className="text-[13px] text-neutral mt-1">
            {vehicle.vin && <>VIN# {vehicle.vin} • </>}
            {mileage.toLocaleString()} miles • ${askingPrice.toLocaleString()}
          </p>

          {/* Action row */}
          <div className="flex flex-wrap gap-3 mt-3">
            <Button variant="outline" size="sm" className="h-9 text-[13px] border-border-card"
              onClick={onReAnalyze} disabled={isRefreshing}>
              {isRefreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              {isRefreshing ? "Re-Analyzing..." : "Re-Analyze"}
            </Button>
            <Button variant="outline" size="sm" className="h-9 text-[13px] border-border-card"
              onClick={onUploadHistory} disabled={isRefreshing}>
              <Upload className="mr-2 h-4 w-4" />
              Upload CarFax/AutoCheck
            </Button>
            <Button variant="outline" size="sm" className="h-9 text-[13px] border-border-card"
              onClick={onDownloadPDF} disabled={isDownloading}>
              {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              {isDownloading ? "Generating..." : "Download PDF"}
            </Button>
          </div>
        </div>

        {/* Right zone — verdict */}
        <div className="md:w-[45%] p-5 md:p-6">
          <div className="rounded-xl p-6 flex flex-col items-center text-center"
               style={{
                 backgroundColor: `color-mix(in srgb, ${verdictHsl} 10%, transparent)`,
                 border: `2px solid ${verdictHsl}`,
               }}>
            {/* Verdict badge */}
            <Badge className={cn(
              "text-[28px] font-bold px-8 py-3 rounded-full uppercase",
              badgeClasses[verdictToken]
            )}>
              {verdict}
            </Badge>

            {/* Risk gauge */}
            {riskScore != null && (
              <div className="mt-4 flex flex-col items-center">
                <CircularGauge score={riskScore} />
                <p className="text-xs text-neutral mt-1">
                  / 100 {riskLabel || "Risk"}
                </p>
              </div>
            )}

            {/* Key reasons */}
            {topFindings.length > 0 && (
              <ul className="mt-3 space-y-1 text-left w-full max-w-xs">
                {topFindings.slice(0, 3).map((f, i) => (
                  <li key={i} className="text-xs text-foreground truncate">
                    • {f}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* CTA row */}
          <div className="flex gap-2 mt-3">
            {isPaid && onCheatSheetClick && (
              <Button className="flex-1" style={{ backgroundColor: verdictHsl }}
                onClick={onCheatSheetClick}>
                Negotiation Cheat Sheet
              </Button>
            )}
            <Button variant="outline" className="flex-1 border-border-card">
              Get Insurance Quote
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
});

VerdictHero.displayName = "VerdictHero";
