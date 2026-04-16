import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wrench, AlertTriangle, CheckCircle, Clock, CircleDot } from "lucide-react";
import { cn } from "@/lib/utils";

interface ServiceHistoryTimelineProps {
  serviceGapMiles: number | null | undefined;
  majorServicesDue: string[] | null | undefined;
  majorServicesDone: string[] | null | undefined;
  chronicRepairSystems: string[] | null | undefined;
  hasServiceRecords: boolean | null | undefined;
  mileage: number;
}

type TimelineItem = {
  label: string;
  type: "done" | "due" | "chronic" | "gap";
  icon: typeof CheckCircle;
};

export function ServiceHistoryTimeline({
  serviceGapMiles,
  majorServicesDue,
  majorServicesDone,
  chronicRepairSystems,
  hasServiceRecords,
  mileage,
}: ServiceHistoryTimelineProps) {
  const doneItems = majorServicesDone ?? [];
  const dueItems = majorServicesDue ?? [];
  const chronicItems = chronicRepairSystems ?? [];

  const hasGranularData =
    doneItems.length > 0 ||
    dueItems.length > 0 ||
    chronicItems.length > 0 ||
    (serviceGapMiles !== null && serviceGapMiles !== undefined);

  if (!hasGranularData) return null;

  // Build timeline entries
  const entries: TimelineItem[] = [
    ...doneItems.map((s) => ({ label: s, type: "done" as const, icon: CheckCircle })),
    ...dueItems.map((s) => ({ label: s, type: "due" as const, icon: AlertTriangle })),
    ...chronicItems.map((s) => ({
      label: `Chronic: ${s}`,
      type: "chronic" as const,
      icon: AlertTriangle,
    })),
  ];

  const gapSeverity =
    serviceGapMiles == null
      ? (hasServiceRecords === false ? "unknown" : null)
      : serviceGapMiles <= 10000
        ? "low"
        : serviceGapMiles <= 20000
          ? "moderate"
          : "high";

  const typeStyles: Record<TimelineItem["type"], string> = {
    done: "border-success/40 bg-success/10 text-success",
    due: "border-warning/40 bg-warning/10 text-warning",
    chronic: "border-danger/40 bg-danger/10 text-danger",
    gap: "",
  };

  const dotStyles: Record<TimelineItem["type"], string> = {
    done: "bg-success",
    due: "bg-warning",
    chronic: "bg-danger",
    gap: "",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wrench className="h-5 w-5 text-primary" />
          Service History
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Service gap callout */}
        {gapSeverity === "unknown" && (
          <div className="flex items-center gap-3 rounded-lg border p-3 border-primary/30 bg-primary/5">
            <Clock className="h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-medium">Service history not verified</p>
              <p className="text-xs text-muted-foreground">
                No CarFax or AutoCheck report was uploaded. Upload a history report for verified service records.
              </p>
            </div>
          </div>
        )}
        {serviceGapMiles != null && (
          <div
            className={cn(
              "flex items-center gap-3 rounded-lg border p-3",
              gapSeverity === "low" && "border-success/30 bg-success/5",
              gapSeverity === "moderate" && "border-warning/30 bg-warning/5",
              gapSeverity === "high" && "border-danger/30 bg-danger/5"
            )}
          >
            <Clock
              className={cn(
                "h-5 w-5 shrink-0",
                gapSeverity === "low" && "text-success",
                gapSeverity === "moderate" && "text-warning",
                gapSeverity === "high" && "text-danger"
              )}
            />
            <div>
              <p className="text-sm font-medium">
                Largest service gap: {serviceGapMiles.toLocaleString()} miles
              </p>
              <p className="text-xs text-muted-foreground">
                {gapSeverity === "low"
                  ? "Consistent maintenance schedule"
                  : gapSeverity === "moderate"
                    ? "Some gaps in documented service — ask seller for records"
                    : "Significant maintenance gaps — budget for deferred service"}
              </p>
            </div>
          </div>
        )}

        {/* Timeline */}
        {entries.length > 0 && (
          <div className="relative ml-3 border-l-2 border-muted pl-6 space-y-4">
            {entries.map((entry, i) => (
              <div key={i} className="relative">
                {/* Dot on the timeline line */}
                <span
                  className={cn(
                    "absolute -left-[31px] top-1 h-3 w-3 rounded-full border-2 border-background",
                    dotStyles[entry.type]
                  )}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <entry.icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      entry.type === "done" && "text-success",
                      entry.type === "due" && "text-warning",
                      entry.type === "chronic" && "text-danger"
                    )}
                  />
                  <span className="text-sm">{entry.label}</span>
                  <Badge
                    variant="outline"
                    className={cn("text-[10px] px-1.5 py-0", typeStyles[entry.type])}
                  >
                    {entry.type === "done"
                      ? "Completed"
                      : entry.type === "due"
                        ? "Overdue"
                        : "Repeat Issue"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Summary legend */}
        <div className="flex flex-wrap gap-4 pt-2 text-xs text-muted-foreground">
          {doneItems.length > 0 && (
            <span className="flex items-center gap-1">
              <CircleDot className="h-3 w-3 text-success" /> {doneItems.length} completed
            </span>
          )}
          {dueItems.length > 0 && (
            <span className="flex items-center gap-1">
              <CircleDot className="h-3 w-3 text-warning" /> {dueItems.length} overdue
            </span>
          )}
          {chronicItems.length > 0 && (
            <span className="flex items-center gap-1">
              <CircleDot className="h-3 w-3 text-danger" /> {chronicItems.length} chronic
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
