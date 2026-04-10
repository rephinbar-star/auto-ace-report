import { cn } from "@/lib/utils";
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

export function ExpertFindingsStrip({ aiFindings, reliabilityConcerns }: ExpertFindingsStripProps) {
  const findings = combineFindingsFromAI(aiFindings, reliabilityConcerns);

  if (findings.length === 0) return null;

  return (
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
            <p className="text-[11px] uppercase tracking-wider text-neutral font-medium leading-tight">{f.name}</p>
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
  );
}
