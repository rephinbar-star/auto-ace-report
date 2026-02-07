import { useState, useEffect } from "react";
import { Shield, ShieldCheck, ShieldAlert, Loader2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface DealerTrustPreviewProps {
  dealerName: string;
  isPro: boolean;
}

interface TrustPreview {
  trustScore: number;
  sentiment: "positive" | "mixed" | "negative" | "unknown";
  quickSummary: string;
}

export function DealerTrustPreview({ dealerName, isPro }: DealerTrustPreviewProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<TrustPreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dealerName || dealerName.length < 3 || !isPro) {
      setPreview(null);
      setError(null);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: fnError } = await supabase.functions.invoke("analyze-dealer", {
          body: { dealerName },
        });

        if (fnError) throw fnError;

        if (data?.analysis) {
          setPreview({
            trustScore: data.analysis.trustScore,
            sentiment: data.analysis.sentiment,
            quickSummary: data.analysis.summary?.slice(0, 100) + (data.analysis.summary?.length > 100 ? "..." : ""),
          });
        }
      } catch (err) {
        console.error("Failed to fetch dealer preview:", err);
        setError("Could not analyze dealer");
      } finally {
        setLoading(false);
      }
    }, 800); // Debounce

    return () => clearTimeout(timeoutId);
  }, [dealerName, isPro]);

  if (!isPro) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30 p-3 text-sm text-muted-foreground">
        <Shield className="h-4 w-4" />
        <span>Dealer trust analysis available with Pro</span>
        <Button 
          variant="secondary" 
          size="sm" 
          className="ml-auto text-xs"
          onClick={() => navigate("/pricing")}
        >
          <Sparkles className="mr-1 h-3 w-3" />
          Upgrade
        </Button>
      </div>
    );
  }

  if (!dealerName || dealerName.length < 3) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-3 text-sm">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span className="text-muted-foreground">Analyzing dealer reputation...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
        <ShieldAlert className="h-4 w-4" />
        <span>{error}</span>
      </div>
    );
  }

  if (!preview) {
    return null;
  }

  const getScoreColor = (score: number) => {
    if (score >= 70) return "text-green-600 dark:text-green-400";
    if (score >= 50) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getSentimentBadge = (sentiment: string) => {
    switch (sentiment) {
      case "positive":
        return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">Trusted</Badge>;
      case "mixed":
        return <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30">Mixed</Badge>;
      case "negative":
        return <Badge variant="destructive" className="bg-destructive/10 text-destructive border-destructive/30">Caution</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-3 rounded-lg border bg-card p-3 cursor-help transition-colors hover:bg-muted/50">
            <div className="flex items-center gap-2">
              <ShieldCheck className={`h-5 w-5 ${getScoreColor(preview.trustScore)}`} />
              <span className={`text-lg font-bold ${getScoreColor(preview.trustScore)}`}>
                {preview.trustScore}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{dealerName}</p>
              <p className="text-xs text-muted-foreground truncate">{preview.quickSummary}</p>
            </div>
            {getSentimentBadge(preview.sentiment)}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="text-sm">Full dealer analysis will be available in your report</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
