import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Download, Loader2, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { generateCheatSheetPDF } from "@/lib/generateCheatSheetPDF";

interface DeductionItem {
  reason: string;
  amount: number;
}

interface CheatSheetSection {
  header: string;
  bullets: string[];
}

interface CheatSheetResult {
  sections: CheatSheetSection[];
  deductionTable: DeductionItem[];
  targetOfferPrice: number;
  basePrice: number;
  floorPrice: number;
  vehicleLabel: string;
  askingPrice: number;
}

interface NegotiationCheatSheetProps {
  isPaid: boolean;
  // Vehicle
  year: number;
  make: string;
  model: string;
  trim?: string;
  mileage: number;
  askingPrice: number;
  condition: string;
  sellerType: string;
  // Pricing
  fairMarketPrivate: number;
  fairMarketDealer?: number;
  fairMarketTradeIn: number;
  dealRating: string;
  priceDifference: number;
  // History
  accidentCount: number;
  ownerCount: number;
  titleStatus: string;
  serviceGapMiles?: number | null;
  majorServicesDue?: string[];
  chronicRepairSystems?: string[];
  // Risk
  reliabilityConcerns?: Array<{ concern: string; costLow?: number | null; costHigh?: number | null }>;
  openRecallCount: number;
  recallDetails?: string;
  verdict: string;
  fairOfferPrice: number;
  // AI Findings
  activeFaults?: Array<{ system: string; costLow: number }>;
  failurePatterns?: Array<{ issue: string; probability: string; costLow: number }>;
  overdueMaintenanceItems?: Array<{ item: string; cost: number }>;
  batteryUnverified?: boolean;
  odometerDiscrepancy?: boolean;
  // TCO
  tcoRange?: { low: number; high: number };
  financingType?: string;
}

export function NegotiationCheatSheet(props: NegotiationCheatSheetProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<CheatSheetResult | null>(null);

  const handleGenerate = async () => {
    if (!props.isPaid) {
      toast.error("Upgrade to Premium or Pro to access the Negotiation Cheat Sheet.");
      return;
    }

    setOpen(true);
    if (result) return; // Already generated

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-cheat-sheet", {
        body: {
          year: props.year,
          make: props.make,
          model: props.model,
          trim: props.trim,
          mileage: props.mileage,
          askingPrice: props.askingPrice,
          condition: props.condition,
          sellerType: props.sellerType,
          fairMarketPrivate: props.fairMarketPrivate,
          fairMarketDealer: props.fairMarketDealer,
          fairMarketTradeIn: props.fairMarketTradeIn,
          dealRating: props.dealRating,
          priceDifference: props.priceDifference,
          accidentCount: props.accidentCount,
          ownerCount: props.ownerCount,
          titleStatus: props.titleStatus,
          serviceGapMiles: props.serviceGapMiles,
          majorServicesDue: props.majorServicesDue,
          chronicRepairSystems: props.chronicRepairSystems,
          reliabilityConcerns: props.reliabilityConcerns,
          openRecallCount: props.openRecallCount,
          recallDetails: props.recallDetails,
          verdict: props.verdict,
          fairOfferPrice: props.fairOfferPrice,
          activeFaults: props.activeFaults,
          failurePatterns: props.failurePatterns,
          overdueMaintenanceItems: props.overdueMaintenanceItems,
          batteryUnverified: props.batteryUnverified,
          odometerDiscrepancy: props.odometerDiscrepancy,
          tcoRange: props.tcoRange,
          financingType: props.financingType,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setResult(data as CheatSheetResult);
    } catch (err) {
      console.error("Cheat sheet generation error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to generate cheat sheet");
      setOpen(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!result) return;
    generateCheatSheetPDF(result);
    toast.success("PDF downloaded!");
  };

  return (
    <>
      <Button
        onClick={handleGenerate}
        variant="outline"
        className="w-full border-2 border-primary/30 hover:border-primary/60"
        disabled={isLoading}
      >
        {!props.isPaid ? (
          <>
            <Lock className="mr-2 h-4 w-4" />
            Negotiation Cheat Sheet (Premium)
          </>
        ) : isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <FileText className="mr-2 h-4 w-4" />
            Negotiation Cheat Sheet
          </>
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">Buyer Negotiation Brief</DialogTitle>
            <DialogDescription>
              {result ? `${result.vehicleLabel} • Asking: $${result.askingPrice.toLocaleString()}` : "Generating your negotiation document..."}
            </DialogDescription>
          </DialogHeader>

          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Analyzing data and building your negotiation brief...</p>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              {/* Sections */}
              {result.sections.slice(0, 5).map((section, i) => (
                <div key={i}>
                  <h3 className="text-sm font-bold uppercase tracking-wide text-foreground mb-1">{section.header}</h3>
                  <ul className="space-y-1">
                    {section.bullets.map((bullet, j) => (
                      <li key={j} className="text-sm text-muted-foreground flex gap-2">
                        <span className="shrink-0">•</span>
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}

              {/* Deduction Table */}
              <Card>
                <CardContent className="p-4">
                  <h3 className="text-sm font-bold uppercase tracking-wide mb-2">Price Adjustment Breakdown</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Item</TableHead>
                        <TableHead className="text-xs text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="text-sm">Fair Market Value (base)</TableCell>
                        <TableCell className="text-sm text-right font-medium">${result.basePrice.toLocaleString()}</TableCell>
                      </TableRow>
                      {result.deductionTable.map((d, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-sm">{d.reason}</TableCell>
                          <TableCell className="text-sm text-right text-destructive font-medium">-${d.amount.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <div className="flex items-center justify-between mt-3 pt-3 border-t">
                    <div>
                      <p className="text-lg font-bold">Target Offer Price</p>
                      <p className="text-xs text-muted-foreground">Floor: ${result.floorPrice.toLocaleString()} (trade-in) • Rounded to $250</p>
                    </div>
                    <Badge className="text-xl px-4 py-2 bg-primary text-primary-foreground">
                      ${result.targetOfferPrice.toLocaleString()}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* 6th section — Our Offer justification */}
              {result.sections[5] && (
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wide text-foreground mb-1">{result.sections[5].header}</h3>
                  <ul className="space-y-1">
                    {result.sections[5].bullets.map((bullet, j) => (
                      <li key={j} className="text-sm text-muted-foreground flex gap-2">
                        <span className="shrink-0">•</span>
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Download */}
              <Button onClick={handleDownloadPDF} className="w-full">
                <Download className="mr-2 h-4 w-4" />
                Download PDF
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                This document is for informational purposes. Pricing estimates are based on publicly available market data.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
