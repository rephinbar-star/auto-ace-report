import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Car, Calendar, Gauge, DollarSign, ArrowRight, AlertTriangle, CheckCircle, Clock, Check, Trash2, ShieldCheck, ThumbsUp, ThumbsDown, HandCoins } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

type VehicleReport = Tables<"vehicle_reports">;

interface ReportCardProps {
  report: VehicleReport;
  selectionMode?: boolean;
  isSelected?: boolean;
  onSelect?: (id: string, selected: boolean) => void;
  selectionDisabled?: boolean;
  onDelete?: (id: string) => void;
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

export function ReportCard({ report, selectionMode, isSelected, onSelect, selectionDisabled, onDelete }: ReportCardProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const dealRating = report.deal_rating ? dealRatingConfig[report.deal_rating] : null;
  const status = statusConfig[report.status];
  const StatusIcon = status.icon;
  const risk = report.risk_level ? riskConfig[report.risk_level] : null;

  const isComplete = report.status === "complete";
  const canSelect = selectionMode && isComplete && !selectionDisabled;

  const handleCardClick = (e: React.MouseEvent) => {
    if (selectionMode && canSelect) {
      e.preventDefault();
      onSelect?.(report.id, !isSelected);
    }
  };

  return (
    <Card 
      className={cn(
        "group relative transition-all duration-200",
        selectionMode && canSelect && "cursor-pointer",
        selectionMode && isSelected && "ring-2 ring-primary border-primary",
        selectionMode && !canSelect && "opacity-50",
        !selectionMode && "hover:shadow-lg hover:border-primary/50"
      )}
      onClick={handleCardClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          {selectionMode && (
            <div className="shrink-0">
              <Checkbox
                checked={isSelected}
                disabled={!canSelect}
                onCheckedChange={(checked) => onSelect?.(report.id, !!checked)}
                onClick={(e) => e.stopPropagation()}
                className="mt-1"
              />
            </div>
          )}
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
            {report.warranty_status && (
              <Badge variant="outline" className={cn(
                report.warranty_status === "active" ? "bg-green-500/10 text-green-600 border-green-500/20"
                  : report.warranty_status === "expired" ? "bg-red-500/10 text-red-600 border-red-500/20"
                  : "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
              )}>
                <ShieldCheck className="h-3 w-3 mr-1" />
                {report.warranty_status === "active" ? "Warranty Active" : report.warranty_status === "expired" ? "Warranty Expired" : "Warranty Unknown"}
              </Badge>
            )}
            {report.final_verdict && (
              <Badge variant="outline" className={cn(
                report.final_verdict === "Buy" ? "bg-green-500/10 text-green-600 border-green-500/20"
                  : report.final_verdict === "Negotiate" ? "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
                  : "bg-red-500/10 text-red-600 border-red-500/20"
              )}>
                {report.final_verdict === "Buy" ? <ThumbsUp className="h-3 w-3 mr-1" />
                  : report.final_verdict === "Negotiate" ? <HandCoins className="h-3 w-3 mr-1" />
                  : <ThumbsDown className="h-3 w-3 mr-1" />}
                {report.final_verdict}
              </Badge>
            )}
          </div>
        )}

        {report.fair_offer_price && report.status === "complete" && (
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
            <p className="text-xs text-muted-foreground mb-1">Fair Offer Price</p>
            <p className="text-lg font-semibold text-primary">
              ${Number(report.fair_offer_price).toLocaleString()}
            </p>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex items-center justify-between gap-2">
        {selectionMode ? (
          <Button 
            variant={isSelected ? "default" : "outline"} 
            className="w-full"
            disabled={!canSelect}
            onClick={(e) => {
              e.stopPropagation();
              if (canSelect) onSelect?.(report.id, !isSelected);
            }}
          >
            {isSelected ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                Selected
              </>
            ) : !isComplete ? (
              "Not Available"
            ) : (
              "Select for Compare"
            )}
          </Button>
        ) : (
          <>
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Report</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete the report for{" "}
                    <span className="font-medium text-foreground">
                      {report.year} {report.make} {report.model}
                    </span>
                    ? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => onDelete?.(report.id)}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button asChild variant="ghost" className="flex-1 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
              <Link to={`/report/${report.id}`}>
                View Full Report
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </>
        )}
      </CardFooter>
      {report.updated_at && report.updated_at !== report.created_at && (
        <p className="px-6 pb-3 text-xs text-muted-foreground text-right">
          Last analyzed: {new Date(report.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
        </p>
      )}
    </Card>
  );
}
