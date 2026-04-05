import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreditCard, Banknote, Car, Calculator, Tag, BadgePercent, MapPin, Loader2 } from "lucide-react";
import { FinancingInfo } from "@/types/vehicle";
import { STATE_TAX_DATA, getCountiesForState, getCountyRate, getStateCombinedRate, getStateFromZip, getCountyFromZip, CountyTax } from "@/lib/sales-tax-data";

const normalizeCountyName = (value: string) =>
  value.toLowerCase().replace(/\s*(county|parish|borough|census area)\s*/g, "").trim();

const matchCountyName = (counties: CountyTax[], countyName: string) =>
  counties.find((county) => normalizeCountyName(county.name) === normalizeCountyName(countyName));

const loanSchema = z.object({
  askingPrice: z.coerce.number().min(1, "Asking price is required"),
  salesPrice: z.coerce.number().min(1, "Negotiated price is required"),
  salesTaxRate: z.coerce.number().min(0).max(20),
  fees: z.coerce.number().min(0),
  downPayment: z.coerce.number().min(0),
  amountFinanced: z.coerce.number().min(0),
  loanTerm: z.coerce.number().min(12).max(84),
  apr: z.coerce.number().min(0).max(30),
});

const leaseSchema = z.object({
  monthlyPayment: z.coerce.number().min(1, "Payment is required"),
  leaseTermMonths: z.coerce.number().min(12).max(60),
  mileageAllowance: z.coerce.number().min(5000).max(20000),
  residualValue: z.coerce.number().min(0),
  monthsRemaining: z.coerce.number().optional(),
  currentMileage: z.coerce.number().optional(),
});

interface FinancingStepProps {
  onComplete: (financing: FinancingInfo) => void;
  onBack: () => void;
  askingPrice: number;
  zipCode?: string;
}

