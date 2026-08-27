import { CheckCircle2, CircleSlash, MinusCircle, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { SourceCheck, SourceCheckStatus } from "@/types/best-deal";

const ICON: Record<SourceCheckStatus, typeof CheckCircle2> = {
  success: CheckCircle2,
  no_match: MinusCircle,
  unavailable: XCircle,
  not_configured: CircleSlash,
};

const LABEL: Record<SourceCheckStatus, string> = {
  success: "Data found",
  no_match: "No match",
  unavailable: "Unavailable",
  not_configured: "Not configured",
};

const TONE: Record<SourceCheckStatus, string> = {
  success: "text-primary",
  no_match: "text-muted-foreground",
  unavailable: "text-destructive",
  not_configured: "text-muted-foreground",
};

export function SourcesChecked({ checks }: { checks: SourceCheck[] }) {
  if (checks.length === 0) return null;
  const success = checks.filter((c) => c.status === "success").length;

  return (
    <Card className="border-2">
      <CardContent className="space-y-2 p-4">
        <details>
          <summary className="cursor-pointer text-sm font-semibold text-foreground">
            Sources checked · {success} returned data of {checks.length}
          </summary>
          <ul className="mt-3 space-y-2">
            {checks.map((c) => {
              const Icon = ICON[c.status];
              return (
                <li key={`${c.sourceName}-${c.sourceUrl}`} className="flex items-start gap-2 text-xs">
                  <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${TONE[c.status]}`} />
                  <span className="text-muted-foreground">
                    <a
                      href={c.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="font-medium text-foreground hover:underline"
                    >
                      {c.sourceName}
                    </a>{" "}
                    — {LABEL[c.status]}. {c.detail}
                  </span>
                </li>
              );
            })}
          </ul>
        </details>
      </CardContent>
    </Card>
  );
}
