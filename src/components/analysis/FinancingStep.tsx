import { useState, useEffect } from "react";
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
import { CreditCard, Banknote, Car, Calculator, Tag, BadgePercent } from "lucide-react";
import { FinancingInfo } from "@/types/vehicle";
import { STATE_TAX_DATA, getCountiesForState, getCountyRate, getStateCombinedRate, CountyTax } from "@/lib/sales-tax-data";

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
}

export function FinancingStep({ onComplete, onBack, askingPrice }: FinancingStepProps) {
  const [activeTab, setActiveTab] = useState<string>("loan");
  const [selectedState, setSelectedState] = useState<string>("");
  const [selectedCounty, setSelectedCounty] = useState<string>("");
  const [availableCounties, setAvailableCounties] = useState<CountyTax[]>([]);

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

  // Update counties when state changes
  useEffect(() => {
    if (selectedState) {
      const counties = getCountiesForState(selectedState);
      setAvailableCounties(counties);
      setSelectedCounty("");
      
      // Set tax rate to state combined rate (state + avg local)
      const rate = getStateCombinedRate(selectedState);
      loanForm.setValue("salesTaxRate", parseFloat(rate.toFixed(3)));
    } else {
      setAvailableCounties([]);
      setSelectedCounty("");
    }
  }, [selectedState]);

  // Update tax rate when county changes
  useEffect(() => {
    if (selectedState && selectedCounty) {
      const rate = getCountyRate(selectedState, selectedCounty);
      loanForm.setValue("salesTaxRate", parseFloat(rate.toFixed(3)));
    } else if (selectedState) {
      const rate = getStateCombinedRate(selectedState);
      loanForm.setValue("salesTaxRate", parseFloat(rate.toFixed(3)));
    }
  }, [selectedCounty, selectedState]);

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
    onComplete({
      type: "loan",
      loanAmount: data.amountFinanced,
      loanTerm: data.loanTerm,
      apr: data.apr,
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

  const handleCash = () => {
    onComplete({ type: "cash" });
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
                    <div className="flex items-center gap-2">
                      <Calculator className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Sales Tax Calculator</span>
                    </div>
                    
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
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-sm font-medium">County (Optional)</label>
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
                              Or enter manually
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
                    <Button type="button" variant="outline" onClick={onBack}>
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
                    <Button type="button" variant="outline" onClick={onBack}>
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

                <div className="flex gap-4">
                  <Button type="button" variant="outline" onClick={onBack}>
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
