import { cn } from "@/lib/utils";
import { getVerdictHsl } from "@/lib/risk-colors";
import { AlertTriangle, Info } from "lucide-react";
import type { AiFindings } from "@/types/vehicle";

interface CombinedFinding {
  name: string;
  detail: string;
  severity: number;
  costLow?: number;
  costHigh?: number;
}

interface ExpertFindingsStripProps {
  aiFindings?: AiFindings;
  reliabilityConcerns?: Array<{ concern: string; costLow?: number | null; costHigh?: number | null }>;
  verdict: string;
  riskScore?: number;
}

function combineFindingsFromAI(
  aiFindings?: AiFindings,
  reliabilityConcerns?: Array<{ concern: string; costLow?: number | null; costHigh?: number | null }>
): CombinedFinding[] {
  const results: CombinedFinding[] = [];
  if (aiFindings?.activeServiceFaults) {
    for (const f of aiFindings.activeServiceFaults) {
      const matchingConcern = reliabilityConcerns?.find(rc =>
        rc.concern.toLowerCase().includes(f.system.toLowerCase()) ||
        f.description?.toLowerCase().includes(rc.concern.toLowerCase().slice(0, 20))
      );
      results.push({
        name: f.system,
        detail: f.description || `${f.system} fault detected`,
        severity: f.severityClass ?? 3,
        costLow: matchingConcern?.costLow ?? f.estimatedCostPerIncident ?? undefined,
        costHigh: matchingConcern?.costHigh ?? (f.estimatedCostPerIncident ? Math.round(f.estimatedCostPerIncident * 1.5) : undefined),
      });
    }
  }
  if (aiFindings?.knownFailurePatterns) {
    for (const p of aiFindings.knownFailurePatterns) {
      const sev = p.probabilityTier === "high" ? 4 : p.probabilityTier === "medium" ? 3 : 1;
      const matchingConcern = reliabilityConcerns?.find(rc =>
        rc.concern.toLowerCase().includes(p.issue.toLowerCase().slice(0, 15)) ||
        p.issue.toLowerCase().includes(rc.concern.toLowerCase().slice(0, 15))
      );
      results.push({
        name: p.issue,
        detail: p.description || p.issue,
        severity: sev,
        costLow: matchingConcern?.costLow ?? (p.probabilityPercent > 50 ? 1500 : 800),
        costHigh: matchingConcern?.costHigh ?? (p.probabilityPercent > 50 ? 4000 : 2000),
      });
    }
  }
  return results.sort((a, b) => b.severity - a.severity).slice(0, 3);
}

function getSeverityColorToken(severity: number): string {
  if (severity >= 4) return "risk-red";
  if (severity >= 2) return "risk-amber";
  return "risk-green";
}

const colorClasses: Record<string, string> = {
  "risk-green": "text-risk-green",
  "risk-amber": "text-risk-amber",
  "risk-red": "text-risk-red",
};

function getTopFinding(aiFindings?: AiFindings): string {
  if (aiFindings?.activeServiceFaults?.[0]?.description) {
    return aiFindings.activeServiceFaults[0].description;
  }
  if (aiFindings?.knownFailurePatterns?.[0]?.description) {
    return aiFindings.knownFailurePatterns[0].description;
  }
  return "No critical findings identified";
}

export function ExpertFindingsStrip({ aiFindings, reliabilityConcerns, verdict, riskScore }: ExpertFindingsStripProps) {
  const findings = combineFindingsFromAI(aiFindings, reliabilityConcerns);
  const verdictHsl = getVerdictHsl(verdict);
  const topFinding = getTopFinding(aiFindings);
  const isHighRisk = (riskScore ?? 0) > 50;

  if (findings.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* Primary Finding Banner */}
      <div className="report-card p-0 overflow-hidden">
        <div className="px-4 md:px-5 py-4 flex items-start gap-3"
             style={{
               borderLeft: `4px solid ${verdictHsl}`,
               backgroundColor: `color-mix(in srgb, ${verdictHsl} 8%, transparent)`,
             }}>
          {isHighRisk ? (
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" style={{ color: verdictHsl }} />
          ) : (
            <Info className="h-5 w-5 shrink-0 mt-0.5" style={{ color: verdictHsl }} />
          )}
          <p className="text-base font-semibold text-foreground leading-snug">{topFinding}</p>
        </div>
      </div>

      {/* Findings Cards */}
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory" style={{ WebkitOverflowScrolling: "touch" }}>
        {findings.map((f, i) => {
          const token = getSeverityColorToken(f.severity);
          const costStr = (f.costLow || f.costHigh)
            ? `$${f.costLow?.toLocaleString()}–$${f.costHigh?.toLocaleString()} est.`
            : undefined;

          return (
            <div
              key={i}
              className={cn(
                "report-card flex-1 min-w-[130px] px-2.5 py-2 md:px-3 md:py-2.5 text-left snap-start border border-transparent",
                token === "risk-red" && "bg-risk-red/5"
              )}
            >
              <p className="text-[11px] uppercase tracking-wider text-risk-red font-medium leading-tight">{f.name}</p>
              <p className="text-xs text-foreground mt-1 leading-snug line-clamp-2">{f.detail}</p>
              {costStr && (
                <p className={cn("text-[11px] font-medium mt-1 leading-tight", colorClasses[token])}>
                  {costStr}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
