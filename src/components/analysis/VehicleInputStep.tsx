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
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Car, Link as LinkIcon, CheckCircle, AlertCircle } from "lucide-react";
import { decodeVIN, isValidVIN, getMakes, getModels } from "@/lib/nhtsa";
import { VehicleInfo, VehicleCondition } from "@/types/vehicle";
import { useToast } from "@/hooks/use-toast";
import { scrapeCarListing, ScrapedVehicle } from "@/lib/api/scrape-listing";
const vinSchema = z.object({
  vin: z.string()
    .length(17, "VIN must be exactly 17 characters")
    .refine(isValidVIN, "Invalid VIN format"),
});

const manualSchema = z.object({
  year: z.coerce.number().min(1980).max(new Date().getFullYear() + 1),
  make: z.string().min(1, "Make is required"),
  model: z.string().min(1, "Model is required"),
  trim: z.string().optional(),
});

const listingSchema = z.object({
  listingUrl: z.string().url("Please enter a valid URL"),
});

interface VehicleInputStepProps {
  onComplete: (vehicle: VehicleInfo, listingUrl?: string, scrapedCondition?: Partial<VehicleCondition>) => void;
  initialData?: Partial<VehicleInfo>;
}

export function VehicleInputStep({ onComplete, initialData }: VehicleInputStepProps) {
  const [activeTab, setActiveTab] = useState<string>("vin");
  const [isLoading, setIsLoading] = useState(false);
  const [decodedVehicle, setDecodedVehicle] = useState<VehicleInfo | null>(null);
  const [scrapedData, setScrapedData] = useState<{ vehicle: ScrapedVehicle; sourceUrl: string } | null>(null);
  const { toast } = useToast();

  // State for NHTSA data
  const [availableMakes, setAvailableMakes] = useState<string[]>([]);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isLoadingMakes, setIsLoadingMakes] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  // Generate years from 1980 to next year
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 1979 + 1 }, (_, i) => currentYear + 1 - i);

  // VIN form
  const vinForm = useForm<z.infer<typeof vinSchema>>({
    resolver: zodResolver(vinSchema),
    defaultValues: { vin: "" },
  });

  // Manual form
  const manualForm = useForm<z.infer<typeof manualSchema>>({
    resolver: zodResolver(manualSchema),
    defaultValues: {
      year: initialData?.year || new Date().getFullYear(),
      make: initialData?.make || "",
      model: initialData?.model || "",
      trim: initialData?.trim || "",
    },
  });

  // Listing URL form
  const listingForm = useForm<z.infer<typeof listingSchema>>({
    resolver: zodResolver(listingSchema),
    defaultValues: { listingUrl: "" },
  });

  // Watch year and make for dynamic updates
  const selectedYear = manualForm.watch("year");
  const selectedMake = manualForm.watch("make");

  // Fetch makes when year changes
  useEffect(() => {
    const fetchMakes = async () => {
      if (!selectedYear) return;
      setIsLoadingMakes(true);
      setAvailableModels([]);
      manualForm.setValue("make", "");
      manualForm.setValue("model", "");
      try {
        const makes = await getMakes(selectedYear);
        setAvailableMakes(makes);
      } catch (error) {
        console.error("Failed to fetch makes:", error);
      } finally {
        setIsLoadingMakes(false);
      }
    };
    fetchMakes();
  }, [selectedYear]);

  // Fetch models when make changes
  useEffect(() => {
    const fetchModels = async () => {
      if (!selectedMake || !selectedYear) return;
      setIsLoadingModels(true);
      manualForm.setValue("model", "");
      try {
        const models = await getModels(selectedMake, selectedYear);
        setAvailableModels(models);
      } catch (error) {
        console.error("Failed to fetch models:", error);
      } finally {
        setIsLoadingModels(false);
      }
    };
    fetchModels();
  }, [selectedMake, selectedYear]);

  const handleVINSubmit = async (data: z.infer<typeof vinSchema>) => {
    setIsLoading(true);
    try {
      const vehicle = await decodeVIN(data.vin);
      if (vehicle) {
        setDecodedVehicle(vehicle);
        toast({
          title: "VIN Decoded Successfully",
          description: `Found: ${vehicle.year} ${vehicle.make} ${vehicle.model}`,
        });
      } else {
        toast({
          title: "VIN Not Found",
          description: "Could not decode this VIN. Please try manual entry.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to decode VIN. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualSubmit = (data: z.infer<typeof manualSchema>) => {
    onComplete({
      year: data.year,
      make: data.make,
      model: data.model,
      trim: data.trim,
    });
  };

  const handleListingSubmit = async (data: z.infer<typeof listingSchema>) => {
    setIsLoading(true);
    setScrapedData(null);
    
    try {
      const result = await scrapeCarListing(data.listingUrl);
      
      if (result.success && result.vehicle) {
        setScrapedData({
          vehicle: result.vehicle,
          sourceUrl: result.sourceUrl || data.listingUrl,
        });
        toast({
          title: "Listing Imported Successfully",
          description: `Found: ${result.vehicle.year} ${result.vehicle.make} ${result.vehicle.model}`,
        });
      } else {
        toast({
          title: "Import Failed",
          description: result.error || "Could not extract vehicle details from this listing.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to import listing. Please try VIN or manual entry.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const confirmScrapedVehicle = () => {
    if (scrapedData?.vehicle) {
      const v = scrapedData.vehicle;
      const vehicleInfo: VehicleInfo = {
        year: v.year || new Date().getFullYear(),
        make: v.make || "",
        model: v.model || "",
        trim: v.trim,
        vin: v.vin,
      };
      
      // Pass along any scraped condition data
      const scrapedCondition: Partial<VehicleCondition> = {};
      if (v.mileage) scrapedCondition.mileage = v.mileage;
      if (v.askingPrice) scrapedCondition.askingPrice = v.askingPrice;
      if (v.condition) scrapedCondition.condition = v.condition;
      if (v.sellerType) scrapedCondition.sellerType = v.sellerType;
      scrapedCondition.listingUrl = scrapedData.sourceUrl;
      
      onComplete(vehicleInfo, scrapedData.sourceUrl, scrapedCondition);
    }
  };

  const confirmDecodedVehicle = () => {
    if (decodedVehicle) {
      onComplete(decodedVehicle);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Vehicle Information</h2>
        <p className="text-muted-foreground">
          Enter the vehicle details using one of the methods below.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="vin" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            VIN Lookup
          </TabsTrigger>
          <TabsTrigger value="manual" className="flex items-center gap-2">
            <Car className="h-4 w-4" />
            Manual Entry
          </TabsTrigger>
          <TabsTrigger value="listing" className="flex items-center gap-2">
            <LinkIcon className="h-4 w-4" />
            Listing URL
          </TabsTrigger>
        </TabsList>

        {/* VIN Lookup Tab */}
        <TabsContent value="vin" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Decode VIN</CardTitle>
              <CardDescription>
                Enter the 17-character Vehicle Identification Number to auto-fill vehicle details.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!decodedVehicle ? (
                <Form {...vinForm}>
                  <form onSubmit={vinForm.handleSubmit(handleVINSubmit)} className="space-y-4">
                    <FormField
                      control={vinForm.control}
                      name="vin"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>VIN</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Enter 17-character VIN" 
                              {...field}
                              className="font-mono uppercase"
                              maxLength={17}
                              onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                            />
                          </FormControl>
                          <FormDescription>
                            Find the VIN on the driver's side dashboard or door jamb.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" disabled={isLoading}>
                      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Decode VIN
                    </Button>
                    
                    <div className="mt-4 rounded-lg border border-dashed p-4">
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">Don't have a VIN?</span>{" "}
                        Select year, make, and model using the{" "}
                        <button
                          type="button"
                          onClick={() => setActiveTab("manual")}
                          className="text-primary hover:underline font-medium"
                        >
                          Manual Entry
                        </button>{" "}
                        tab.
                      </p>
                    </div>
                  </form>
                </Form>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-success">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-medium">Vehicle Found!</span>
                  </div>
                  
                  <div className="rounded-lg border bg-muted/50 p-4">
                    <div className="grid gap-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Year:</span>
                        <span className="font-medium">{decodedVehicle.year}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Make:</span>
                        <span className="font-medium">{decodedVehicle.make}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Model:</span>
                        <span className="font-medium">{decodedVehicle.model}</span>
                      </div>
                      {decodedVehicle.trim && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Trim:</span>
                          <span className="font-medium">{decodedVehicle.trim}</span>
                        </div>
                      )}
                      {decodedVehicle.engineSize && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Engine:</span>
                          <span className="font-medium">{decodedVehicle.engineSize}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={confirmDecodedVehicle}>
                      Continue with this vehicle
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setDecodedVehicle(null);
                        vinForm.reset();
                      }}
                    >
                      Try different VIN
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Manual Entry Tab */}
        <TabsContent value="manual" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Manual Entry</CardTitle>
              <CardDescription>
                Select your vehicle details from the dropdowns below.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...manualForm}>
                <form onSubmit={manualForm.handleSubmit(handleManualSubmit)} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={manualForm.control}
                      name="year"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Year</FormLabel>
                          <Select
                            onValueChange={(value) => field.onChange(parseInt(value, 10))}
                            value={field.value?.toString()}
                          >
                            <FormControl>
                              <SelectTrigger className="bg-background">
                                <SelectValue placeholder="Select year" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-background max-h-[300px]">
                              {years.map((year) => (
                                <SelectItem key={year} value={year.toString()}>
                                  {year}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={manualForm.control}
                      name="make"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Make</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                            disabled={!selectedYear || isLoadingMakes}
                          >
                            <FormControl>
                              <SelectTrigger className="bg-background">
                                <SelectValue placeholder={isLoadingMakes ? "Loading makes..." : "Select make"} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-background max-h-[300px]">
                              {availableMakes.map((make) => (
                                <SelectItem key={make} value={make}>
                                  {make}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={manualForm.control}
                      name="model"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Model</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                            disabled={!selectedMake || isLoadingModels}
                          >
                            <FormControl>
                              <SelectTrigger className="bg-background">
                                <SelectValue placeholder={isLoadingModels ? "Loading models..." : "Select model"} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-background max-h-[300px]">
                              {availableModels.map((model) => (
                                <SelectItem key={model} value={model}>
                                  {model}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={manualForm.control}
                      name="trim"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Trim (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., XLE, Sport, Limited" {...field} />
                          </FormControl>
                          <FormDescription className="text-xs">
                            Enter the trim level if known
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <Button type="submit" disabled={!manualForm.formState.isValid}>
                    Continue
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Listing URL Tab */}
        <TabsContent value="listing" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Import from Listing</CardTitle>
              <CardDescription>
                Paste a URL from AutoTrader, Cars.com, Carvana, or other car listing sites.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!scrapedData ? (
                <Form {...listingForm}>
                  <form onSubmit={listingForm.handleSubmit(handleListingSubmit)} className="space-y-4">
                    <FormField
                      control={listingForm.control}
                      name="listingUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Listing URL</FormLabel>
                          <FormControl>
                            <Input placeholder="https://www.autotrader.com/cars-for-sale/..." {...field} />
                          </FormControl>
                          <FormDescription>
                            We'll extract the vehicle details automatically.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">AutoTrader</Badge>
                      <Badge variant="outline">Cars.com</Badge>
                      <Badge variant="outline">Carvana</Badge>
                      <Badge variant="outline">CarGurus</Badge>
                      <Badge variant="outline">Craigslist</Badge>
                    </div>
                    <Button type="submit" disabled={isLoading}>
                      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {isLoading ? "Importing..." : "Import Listing"}
                    </Button>
                  </form>
                </Form>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-success">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-medium">Listing Imported!</span>
                  </div>
                  
                  <div className="rounded-lg border bg-muted/50 p-4">
                    <div className="grid gap-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Year:</span>
                        <span className="font-medium">{scrapedData.vehicle.year}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Make:</span>
                        <span className="font-medium">{scrapedData.vehicle.make}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Model:</span>
                        <span className="font-medium">{scrapedData.vehicle.model}</span>
                      </div>
                      {scrapedData.vehicle.trim && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Trim:</span>
                          <span className="font-medium">{scrapedData.vehicle.trim}</span>
                        </div>
                      )}
                      {scrapedData.vehicle.mileage && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Mileage:</span>
                          <span className="font-medium">{scrapedData.vehicle.mileage.toLocaleString()} miles</span>
                        </div>
                      )}
                      {scrapedData.vehicle.askingPrice && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Price:</span>
                          <span className="font-medium">${scrapedData.vehicle.askingPrice.toLocaleString()}</span>
                        </div>
                      )}
                      {scrapedData.vehicle.sellerType && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Seller:</span>
                          <Badge variant="secondary" className="capitalize">
                            {scrapedData.vehicle.sellerType}
                          </Badge>
                        </div>
                      )}
                      {scrapedData.vehicle.vin && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">VIN:</span>
                          <span className="font-mono text-xs">{scrapedData.vehicle.vin}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {scrapedData.vehicle.description && (
                    <p className="text-sm text-muted-foreground">
                      {scrapedData.vehicle.description}
                    </p>
                  )}

                  <div className="flex gap-2">
                    <Button onClick={confirmScrapedVehicle}>
                      Continue with this vehicle
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setScrapedData(null);
                        listingForm.reset();
                      }}
                    >
                      Try different listing
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
