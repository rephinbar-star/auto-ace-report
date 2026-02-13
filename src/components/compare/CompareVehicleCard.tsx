import { useState, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  ChevronDown, 
  ChevronUp, 
  Car, 
  Calendar, 
  Gauge, 
  DollarSign, 
  Shield, 
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  X,
  Crown,
  FileText,
  Fuel,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { calculateAnnualFuelCost } from "@/lib/tco-calculations";
import { calculateUVPRS, getRiskLevel } from "@/lib/uvprs-scoring";
import type { Tables } from "@/integrations/supabase/types";

type VehicleReport = Tables<"vehicle_reports"> & {
  mpg_city?: number | null;
  mpg_highway?: number | null;
  mpg_combined?: number | null;
};

interface CompareVehicleCardProps {
  report: VehicleReport;
  onRemove: (id: string) => void;
  isBestBuy?: boolean;
  rank?: number;
}

const dealRatingConfig = {
  excellent: { label: "Excellent Deal", className: "bg-green-500/10 text-green-600 border-green-500/20", score: 5 },
  good: { label: "Good Deal", className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", score: 4 },
  fair: { label: "Fair Deal", className: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20", score: 3 },
  poor: { label: "Poor Deal", className: "bg-orange-500/10 text-orange-600 border-orange-500/20", score: 2 },
  overpriced: { label: "Overpriced", className: "bg-red-500/10 text-red-600 border-red-500/20", score: 1 },
};

const riskConfig = {
  low: { label: "Low Risk", className: "text-green-600 bg-green-500/10", icon: CheckCircle },
  medium: { label: "Medium Risk", className: "text-yellow-600 bg-yellow-500/10", icon: AlertTriangle },
  high: { label: "High Risk", className: "text-red-600 bg-red-500/10", icon: AlertTriangle },
};

export function CompareVehicleCard({ report, onRemove, isBestBuy, rank }: CompareVehicleCardProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [searchParams] = useSearchParams();
  const dealRating = report.deal_rating ? dealRatingConfig[report.deal_rating] : null;
  const risk = report.risk_level ? riskConfig[report.risk_level] : null;
  const RiskIcon = risk?.icon || AlertTriangle;

  // Compute UVPRS
  const uvprs = useMemo(() => calculateUVPRS({
    year: report.year,
    make: report.make,
    mileage: report.mileage,
    askingPrice: Number(report.asking_price),
    titleStatus: report.title_status as "clean" | "salvage" | "rebuilt" | "lemon" | null,
    accidentCount: report.accident_count,
    ownerCount: report.owner_count,
    hasServiceRecords: report.has_service_records,
    healthScore: report.health_score,
    historyIssues: report.history_issues,
    historyPositives: report.history_positives,
    serviceGapMiles: report.service_gap_miles,
    majorServicesDue: report.major_services_due,
    majorServicesDone: report.major_services_done,
    chronicRepairSystems: report.chronic_repair_systems,
    fairMarketPrivate: report.fair_market_private ? Number(report.fair_market_private) : null,
    fairMarketDealer: report.fair_market_dealer ? Number(report.fair_market_dealer) : null,
    openRecallCount: null,
  }), [report]);

  const uvprsColor = uvprs.riskLevel === "low" ? "text-green-600 bg-green-500/10 border-green-500/20"
    : uvprs.riskLevel === "moderate" ? "text-yellow-600 bg-yellow-500/10 border-yellow-500/20"
    : uvprs.riskLevel === "high" ? "text-orange-600 bg-orange-500/10 border-orange-500/20"
    : "text-red-600 bg-red-500/10 border-red-500/20";

  const vehicleTitle = `${report.year} ${report.make} ${report.model}${report.trim ? ` ${report.trim}` : ""}`;
  
  // Build the full report URL with comparison return context
  const compareIds = searchParams.get("ids") || "";
  const fullReportUrl = `/report/${report.id}?from=compare&ids=${encodeURIComponent(compareIds)}`;

  return (
    <Card className={cn(
      "relative transition-all duration-200",
      isBestBuy && "ring-2 ring-primary shadow-lg"
    )}>
      {/* Best Buy Badge */}
      {isBestBuy && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
          <Badge className="bg-primary text-primary-foreground shadow-md">
            <Crown className="h-3 w-3 mr-1" />
            Best Buy
          </Badge>
        </div>
      )}

      {/* Rank Badge */}
      {rank && !isBestBuy && (
        <div className="absolute -top-2 -left-2 z-10">
          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-bold border">
            #{rank}
          </div>
        </div>
      )}

      {/* Remove Button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-8 w-8 text-muted-foreground hover:text-destructive"
        onClick={() => onRemove(report.id)}
      >
        <X className="h-4 w-4" />
      </Button>

      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3 pr-12">
          <div className="space-y-2">
            <h3 className="font-semibold text-lg leading-tight">{vehicleTitle}</h3>
            <div className="flex flex-wrap items-center gap-2">
              {dealRating && (
                <Badge variant="outline" className={dealRating.className}>
                  {dealRating.label}
                </Badge>
              )}
              <Badge variant="outline" className={uvprsColor}>
                <Shield className="h-3 w-3 mr-1" />
                Risk: {uvprs.totalScore}/100
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {/* Key Metrics - Always visible */}
          <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-muted/50 mb-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <DollarSign className="h-3 w-3" /> Asking Price
              </p>
              <p className="text-xl font-bold">${Number(report.asking_price).toLocaleString()}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <DollarSign className="h-3 w-3" /> Fair Offer
              </p>
              <p className="text-xl font-bold text-primary">
                {report.fair_offer_price 
                  ? `$${Number(report.fair_offer_price).toLocaleString()}`
                  : "—"
                }
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                {report.seller_type === "dealer" ? "Dealer Retail" : "Private Sale"}
              </p>
              <p className="font-semibold">
                {report.seller_type === "dealer" && report.fair_market_dealer
                  ? `$${Number(report.fair_market_dealer).toLocaleString()}`
                  : report.fair_market_private
                    ? `$${Number(report.fair_market_private).toLocaleString()}`
                    : "—"
                }
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Gauge className="h-3 w-3" /> Mileage
              </p>
              <p className="font-semibold">{report.mileage.toLocaleString()} mi</p>
            </div>
          </div>

          {/* Price Difference */}
          {report.price_difference && (
            <div className={cn(
              "p-3 rounded-lg mb-4 flex items-center justify-between",
              Number(report.price_difference) > 0 
                ? "bg-red-500/10 text-red-600" 
                : "bg-green-500/10 text-green-600"
            )}>
              <span className="text-sm font-medium">
                vs {report.seller_type === "dealer" ? "Dealer Retail" : "Market"}
              </span>
              <span className="font-bold">
                {Number(report.price_difference) > 0 ? "+" : ""}
                ${Number(report.price_difference).toLocaleString()}
              </span>
            </div>
          )}

          {/* Expandable Details */}
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between">
              <span className="text-sm">
                {isOpen ? "Hide Details" : "Show Details"}
              </span>
              {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>

          <CollapsibleContent className="space-y-4 pt-4">
            {/* Vehicle Specs */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Car className="h-4 w-4" /> Specifications
              </h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {report.body_style && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Body</span>
                    <span className="capitalize">{report.body_style}</span>
                  </div>
                )}
                {report.transmission && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Trans</span>
                    <span className="capitalize">{report.transmission}</span>
                  </div>
                )}
                {report.drivetrain && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Drive</span>
                    <span className="uppercase">{report.drivetrain}</span>
                  </div>
                )}
                {report.fuel_type && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fuel</span>
                    <span className="capitalize">{report.fuel_type}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Fuel Economy - NEW */}
            {(report.mpg_combined || report.mpg_city || report.mpg_highway) && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Fuel className="h-4 w-4" /> Fuel Economy
                </h4>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  {report.mpg_city && (
                    <div className="p-2 rounded bg-muted text-center">
                      <p className="font-bold">{report.mpg_city}</p>
                      <p className="text-xs text-muted-foreground">City MPG</p>
                    </div>
                  )}
                  {report.mpg_highway && (
                    <div className="p-2 rounded bg-muted text-center">
                      <p className="font-bold">{report.mpg_highway}</p>
                      <p className="text-xs text-muted-foreground">Hwy MPG</p>
                    </div>
                  )}
                  {report.mpg_combined && (
                    <div className="p-2 rounded bg-muted text-center">
                      <p className="font-bold">{report.mpg_combined}</p>
                      <p className="text-xs text-muted-foreground">Combined</p>
                    </div>
                  )}
                </div>
                {report.mpg_combined && (
                  <p className="text-xs text-muted-foreground">
                    Est. annual fuel cost: <span className="font-medium text-foreground">
                      ${calculateAnnualFuelCost(report.mpg_combined, report.fuel_type).toLocaleString()}
                    </span>
                  </p>
                )}
              </div>
            )}

            {/* Risk Assessment */}
            {report.reliability_concerns && Array.isArray(report.reliability_concerns) && (report.reliability_concerns as Array<{ concern: string; costLow?: number | null; costHigh?: number | null }>).length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Shield className="h-4 w-4" /> Reliability Concerns
                </h4>
                <ul className="space-y-1">
                  {(report.reliability_concerns as Array<{ concern: string; costLow?: number | null; costHigh?: number | null }>).map((item, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <AlertTriangle className="h-3 w-3 mt-0.5 text-yellow-600 shrink-0" />
                      <span>
                        {typeof item === "string" ? item : item.concern}
                        {typeof item !== "string" && (item.costLow || item.costHigh) && (
                          <span className="ml-1 font-medium text-destructive">
                            — Est. {item.costLow && item.costHigh
                              ? `$${item.costLow.toLocaleString()}–$${item.costHigh.toLocaleString()}`
                              : item.costLow ? `$${item.costLow.toLocaleString()}+`
                              : `Up to $${item.costHigh!.toLocaleString()}`}
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Depreciation Risk */}
            {report.depreciation_risk && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <TrendingDown className="h-4 w-4" /> Depreciation Risk
                </h4>
                <p className="text-sm text-muted-foreground">{report.depreciation_risk}</p>
              </div>
            )}

            {/* Value Proposition */}
            {report.value_proposition && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Value Summary</h4>
                <p className="text-sm text-muted-foreground">{report.value_proposition}</p>
              </div>
            )}

            {/* History Summary */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Calendar className="h-4 w-4" /> History
              </h4>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="p-2 rounded bg-muted text-center">
                  <p className="font-bold">{report.accident_count || 0}</p>
                  <p className="text-xs text-muted-foreground">Accidents</p>
                </div>
                <div className="p-2 rounded bg-muted text-center">
                  <p className="font-bold">{report.owner_count || 1}</p>
                  <p className="text-xs text-muted-foreground">Owners</p>
                </div>
                <div className="p-2 rounded bg-muted text-center">
                  <p className="font-bold capitalize">{report.title_status || "Clean"}</p>
                  <p className="text-xs text-muted-foreground">Title</p>
                </div>
              </div>
            </div>
          </CollapsibleContent>

          {/* Full Report Button */}
          <div className="pt-4 border-t mt-4">
            <Button asChild className="w-full" variant="outline">
              <Link to={fullReportUrl}>
                <FileText className="h-4 w-4 mr-2" />
                View Full Report
              </Link>
            </Button>
          </div>
        </CardContent>
      </Collapsible>
    </Card>
  );
}
