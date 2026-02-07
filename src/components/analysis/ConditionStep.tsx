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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VehicleCondition } from "@/types/vehicle";

const conditionSchema = z.object({
  mileage: z.coerce.number().min(0, "Mileage must be positive").max(500000),
  askingPrice: z.coerce.number().min(0, "Price must be positive"),
  condition: z.enum(["excellent", "good", "fair", "poor"]),
  sellerType: z.enum(["private", "dealer"]),
  sellerName: z.string().max(100).optional().or(z.literal("")),
  listingUrl: z.string().url().optional().or(z.literal("")),
});

interface ConditionStepProps {
  onComplete: (condition: VehicleCondition) => void;
  onBack: () => void;
  initialData?: Partial<VehicleCondition>;
  vehicleSummary: string;
}

export function ConditionStep({ onComplete, onBack, initialData, vehicleSummary }: ConditionStepProps) {
  const form = useForm<z.infer<typeof conditionSchema>>({
    resolver: zodResolver(conditionSchema),
    defaultValues: {
      mileage: initialData?.mileage || 0,
      askingPrice: initialData?.askingPrice || 0,
      condition: initialData?.condition || "good",
      sellerType: initialData?.sellerType || "dealer",
      sellerName: initialData?.sellerName || "",
      listingUrl: initialData?.listingUrl || "",
    },
  });

  const watchSellerType = form.watch("sellerType");

  const handleSubmit = (data: z.infer<typeof conditionSchema>) => {
    onComplete({
      mileage: data.mileage,
      askingPrice: data.askingPrice,
      condition: data.condition,
      sellerType: data.sellerType,
      sellerName: data.sellerType === "dealer" ? data.sellerName || undefined : undefined,
      listingUrl: data.listingUrl || undefined,
      images: initialData?.images, // Preserve images from scraped listing
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

              {/* Dealer Name field - shows when seller type is dealer */}
              {watchSellerType === "dealer" && (
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
              )}

              <FormField
                control={form.control}
                name="listingUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Listing URL (Optional)</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="https://www.autotrader.com/..." 
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      If you have a link to the listing, we can extract additional details.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
