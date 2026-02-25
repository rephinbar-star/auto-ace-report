import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, Search, Car, Link as LinkIcon, CheckCircle, AlertCircle, ArrowRight, ExternalLink, AlertTriangle, ChevronLeft, ChevronRight, ImageIcon, HelpCircle, Camera, Sparkles } from "lucide-react";
import { ScreenshotTutorial } from "@/components/analysis/ScreenshotTutorial";
import { URLTutorial } from "@/components/analysis/URLTutorial";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { decodeVIN, isValidVIN, getMakes, getModels } from "@/lib/nhtsa";
import { VehicleInfo, VehicleCondition } from "@/types/vehicle";
import { useToast } from "@/hooks/use-toast";
import { scrapeCarListing, ScrapedVehicle } from "@/lib/api/scrape-listing";
import { cacheImages, getCachedUrls } from "@/lib/api/cache-images";
import { extractFromScreenshot } from "@/lib/api/extract-screenshot";
import { supabase } from "@/integrations/supabase/client";
import { VinLocationTooltip } from "@/components/analysis/VinLocationTooltip";

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

const fbPasteSchema = z.object({
  year: z.coerce.number().min(1980, "Enter a valid year").max(new Date().getFullYear() + 1),
  make: z.string().min(1, "Make is required").max(50),
  model: z.string().min(1, "Model is required").max(50),
  trim: z.string().max(50).optional(),
  mileage: z.coerce.number().min(0).max(999999).optional(),
  askingPrice: z.coerce.number().min(1, "Price is required").max(99999999),
});

