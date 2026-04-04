import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, CreditCard, Landmark, Banknote, HandCoins } from "lucide-react";
import type { FinancingInfo } from "@/types/vehicle";

interface FinancingDetailsCardProps {
  financing: FinancingInfo;
  askingPrice: number;
  onChange: (updated: FinancingInfo) => void;
}

export function FinancingDetailsCard({ financing, askingPrice, onChange }: FinancingDetailsCardProps) {
  const [local, setLocal] = useState<FinancingInfo>({ ...financing });

  useEffect(() => {
    setLocal({ ...financing });
  }, [financing]);

  const update = useCallback((patch: Partial<FinancingInfo>) => {
    const next = { ...local, ...patch };
    setLocal(next);
    onChange(next);
  }, [local, onChange]);

  const purchasePrice = local.negotiatedPrice ?? askingPrice;

  // Derived values
  const fees = local.fees || 0;
  const downPayment = local.downPayment || 0;
  const apr = local.apr || 0;
  const loanTerm = local.loanTerm || 0;

  // Principal = what's actually being financed (price + fees - down payment)
  const principal = local.type === "loan"
    ? Math.max(0, purchasePrice + fees - downPayment)
    : 0;

  // Interest Amount = total interest on the principal over the loan term
  const interestAmount = (() => {
    if (!principal || !loanTerm || apr <= 0) return 0;
    const r = (apr / 100) / 12;
    const n = loanTerm;
    const monthlyPmt = principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    return Math.round((monthlyPmt * n) - principal);
  })();

  // Total Amount Financed = principal + interest
  const totalAmountFinanced = principal + interestAmount;

  // Monthly Payment = Total Amount Financed / term
  const computedMonthlyPayment = totalAmountFinanced > 0 && loanTerm > 0
    ? Math.round(totalAmountFinanced / loanTerm)
    : null;

  // Savings banner data
  const negotiated = local.negotiatedPrice;
  const hasSavings = negotiated != null && negotiated < askingPrice;
  const saved = hasSavings ? askingPrice - negotiated! : 0;
  const savingsPct = hasSavings ? ((saved / askingPrice) * 100).toFixed(1) : "0";

  const typeIcon = local.type === "loan" ? <Landmark className="h-5 w-5 text-primary" />
    : local.type === "lease" ? <CreditCard className="h-5 w-5 text-primary" />
    : <Banknote className="h-5 w-5 text-primary" />;

  const typeLabel = local.type === "loan" ? "Auto Loan" : local.type === "lease" ? "Lease" : "Cash Purchase";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          {typeIcon}
          Financing Details
          <Badge variant="secondary" className="ml-auto text-xs font-normal">
            {typeLabel}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Financing Type Selector */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Financing Type</Label>
          <Select value={local.type} onValueChange={(v) => update({ type: v as FinancingInfo["type"] })}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="loan">Auto Loan</SelectItem>
              <SelectItem value="lease">Lease</SelectItem>
              <SelectItem value="cash">Cash</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Purchase / Negotiated Price */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            {local.type === "cash" ? "Purchase Price" : "Negotiated Price"}
          </Label>
          <div className="relative">
            <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="number"
              className="h-9 pl-8"
              value={purchasePrice || ""}
              onChange={(e) => update({ negotiatedPrice: Number(e.target.value) || undefined })}
            />
          </div>
        </div>

        {/* Savings Banner — inside the card, below negotiated price */}
        {hasSavings && (
          <div className="flex items-center gap-3 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-500/20">
              <HandCoins className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-green-700 dark:text-green-400">
                You negotiated ${saved.toLocaleString()} off the asking price
              </p>
              <p className="text-xs text-green-600/80 dark:text-green-500/80">
                Paying ${negotiated!.toLocaleString()} instead of ${askingPrice.toLocaleString()} — a {savingsPct}% discount. Deal rating and TCO reflect your negotiated price.
              </p>
            </div>
          </div>
        )}

        {/* Loan-specific fields */}
        {local.type === "loan" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              {/* 1. Loan Term */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Loan Term (months)</Label>
                <Input
                  type="number"
                  className="h-9"
                  value={local.loanTerm || ""}
                  onChange={(e) => update({ loanTerm: Number(e.target.value) || undefined })}
                />
              </div>
              {/* 2. Interest Rate */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Interest Rate (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  className="h-9"
                  value={local.apr ?? ""}
                  onChange={(e) => update({ apr: Number(e.target.value) || undefined })}
                />
              </div>
              {/* 3. Fees */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Fees (doc/title/dealer)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    type="number"
                    className="h-9 pl-8"
                    value={local.fees || ""}
                    onChange={(e) => update({ fees: Number(e.target.value) || undefined })}
                  />
                </div>
              </div>
              {/* 4. Money Down */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Money Down</Label>
                <div className="relative">
                  <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    type="number"
                    className="h-9 pl-8"
                    value={local.downPayment || ""}
                    onChange={(e) => update({ downPayment: Number(e.target.value) || undefined })}
                  />
                </div>
              </div>
              {/* 5. Interest Amount (read-only) */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Interest Amount</Label>
                <div className="flex items-center h-9 px-3 rounded-md border bg-muted/50 text-sm pointer-events-none select-none text-muted-foreground">
                  ${interestAmount.toLocaleString()}
                </div>
              </div>
              {/* 6. Total Amount Financed (read-only) */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Total Amount Financed</Label>
                <div className="flex items-center h-9 px-3 rounded-md border bg-muted/50 text-sm pointer-events-none select-none text-muted-foreground">
                  ${totalAmountFinanced.toLocaleString()}
                </div>
              </div>
              {/* 7. Payment (read-only) */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Monthly Payment</Label>
                <div className="flex items-center h-9 px-3 rounded-md border bg-muted/50 text-sm pointer-events-none select-none text-muted-foreground">
                  {computedMonthlyPayment != null ? `$${computedMonthlyPayment.toLocaleString()}` : "—"}
                </div>
              </div>
            </div>

            {/* Summary */}
            {computedMonthlyPayment != null && loanTerm > 0 && (
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">${computedMonthlyPayment.toLocaleString()}/mo</span>
                  {" "}for {loanTerm} months at {apr}% APR
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Interest: ${interestAmount.toLocaleString()}
                  {" · "}Total paid: ${totalAmountFinanced.toLocaleString()}
                </p>
              </div>
            )}
          </>
        )}

        {/* Lease-specific fields */}
        {local.type === "lease" && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Monthly Payment</Label>
              <div className="relative">
                <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="number"
                  className="h-9 pl-8"
                  value={local.monthlyPayment || ""}
                  onChange={(e) => update({ monthlyPayment: Number(e.target.value) || undefined })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Lease Term (months)</Label>
              <Input
                type="number"
                className="h-9"
                value={local.leaseTermMonths || ""}
                onChange={(e) => update({ leaseTermMonths: Number(e.target.value) || undefined })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Mileage Allowance (mi/yr)</Label>
              <Input
                type="number"
                className="h-9"
                value={local.mileageAllowance || ""}
                onChange={(e) => update({ mileageAllowance: Number(e.target.value) || undefined })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Residual Value</Label>
              <div className="relative">
                <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="number"
                  className="h-9 pl-8"
                  value={local.residualValue || ""}
                  onChange={(e) => update({ residualValue: Number(e.target.value) || undefined })}
                />
              </div>
            </div>
          </div>
        )}

        {local.type === "lease" && local.monthlyPayment && local.leaseTermMonths && (
          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">${local.monthlyPayment.toLocaleString()}/mo</span>
              {" "}for {local.leaseTermMonths} months
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Total lease cost: ${(local.monthlyPayment * local.leaseTermMonths).toLocaleString()}
            </p>
          </div>
        )}

        {local.type === "cash" && (
          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <p className="text-sm text-muted-foreground">
              Cash purchase at <span className="font-semibold text-foreground">${purchasePrice.toLocaleString()}</span>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
