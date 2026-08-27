import { useState } from "react";
import { ChevronDown, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type {
  BestDealSearchParams,
  LeaseAssumptions,
  PurchaseAssumptions,
} from "@/types/best-deal";
import { LEASE_TERM_CHOICES, validateLeaseAssumptions } from "@/lib/best-deal/deal-math";

const BRANDS = [
  "Acura", "Audi", "BMW", "Buick", "Cadillac", "Chevrolet", "Chrysler", "Dodge",
  "Ford", "Genesis", "GMC", "Honda", "Hyundai", "Infiniti", "Jaguar", "Jeep",
  "Kia", "Land Rover", "Lexus", "Lincoln", "Mazda", "Mercedes-Benz", "MINI",
  "Mitsubishi", "Nissan", "Polestar", "Porsche", "Ram", "Rivian", "Subaru",
  "Tesla", "Toyota", "Volkswagen", "Volvo",
];

interface Props {
  value: BestDealSearchParams;
  onChange: (next: BestDealSearchParams) => void;
  onSubmit: () => void;
  loading: boolean;
}

export function BestDealSearchForm({ value, onChange, onSubmit, loading }: Props) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [zipError, setZipError] = useState<string | null>(null);
  const [leaseErrors, setLeaseErrors] = useState<Record<string, string>>({});

  const set = <K extends keyof BestDealSearchParams>(
    key: K,
    next: BestDealSearchParams[K]
  ) => onChange({ ...value, [key]: next });

  const setLease = <K extends keyof LeaseAssumptions>(key: K, next: LeaseAssumptions[K]) =>
    onChange({ ...value, leaseAssumptions: { ...value.leaseAssumptions, [key]: next } });

  const setPurchase = <K extends keyof PurchaseAssumptions>(
    key: K,
    next: PurchaseAssumptions[K]
  ) => onChange({ ...value, purchaseAssumptions: { ...value.purchaseAssumptions, [key]: next } });

  const numeric = (raw: string): number | null => {
    const cleaned = raw.replace(/[^0-9.]/g, "");
    if (!cleaned) return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{5}$/.test(value.zip)) {
      setZipError("Enter a five-digit ZIP code.");
      return;
    }
    setZipError(null);
    const errors =
      value.dealType === "purchase" ? {} : validateLeaseAssumptions(value.leaseAssumptions);
    setLeaseErrors(errors);
    if (Object.keys(errors).length > 0) {
      setAdvancedOpen(true);
      return;
    }
    onSubmit();
  };

  const showMileage = value.dealType === "lease" || value.dealType === "any";
  const showLeaseAssumptions = value.dealType === "lease" || value.dealType === "any";
  const showPurchaseAssumptions = value.dealType === "purchase" || value.dealType === "any";
  const fieldError = (key: string) =>
    leaseErrors[key] ? (
      <p className="text-xs text-destructive" role="alert">
        {leaseErrors[key]}
      </p>
    ) : null;

  return (
    <Card className="border-2 bg-gradient-card shadow-card">
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="bd-zip">
                ZIP code <span className="text-destructive">*</span>
              </Label>
              <Input
                id="bd-zip"
                inputMode="numeric"
                placeholder="92011"
                maxLength={5}
                value={value.zip}
                aria-invalid={Boolean(zipError)}
                aria-describedby={zipError ? "bd-zip-error" : undefined}
                onChange={(e) => set("zip", e.target.value.replace(/\D/g, "").slice(0, 5))}
              />
              {zipError && (
                <p id="bd-zip-error" className="text-xs text-destructive">
                  {zipError}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="bd-radius">Radius</Label>
              <Select
                value={String(value.radius)}
                onValueChange={(v) => set("radius", Number(v) as BestDealSearchParams["radius"])}
              >
                <SelectTrigger id="bd-radius">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25 miles</SelectItem>
                  <SelectItem value="50">50 miles</SelectItem>
                  <SelectItem value="100">100 miles</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bd-dealtype">Deal type</Label>
              <Select
                value={value.dealType}
                onValueChange={(v) => set("dealType", v as BestDealSearchParams["dealType"])}
              >
                <SelectTrigger id="bd-dealtype">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Lease + Purchase</SelectItem>
                  <SelectItem value="lease">Lease</SelectItem>
                  <SelectItem value="purchase">Purchase</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bd-max-monthly">Maximum monthly payment</Label>
              <Input
                id="bd-max-monthly"
                inputMode="numeric"
                placeholder="Any"
                value={value.maxMonthlyPayment ?? ""}
                onChange={(e) => set("maxMonthlyPayment", numeric(e.target.value))}
              />
            </div>

            {showMileage && (
              <div className="space-y-2">
                <Label htmlFor="bd-mileage">Annual mileage (lease)</Label>
                <Select
                  value={value.annualMileage}
                  onValueChange={(v) =>
                    set("annualMileage", v as BestDealSearchParams["annualMileage"])
                  }
                >
                  <SelectTrigger id="bd-mileage">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any</SelectItem>
                    <SelectItem value="7500">7,500 mi/yr</SelectItem>
                    <SelectItem value="10000">10,000 mi/yr</SelectItem>
                    <SelectItem value="12000">12,000 mi/yr</SelectItem>
                    <SelectItem value="15000">15,000 mi/yr</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="bd-due">Maximum due at signing</Label>
              <Input
                id="bd-due"
                inputMode="numeric"
                placeholder="Any"
                value={value.maxDueAtSigning ?? ""}
                onChange={(e) => set("maxDueAtSigning", numeric(e.target.value))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bd-vehicle-type">Vehicle type</Label>
              <Select
                value={value.vehicleType}
                onValueChange={(v) => set("vehicleType", v as BestDealSearchParams["vehicleType"])}
              >
                <SelectTrigger id="bd-vehicle-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="sedan">Sedan</SelectItem>
                  <SelectItem value="truck">Truck</SelectItem>
                  <SelectItem value="suv">SUV</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bd-powertrain">Powertrain</Label>
              <Select
                value={value.powertrain}
                onValueChange={(v) => set("powertrain", v as BestDealSearchParams["powertrain"])}
              >
                <SelectTrigger id="bd-powertrain">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="ev">EV</SelectItem>
                  <SelectItem value="hybrid">Hybrid</SelectItem>
                  <SelectItem value="gas">Gas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bd-brand">Brand</Label>
              <Select
                value={value.brand ?? "any"}
                onValueChange={(v) => set("brand", v === "any" ? null : v)}
              >
                <SelectTrigger id="bd-brand">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="any">Any brand</SelectItem>
                  {BRANDS.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" className="-ml-3 text-sm">
                <ChevronDown
                  className={cn("mr-2 h-4 w-4 transition-transform", advancedOpen && "rotate-180")}
                />
                Advanced assumptions
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-4">
              {showLeaseAssumptions && (
                <div className="rounded-xl border bg-card/50 p-4" data-testid="lease-assumptions">
                  <h3 className="text-sm font-semibold text-foreground">Lease assumptions</h3>
                  <p className="mb-4 mt-1 text-sm text-muted-foreground">
                    Money factor and residual value are lender/program inputs — CarWise never
                    guesses them. Advertised lease offers are still ranked from their published
                    terms without these optional fields.
                  </p>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="bd-lease-term">Preferred lease term</Label>
                      <Select
                        value={String(value.leaseAssumptions.termMonths)}
                        onValueChange={(v) =>
                          setLease("termMonths", Number(v) as LeaseAssumptions["termMonths"])
                        }
                      >
                        <SelectTrigger id="bd-lease-term">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LEASE_TERM_CHOICES.map((t) => (
                            <SelectItem key={t} value={String(t)}>
                              {t} months
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {fieldError("termMonths")}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bd-cap-reduction">Cap-cost reduction / cash down ($)</Label>
                      <Input
                        id="bd-cap-reduction"
                        inputMode="numeric"
                        value={value.leaseAssumptions.capCostReduction}
                        aria-invalid={Boolean(leaseErrors.capCostReduction)}
                        onChange={(e) =>
                          setLease("capCostReduction", numeric(e.target.value) ?? 0)
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        Cash applied to reduce the lease balance. This is not the same as your
                        Maximum due at signing search limit.
                      </p>
                      {fieldError("capCostReduction")}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bd-money-factor">Money factor (optional)</Label>
                      <Input
                        id="bd-money-factor"
                        inputMode="decimal"
                        placeholder="0.00125"
                        value={value.leaseAssumptions.moneyFactor ?? ""}
                        aria-invalid={Boolean(leaseErrors.moneyFactor)}
                        onChange={(e) => setLease("moneyFactor", numeric(e.target.value))}
                      />
                      {fieldError("moneyFactor")}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bd-residual">Residual value (% of MSRP, optional)</Label>
                      <Input
                        id="bd-residual"
                        inputMode="decimal"
                        placeholder="58"
                        value={value.leaseAssumptions.residualPercent ?? ""}
                        aria-invalid={Boolean(leaseErrors.residualPercent)}
                        onChange={(e) => setLease("residualPercent", numeric(e.target.value))}
                      />
                      {fieldError("residualPercent")}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bd-acq-fee">Acquisition fee ($, optional)</Label>
                      <Input
                        id="bd-acq-fee"
                        inputMode="numeric"
                        value={value.leaseAssumptions.acquisitionFee}
                        aria-invalid={Boolean(leaseErrors.acquisitionFee)}
                        onChange={(e) => setLease("acquisitionFee", numeric(e.target.value) ?? 0)}
                      />
                      {fieldError("acquisitionFee")}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bd-lease-tax">Lease sales-tax rate (%, optional)</Label>
                      <Input
                        id="bd-lease-tax"
                        inputMode="decimal"
                        placeholder="Leave blank for pre-tax"
                        value={value.leaseAssumptions.salesTaxPercent ?? ""}
                        aria-invalid={Boolean(leaseErrors.salesTaxPercent)}
                        onChange={(e) => setLease("salesTaxPercent", numeric(e.target.value))}
                      />
                      <p className="text-xs text-muted-foreground">
                        If blank, any calculated lease payment is labeled pre-tax.
                      </p>
                      {fieldError("salesTaxPercent")}
                    </div>
                  </div>
                </div>
              )}

              {showPurchaseAssumptions && (
                <div
                  className="rounded-xl border bg-card/50 p-4"
                  data-testid="purchase-assumptions"
                >
                  <h3 className="text-sm font-semibold text-foreground">Purchase assumptions</h3>
                  <p className="mb-4 mt-1 text-sm text-muted-foreground">
                    These assumptions are used only when a listing has no advertised finance
                    payment. Computed payments are labeled CarWise estimates before taxes and fees.
                  </p>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="bd-term">Finance term</Label>
                      <Select
                        value={String(value.purchaseAssumptions.termMonths)}
                        onValueChange={(v) =>
                          setPurchase("termMonths", Number(v) as PurchaseAssumptions["termMonths"])
                        }
                      >
                        <SelectTrigger id="bd-term">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[48, 60, 72, 84].map((t) => (
                            <SelectItem key={t} value={String(t)}>
                              {t} months
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bd-apr">APR (%)</Label>
                      <Input
                        id="bd-apr"
                        inputMode="decimal"
                        value={value.purchaseAssumptions.aprPercent}
                        onChange={(e) => setPurchase("aprPercent", numeric(e.target.value) ?? 0)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bd-down">Down payment ($)</Label>
                      <Input
                        id="bd-down"
                        inputMode="numeric"
                        value={value.purchaseAssumptions.downPayment}
                        onChange={(e) => setPurchase("downPayment", numeric(e.target.value) ?? 0)}
                      />
                    </div>
                  </div>
                </div>
              )}
            </CollapsibleContent>

          </Collapsible>

          <div className="sticky bottom-4 z-10 lg:static">
            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Searching live inventory…
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Search deals
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
