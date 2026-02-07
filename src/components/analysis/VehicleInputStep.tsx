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
import { Separator } from "@/components/ui/separator";
import { Loader2, Search, Car, Link as LinkIcon, CheckCircle, AlertCircle, ArrowRight, ExternalLink, AlertTriangle, ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { decodeVIN, isValidVIN, getMakes, getModels } from "@/lib/nhtsa";
import { VehicleInfo, VehicleCondition } from "@/types/vehicle";
import { useToast } from "@/hooks/use-toast";
import { scrapeCarListing, ScrapedVehicle } from "@/lib/api/scrape-listing";
import { cacheImages, getCachedUrls } from "@/lib/api/cache-images";

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

const listingUrlSchema = z.object({
  listingUrl: z.string().url("Please enter a valid URL"),
});

interface VehicleInputStepProps {
  onComplete: (vehicle: VehicleInfo, listingUrl?: string, scrapedCondition?: Partial<VehicleCondition>) => void;
  initialData?: Partial<VehicleInfo>;
}

interface ImportedListingData {
  vehicle: ScrapedVehicle;
  decodedVehicle?: VehicleInfo;
  sourceUrl: string;
}

export function VehicleInputStep({ onComplete, initialData }: VehicleInputStepProps) {
  const [activeTab, setActiveTab] = useState<string>("vin");
  const [isLoading, setIsLoading] = useState(false);
  const [isDecodingVin, setIsDecodingVin] = useState(false);
  const [decodedVehicle, setDecodedVehicle] = useState<VehicleInfo | null>(null);
  const [importedListing, setImportedListing] = useState<ImportedListingData | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const { toast } = useToast();

  // State for NHTSA data
  const [availableMakes, setAvailableMakes] = useState<string[]>([]);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isLoadingMakes, setIsLoadingMakes] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  // Generate years from 1980 to next year
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 1979 + 1 }, (_, i) => currentYear + 1 - i);

  // Listing URL form (top of page)
  const listingUrlForm = useForm<z.infer<typeof listingUrlSchema>>({
    resolver: zodResolver(listingUrlSchema),
    defaultValues: { listingUrl: "" },
  });

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

  // Handle listing URL submission
  const handleListingUrlSubmit = async (data: z.infer<typeof listingUrlSchema>) => {
    setIsLoading(true);
    setImportedListing(null);
    
    try {
      const result = await scrapeCarListing(data.listingUrl);
      
      if (result.success && result.vehicle) {
        const scraped = result.vehicle;
        let decoded: VehicleInfo | undefined;
        
        // If VIN was extracted, auto-decode it
        if (scraped.vin && isValidVIN(scraped.vin)) {
          setIsDecodingVin(true);
          toast({
            title: "VIN Found!",
            description: `Decoding VIN: ${scraped.vin}...`,
          });
          
          try {
            decoded = await decodeVIN(scraped.vin) || undefined;
            if (decoded) {
              toast({
                title: "VIN Decoded Successfully",
                description: `Verified: ${decoded.year} ${decoded.make} ${decoded.model}`,
              });
            }
          } catch (error) {
            console.error("VIN decode error:", error);
          } finally {
            setIsDecodingVin(false);
          }
        }
        
        setImportedListing({
          vehicle: scraped,
          decodedVehicle: decoded,
          sourceUrl: result.sourceUrl || data.listingUrl,
        });
        
        toast({
          title: "Listing Imported Successfully",
          description: `Found: ${scraped.year} ${scraped.make} ${scraped.model}`,
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
        description: "Failed to import listing. Please try VIN or manual entry below.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

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

  const [isCachingImages, setIsCachingImages] = useState(false);

  const confirmImportedListing = async () => {
    if (!importedListing) return;
    
    const v = importedListing.vehicle;
    const decoded = importedListing.decodedVehicle;
    
    // Prefer decoded VIN data, fall back to scraped data
    const vehicleInfo: VehicleInfo = {
      year: decoded?.year || v.year || new Date().getFullYear(),
      make: decoded?.make || v.make || "",
      model: decoded?.model || v.model || "",
      trim: decoded?.trim || v.trim,
      vin: v.vin,
      engineSize: decoded?.engineSize,
      transmission: decoded?.transmission,
      drivetrain: decoded?.drivetrain,
      fuelType: decoded?.fuelType,
      bodyStyle: decoded?.bodyStyle,
    };
    
    // Pass along scraped condition data
    const scrapedCondition: Partial<VehicleCondition> = {};
    if (v.mileage) scrapedCondition.mileage = v.mileage;
    if (v.askingPrice) scrapedCondition.askingPrice = v.askingPrice;
    if (v.condition) scrapedCondition.condition = v.condition;
    if (v.sellerType) scrapedCondition.sellerType = v.sellerType;
    scrapedCondition.listingUrl = importedListing.sourceUrl;
    
    // Cache images to Lovable Cloud storage for persistence
    if (v.images && v.images.length > 0) {
      setIsCachingImages(true);
      try {
        const cacheResult = await cacheImages(v.images);
        if (cacheResult.success && cacheResult.images) {
          scrapedCondition.images = getCachedUrls(cacheResult);
          console.log(`Cached ${cacheResult.cached}/${cacheResult.total} vehicle images`);
        } else {
          // Fallback to original images if caching fails
          scrapedCondition.images = v.images;
        }
      } catch (error) {
        console.error("Image caching failed, using original URLs:", error);
        scrapedCondition.images = v.images;
      } finally {
        setIsCachingImages(false);
      }
    }
    
    onComplete(vehicleInfo, importedListing.sourceUrl, scrapedCondition);
  };

  const confirmDecodedVehicle = () => {
    if (decodedVehicle) {
      onComplete(decodedVehicle);
    }
  };

  const resetImportedListing = () => {
    setImportedListing(null);
    listingUrlForm.reset();
  };

  // Get display vehicle info (prefer decoded, fall back to scraped)
  const getDisplayVehicle = () => {
    if (!importedListing) return null;
    const decoded = importedListing.decodedVehicle;
    const scraped = importedListing.vehicle;
    return {
      year: decoded?.year || scraped.year,
      make: decoded?.make || scraped.make,
      model: decoded?.model || scraped.model,
      trim: decoded?.trim || scraped.trim,
      engineSize: decoded?.engineSize,
      transmission: decoded?.transmission,
      drivetrain: decoded?.drivetrain,
      fuelType: decoded?.fuelType,
      bodyStyle: decoded?.bodyStyle,
      vin: scraped.vin,
      mileage: scraped.mileage,
      askingPrice: scraped.askingPrice,
      sellerType: scraped.sellerType,
      condition: scraped.condition,
      description: scraped.description,
      images: scraped.images,
    };
  };

  const displayVehicle = getDisplayVehicle();

  // Check for mismatch between listing claims and VIN decode
  const getMismatchWarning = () => {
    if (!importedListing?.decodedVehicle || !importedListing?.vehicle) return null;
    
    const decoded = importedListing.decodedVehicle;
    const scraped = importedListing.vehicle;
    const mismatches: string[] = [];
    
    // Normalize strings for comparison (lowercase, trim)
    const normalize = (str?: string | null) => str?.toLowerCase().trim() || "";
    
    // Check year mismatch
    if (scraped.year && decoded.year && scraped.year !== decoded.year) {
      mismatches.push(`Year: Listing says ${scraped.year}, VIN shows ${decoded.year}`);
    }
    
    // Check make mismatch
    if (scraped.make && decoded.make && normalize(scraped.make) !== normalize(decoded.make)) {
      mismatches.push(`Make: Listing says "${scraped.make}", VIN shows "${decoded.make}"`);
    }
    
    // Check model mismatch (more lenient - check if one contains the other)
    if (scraped.model && decoded.model) {
      const scrapedModel = normalize(scraped.model);
      const decodedModel = normalize(decoded.model);
      if (!scrapedModel.includes(decodedModel) && !decodedModel.includes(scrapedModel)) {
        mismatches.push(`Model: Listing says "${scraped.model}", VIN shows "${decoded.model}"`);
      }
    }
    
    return mismatches.length > 0 ? mismatches : null;
  };

  const mismatchWarning = getMismatchWarning();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Vehicle Information</h2>
        <p className="text-muted-foreground">
          Enter the vehicle details to get started with your analysis.
        </p>
      </div>

      {/* Quick Import Section - Always visible at top when no imported listing */}
      {!importedListing && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <LinkIcon className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Quick Import from Listing</CardTitle>
            </div>
            <CardDescription>
              Paste a car listing URL to automatically extract vehicle details, VIN, price, and mileage.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...listingUrlForm}>
              <form onSubmit={listingUrlForm.handleSubmit(handleListingUrlSubmit)} className="space-y-4">
                <FormField
                  control={listingUrlForm.control}
                  name="listingUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Listing URL</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="https://www.autotrader.com/cars-for-sale/..." 
                          {...field}
                          className="bg-background"
                        />
                      </FormControl>
                      <FormDescription className="flex flex-wrap gap-2 items-center">
                        <span className="text-xs">Supported:</span>
                        <Badge variant="outline" className="text-xs">AutoTrader</Badge>
                        <Badge variant="outline" className="text-xs">Cars.com</Badge>
                        <Badge variant="outline" className="text-xs">Carvana</Badge>
                        <Badge variant="outline" className="text-xs">CarGurus</Badge>
                        <Badge variant="outline" className="text-xs">Facebook</Badge>
                        <Badge variant="outline" className="text-xs">Craigslist</Badge>
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={isLoading || isDecodingVin}>
                  {(isLoading || isDecodingVin) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isDecodingVin ? "Decoding VIN..." : isLoading ? "Importing..." : "Import Listing"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* Imported Listing Success Card */}
      {importedListing && displayVehicle && (
        <Card className="border-success/50 bg-success/5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-success">
                <CheckCircle className="h-5 w-5" />
                <CardTitle className="text-lg">
                  {importedListing.decodedVehicle ? "VIN Verified & Decoded!" : "Listing Imported!"}
                </CardTitle>
              </div>
              <a 
                href={importedListing.sourceUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
              >
                View Listing <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Mismatch Warning */}
            {mismatchWarning && (
              <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Vehicle Mismatch Detected</AlertTitle>
                <AlertDescription className="mt-2">
                  <p className="text-sm mb-2">
                    The VIN decode results don't match what the listing claims. This could indicate an error in the listing or a potential scam.
                  </p>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    {mismatchWarning.map((mismatch, i) => (
                      <li key={i}>{mismatch}</li>
                    ))}
                  </ul>
                  <p className="text-sm mt-2 font-medium">
                    We recommend verifying the vehicle details before proceeding.
                  </p>
                </AlertDescription>
              </Alert>
            )}

            {/* Vehicle Details */}
            <div className="rounded-lg border bg-background p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Vehicle</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Year:</span>
                      <span className="font-medium">{displayVehicle.year}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Make:</span>
                      <span className="font-medium">{displayVehicle.make}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Model:</span>
                      <span className="font-medium">{displayVehicle.model}</span>
                    </div>
                    {displayVehicle.trim && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Trim:</span>
                        <span className="font-medium">{displayVehicle.trim}</span>
                      </div>
                    )}
                    {displayVehicle.engineSize && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Engine:</span>
                        <span className="font-medium">{displayVehicle.engineSize}</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Listing Details</h4>
                  <div className="space-y-1 text-sm">
                    {displayVehicle.askingPrice && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Price:</span>
                        <span className="font-semibold text-primary">${displayVehicle.askingPrice.toLocaleString()}</span>
                      </div>
                    )}
                    {displayVehicle.mileage && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Mileage:</span>
                        <span className="font-medium">{displayVehicle.mileage.toLocaleString()} mi</span>
                      </div>
                    )}
                    {displayVehicle.sellerType && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Seller:</span>
                        <Badge variant="secondary" className="capitalize text-xs">
                          {displayVehicle.sellerType}
                        </Badge>
                      </div>
                    )}
                    {displayVehicle.vin && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">VIN:</span>
                        <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{displayVehicle.vin}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {displayVehicle.description && (
              <p className="text-sm text-muted-foreground italic">
                "{displayVehicle.description}"
              </p>
            )}

            {/* Vehicle Images Gallery */}
            {displayVehicle.images && displayVehicle.images.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <ImageIcon className="h-4 w-4" />
                  <span>{displayVehicle.images.length} photo{displayVehicle.images.length !== 1 ? 's' : ''} found</span>
                </div>
                <div className="relative rounded-lg overflow-hidden bg-muted aspect-video">
                  <img
                    src={displayVehicle.images[currentImageIndex]}
                    alt={`Vehicle photo ${currentImageIndex + 1}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // Hide broken images by replacing with placeholder
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                  {displayVehicle.images.length > 1 && (
                    <>
                      <button
                        onClick={() => setCurrentImageIndex((prev) => 
                          prev === 0 ? displayVehicle.images!.length - 1 : prev - 1
                        )}
                        className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 transition-colors"
                        aria-label="Previous image"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => setCurrentImageIndex((prev) => 
                          prev === displayVehicle.images!.length - 1 ? 0 : prev + 1
                        )}
                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 transition-colors"
                        aria-label="Next image"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
                        {currentImageIndex + 1} / {displayVehicle.images.length}
                      </div>
                    </>
                  )}
                </div>
                {/* Thumbnail strip */}
                {displayVehicle.images.length > 1 && (
                  <div className="flex gap-1 overflow-x-auto pb-1">
                    {displayVehicle.images.slice(0, 6).map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentImageIndex(idx)}
                        className={`flex-shrink-0 w-16 h-12 rounded overflow-hidden border-2 transition-colors ${
                          currentImageIndex === idx ? 'border-primary' : 'border-transparent opacity-70 hover:opacity-100'
                        }`}
                      >
                        <img
                          src={img}
                          alt={`Thumbnail ${idx + 1}`}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.parentElement!.style.display = 'none';
                          }}
                        />
                      </button>
                    ))}
                    {displayVehicle.images.length > 6 && (
                      <div className="flex-shrink-0 w-16 h-12 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground">
                        +{displayVehicle.images.length - 6}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <Separator />

            <div className="flex gap-3">
              <Button onClick={confirmImportedListing} disabled={isCachingImages} className="flex-1 sm:flex-none">
                {isCachingImages ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Caching Images...
                  </>
                ) : (
                  <>
                    Continue
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={resetImportedListing} disabled={isCachingImages}>
                Try Different Listing
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Manual Entry Section - Show when no imported listing */}
      {!importedListing && (
        <>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator className="w-full" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or enter details manually
              </span>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="vin" className="flex items-center gap-2">
                <Search className="h-4 w-4" />
                VIN Lookup
              </TabsTrigger>
              <TabsTrigger value="manual" className="flex items-center gap-2">
                <Car className="h-4 w-4" />
                Manual Entry
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
          </Tabs>
        </>
      )}
    </div>
  );
}
