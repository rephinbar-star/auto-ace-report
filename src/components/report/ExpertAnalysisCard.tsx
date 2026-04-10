import type { AiFindings } from "@/types/vehicle";

interface ExpertAnalysisCardProps {
  aiFindings?: AiFindings;
  sanitizedExpertOpinion: string;
  verdict: string;
  riskScore?: number;
  reliabilityConcerns?: Array<{ concern: string; costLow?: number | null; costHigh?: number | null }>;
}

export function ExpertAnalysisCard({ sanitizedExpertOpinion }: ExpertAnalysisCardProps) {
  return (
    <div className="report-card p-0 overflow-hidden">
      <div className="px-4 md:px-5 pt-5 pb-2">
        <h3 className="text-lg font-semibold text-foreground">Expert Opinion</h3>
      </div>
      {sanitizedExpertOpinion && (
        <div className="px-4 md:px-5 pb-4 md:pb-5">
          <p className="whitespace-pre-line text-[14px] text-[#374151] leading-[1.6] mt-1 dark:text-foreground">
            {sanitizedExpertOpinion}
          </p>
        </div>
      )}
    </div>
  );
}