export function FinancingStep({ onComplete, onBack, askingPrice, zipCode }: FinancingStepProps) {
  const [showForm, setShowForm] = useState(false);
  const [countyLookupLoading, setCountyLookupLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("loan");
  const [selectedState, setSelectedState] = useState<string>("");
  const [zipAutoFilled, setZipAutoFilled] = useState<boolean>(false);
  const [selectedCounty, setSelectedCounty] = useState<string>("");
  const [availableCounties, setAvailableCounties] = useState<CountyTax[]>([]);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [detectedZip, setDetectedZip] = useState<string | null>(null);
  const effectiveZip = zipCode?.replace(/\D/g, "").slice(0, 5) || detectedZip?.replace(/\D/g, "").slice(0, 5) || "";

  // Track whether county was set by auto-fill (ZIP/geo) to avoid clearing it
  const countySetByAutoRef = useRef(false);

  // Geolocation-based ZIP detection for sales tax auto-fill
  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setGeoError("Geolocation not supported by your browser.");
      return;
    }
    setGeoLoading(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${coords.latitude}&lon=${coords.longitude}&format=json`,
            { headers: { "Accept-Language": "en", "User-Agent": "CarWise/1.0 (https://carwise.expert)" } }
          );
          if (!res.ok) throw new Error(`Nominatim returned ${res.status}`);
          const data = await res.json();
          const zip = data?.address?.postcode?.replace(/\D/g, "").substring(0, 5);
          if (zip && zip.length === 5) {
            setDetectedZip(zip);
            setZipAutoFilled(true);
          } else {
            setGeoError("Couldn't determine ZIP from location.");
          }
        } catch {
          setGeoError("Location lookup failed.");
        } finally {
          setGeoLoading(false);
        }
      },
      () => {
        setGeoError("Location access denied.");
        setGeoLoading(false);
      },
      { timeout: 8000 }
    );
  };

  // Auto-trigger geolocation if no ZIP was provided from the condition step
  const geoTriggeredRef = useRef(false);
  useEffect(() => {
    if (!zipCode && !geoTriggeredRef.current && navigator.geolocation) {
      geoTriggeredRef.current = true;
      handleDetectLocation();
    }
  }, [zipCode]);

  const loanForm = useForm<z.infer<typeof loanSchema>>({
    resolver: zodResolver(loanSchema),
    defaultValues: {
      askingPrice: askingPrice,
      salesPrice: askingPrice,
      salesTaxRate: 0,
      fees: 0,
      downPayment: 0,
      amountFinanced: askingPrice,
      loanTerm: 60,
      apr: 7.0,
    },
  });

  // Sync askingPrice prop into form when it changes (e.g. from listing import)
  useEffect(() => {
    if (!askingPrice) return;
    const currentAsking = loanForm.getValues("askingPrice");
    const currentNegotiated = loanForm.getValues("salesPrice");
    loanForm.setValue("askingPrice", askingPrice);
    // Only update negotiated price if it still mirrors the old asking price (user hasn't touched it)
    if (!currentAsking || currentNegotiated === currentAsking) {
      loanForm.setValue("salesPrice", askingPrice);
    }
  }, [askingPrice]);

  // Auto-select state AND county from ZIP/geolocation using one shared lookup path
  useEffect(() => {
    if (effectiveZip.length !== 5) return;

    const stateAbbr = getStateFromZip(effectiveZip);
    if (!stateAbbr) return;

    const counties = getCountiesForState(stateAbbr);
    countySetByAutoRef.current = true;
    setSelectedState(stateAbbr);
    setAvailableCounties(counties);
    setZipAutoFilled(true);

    const staticCounty = getCountyFromZip(effectiveZip);
    if (staticCounty) {
      const matched = matchCountyName(counties, staticCounty);
      if (matched) {
        setSelectedCounty(matched.name);
        setCountyLookupLoading(false);
        return;
      }
    }

    setSelectedCounty("");
    setCountyLookupLoading(true);
    fetch(
      `https://nominatim.openstreetmap.org/search?postalcode=${effectiveZip}&country=US&format=json&addressdetails=1&limit=1`,
      { headers: { "Accept-Language": "en", "User-Agent": "CarWise/1.0 (https://carwise.expert)" } }
    )
      .then((r) => r.json())
      .then((results) => {
        const addr = results?.[0]?.address;
        if (!addr) return;

        const countyRaw: string = addr.county || addr.state_district || "";
        if (!countyRaw) return;

        const matched = matchCountyName(counties, countyRaw);

        if (matched) {
          setSelectedCounty(matched.name);
        }
      })
      .catch(() => {
        // Silently fall back to state-level rate
      })
      .finally(() => setCountyLookupLoading(false));
  }, [effectiveZip]);

  // Update counties when state changes
  useEffect(() => {
    if (selectedState) {
      const counties = getCountiesForState(selectedState);
      setAvailableCounties(counties);
      // Only reset county if it wasn't just set by auto-fill
      if (!countySetByAutoRef.current) {
        setSelectedCounty("");
        // Default to state-only rate until county is chosen
        const stateData = STATE_TAX_DATA.find(s => s.abbreviation === selectedState);
        const rate = stateData ? stateData.stateRate + stateData.avgLocalRate : 0;
        loanForm.setValue("salesTaxRate", parseFloat(rate.toFixed(3)));
      }
      countySetByAutoRef.current = false;
      // If county was auto-set, trigger county rate immediately
      if (selectedCounty) {
        const rate = getCountyRate(selectedState, selectedCounty);
        loanForm.setValue("salesTaxRate", parseFloat(rate.toFixed(3)));
      }
    } else {
      setAvailableCounties([]);
      setSelectedCounty("");
      loanForm.setValue("salesTaxRate", 0);
    }
  }, [selectedState]);

  // Update tax rate when county changes
  useEffect(() => {
    if (!selectedState) return;
    if (selectedCounty) {
      const rate = getCountyRate(selectedState, selectedCounty);
      loanForm.setValue("salesTaxRate", parseFloat(rate.toFixed(3)));
    } else {
      // County cleared — fall back to combined state + avg local rate
      const stateData = STATE_TAX_DATA.find(s => s.abbreviation === selectedState);
      const rate = stateData ? stateData.stateRate + stateData.avgLocalRate : 0;
      loanForm.setValue("salesTaxRate", parseFloat(rate.toFixed(3)));
    }
  }, [selectedCounty]);

  // Watch loan fields for auto-calculation
  const askingPriceVal = Number(loanForm.watch("askingPrice") || 0);
  const salesPrice = Number(loanForm.watch("salesPrice") || 0);
  const salesTaxRate = Number(loanForm.watch("salesTaxRate") || 0);
  const fees = Number(loanForm.watch("fees") || 0);
  const downPayment = Number(loanForm.watch("downPayment") || 0);

  // Discount calculation
  const savingsAmount = askingPriceVal > 0 ? parseFloat((askingPriceVal - salesPrice).toFixed(2)) : 0;
  const discountPct = askingPriceVal > 0 ? parseFloat(((savingsAmount / askingPriceVal) * 100).toFixed(1)) : 0;

  // Calculate sales tax amount from rate (rounded to 2 decimal places)
  const salesTaxAmount = parseFloat(((salesPrice || 0) * ((salesTaxRate || 0) / 100)).toFixed(2));

  // Auto-calculate amount financed when inputs change
  useEffect(() => {
    const calculated = parseFloat(((salesPrice || 0) + salesTaxAmount + (fees || 0) - (downPayment || 0)).toFixed(2));
    const currentAmountFinanced = loanForm.getValues("amountFinanced");
    // Only update if the calculated value differs significantly (user hasn't manually edited)
    if (Math.abs(calculated - currentAmountFinanced) > 0.01) {
      loanForm.setValue("amountFinanced", Math.max(0, calculated));
    }
  }, [salesPrice, salesTaxAmount, fees, downPayment]);

  const leaseForm = useForm<z.infer<typeof leaseSchema>>({
    resolver: zodResolver(leaseSchema),
    defaultValues: {
      monthlyPayment: 0,
      leaseTermMonths: 36,
      mileageAllowance: 12000,
      residualValue: 0,
    },
  });

  const handleLoanSubmit = (data: z.infer<typeof loanSchema>) => {
    const taxAmt = parseFloat(((data.salesPrice || 0) * ((data.salesTaxRate || 0) / 100)).toFixed(2));
    onComplete({
      type: "loan",
      negotiatedPrice: data.salesPrice,
      loanAmount: data.amountFinanced,
      loanTerm: data.loanTerm,
      apr: data.apr,
      fees: data.fees,
      downPayment: data.downPayment,
      salesTaxRate: data.salesTaxRate,
      salesTaxAmount: taxAmt,
    });
  };

  const handleLeaseSubmit = (data: z.infer<typeof leaseSchema>) => {
    onComplete({
      type: "lease",
      monthlyPayment: data.monthlyPayment,
      leaseTermMonths: data.leaseTermMonths,
      mileageAllowance: data.mileageAllowance,
      residualValue: data.residualValue,
      monthsRemaining: data.monthsRemaining,
      currentMileage: data.currentMileage,
    });
  };

  const [cashNegotiatedPrice, setCashNegotiatedPrice] = useState<number>(askingPrice);
  const cashSavings = askingPrice > 0 ? askingPrice - cashNegotiatedPrice : 0;
  const cashDiscountPct = askingPrice > 0 ? parseFloat(((cashSavings / askingPrice) * 100).toFixed(1)) : 0;

  // Sync cashNegotiatedPrice when askingPrice changes (listing import), unless user has edited it
  const prevAskingRef = useRef(askingPrice);
  useEffect(() => {
    if (prevAskingRef.current !== askingPrice) {
      setCashNegotiatedPrice((prev) => (prev === prevAskingRef.current ? askingPrice : prev));
      prevAskingRef.current = askingPrice;
    }
  }, [askingPrice]);

  const handleCash = () => {
    onComplete({ type: "cash", negotiatedPrice: cashNegotiatedPrice });
  };

  // Calculate monthly payment estimate for loan
  const watchedLoan = loanForm.watch();
  const estimatedMonthlyPayment = (() => {
    const P = watchedLoan.amountFinanced || 0;
    const r = (watchedLoan.apr || 0) / 100 / 12;
    const n = watchedLoan.loanTerm || 60;
    if (r === 0) return P / n;
    return (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  })();

  const handleSkip = () => {
    onComplete({ type: "cash", skipped: true });
  };

  if (!showForm) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Financing Details</h2>
          <p className="text-muted-foreground">
            Adding financing details lets us project your equity and loan balance over time.
          </p>
        </div>

        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-8">
            <CreditCard className="h-10 w-10 text-primary" />
            <div className="text-center space-y-1">
              <p className="font-medium">Do you want to enter financing details now?</p>
              <p className="text-sm text-muted-foreground">
                This helps us show your loan balance alongside depreciation projections.
              </p>
            </div>
            <div className="flex flex-col gap-3 w-full max-w-sm mt-2">
              <Button size="lg" onClick={() => setShowForm(true)}>
                Enter Financing Details Now
              </Button>
              <Button variant="ghost" size="lg" className="text-muted-foreground" onClick={handleSkip}>
                Skip For Now — You can enter later if you want
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-start">
          <Button variant="outline" onClick={onBack}>Back</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Financing Details</h2>
        <p className="text-muted-foreground">
          Enter your financing terms to calculate equity projections over time.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="loan" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Loan
          </TabsTrigger>
          <TabsTrigger value="lease" className="flex items-center gap-2">
            <Car className="h-4 w-4" />
            Lease
          </TabsTrigger>
          <TabsTrigger value="cash" className="flex items-center gap-2">
            <Banknote className="h-4 w-4" />
            Cash
          </TabsTrigger>
        </TabsList>

        {/* Loan Tab */}
        <TabsContent value="loan" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Loan Details</CardTitle>
              <CardDescription>
                Enter your auto loan terms to see how your equity changes over time.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...loanForm}>
                <form onSubmit={loanForm.handleSubmit(handleLoanSubmit)} className="space-y-6">
                  {/* Asking Price + Negotiated Price + Discount */}
                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      {/* Asking Price */}
                      <FormField
                        control={loanForm.control}
                        name="askingPrice"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-1.5">
                              <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                              Asking Price
                            </FormLabel>
                            <FormControl>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                                <Input type="number" className="pl-7" {...field} />
                              </div>
                            </FormControl>
                            <FormDescription>Dealer or seller's listed price</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Negotiated Price */}
                      <FormField
                        control={loanForm.control}
                        name="salesPrice"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-1.5">
                              <BadgePercent className="h-3.5 w-3.5 text-muted-foreground" />
                              Negotiated Price
                            </FormLabel>
                            <FormControl>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                                <Input type="number" className="pl-7" {...field} />
                              </div>
                            </FormControl>
                            <FormDescription>Agreed final sales price</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Discount summary */}
                    {askingPriceVal > 0 && salesPrice > 0 && (
                      <div className={`flex items-center justify-between rounded-lg border px-4 py-3 text-sm ${savingsAmount > 0 ? "border-green-500/30 bg-green-500/5" : savingsAmount < 0 ? "border-destructive/30 bg-destructive/5" : "border-border bg-muted/30"}`}>
                        <span className="text-muted-foreground">
                          {savingsAmount > 0 ? "Discount" : savingsAmount < 0 ? "Over asking" : "No discount"}
                        </span>
                        <div className="flex items-center gap-3">
                          <span className={`font-semibold tabular-nums ${savingsAmount > 0 ? "text-green-600 dark:text-green-400" : savingsAmount < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                            {savingsAmount !== 0 ? (savingsAmount > 0 ? "−" : "+") : ""}${Math.abs(savingsAmount).toLocaleString()}
                          </span>
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${savingsAmount > 0 ? "bg-green-500/15 text-green-700 dark:text-green-400" : savingsAmount < 0 ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground"}`}>
                            {savingsAmount > 0 ? "-" : savingsAmount < 0 ? "+" : ""}{Math.abs(discountPct)}%
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Sales Tax Calculator */}
                   <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calculator className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Sales Tax Calculator</span>
                      </div>
                      {!zipCode && !detectedZip && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleDetectLocation}
                          disabled={geoLoading}
                          className="h-7 text-xs gap-1.5"
                        >
                          {geoLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <MapPin className="h-3 w-3" />}
                          {geoLoading ? "Detecting…" : "Detect Location"}
                        </Button>
                      )}
                    </div>
                    {geoError && (
                      <p className="text-xs text-destructive">{geoError}</p>
                    )}
                    
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">State</label>
                        <Select
                          value={selectedState}
                          onValueChange={setSelectedState}
                        >
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder="Select state" />
                          </SelectTrigger>
                          <SelectContent className="bg-background max-h-[300px]">
                            {STATE_TAX_DATA.map((state) => (
                              <SelectItem key={state.abbreviation} value={state.abbreviation}>
                                {state.name} ({(state.stateRate + state.avgLocalRate).toFixed(2)}%)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {zipAutoFilled && effectiveZip && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {countyLookupLoading
                              ? "⏳ Looking up county from ZIP…"
                              : selectedCounty
                                ? `✓ County auto-detected from ZIP ${effectiveZip}`
                                : `✓ State auto-filled from ZIP ${effectiveZip}`}
                          </p>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-sm font-medium">County</label>
                        <Select
                          value={selectedCounty}
                          onValueChange={setSelectedCounty}
                          disabled={!selectedState || availableCounties.length === 0}
                        >
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder={
                              !selectedState 
                                ? "Select state first" 
                                : availableCounties.length === 0 
                                  ? "No county data" 
                                  : "Select county"
                            } />
                          </SelectTrigger>
                          <SelectContent className="bg-background max-h-[300px]">
                            {availableCounties.map((county) => {
                              const state = STATE_TAX_DATA.find(s => s.abbreviation === selectedState);
                              const totalRate = state ? state.stateRate + county.rate : county.rate;
                              return (
                                <SelectItem key={county.name} value={county.name}>
                                  {county.name} ({totalRate.toFixed(2)}%)
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t">
                      <FormField
                        control={loanForm.control}
                        name="salesTaxRate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tax Rate</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input 
                                  type="number" 
                                  step="0.01"
                                  placeholder="e.g. 8.5"
                                  {...field} 
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                                  %
                                </span>
                              </div>
                            </FormControl>
                            <FormDescription>
                              {selectedCounty ? "County rate (state + county)" : selectedState ? "State + avg local rate — select county to refine" : "Or enter manually"}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Calculated Tax</label>
                        <div className="flex h-10 items-center rounded-md border bg-muted/50 px-3">
                          <span className="text-lg font-semibold text-primary">
                            ${salesTaxAmount.toFixed(2)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Based on ${salesPrice?.toLocaleString() || 0} (negotiated) × {salesTaxRate || 0}%
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Fees */}
                  <FormField
                    control={loanForm.control}
                    name="fees"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fees (Title, Registration, Doc)</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                              $
                            </span>
                            <Input 
                              type="number" 
                              className="pl-7"
                              {...field} 
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Down Payment and Amount Financed */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={loanForm.control}
                      name="downPayment"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Down Payment</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                $
                              </span>
                              <Input 
                                type="number" 
                                className="pl-7"
                                {...field} 
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={loanForm.control}
                      name="amountFinanced"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Amount Financed</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                $
                              </span>
                              <Input 
                                type="number" 
                                step="0.01"
                                className="pl-7"
                                value={field.value || 0}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                              />
                            </div>
                          </FormControl>
                          <FormDescription>
                            Price + Tax + Fees − Down Payment
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Loan Terms */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={loanForm.control}
                      name="loanTerm"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Loan Term</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input 
                                type="number" 
                                {...field} 
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                                months
                              </span>
                            </div>
                          </FormControl>
                          <FormDescription>
                            Common terms: 36, 48, 60, 72 months
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={loanForm.control}
                      name="apr"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>APR</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input 
                                type="number" 
                                step="0.1"
                                {...field} 
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                                %
                              </span>
                            </div>
                          </FormControl>
                          <FormDescription>
                            Annual percentage rate
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Monthly payment preview */}
                  <div className="rounded-lg border bg-muted/50 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Estimated Monthly Payment:</span>
                      <span className="text-xl font-bold text-primary">
                        ${estimatedMonthlyPayment.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                      Back
                    </Button>
                    <Button type="submit">Generate Report</Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Lease Tab */}
        <TabsContent value="lease" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Lease Details</CardTitle>
              <CardDescription>
                Enter your lease terms including residual value and mileage allowance.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...leaseForm}>
                <form onSubmit={leaseForm.handleSubmit(handleLeaseSubmit)} className="space-y-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={leaseForm.control}
                      name="monthlyPayment"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Monthly Payment (incl. tax)</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                $
                              </span>
                              <Input 
                                type="number" 
                                className="pl-7"
                                {...field} 
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={leaseForm.control}
                      name="leaseTermMonths"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Lease Term</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input 
                                type="number" 
                                {...field} 
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                                months
                              </span>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={leaseForm.control}
                      name="mileageAllowance"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Annual Mileage Allowance</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input 
                                type="number" 
                                {...field} 
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                                miles/year
                              </span>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={leaseForm.control}
                      name="residualValue"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Residual Value</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                $
                              </span>
                              <Input 
                                type="number" 
                                className="pl-7"
                                {...field} 
                              />
                            </div>
                          </FormControl>
                          <FormDescription>
                            Buyout price at lease end
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={leaseForm.control}
                      name="monthsRemaining"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Months Remaining (Optional)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              placeholder="For existing leases"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={leaseForm.control}
                      name="currentMileage"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Current Mileage (Optional)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              placeholder="For existing leases"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex gap-4">
                    <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                      Back
                    </Button>
                    <Button type="submit">Generate Report</Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cash Tab */}
        <TabsContent value="cash" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Cash Purchase</CardTitle>
              <CardDescription>
                Buying with cash? We'll focus on depreciation and repair costs without loan calculations.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="rounded-lg border bg-success/5 border-success/20 p-4">
                  <p className="text-sm">
                    <strong className="text-success">Great choice!</strong> Paying cash means no interest 
                    payments and immediate full equity in your vehicle.
                  </p>
                </div>

                {/* Asking vs Negotiated Price */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-1.5">
                      <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                      Asking Price
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                      <input
                        type="number"
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 pl-7 text-sm shadow-sm transition-colors"
                        value={askingPrice}
                        readOnly
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Dealer or seller's listed price</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-1.5">
                      <BadgePercent className="h-3.5 w-3.5 text-muted-foreground" />
                      Negotiated Price
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                      <input
                        type="number"
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 pl-7 text-sm shadow-sm transition-colors"
                        value={cashNegotiatedPrice}
                        onChange={(e) => setCashNegotiatedPrice(Number(e.target.value) || askingPrice)}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Agreed final sales price</p>
                  </div>
                </div>

                {/* Discount summary */}
                {askingPrice > 0 && cashNegotiatedPrice > 0 && (
                  <div className={`flex items-center justify-between rounded-lg border px-4 py-3 text-sm ${cashSavings > 0 ? "border-green-500/30 bg-green-500/5" : cashSavings < 0 ? "border-destructive/30 bg-destructive/5" : "border-border bg-muted/30"}`}>
                    <span className="text-muted-foreground">
                      {cashSavings > 0 ? "Discount" : cashSavings < 0 ? "Over asking" : "No discount"}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className={`font-semibold tabular-nums ${cashSavings > 0 ? "text-green-600 dark:text-green-400" : cashSavings < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                        {cashSavings !== 0 ? (cashSavings > 0 ? "−" : "+") : ""}${Math.abs(cashSavings).toLocaleString()}
                      </span>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${cashSavings > 0 ? "bg-green-500/15 text-green-700 dark:text-green-400" : cashSavings < 0 ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground"}`}>
                        {cashSavings > 0 ? "-" : cashSavings < 0 ? "+" : ""}{Math.abs(cashDiscountPct)}%
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex gap-4">
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                    Back
                  </Button>
                  <Button onClick={handleCash}>Generate Report</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
