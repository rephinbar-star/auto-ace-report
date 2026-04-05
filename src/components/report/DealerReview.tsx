import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Building2, 
  Star, 
  Shield, 
  ShieldAlert, 
  ShieldCheck, 
  ShieldQuestion,
  CheckCircle,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  Lock
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";

interface ReviewSource {
  source: string;
  reviews: string[];
  rating?: number;
  reviewCount?: number;
}

interface DealerAnalysis {
  dealerName: string;
  overallTrustScore: number;
  trustLevel: "high" | "medium" | "low" | "unknown";
  summary: string;
  sources: ReviewSource[];
  redFlags: string[];
  positives: string[];
}

interface DealerReviewProps {
  dealerName?: string;
  listingUrl?: string;
  sellerType?: string;
  isPro: boolean;
  onAnalysisComplete?: (analysis: DealerAnalysis | null) => void;
}

export function DealerReview({ dealerName, listingUrl, sellerType, isPro, onAnalysisComplete }: DealerReviewProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [analysis, setAnalysis] = useState<DealerAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchDealerReview = async () => {
    if (!dealerName && !listingUrl) {
      setError("No dealer information available");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke("analyze-dealer", {
        body: { dealerName, listingUrl, sellerType },
      });

      if (invokeError) {
        throw new Error(invokeError.message);
      }

      if (data?.success) {
        setAnalysis(data.analysis);
        onAnalysisComplete?.(data.analysis);
      } else {
        throw new Error(data?.error || "Failed to analyze dealer");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch dealer review";
      onAnalysisComplete?.(null);
      setError(message);
      toast({
        title: "Dealer Review Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isPro && (dealerName || listingUrl)) {
      fetchDealerReview();
    }
  }, [isPro, dealerName, listingUrl]);

  // Non-Pro user view
  if (!isPro) {
    return (
      <Card className="border-2 border-dashed border-primary/30 bg-primary/5">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            <CardTitle>Dealer Trust Analysis</CardTitle>
          </div>
          <CardDescription>Pro feature</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            Get comprehensive dealer reviews from Google, AutoTrader, and CarGurus with AI-powered trust analysis.
          </p>
          <Button asChild size="sm" className="w-full">
            <Link to="/pricing">
              Upgrade to Pro
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <CardTitle>Dealer Trust Analysis</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error && !analysis) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <CardTitle>Dealer Trust Analysis</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">{error}</p>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchDealerReview}
            className="w-full"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry Analysis
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!analysis) return null;

  const trustLevelConfig = {
    high: {
      icon: ShieldCheck,
      color: "text-success",
      bgColor: "bg-success/10",
      badgeColor: "bg-success text-success-foreground",
      label: "Highly Trusted",
    },
    medium: {
      icon: Shield,
      color: "text-warning",
      bgColor: "bg-warning/10",
      badgeColor: "bg-warning text-warning-foreground",
      label: "Moderate Trust",
    },
    low: {
      icon: ShieldAlert,
      color: "text-destructive",
      bgColor: "bg-destructive/10",
      badgeColor: "bg-destructive text-destructive-foreground",
      label: "Low Trust",
    },
    unknown: {
      icon: ShieldQuestion,
      color: "text-muted-foreground",
      bgColor: "bg-muted",
      badgeColor: "bg-muted text-muted-foreground",
      label: "Limited Data",
    },
  };

  const config = trustLevelConfig[analysis.trustLevel];
  const TrustIcon = config.icon;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <CardTitle>Dealer Trust Analysis</CardTitle>
          </div>
          <Badge variant="secondary" className="text-xs">
            PRO
          </Badge>
        </div>
        <CardDescription className="line-clamp-1">
          {analysis.dealerName}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Trust Score */}
        <div className="flex items-center gap-4">
          <div className={cn("flex h-14 w-14 items-center justify-center rounded-full", config.bgColor)}>
            <TrustIcon className={cn("h-7 w-7", config.color)} />
          </div>
          <div className="flex-1">
            <div className="mb-1 flex items-center justify-between">
              <Badge className={config.badgeColor}>{config.label}</Badge>
              <span className="text-lg font-bold">{analysis.overallTrustScore}/100</span>
            </div>
            <Progress value={analysis.overallTrustScore} className="h-2" />
          </div>
        </div>

        {/* Summary */}
        <p className="text-sm text-muted-foreground">{analysis.summary}</p>

        {/* Positives */}
        {analysis.positives.length > 0 && (
          <div>
            <h4 className="mb-2 flex items-center gap-1 text-sm font-medium text-success">
              <CheckCircle className="h-4 w-4" />
              Positives
            </h4>
            <ul className="space-y-1">
              {analysis.positives.slice(0, 3).map((item, i) => (
                <li key={i} className="text-xs text-muted-foreground">• {item}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Red Flags */}
        {analysis.redFlags.length > 0 && (
          <div>
            <h4 className="mb-2 flex items-center gap-1 text-sm font-medium text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Red Flags
            </h4>
            <ul className="space-y-1">
              {analysis.redFlags.slice(0, 3).map((item, i) => (
                <li key={i} className="text-xs text-muted-foreground">• {item}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Sources */}
        <div className="flex flex-wrap gap-2 border-t pt-3">
          <span className="text-xs text-muted-foreground">Sources:</span>
          {analysis.sources.length > 0 ? (
            analysis.sources.map((source) => (
              <Badge key={source.source} variant="outline" className="text-xs">
                <Star className="mr-1 h-3 w-3" />
                {source.source}
              </Badge>
            ))
          ) : (
            <span className="text-xs text-muted-foreground">Limited data available</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
