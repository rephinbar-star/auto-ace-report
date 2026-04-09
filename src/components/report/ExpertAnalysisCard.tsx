import { cn } from "@/lib/utils";
import { getVerdictHsl } from "@/lib/risk-colors";
import { AlertTriangle, Info } from "lucide-react";
import type { AiFindings, ActiveServiceFault, KnownFailurePattern } from "@/types/vehicle";

interface ExpertAnalysisCardProps {
  aiFindings?: AiFindings;
  sanitizedExpertOpinion: string;
  verdict: string;
  riskScore?: number;
}

interface CombinedFinding {
  name: string;
  detail: string;
  severity: number;
  costLow?: number;
  costHigh?: number;
}

function combineFindingsFromAI(aiFindings?: AiFindings): CombinedFinding[] {
  const results: CombinedFinding[] = [];
  if (aiFindings?.activeServiceFaults) {
    for (const f of aiFindings.activeServiceFaults) {
      results.push({
        name: f.system,
        detail: f.description || `${f.system} fault detected`,
        severity: f.severityClass ?? 3,
        costLow: f.estimatedCostPerIncident,
        costHigh: f.estimatedCostPerIncident ? Math.round(f.estimatedCostPerIncident * 1.5) : undefined,
      });
    }
  }
  if (aiFindings?.knownFailurePatterns) {
    for (const p of aiFindings.knownFailurePatterns) {
      const sev = p.probabilityTier === "high" ? 4 : p.probabilityTier === "medium" ? 3 : 1;
      results.push({
        name: p.issue,
        detail: p.description || p.issue,
        severity: sev,
        costLow: p.probabilityPercent > 50 ? 1500 : 800,
        costHigh: p.probabilityPercent > 50 ? 4000 : 2000,
      });
    }
  }
  return results.sort((a, b) => b.severity - a.severity).slice(0, 3);
}

function getSeverityColor(severity: number): string {
  if (severity >= 4) return "border-risk-red";
  if (severity >= 2) return "border-risk-amber";
  return "border-risk-green";
}

function getSeverityIcon(severity: number): string {
  if (severity >= 4) return "🔴";
  if (severity >= 2) return "🟡";
  return "🟢";
}

export function ExpertAnalysisCard({ aiFindings, sanitizedExpertOpinion, verdict, riskScore }: ExpertAnalysisCardProps) {
  const verdictHsl = getVerdictHsl(verdict);
  const findings = combineFindingsFromAI(aiFindings);

  const topFinding = findings[0]?.detail ||
    (aiFindings?.activeServiceFaults?.[0]?.description) ||
    "No critical findings identified";

  const isHighRisk = (riskScore ?? 0) > 50;

  return (
    <div className="report-card p-0 overflow-hidden">
      {/* Part A — Primary Finding Banner */}
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

      {/* Part B — Key Findings Grid */}
      {findings.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 md:p-5 pt-3">
          {findings.map((f, i) => (
            <div key={i} className={cn("rounded-lg border-l-2 pl-3 pr-2 py-2", getSeverityColor(f.severity))}>
              <div className="flex items-center gap-1.5">
                <span className="text-base">{getSeverityIcon(f.severity)}</span>
                <span className="text-[13px] font-semibold text-foreground truncate">{f.name}</span>
              </div>
              <p className="text-xs text-neutral mt-1 line-clamp-2">{f.detail}</p>
              {(f.costLow || f.costHigh) && (
                <p className="text-[11px] text-risk-red font-medium mt-1">
                  ${f.costLow?.toLocaleString()}–${f.costHigh?.toLocaleString()} est.
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Part C — Full Expert Opinion (always visible) */}
      {sanitizedExpertOpinion && (
        <div className="px-4 md:px-5 pb-4 md:pb-5">
          <p className="whitespace-pre-line text-[14px] text-[#374151] leading-[1.6] mt-4 dark:text-foreground">
            {sanitizedExpertOpinion}
          </p>
        </div>
      )}
    </div>
  );
}
