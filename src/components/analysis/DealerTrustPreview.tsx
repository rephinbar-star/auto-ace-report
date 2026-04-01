import { Shield, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface DealerTrustPreviewProps {
  dealerName: string;
  isPro: boolean;
}

export function DealerTrustPreview({ dealerName, isPro }: DealerTrustPreviewProps) {
  const navigate = useNavigate();

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

  return (
    <div className="flex items-center gap-2 rounded-lg border bg-card p-3 text-sm">
      <ShieldCheck className="h-4 w-4 text-primary" />
      <span className="text-muted-foreground">
        Dealer trust analysis for <span className="font-medium text-foreground">{dealerName}</span> will be included in your report
      </span>
    </div>
  );
}
