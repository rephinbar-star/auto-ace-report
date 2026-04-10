import { getVerdictHsl } from "@/lib/risk-colors";
import { AlertTriangle, Info } from "lucide-react";
import type { AiFindings } from "@/types/vehicle";

interface ExpertAnalysisCardProps {
  aiFindings?: AiFindings;
  sanitizedExpertOpinion: string;
  verdict: string;
  riskScore?: number;
  reliabilityConcerns?: Array<{ concern: string; costLow?: number | null; costHigh?: number | null }>;
}

function getTopFinding(
  aiFindings?: AiFindings,
): string {
  if (aiFindings?.activeServiceFaults?.[0]?.description) {
    return aiFindings.activeServiceFaults[0].description;
  }
  if (aiFindings?.knownFailurePatterns?.[0]?.description) {
    return aiFindings.knownFailurePatterns[0].description;
  }
  return "No critical findings identified";
}

export function ExpertAnalysisCard({ aiFindings, sanitizedExpertOpinion, verdict, riskScore }: ExpertAnalysisCardProps) {
  const verdictHsl = getVerdictHsl(verdict);
  const topFinding = getTopFinding(aiFindings);
  const isHighRisk = (riskScore ?? 0) > 50;

  return (
    <div className="report-card p-0 overflow-hidden">
      {/* Heading */}
      <div className="px-4 md:px-5 pt-5 pb-2">
        <h3 className="text-lg font-semibold text-foreground">Expert Opinion</h3>
      </div>
      {/* Primary Finding Banner */}
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

      {/* Full Expert Opinion */}
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