function FacebookPasteForm({ onComplete, onCancel }: { 
  onComplete: (vehicle: VehicleInfo, listingUrl?: string, scrapedCondition?: Partial<VehicleCondition>) => void; 
  onCancel: () => void;
}) {
  const form = useForm<z.infer<typeof fbPasteSchema>>({
    resolver: zodResolver(fbPasteSchema),
    defaultValues: { year: new Date().getFullYear(), make: "", model: "", trim: "", mileage: undefined, askingPrice: undefined },
  });

  const handleSubmit = (data: z.infer<typeof fbPasteSchema>) => {
    const vehicle: VehicleInfo = {
      year: data.year,
      make: data.make,
      model: data.model,
      trim: data.trim,
    };
    const scrapedCondition: Partial<VehicleCondition> = {
      sellerType: "private",
    };
    if (data.askingPrice) scrapedCondition.askingPrice = data.askingPrice;
    if (data.mileage) scrapedCondition.mileage = data.mileage;
    onComplete(vehicle, undefined, scrapedCondition);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField control={form.control} name="year" render={({ field }) => (
            <FormItem>
              <FormLabel>Year *</FormLabel>
              <FormControl><Input type="number" placeholder="e.g. 2019" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="make" render={({ field }) => (
            <FormItem>
              <FormLabel>Make *</FormLabel>
              <FormControl><Input placeholder="e.g. Honda" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="model" render={({ field }) => (
            <FormItem>
              <FormLabel>Model *</FormLabel>
              <FormControl><Input placeholder="e.g. Civic" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="trim" render={({ field }) => (
            <FormItem>
              <FormLabel>Trim</FormLabel>
              <FormControl><Input placeholder="e.g. EX-L" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="askingPrice" render={({ field }) => (
            <FormItem>
              <FormLabel>Asking Price *</FormLabel>
              <FormControl><Input type="number" placeholder="e.g. 15000" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="mileage" render={({ field }) => (
            <FormItem>
              <FormLabel>Mileage</FormLabel>
              <FormControl><Input type="number" placeholder="e.g. 45000" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>
        <div className="flex gap-3 pt-2">
          <Button type="submit">
            Continue <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            Back
          </Button>
        </div>
      </form>
    </Form>
  );
}

export function VehicleInputStep({ onComplete, initialData }: VehicleInputStepProps) {
  const [activeTab, setActiveTab] = useState<string>("vin");
  const [isLoading, setIsLoading] = useState(false);
  const [isDecodingVin, setIsDecodingVin] = useState(false);
  const [decodedVehicle, setDecodedVehicle] = useState<VehicleInfo | null>(null);
  const [importedListing, setImportedListing] = useState<ImportedListingData | null>(null);
  const [importFailed, setImportFailed] = useState<{ url: string; error: string } | null>(null);
  const [showFacebookHelper, setShowFacebookHelper] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showHelpVideo, setShowHelpVideo] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [isExtractingScreenshot, setIsExtractingScreenshot] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
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
    // Detect Facebook URLs and show helper instead of scraping
    const isFacebookUrl = /facebook\.com|fb\.com/i.test(data.listingUrl);
    if (isFacebookUrl) {
      setShowFacebookHelper(true);
      toast({
        title: "Facebook Marketplace Detected",
        description: "Please use the helper below to enter details from your Facebook listing.",
      });
      return;
    }

    setIsLoading(true);
    setImportedListing(null);
    setImportFailed(null);
    
    try {
      const result = await scrapeCarListing(data.listingUrl);
      
      if (result.success && result.vehicle) {
        const scraped = result.vehicle;
        let decoded: VehicleInfo | undefined;
        
        // Check if the scrape returned valid vehicle data
        const hasValidData = scraped.year && scraped.year > 1900 && 
          scraped.make && scraped.make !== "Unknown" && 
          scraped.model && scraped.model !== "Unknown";
        
        if (!hasValidData) {
          // Scrape succeeded but no valid vehicle data extracted
          setImportFailed({
            url: data.listingUrl,
            error: "We couldn't extract vehicle details from this listing. The page may be blocked, expired, or not a vehicle listing.",
          });
          toast({
            title: "Could Not Extract Vehicle Data",
            description: "Please enter the vehicle details manually below.",
            variant: "destructive",
          });
          return;
        }
        
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
        setImportFailed({
          url: data.listingUrl,
          error: result.error || "Could not access or parse this listing URL.",
        });
        toast({
          title: "Import Failed",
          description: "Please enter the vehicle details manually below.",
          variant: "destructive",
        });
      }
    } catch (error) {
      setImportFailed({
        url: data.listingUrl,
        error: "Network error or the website blocked our request.",
      });
      toast({
        title: "Error",
        description: "Failed to import listing. Please try VIN or manual entry below.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const processScreenshotFiles = useCallback(async (fileList: File[]) => {
    // Validate all files
    const validFiles: File[] = [];
    for (const file of fileList) {
      if (!file.type.startsWith("image/")) {
        toast({ title: "Invalid File", description: `"${file.name}" is not an image. Skipping.`, variant: "destructive" });
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast({ title: "File Too Large", description: `"${file.name}" exceeds 10MB. Skipping.`, variant: "destructive" });
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    if (validFiles.length > 5) {
      toast({ title: "Too Many Files", description: "Processing the first 5 screenshots only.", variant: "default" });
      validFiles.splice(5);
    }

    setIsExtractingScreenshot(true);
    setImportedListing(null);
    setImportFailed(null);
    setShowFacebookHelper(false);

    try {
      const results = await Promise.all(validFiles.map(f => extractFromScreenshot(f)));

      type VehicleFields = NonNullable<(typeof results)[number]["vehicle"]>;
      let merged: Partial<VehicleFields> = {};
      let foundValid = false;

      for (const result of results) {
        if (!result.success || !result.vehicle) continue;
        const v = result.vehicle;
        if (!foundValid && v.year && v.year > 1900 && v.make && v.model) {
          foundValid = true;
        }
        for (const key of Object.keys(v) as (keyof VehicleFields)[]) {
          if (v[key] != null && merged[key] == null) {
            (merged as Record<string, unknown>)[key] = v[key];
          }
        }
      }

      if (!foundValid || !merged.year || !merged.make || !merged.model) {
        setImportFailed({
          url: "screenshot",
          error: "Couldn't extract vehicle details from the screenshot(s). Try clearer images or enter details manually.",
        });
        toast({ title: "Extraction Failed", description: "Please enter details manually.", variant: "destructive" });
        return;
      }

      setImportedListing({
        vehicle: {
          year: merged.year,
          make: merged.make,
          model: merged.model,
          trim: merged.trim,
          askingPrice: merged.askingPrice,
          mileage: merged.mileage,
          vin: merged.vin,
          sellerType: merged.sellerType,
          sellerName: merged.sellerName,
          condition: merged.condition,
          engine: merged.engine,
          transmission: merged.transmission,
          drivetrain: merged.drivetrain,
          exteriorColor: merged.exteriorColor,
          fuelType: merged.fuelType,
          titleStatus: merged.titleStatus,
        },
        sourceUrl: "",
      });

      const countSuccess = results.filter(r => r.success && r.vehicle).length;
      toast({
        title: "Screenshots Imported!",
        description: `Extracted from ${countSuccess} image${countSuccess > 1 ? "s" : ""}: ${merged.year} ${merged.make} ${merged.model}`,
      });
    } catch (error) {
      console.error("Screenshot extraction error:", error);
      setImportFailed({
        url: "screenshot",
        error: "Failed to process screenshots. Please try again or enter details manually.",
      });
      toast({ title: "Error", description: "Failed to process screenshots.", variant: "destructive" });
    } finally {
      setIsExtractingScreenshot(false);
    }
  }, [toast]);

  const handleScreenshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await processScreenshotFiles(Array.from(files));
    e.target.value = "";
  };

  // Clipboard paste support for screenshots
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (isExtractingScreenshot || isLoading || importedListing) return;
      const items = e.clipboardData?.items;
      if (!items) return;

      const imageFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          const file = items[i].getAsFile();
          if (file) imageFiles.push(file);
        }
      }

      if (imageFiles.length > 0) {
        e.preventDefault();
        toast({ title: "Processing pasted image(s)…", description: `${imageFiles.length} screenshot${imageFiles.length > 1 ? "s" : ""} detected.` });
        processScreenshotFiles(imageFiles);
      }
    };

    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [isExtractingScreenshot, isLoading, importedListing, processScreenshotFiles, toast]);

  const handleVINSubmit = async (data: z.infer<typeof vinSchema>) => {
    setIsLoading(true);
    try {
      const vehicle = await decodeVIN(data.vin);
      if (vehicle) {
        // Enrich with MarketCheck NeoVIN specs in background
        let enrichedVehicle = vehicle;
        try {
          const { data: specsResult } = await supabase.functions.invoke("decode-vin-specs", {
            body: { vin: data.vin },
          });
          if (specsResult?.success && specsResult.data) {
            const s = specsResult.data;
            enrichedVehicle = {
              ...vehicle,
              trim: s.trim || vehicle.trim,
              bodyStyle: s.bodyStyle || vehicle.bodyStyle,
              engineSize: s.engineSize || vehicle.engineSize,
              transmission: s.transmission || vehicle.transmission,
              drivetrain: s.drivetrain || vehicle.drivetrain,
              fuelType: s.fuelType || vehicle.fuelType,
              engine: s.engine || undefined,
              exteriorColor: s.exteriorColor || undefined,
              interiorColor: s.interiorColor || undefined,
              installedEquipment: s.installedEquipment?.length ? s.installedEquipment : undefined,
              optionPackages: s.optionPackages?.length ? s.optionPackages : undefined,
            };
            console.log("Enriched vehicle with NeoVIN specs:", enrichedVehicle);
          }
        } catch (err) {
          console.warn("NeoVIN decode failed, using NHTSA data only:", err);
        }

        setDecodedVehicle(enrichedVehicle);
        toast({
          title: "VIN Decoded Successfully",
          description: `Found: ${enrichedVehicle.year} ${enrichedVehicle.make} ${enrichedVehicle.model}`,
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
    if (v.sellerName) scrapedCondition.sellerName = v.sellerName;
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
    setImportFailed(null);
    setShowFacebookHelper(false);
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

  // Check if a specific model variant belongs to a model series
  // Supports all major brands with series-based naming conventions
  const isModelVariantOfSeries = (variant: string, series: string): boolean => {
    const v = variant.toLowerCase().trim().replace(/-/g, ' ');
    const s = series.toLowerCase().trim().replace(/-/g, ' ');
    
    // Direct match or containment
    if (v.includes(s) || s.includes(v)) return true;
    
    // Remove common suffixes for comparison
    const cleanVariant = v.replace(/\s*(sedan|coupe|suv|wagon|convertible|cabriolet|roadster|sport|premium|luxury|base)$/i, '').trim();
    const cleanSeries = s.replace(/\s*(sedan|coupe|suv|wagon|convertible|cabriolet|roadster|sport|premium|luxury|base)$/i, '').trim();
    
    if (cleanVariant.includes(cleanSeries) || cleanSeries.includes(cleanVariant)) return true;
    
    // === BMW ===
    // "7 Series" matches "750i", "745e", "760i", "740i", etc.
    // "3 Series" matches "330i", "M340i", "320i", etc.
    const bmwSeriesMatch = s.match(/^(\d+)\s*series$/i);
    if (bmwSeriesMatch) {
      const seriesNum = bmwSeriesMatch[1];
      if (v.startsWith(seriesNum)) return true;
      if (v.startsWith(`m${seriesNum}`)) return true; // M variants
    }
    
    // BMW X series: "X5" matches "X5 M50i", "X5 xDrive40i", etc.
    const bmwXMatch = s.match(/^x(\d+)$/i);
    if (bmwXMatch && v.match(new RegExp(`^x${bmwXMatch[1]}\\b`, 'i'))) return true;
    
    // BMW Z and i series
    const bmwZMatch = s.match(/^z(\d+)$/i);
    if (bmwZMatch && v.match(new RegExp(`^z${bmwZMatch[1]}`, 'i'))) return true;
    
    const bmwIMatch = s.match(/^i(\d+)$/i);
    if (bmwIMatch && v.match(new RegExp(`^i${bmwIMatch[1]}`, 'i'))) return true;
    
    // === Mercedes-Benz ===
    // "C-Class" or "C Class" matches "C300", "C43 AMG", "C63", etc.
    // "E-Class" matches "E350", "E63 AMG", etc.
    const mbClassMatch = s.match(/^([a-z]+)\s*class$/i);
    if (mbClassMatch) {
      const classLetter = mbClassMatch[1].toLowerCase();
      // Match variants like "C300", "C43", "E350", "S500", "AMG C43"
      if (v.startsWith(classLetter) && /^[a-z]\d/.test(v)) return true;
      if (v.includes(`amg ${classLetter}`) || v.includes(`${classLetter} amg`)) return true;
    }
    
    // Mercedes GLE, GLC, GLA, GLB, GLS series
    const mbGlMatch = s.match(/^(gl[abces]|gla|glb|glc|gle|gls)$/i);
    if (mbGlMatch && v.match(new RegExp(`^${mbGlMatch[1]}\\d*`, 'i'))) return true;
    
    // Mercedes AMG GT
    if (s === 'amg gt' && v.startsWith('amg gt')) return true;
    
    // === Audi ===
    // "A4" matches "A4 Premium", "A4 2.0T", "S4", "RS4"
    // "Q5" matches "Q5 Premium", "SQ5", etc.
    const audiMatch = s.match(/^([aqrs]+)(\d+)$/i);
    if (audiMatch) {
      const audiPrefix = audiMatch[1].toLowerCase();
      const audiNum = audiMatch[2];
      // Direct match: A4 -> A4 Premium
      if (v.match(new RegExp(`^${audiPrefix}${audiNum}\\b`, 'i'))) return true;
      // S/RS variants: A4 -> S4, RS4
      if (audiPrefix === 'a') {
        if (v.match(new RegExp(`^s${audiNum}\\b`, 'i'))) return true;
        if (v.match(new RegExp(`^rs${audiNum}\\b`, 'i'))) return true;
      }
      if (audiPrefix === 'q') {
        if (v.match(new RegExp(`^sq${audiNum}\\b`, 'i'))) return true;
        if (v.match(new RegExp(`^rsq${audiNum}\\b`, 'i'))) return true;
      }
    }
    
    // Audi e-tron variants
    if (s.includes('e tron') || s.includes('etron')) {
      if (v.includes('e tron') || v.includes('etron')) return true;
    }
    
    // === Lexus ===
    // "ES" matches "ES350", "ES300h", etc.
    // "RX" matches "RX350", "RX450h", "RX500h", etc.
    const lexusMatch = s.match(/^([a-z]{2,3})$/i);
    if (lexusMatch) {
      const lexusModel = lexusMatch[1].toLowerCase();
      if (['es', 'is', 'ls', 'gs', 'rx', 'nx', 'ux', 'gx', 'lx', 'rc', 'lc'].includes(lexusModel)) {
        if (v.match(new RegExp(`^${lexusModel}\\d`, 'i'))) return true;
      }
    }
    
    // === Infiniti ===
    // "Q50" matches "Q50 3.0t", "Q50 Red Sport", etc.
    // "QX60" matches "QX60 Luxe", etc.
    const infinitiMatch = s.match(/^(q|qx)(\d+)$/i);
    if (infinitiMatch && v.match(new RegExp(`^${infinitiMatch[1]}${infinitiMatch[2]}\\b`, 'i'))) return true;
    
    // === Acura ===
    // "TLX" matches "TLX A-Spec", "TLX Type S", etc.
    const acuraModels = ['tlx', 'mdx', 'rdx', 'ilx', 'nsx', 'integra'];
    for (const model of acuraModels) {
      if (s === model && v.startsWith(model)) return true;
    }
    
    // === Genesis ===
    // "G70" matches "G70 3.3T", "G70 Sport", etc.
    // "GV70" matches "GV70 3.5T", etc.
    const genesisMatch = s.match(/^(g|gv)(\d+)$/i);
    if (genesisMatch && v.match(new RegExp(`^${genesisMatch[1]}${genesisMatch[2]}\\b`, 'i'))) return true;
    
    // === Porsche ===
    // "911" matches "911 Carrera", "911 Turbo", "911 GT3", etc.
    // "Cayenne" matches "Cayenne S", "Cayenne Turbo", etc.
    const porscheNumMatch = s.match(/^(\d{3})$/);
    if (porscheNumMatch && v.startsWith(porscheNumMatch[1])) return true;
    
    const porscheModels = ['cayenne', 'macan', 'panamera', 'taycan', 'boxster', 'cayman'];
    for (const model of porscheModels) {
      if (s === model && v.startsWith(model)) return true;
    }
    
    // === Volvo ===
    // "S60" matches "S60 T5", "S60 Recharge", etc.
    // "XC90" matches "XC90 T6", "XC90 Recharge", etc.
    const volvoMatch = s.match(/^(s|v|xc|c)(\d+)$/i);
    if (volvoMatch && v.match(new RegExp(`^${volvoMatch[1]}${volvoMatch[2]}\\b`, 'i'))) return true;
    
    // === Land Rover / Range Rover ===
    // "Range Rover" matches "Range Rover Sport", "Range Rover Velar", etc.
    if (s === 'range rover' && v.startsWith('range rover')) return true;
    if (s === 'discovery' && v.startsWith('discovery')) return true;
    if (s === 'defender' && v.startsWith('defender')) return true;
    
    // === Jaguar ===
    // "F-Type" matches "F-Type R", "F-Type SVR", etc.
    // "XF" matches "XF 30t", etc.
    const jaguarMatch = s.match(/^([a-z]+)\s*type$/i);
    if (jaguarMatch && v.match(new RegExp(`^${jaguarMatch[1]}\\s*type`, 'i'))) return true;
    
    const jaguarModels = ['xf', 'xe', 'xj', 'e pace', 'f pace', 'i pace'];
    for (const model of jaguarModels) {
      if (s === model && v.startsWith(model.replace(' ', ''))) return true;
      if (s === model && v.startsWith(model)) return true;
    }
    
    // === Tesla ===
    // "Model 3" matches "Model 3 Long Range", "Model 3 Performance", etc.
    const teslaMatch = s.match(/^model\s*([3sxy])$/i);
    if (teslaMatch && v.match(new RegExp(`^model\\s*${teslaMatch[1]}`, 'i'))) return true;
    
    // === Cadillac ===
    // "CT5" matches "CT5-V", "CT5 Premium Luxury", etc.
    // "Escalade" matches "Escalade ESV", etc.
    const cadillacMatch = s.match(/^(ct|xt)(\d+)$/i);
    if (cadillacMatch && v.match(new RegExp(`^${cadillacMatch[1]}${cadillacMatch[2]}`, 'i'))) return true;
    
    if (s === 'escalade' && v.startsWith('escalade')) return true;
    
    // === Lincoln ===
    // "Navigator" matches "Navigator L", "Navigator Reserve", etc.
    const lincolnModels = ['navigator', 'aviator', 'nautilus', 'corsair'];
    for (const model of lincolnModels) {
      if (s === model && v.startsWith(model)) return true;
    }
    
    // === Alfa Romeo ===
    // "Giulia" matches "Giulia Ti", "Giulia Quadrifoglio", etc.
    const alfaModels = ['giulia', 'stelvio', 'tonale'];
    for (const model of alfaModels) {
      if (s === model && v.startsWith(model)) return true;
    }
    
    // === Maserati ===
    const maseratiModels = ['ghibli', 'quattroporte', 'levante', 'grecale', 'mc20'];
    for (const model of maseratiModels) {
      if (s === model && v.startsWith(model)) return true;
    }
    
    // === Generic: Extract base model from variant ===
    // If variant has numbers/letters after base, try matching
    const baseModelMatch = v.match(/^([a-z]+\d*)/i);
    if (baseModelMatch && baseModelMatch[1].toLowerCase() === cleanSeries) return true;
    
    return false;
  };

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
    
    // Check model mismatch (smart comparison for series/variants)
    if (scraped.model && decoded.model) {
      const scrapedModel = scraped.model;
      const decodedModel = decoded.model;
      const normalizedScraped = normalize(scrapedModel);
      const normalizedDecoded = normalize(decodedModel);
      
      // Check direct containment or series/variant relationship
      const isMatch = 
        normalizedScraped.includes(normalizedDecoded) || 
        normalizedDecoded.includes(normalizedScraped) ||
        isModelVariantOfSeries(decodedModel, scrapedModel) ||
        isModelVariantOfSeries(scrapedModel, decodedModel);
      
      if (!isMatch) {
        mismatches.push(`Model: Listing says "${scrapedModel}", VIN shows "${decodedModel}"`);
      }
    }
    
    return mismatches.length > 0 ? mismatches : null;
  };

  const mismatchWarning = getMismatchWarning();

  return (
    <div className="space-y-6">
      {/* URL Tutorial */}
      <URLTutorial open={showHelpVideo} onClose={() => setShowHelpVideo(false)} />
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
              <Camera className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Quick Import from Listing</CardTitle>
            </div>
            <CardDescription>
              Upload screenshots of the listing from marketplace (AutoTrader, CarGurus, Cars.com, Dealer Site etc.) <span className="font-bold">Easiest for Mobile Users.</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* How it works tutorial trigger - above upload area */}
            <motion.button
              type="button"
              onClick={() => setShowTutorial(true)}
              className="flex items-center justify-center gap-2 w-full rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm font-semibold text-primary hover:bg-primary/10 transition-colors"
              animate={{ scale: [1, 1.02, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              <motion.span
                animate={{ rotate: [0, 15, -15, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 1 }}
              >
                <HelpCircle className="h-5 w-5" />
              </motion.span>
              How do I do this?
            </motion.button>

            <ScreenshotTutorial open={showTutorial} onClose={() => setShowTutorial(false)} />

            {/* Screenshot Upload - Primary Option */}
            <div
              className={`relative flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-6 transition-colors cursor-pointer ${
                isDragging
                  ? "border-primary bg-primary/10"
                  : "border-primary/40 hover:border-primary hover:bg-primary/5"
              }`}
              onClick={() => !isExtractingScreenshot && document.getElementById("screenshot-upload")?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const dt = e.dataTransfer;
                if (dt.files.length > 0) {
                  const input = document.getElementById("screenshot-upload") as HTMLInputElement;
                  if (input) {
                    const dataTransfer = new DataTransfer();
                    for (let i = 0; i < dt.files.length; i++) {
                      dataTransfer.items.add(dt.files[i]);
                    }
                    input.files = dataTransfer.files;
                    input.dispatchEvent(new Event("change", { bubbles: true }));
                  }
                }
              }}
            >
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
                {isExtractingScreenshot ? (
                  <Loader2 className="h-6 w-6 text-primary animate-spin" />
                ) : (
                  <Camera className="h-6 w-6 text-primary" />
                )}
              </div>
              <div className="text-center">
                <p className="font-semibold text-base">
                  {isExtractingScreenshot ? "Extracting details..." : "Upload Listing Screenshots"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  or drop / paste (Ctrl+V) images here
                </p>
              </div>
              <input
                id="screenshot-upload"
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleScreenshotUpload}
              />
            </div>

            {/* Divider */}
            <div className="flex flex-col items-center gap-1.5">
              <div className="flex items-center gap-3 w-full">
                <div className="flex-1 h-px bg-border" />
                <span className="text-sm text-muted-foreground font-semibold">or paste marketplace listing URL</span>
                <div className="flex-1 h-px bg-border" />
              </div>
              <motion.button
                type="button"
                onClick={() => setShowHelpVideo(true)}
                className="inline-flex items-center gap-1.5 text-primary hover:text-primary/80 text-xs font-semibold transition-colors"
                animate={{ scale: [1, 1.03, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              >
                <motion.span
                  animate={{ rotate: [0, 15, -15, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 1 }}
                >
                  <HelpCircle className="h-4 w-4" />
                </motion.span>
                How do I do this?
              </motion.button>
            </div>

            {/* URL Import - Secondary Option */}
            <Form {...listingUrlForm}>
              <form onSubmit={listingUrlForm.handleSubmit(handleListingUrlSubmit)} className="space-y-3">
                <FormField
                  control={listingUrlForm.control}
                  name="listingUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input 
                          placeholder="https://www.cars.com/vehicledetail/..." 
                          {...field}
                          className="bg-background"
                        />
                      </FormControl>
                      <FormDescription className="flex flex-wrap gap-2 items-center">
                        <span className="text-xs">Supported:</span>
                        <Badge variant="outline" className="text-xs">Cars.com</Badge>
                        <Badge variant="outline" className="text-xs">CarGurus</Badge>
                        <Badge variant="outline" className="text-xs">CarMax</Badge>
                        <Badge variant="outline" className="text-xs">Carvana</Badge>
                        <Badge variant="outline" className="text-xs">eBay Motors</Badge>
                        <Badge variant="outline" className="text-xs">Craigslist</Badge>
                        <Badge variant="outline" className="text-xs">BringaTrailer.com</Badge>
                        <Badge variant="outline" className="text-xs">Most Dealer Sites</Badge>
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" size="default" disabled={isLoading || isDecodingVin || isExtractingScreenshot} className="gap-2 w-full sm:w-auto">
                  {(isLoading || isDecodingVin) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isDecodingVin ? "Decoding VIN..." : isLoading ? "Importing..." : <><LinkIcon className="h-4 w-4" />Import from URL</>}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* Import Failed Fallback Alert */}
      {importFailed && !importedListing && (
        <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
          <AlertCircle className="h-5 w-5" />
          <AlertTitle className="font-semibold">Import Unsuccessful</AlertTitle>
          <AlertDescription className="mt-2 space-y-3">
            <p className="text-sm">{importFailed.error}</p>
            <div className="flex flex-col gap-2 text-sm">
              <p className="font-medium">Please enter the vehicle details manually:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
                <li>Use the <strong>VIN lookup</strong> tab if you have the VIN number</li>
                <li>Or use <strong>Manual entry</strong> to select year, make, and model</li>
              </ul>
            </div>
            <div className="flex gap-2 pt-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  setImportFailed(null);
                  listingUrlForm.reset();
                }}
              >
                Try Another URL
              </Button>
              <Button 
                variant="secondary" 
                size="sm"
                onClick={() => setActiveTab("vin")}
              >
                Enter VIN Instead
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Facebook Marketplace Paste Helper */}
      {showFacebookHelper && !importedListing && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Facebook Marketplace</CardTitle>
              </div>
              <Badge variant="secondary" className="text-xs">Manual Entry</Badge>
            </div>
            <CardDescription>
              Facebook Marketplace can't be auto-imported. Copy the details from the listing and paste them below.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground mb-2 font-medium">💡 Quick tip: Open the Facebook listing in another tab and copy each field.</p>
            </div>
            <FacebookPasteForm 
              onComplete={(vehicle) => {
                onComplete(vehicle);
              }}
              onCancel={() => {
                setShowFacebookHelper(false);
                listingUrlForm.reset();
              }}
            />
          </CardContent>
        </Card>
      )}

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
                               <FormLabel className="flex items-center gap-2">
                                 VIN
                                 <VinLocationTooltip />
                               </FormLabel>
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
                                Find the VIN on the driver's side dashboard or door Jam.
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
