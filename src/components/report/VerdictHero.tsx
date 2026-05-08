import { forwardRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { RefreshCw, Upload, Loader2, Download, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getVerdictColorToken, getRiskColorToken, getRiskHsl, getVerdictHsl } from "@/lib/risk-colors";
import { toast } from "sonner";
import type { AiFindings } from "@/types/vehicle";

interface VerdictHeroProps {
  vehicle: {
    year: number; make: string; model: string; trim?: string; vin?: string;
    bodyStyle?: string; drivetrain?: string; fuelType?: string; exteriorColor?: string;
    installedEquipment?: string[];
    categorizedEquipment?: Record<string, string[]>;
    optionPackages?: (string | { name: string })[];
  };
  mileage: number;
  askingPrice: number;
  images?: string[];
  verdict: string;
  riskScore?: number;
  riskLabel?: string;
  aiFindings?: AiFindings;
  openRecallCount?: number;
  recallComponents?: string[];
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
  aiFindings, openRecallCount, recallComponents, onReAnalyze, onUploadHistory, onDownloadPDF,
  isRefreshing, isDownloading, onCheatSheetClick, isPaid,
}, ref) => {
  const verdictToken = getVerdictColorToken(verdict);
  const verdictHsl = getVerdictHsl(verdict);
  const vehicleTitle = `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ` ${vehicle.trim}` : ""}`;

  // Get top findings — ONLY from confirmed structured data, never inferred
  const topFindings: string[] = [];
  const normalizeRecallComponent = (component: string) => {
    const primary = component.split(":")[0]?.trim().toLowerCase() || component.trim().toLowerCase();
    return primary.replace(/\s+/g, " ");
  };

  const recallHighlights = Array.from(
    new Set(
      (recallComponents || [])
        .map(normalizeRecallComponent)
        .filter((component) => component && !component.startsWith("equipment"))
    )
  );

  const recallBullet = openRecallCount && openRecallCount > 0
    ? `${openRecallCount} open NHTSA safety ${openRecallCount === 1 ? "recall" : "recalls"} unresolved${recallHighlights.length > 0 ? ` — including ${recallHighlights.slice(0, 2).join(" and ")} systems.` : "."}`
    : null;

  // 1. Active service faults (confirmed from service records)
  if (aiFindings?.activeServiceFaults) {
    for (const f of aiFindings.activeServiceFaults) {
      if (topFindings.length >= 3) break;
      if (
        f.description &&
        f.system !== "recalls" &&
        !/generic check required|inferred for .* model year|open safety recall/i.test(f.description)
      ) {
        topFindings.push(f.description);
      }
    }
  }
  if (recallBullet && topFindings.length < 3) {
    topFindings.push(recallBullet);
  }
  // 2. Known failure patterns — only those flagged as already present
  if (aiFindings?.knownFailurePatterns) {
    for (const p of aiFindings.knownFailurePatterns) {
      if (topFindings.length >= 3) break;
      if (p.alreadyPresent && p.description) topFindings.push(p.description);
    }
  }
  // Never fabricate findings to fill 3 bullets — show only what exists

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

          {/* Compact specs row (Fix 8) */}
          {(() => {
            const specs = [
              vehicle.bodyStyle,
              vehicle.drivetrain,
              vehicle.fuelType,
              vehicle.exteriorColor,
              vehicle.trim ? `Trim: ${vehicle.trim}` : null,
            ].filter(Boolean);
            if (specs.length === 0) return null;
            return (
              <div className="mt-1.5">
                <p className="text-xs text-neutral">{specs.join(" · ")}</p>
                {vehicle.installedEquipment && vehicle.installedEquipment.length > 0 && (
                  <Collapsible>
                    <CollapsibleTrigger className="text-xs text-neutral hover:text-foreground hover:underline transition-colors mt-1 inline-block">
                      View standard equipment ↓
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2">
                      {(vehicle as any).categorizedEquipment && Object.keys((vehicle as any).categorizedEquipment).length > 0 ? (
                        <div className="space-y-2">
                          {Object.entries((vehicle as any).categorizedEquipment as Record<string, string[]>).sort(([a], [b]) => a.localeCompare(b)).map(([category, items]) => (
                            <div key={category}>
                              <p className="text-[10px] font-semibold text-neutral uppercase tracking-wider mb-1">{category}</p>
                              <div className="flex flex-wrap gap-1">
                                {items.map((item: string, i: number) => (
                                  <Badge key={i} variant="secondary" className="text-[10px] font-normal py-0">{item}</Badge>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {vehicle.installedEquipment.map((item: string, i: number) => (
                            <Badge key={i} variant="secondary" className="text-[10px] font-normal py-0">{item}</Badge>
                          ))}
                        </div>
                      )}
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </div>
            );
          })()}

        </div>

        {/* Right zone — verdict */}
        <div className="md:w-[45%] p-4 md:p-6">
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

          {/* CTA buttons */}
          <div className="mt-4 flex gap-2">
            {isPaid && onCheatSheetClick && (
              <Button
                size="sm"
                className={cn(
                  "flex-1 h-8 text-[11px] px-2 min-w-0 transition-colors",
                  verdict.toLowerCase() === "avoid"
                    ? "text-white"
                    : "bg-[hsl(140,60%,92%)] text-[hsl(140,60%,25%)] hover:bg-[hsl(140,60%,40%)] hover:text-white"
                )}
                style={verdict.toLowerCase() === "avoid" ? { backgroundColor: verdictHsl } : undefined}
                onClick={onCheatSheetClick}
              >
                <span className="truncate">Negotiation Sheet</span>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-8 text-[11px] px-2 min-w-0 border-border-card bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors"
            >
              <span className="truncate font-bold">Get Insurance Quote</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Action row — centered across full card */}
      <div className="flex flex-wrap items-center justify-center gap-3 px-4 md:px-6 pb-6 pt-[10px]">
        <Button variant="outline" size="sm" className="h-[44px] text-[17px] px-4 border-border-card whitespace-nowrap shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md hover:bg-primary hover:text-primary-foreground hover:border-primary"
          onClick={onDownloadPDF} disabled={isDownloading}>
          {isDownloading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin shrink-0" /> : <Download className="mr-1.5 h-4 w-4 shrink-0" />}
          {isDownloading ? "Generating..." : "Download PDF"}
        </Button>
        <Button variant="outline" size="sm" className="h-[44px] text-[17px] px-4 border-border-card whitespace-nowrap shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md hover:bg-primary hover:text-primary-foreground hover:border-primary"
          onClick={() => {
            navigator.clipboard.writeText(window.location.href).then(() => {
              toast("Report link copied to clipboard", { duration: 2000 });
            }).catch(() => {
              toast.error("Failed to copy link");
            });
          }}>
          <Share2 className="mr-1.5 h-4 w-4 shrink-0" />
          Share Report
        </Button>
        <Button variant="outline" size="sm" className="h-[44px] text-[17px] px-4 border-border-card whitespace-nowrap shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md hover:bg-primary hover:text-primary-foreground hover:border-primary"
          onClick={onReAnalyze} disabled={isRefreshing}>
          {isRefreshing ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin shrink-0" /> : <RefreshCw className="mr-1.5 h-4 w-4 shrink-0" />}
          {isRefreshing ? "Re-Analyzing..." : "Re-Analyze"}
        </Button>
        <Button variant="outline" size="sm" className="h-[44px] text-[17px] px-4 border-border-card whitespace-nowrap shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md hover:bg-primary hover:text-primary-foreground hover:border-primary"
          onClick={onUploadHistory} disabled={isRefreshing}>
          <Upload className="mr-1.5 h-4 w-4 shrink-0" />
          Upload CarFax
        </Button>
      </div>
    </div>
  );
});

VerdictHero.displayName = "VerdictHero";
