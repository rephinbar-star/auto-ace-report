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
                Advanced assumptions for purchase estimates
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4">
              <div className="rounded-xl border bg-card/50 p-4">
                <p className="mb-4 text-sm text-muted-foreground">
                  These assumptions are used only when a listing has no advertised finance
                  payment. Estimates are calculated before taxes and fees.
                </p>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="bd-term">Loan term</Label>
                    <Select
                      value={String(value.termMonths)}
                      onValueChange={(v) =>
                        set("termMonths", Number(v) as BestDealSearchParams["termMonths"])
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
                      value={value.aprPercent}
                      onChange={(e) => set("aprPercent", numeric(e.target.value) ?? 0)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bd-down">Down payment ($)</Label>
                    <Input
                      id="bd-down"
                      inputMode="numeric"
                      value={value.downPayment}
                      onChange={(e) => set("downPayment", numeric(e.target.value) ?? 0)}
                    />
                  </div>
                </div>
              </div>
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
