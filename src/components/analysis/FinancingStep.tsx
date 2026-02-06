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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreditCard, Banknote, Car } from "lucide-react";
import { FinancingInfo } from "@/types/vehicle";

const loanSchema = z.object({
  salesPrice: z.coerce.number().min(1, "Sales price is required"),
  salesTax: z.coerce.number().min(0),
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

  const loanForm = useForm<z.infer<typeof loanSchema>>({
    resolver: zodResolver(loanSchema),
    defaultValues: {
      salesPrice: askingPrice,
      salesTax: 0,
      fees: 0,
      downPayment: 0,
      amountFinanced: askingPrice,
      loanTerm: 60,
      apr: 7.0,
    },
  });

  // Watch loan fields for auto-calculation
  const salesPrice = loanForm.watch("salesPrice");
  const salesTax = loanForm.watch("salesTax");
  const fees = loanForm.watch("fees");
  const downPayment = loanForm.watch("downPayment");

  // Auto-calculate amount financed when inputs change
  useEffect(() => {
    const calculated = (salesPrice || 0) + (salesTax || 0) + (fees || 0) - (downPayment || 0);
    const currentAmountFinanced = loanForm.getValues("amountFinanced");
    // Only update if the calculated value differs significantly (user hasn't manually edited)
    if (Math.abs(calculated - currentAmountFinanced) > 0.01) {
      loanForm.setValue("amountFinanced", Math.max(0, calculated));
    }
  }, [salesPrice, salesTax, fees, downPayment]);

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
                  {/* Sales Price */}
                  <FormField
                    control={loanForm.control}
                    name="salesPrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sales Price</FormLabel>
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
                          Vehicle selling price before taxes and fees
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Sales Tax and Fees */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={loanForm.control}
                      name="salesTax"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sales Tax</FormLabel>
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
                  </div>

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
                                className="pl-7"
                                {...field} 
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
