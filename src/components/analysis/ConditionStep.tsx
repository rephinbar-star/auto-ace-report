import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VehicleCondition } from "@/types/vehicle";
import { useSubscription } from "@/hooks/useSubscription";
import { DealerTrustPreview } from "./DealerTrustPreview";

const conditionSchema = z.object({
  mileage: z.coerce.number().min(0, "Mileage must be positive").max(500000),
  askingPrice: z.coerce.number().min(0, "Price must be positive"),
  condition: z.enum(["excellent", "good", "fair", "poor"]),
  sellerType: z.enum(["private", "dealer"]),
  sellerName: z.string().max(100).optional().or(z.literal("")),
  zipCode: z.string().regex(/^\d{5}$/, "Enter a valid 5-digit ZIP code").optional().or(z.literal("")),
  isCPO: z.boolean().optional(),
});

interface ConditionStepProps {
  onComplete: (condition: VehicleCondition) => void;
  onBack: () => void;
  initialData?: Partial<VehicleCondition>;
  vehicleSummary: string;
}

export function ConditionStep({ onComplete, onBack, initialData, vehicleSummary }: ConditionStepProps) {
  const { tier } = useSubscription();
  const isPro = tier === "pro";
  
  const form = useForm<z.infer<typeof conditionSchema>>({
    resolver: zodResolver(conditionSchema),
    defaultValues: {
      mileage: initialData?.mileage || 0,
      askingPrice: initialData?.askingPrice || 0,
      condition: initialData?.condition || "good",
      sellerType: initialData?.sellerType || "dealer",
      sellerName: initialData?.sellerName ?? "",
      zipCode: initialData?.zipCode ?? "",
      isCPO: initialData?.isCPO ?? false,
    },
  });

  // Sync form when initialData changes (e.g., from scraped listing)
  useEffect(() => {
    if (initialData) {
      form.reset({
        mileage: initialData.mileage || 0,
        askingPrice: initialData.askingPrice || 0,
        condition: initialData.condition || "good",
        sellerType: initialData.sellerType || "dealer",
        sellerName: initialData.sellerName ?? "",
        zipCode: initialData.zipCode ?? "",
        isCPO: initialData.isCPO ?? false,
      });
    }
  }, [initialData, form]);

  const watchSellerType = form.watch("sellerType");
  const watchSellerName = form.watch("sellerName");

  const handleSubmit = (data: z.infer<typeof conditionSchema>) => {
    onComplete({
      mileage: data.mileage,
      askingPrice: data.askingPrice,
      condition: data.condition,
      sellerType: data.sellerType,
      sellerName: data.sellerType === "dealer" ? data.sellerName || undefined : undefined,
      zipCode: data.zipCode || undefined,
      listingUrl: initialData?.listingUrl,
      images: initialData?.images,
      isCPO: data.isCPO || false,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Vehicle Condition</h2>
        <p className="text-muted-foreground">
          Analyzing: <span className="font-medium text-foreground">{vehicleSummary}</span>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mileage & Price Details</CardTitle>
          <CardDescription>
            Enter the current mileage and asking price for accurate analysis.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="mileage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Mileage</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input 
                            type="number" 
                            placeholder="45000" 
                            {...field} 
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                            miles
                          </span>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="askingPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Asking Price</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                            $
                          </span>
                          <Input 
                            type="number" 
                            placeholder="25000" 
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

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="condition"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Overall Condition</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select condition" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="excellent">Excellent - Like new</SelectItem>
                          <SelectItem value="good">Good - Minor wear</SelectItem>
                          <SelectItem value="fair">Fair - Some issues</SelectItem>
                          <SelectItem value="poor">Poor - Needs work</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Based on interior, exterior, and mechanical condition.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="sellerType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Seller Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select seller type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="dealer">Dealership</SelectItem>
                          <SelectItem value="private">Private Seller</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Dealers typically price higher but may offer warranties.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* ZIP Code for regional pricing accuracy */}
              <FormField
                control={form.control}
                name="zipCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ZIP Code (Optional)</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="e.g., 92008" 
                        maxLength={5}
                        className="max-w-[200px]"
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      Improves pricing accuracy with region-specific market data.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* CPO Checkbox */}
              <FormField
                control={form.control}
                name="isCPO"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="cursor-pointer">
                        Certified Pre-Owned (CPO)
                      </FormLabel>
                      <FormDescription>
                        Check if this vehicle is manufacturer-certified pre-owned. CPO vehicles have extended warranty coverage and reduce risk.
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              {/* Dealer Name field - shows when seller type is dealer */}
              {watchSellerType === "dealer" && (
                <div className="space-y-3">
                  <FormField
                    control={form.control}
                    name="sellerName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Dealership Name (Optional)</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g., ABC Motors, CarMax, AutoNation..." 
                            {...field} 
                          />
                        </FormControl>
                        <FormDescription>
                          Enter the dealer name for trust analysis (Pro feature).
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DealerTrustPreview 
                    dealerName={watchSellerName || ""} 
                    isPro={isPro} 
                  />
                </div>
              )}

              <div className="flex gap-4">
                <Button type="button" variant="outline" onClick={onBack}>
                  Back
                </Button>
                <Button type="submit">Continue</Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
