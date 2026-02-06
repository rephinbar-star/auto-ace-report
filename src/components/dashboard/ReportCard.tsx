import { Link } from "react-router-dom";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Car, Calendar, Gauge, DollarSign, ArrowRight, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

type VehicleReport = Tables<"vehicle_reports">;

interface ReportCardProps {
  report: VehicleReport;
}

const dealRatingConfig = {
  excellent: { label: "Excellent Deal", className: "bg-green-500/10 text-green-600 border-green-500/20" },
  good: { label: "Good Deal", className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  fair: { label: "Fair Deal", className: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20" },
  poor: { label: "Poor Deal", className: "bg-orange-500/10 text-orange-600 border-orange-500/20" },
  overpriced: { label: "Overpriced", className: "bg-red-500/10 text-red-600 border-red-500/20" },
};

const statusConfig = {
  draft: { label: "Draft", icon: Clock, className: "bg-muted text-muted-foreground" },
  analyzing: { label: "Analyzing", icon: Clock, className: "bg-blue-500/10 text-blue-600" },
  complete: { label: "Complete", icon: CheckCircle, className: "bg-green-500/10 text-green-600" },
  error: { label: "Error", icon: AlertTriangle, className: "bg-red-500/10 text-red-600" },
};

const riskConfig = {
  low: { label: "Low Risk", className: "text-green-600" },
  medium: { label: "Medium Risk", className: "text-yellow-600" },
  high: { label: "High Risk", className: "text-red-600" },
};

export function ReportCard({ report }: ReportCardProps) {
  const dealRating = report.deal_rating ? dealRatingConfig[report.deal_rating] : null;
  const status = statusConfig[report.status];
  const StatusIcon = status.icon;
  const risk = report.risk_level ? riskConfig[report.risk_level] : null;

  return (
    <Card className="group hover:shadow-lg transition-all duration-200 hover:border-primary/50">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg truncate">
              {report.year} {report.make} {report.model}
            </h3>
            {report.trim && (
              <p className="text-sm text-muted-foreground truncate">{report.trim}</p>
            )}
          </div>
          <Badge variant="outline" className={cn("shrink-0", status.className)}>
            <StatusIcon className="h-3 w-3 mr-1" />
            {status.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Key stats */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Gauge className="h-4 w-4" />
            <span>{report.mileage.toLocaleString()} mi</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <DollarSign className="h-4 w-4" />
            <span>${report.asking_price.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>{new Date(report.created_at).toLocaleDateString()}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Car className="h-4 w-4" />
            <span className="capitalize">{report.condition}</span>
          </div>
        </div>

        {/* Deal rating and risk */}
        {report.status === "complete" && (
          <div className="flex flex-wrap items-center gap-2">
            {dealRating && (
              <Badge variant="outline" className={dealRating.className}>
                {dealRating.label}
              </Badge>
            )}
            {risk && (
              <span className={cn("text-xs font-medium", risk.className)}>
                {risk.label}
              </span>
            )}
          </div>
        )}

        {/* Fair offer price */}
        {report.fair_offer_price && report.status === "complete" && (
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
            <p className="text-xs text-muted-foreground mb-1">Fair Offer Price</p>
            <p className="text-lg font-semibold text-primary">
              ${Number(report.fair_offer_price).toLocaleString()}
            </p>
          </div>
        )}
      </CardContent>

      <CardFooter>
        <Button asChild variant="ghost" className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
          <Link to={`/report/${report.id}`}>
            View Full Report
            <ArrowRight className="h-4 w-4 ml-2" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
