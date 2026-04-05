import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Fuel, DollarSign, Gauge, TrendingUp, Car, HelpCircle, Zap, Battery, MapPin, Loader2, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { 
  calculateTCO, 
  calculateMonthlyOwnershipCost,
  type TCOResult 
} from "@/lib/tco-calculations";
import { getStateFromZip } from "@/lib/sales-tax-data";

// National averages as of early 2025
const NATIONAL_AVG_GAS_PRICE = 3.25;
const NATIONAL_AVG_ELECTRICITY_PRICE = 0.15; // $/kWh

interface GasPriceData {
  regular: number | null;
  midGrade: number | null;
  premium: number | null;
  diesel: number | null;
  electricity: number | null;
  location: string;
  source: string;
}

interface FuelEconomyCardProps {
  mpgCity: number | null;
  mpgHighway: number | null;
  mpgCombined: number | null;
  fuelType: string | null;
  askingPrice: number;
  make: string;
  model: string;
  year: number;
  depreciationTable?: unknown;
  evRange?: number | null;
  onAnnualMilesChange?: (miles: number) => void;
  zipCode?: string;
  onZipCodeSave?: (zip: string) => void;
  /** Interest amount + fees from financing (added to TCO) */
  financingCost?: number;
}

export function FuelEconomyCard({
  mpgCity,
  mpgHighway,
  mpgCombined,
  fuelType,
  askingPrice,
  make,
  model,
  year,
  depreciationTable,
  evRange,
  onAnnualMilesChange,
  zipCode,
  onZipCodeSave,
  financingCost = 0,
}: FuelEconomyCardProps) {
  const [annualMiles, setAnnualMiles] = useState(12000);
  const [gasPricePerGallon, setGasPricePerGallon] = useState(NATIONAL_AVG_GAS_PRICE);
  const [gasPriceInput, setGasPriceInput] = useState(NATIONAL_AVG_GAS_PRICE.toFixed(2));
  const [electricityPrice, setElectricityPrice] = useState(NATIONAL_AVG_ELECTRICITY_PRICE);
  const [electricityPriceInput, setElectricityPriceInput] = useState(NATIONAL_AVG_ELECTRICITY_PRICE.toFixed(2));
  const [localGasData, setLocalGasData] = useState<GasPriceData | null>(null);
  const [isLoadingGasPrice, setIsLoadingGasPrice] = useState(false);
  const [gasPriceSource, setGasPriceSource] = useState<"national" | "local">("national");
  const [zipInput, setZipInput] = useState(zipCode || "");
  const [zipError, setZipError] = useState("");

  // Sync zipInput when zipCode prop updates (e.g. from async report load)
  useEffect(() => {
    if (zipCode && /^\d{5}$/.test(zipCode)) {
      setZipInput(zipCode);
    }
  }, [zipCode]);
  const [geoDenied, setGeoDenied] = useState(false);

  const isElectric = fuelType?.toLowerCase().includes("electric");

  // Fetch local gas prices — use zipCode if available, otherwise try browser geolocation
  useEffect(() => {
    const fetchGasPrices = async (zip: string) => {
      setIsLoadingGasPrice(true);
      try {
        const { data, error } = await supabase.functions.invoke("lookup-gas-price", {
          body: { zipCode: zip },
        });

        if (error) throw error;
        if (data?.success && data.data) {
          const gasData = data.data as GasPriceData;
          setLocalGasData(gasData);

          const localGasPrice = gasData.midGrade || gasData.regular;
          if (localGasPrice && localGasPrice > 0) {
            setGasPricePerGallon(localGasPrice);
            setGasPriceInput(localGasPrice.toFixed(2));
            setGasPriceSource("local");
          }

          if (gasData.electricity && gasData.electricity > 0) {
            setElectricityPrice(gasData.electricity);
            setElectricityPriceInput(gasData.electricity.toFixed(2));
          }
        }
      } catch (err) {
        console.error("Failed to fetch local gas prices:", err);
      } finally {
        setIsLoadingGasPrice(false);
      }
    };

    if (zipCode && /^\d{5}$/.test(zipCode)) {
      fetchGasPrices(zipCode);
      return;
    }

    // Fallback: use browser geolocation to reverse-geocode a ZIP
    if (!("geolocation" in navigator)) return;

    setIsLoadingGasPrice(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          // Use free reverse geocoding to get ZIP code
          const geoRes = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`,
            { headers: { "User-Agent": "CarWise/1.0" } }
          );
          if (geoRes.ok) {
            const geoData = await geoRes.json();
            const detectedZip = geoData?.address?.postcode?.substring(0, 5);
            if (detectedZip && /^\d{5}$/.test(detectedZip)) {
              await fetchGasPrices(detectedZip);
              return;
            }
          }
        } catch (err) {
          console.error("Geolocation reverse geocode failed:", err);
        }
        setIsLoadingGasPrice(false);
      },
      () => {
        // User denied geolocation — show prompt to enter ZIP manually
        setIsLoadingGasPrice(false);
        setGeoDenied(true);
      },
      { timeout: 5000 }
    );
  }, [zipCode]);

  // Resolve state from ZIP for insurance estimate
  const resolvedState = zipCode ? getStateFromZip(zipCode) : (zipInput && /^\d{5}$/.test(zipInput) ? getStateFromZip(zipInput) : null);

  // Calculate TCO with user-adjustable mileage and energy price
  const tco = calculateTCO(
    askingPrice,
    mpgCombined,
    fuelType,
    depreciationTable,
    { 
      annualMiles, 
      gasPricePerGallon: isElectric ? gasPricePerGallon : gasPricePerGallon,
      electricityPerKwh: electricityPrice 
    },
    { make, year, model, stateCode: resolvedState }
  );

  const monthlyOwnership = calculateMonthlyOwnershipCost(tco);

  // Determine fuel efficiency rating - different thresholds for EVs
  const getFuelRating = () => {
    if (!mpgCombined) return { label: "Unknown", color: "bg-muted text-muted-foreground" };
    
    if (isElectric) {
      if (mpgCombined >= 120) return { label: "Excellent", color: "bg-success/10 text-success" };
      if (mpgCombined >= 100) return { label: "Good", color: "bg-success/10 text-success" };
      if (mpgCombined >= 85) return { label: "Average", color: "bg-warning/10 text-warning" };
      return { label: "Below Average", color: "bg-destructive/10 text-destructive" };
    }
    
    if (mpgCombined >= 35) return { label: "Excellent", color: "bg-success/10 text-success" };
    if (mpgCombined >= 28) return { label: "Good", color: "bg-success/10 text-success" };
    if (mpgCombined >= 22) return { label: "Average", color: "bg-warning/10 text-warning" };
    return { label: "Below Average", color: "bg-destructive/10 text-destructive" };
  };

  const fuelRating = getFuelRating();
  const normalizedFuelType = isElectric ? "Electric" : (fuelType || "Gasoline").charAt(0).toUpperCase() + (fuelType || "gasoline").slice(1).toLowerCase();

  const fetchGasPricesByZip = async (zip: string) => {
    setIsLoadingGasPrice(true);
    setZipError("");
    try {
      const { data, error } = await supabase.functions.invoke("lookup-gas-price", {
        body: { zipCode: zip },
      });
      if (error) throw error;
      if (data?.success && data.data) {
        const gasData = data.data as GasPriceData;
        setLocalGasData(gasData);
        const localGasPrice = gasData.midGrade || gasData.regular;
        if (localGasPrice && localGasPrice > 0) {
          setGasPricePerGallon(localGasPrice);
          setGasPriceInput(localGasPrice.toFixed(2));
          setGasPriceSource("local");
        }
        if (gasData.electricity && gasData.electricity > 0) {
          setElectricityPrice(gasData.electricity);
          setElectricityPriceInput(gasData.electricity.toFixed(2));
        }
        // Persist the ZIP code back to the report
        onZipCodeSave?.(zip);
      } else {
        setZipError("No price data found for this ZIP code.");
      }
    } catch {
      setZipError("Couldn't fetch prices. Check the ZIP and try again.");
    } finally {
      setIsLoadingGasPrice(false);
    }
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setZipError("Geolocation is not supported by your browser.");
      return;
    }
    setIsLoadingGasPrice(true);
    setZipError("");
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${coords.latitude}&lon=${coords.longitude}&format=json&addressdetails=1`,
            { headers: { "User-Agent": "CarWise/1.0 (https://carwise.expert)" } }
          );
          if (!res.ok) throw new Error("Geocoding failed");
          const data = await res.json();
          const zip = data?.address?.postcode?.replace(/\D/g, "").substring(0, 5);
          if (zip && /^\d{5}$/.test(zip)) {
            setZipInput(zip);
            await fetchGasPricesByZip(zip);
          } else {
            setZipError("Couldn't determine ZIP from location. Enter manually.");
            setIsLoadingGasPrice(false);
          }
        } catch {
          setZipError("Location lookup failed. Enter ZIP manually.");
          setIsLoadingGasPrice(false);
        }
      },
      () => {
        setZipError("Location access denied. Enter ZIP manually.");
        setIsLoadingGasPrice(false);
      },
      { timeout: 8000 }
    );
  };

  const handleZipSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const zip = zipInput.trim();
    // If ZIP field is empty, use browser geolocation instead
    if (!zip) {
      handleUseCurrentLocation();
      return;
    }
    if (!/^\d{5}$/.test(zip)) {
      setZipError("Please enter a valid 5-digit ZIP code.");
      return;
    }
    fetchGasPricesByZip(zip);
  };

  const handleMileageChange = (value: number[]) => {
    setAnnualMiles(value[0]);
    onAnnualMilesChange?.(value[0]);
  };

  const handleGasPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setGasPriceInput(value);
    setGasPriceSource("national"); // User is manually editing, no longer "local"
    
    const parsed = parseFloat(value);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 10) {
      setGasPricePerGallon(parsed);
    }
  };

  const handleGasPriceBlur = () => {
    const parsed = parseFloat(gasPriceInput);
    if (isNaN(parsed) || parsed <= 0 || parsed > 10) {
      setGasPriceInput(gasPricePerGallon.toFixed(2));
    } else {
      setGasPriceInput(parsed.toFixed(2));
      setGasPricePerGallon(parsed);
    }
  };

  const handleElectricityPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setElectricityPriceInput(value);
    
    const parsed = parseFloat(value);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 1) {
      setElectricityPrice(parsed);
    }
  };

  const handleElectricityPriceBlur = () => {
    const parsed = parseFloat(electricityPriceInput);
    if (isNaN(parsed) || parsed <= 0 || parsed > 1) {
      setElectricityPriceInput(electricityPrice.toFixed(2));
    } else {
      setElectricityPriceInput(parsed.toFixed(2));
      setElectricityPrice(parsed);
    }
  };

  return (
    <Card className="overflow-visible">
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="text-base sm:text-lg leading-snug">
          <Fuel className="h-5 w-5 text-primary shrink-0 inline-block mr-2 align-middle" />
          Fuel Economy &amp; Ownership Cost
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 p-4 pt-0 sm:p-6 sm:pt-0">
        {/* MPG/MPGe Stats */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              {isElectric ? <Zap className="h-4 w-4 text-primary" /> : null}
              {isElectric ? "Energy Efficiency" : "Fuel Economy"}
            </h4>
            <Badge variant="outline" className={cn("text-xs", fuelRating.color)}>
              {fuelRating.label}
            </Badge>
          </div>
          
          {mpgCombined ? (
            <div className={cn("grid gap-3", isElectric && evRange ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3")}>
              <div className="rounded-lg border p-3 text-center">
                <Gauge className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                <p className="text-lg font-bold">{mpgCity || "—"}</p>
                <p className="text-xs text-muted-foreground">City {isElectric ? "MPGe" : "MPG"}</p>
              </div>
              <div className="rounded-lg border p-3 text-center bg-primary/5">
                <Gauge className="h-4 w-4 mx-auto mb-1 text-primary" />
                <p className="text-lg font-bold text-primary">{mpgCombined}</p>
                <p className="text-xs text-muted-foreground">Combined {isElectric ? "MPGe" : "MPG"}</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <Gauge className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                <p className="text-lg font-bold">{mpgHighway || "—"}</p>
                <p className="text-xs text-muted-foreground">Highway {isElectric ? "MPGe" : "MPG"}</p>
              </div>
              {isElectric && evRange && (
                <div className="rounded-lg border p-3 text-center bg-success/5">
                  <Battery className="h-4 w-4 mx-auto mb-1 text-success" />
                  <p className="text-lg font-bold text-success">{evRange}</p>
                  <p className="text-xs text-muted-foreground">Range (mi)</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {isElectric ? "Energy efficiency" : "Fuel economy"} data not available for this vehicle.
            </p>
          )}
          
          <p className="text-xs text-muted-foreground mt-2">
            {isElectric ? "Powertrain" : "Fuel Type"}: {normalizedFuelType}
            {isElectric && " (Battery Electric)"}
          </p>
        </div>

        {/* Local Gas Prices */}
        <div className={cn(
          "rounded-lg border p-3 space-y-3 transition-colors",
          geoDenied && !zipCode && gasPriceSource === "national"
            ? "border-warning/40 bg-warning/5"
            : localGasData ? "border-primary/20 bg-primary/5" : "bg-muted/30"
        )}>
          <div className="flex items-center gap-2">
            <MapPin className={cn("h-4 w-4", localGasData ? "text-primary" : geoDenied && !zipCode && gasPriceSource === "national" ? "text-warning" : "text-muted-foreground")} />
            <span className="text-sm font-medium">
              {localGasData ? `Local Gas Prices — ${localGasData.location}` : "Local Gas Prices"}
            </span>
            {gasPriceSource === "local" && localGasData && (
              <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                Live
              </Badge>
            )}
          </div>

          {geoDenied && !zipCode && gasPriceSource === "national" && (
            <p className="text-xs text-warning-foreground bg-warning/10 border border-warning/20 rounded-md px-2.5 py-2 leading-relaxed">
              📍 Allowing location access or entering your ZIP code allows us to generate a much more accurate regionally-based analysis — including car values, gas prices, and total cost of ownership.
            </p>
          )}

          <form onSubmit={handleZipSubmit} className="flex items-center gap-2">
            <Input
              type="text"
              inputMode="numeric"
              placeholder="Enter ZIP code"
              value={zipInput}
              onChange={(e) => { setZipInput(e.target.value); setZipError(""); }}
              maxLength={5}
              className="h-8 w-32 text-sm"
            />
            <button
              type="submit"
              disabled={isLoadingGasPrice}
              className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5 transition-colors"
            >
              {isLoadingGasPrice ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <MapPin className="h-3.5 w-3.5" />
              )}
              {isLoadingGasPrice ? "Looking up…" : "Look up"}
            </button>
          </form>
          {zipError && <p className="text-xs text-destructive">{zipError}</p>}

          {localGasData && !isLoadingGasPrice && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              {localGasData.regular != null && localGasData.regular > 0 && (
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Regular</p>
                  <p className="text-sm font-bold">${localGasData.regular.toFixed(2)}</p>
                </div>
              )}
              {localGasData.midGrade != null && localGasData.midGrade > 0 && (
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Mid-Grade</p>
                  <p className="text-sm font-bold text-primary">${localGasData.midGrade.toFixed(2)}</p>
                </div>
              )}
              {localGasData.premium != null && localGasData.premium > 0 && (
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Premium</p>
                  <p className="text-sm font-bold">${localGasData.premium.toFixed(2)}</p>
                </div>
              )}
              {localGasData.diesel != null && localGasData.diesel > 0 && (
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Diesel</p>
                  <p className="text-sm font-bold">${localGasData.diesel.toFixed(2)}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Annual Mileage Slider */}
        <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Car className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Expected Annual Mileage</span>
            </div>
            <Badge variant="secondary" className="text-sm font-bold">
              {annualMiles.toLocaleString()} mi/yr
            </Badge>
          </div>
          <Slider
            value={[annualMiles]}
            onValueChange={handleMileageChange}
            min={5000}
            max={19000}
            step={1000}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>5,000 mi</span>
            <span>12,000 mi (avg)</span>
            <span>19,000 mi</span>
          </div>
        </div>

        {/* Annual Fuel Cost */}
        <div className="rounded-lg border p-3 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            {isElectric ? (
              <Zap className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Fuel className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="text-xs text-muted-foreground">
              Annual {isElectric ? "Electricity" : "Fuel"}
            </span>
          </div>
          <p className="text-lg font-bold">${tco.annualFuelCost.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">(~${Math.round(tco.annualFuelCost / 12)}/mo)</span></p>
          <p className="text-[10px] text-muted-foreground mt-1">
            * Based on {annualMiles.toLocaleString()} miles/year
            {isElectric 
              ? `, $${electricityPrice.toFixed(2)}/kWh electricity` 
              : `, $${gasPricePerGallon.toFixed(2)}/gal gas`
            }
            {gasPriceSource === "local" && localGasData ? ` (${localGasData.location})` : ""}
            . Maintenance scales with mileage.
            {annualMiles > 12000 && " Excess mileage (above 12k/yr) adds ~$0.18/mi in depreciation."}
          </p>
        </div>

        <div>
          <h4 className="text-sm font-medium mb-3">5-Year Total Cost of Ownership</h4>
          <div className="rounded-lg bg-muted/50 p-4 space-y-3">
            {/* Editable Energy Price - Gas or Electricity */}
            {isElectric ? (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  Electricity Price
                  {gasPriceSource === "local" && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/20">
                      <MapPin className="h-2.5 w-2.5 mr-0.5" />Local
                    </Badge>
                  )}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-sm">
                          {localGasData?.electricity
                            ? `Local residential electricity rate for ${localGasData.location}. Adjust to match your actual utility bill.`
                            : "National average residential electricity rate. Adjust to match your local utility rates for more accurate estimates."
                          }
                          {" "}Home charging is typically $0.10-0.20/kWh; public charging can be $0.30-0.50/kWh.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-medium">$</span>
                  <Input
                    type="number"
                    value={electricityPriceInput}
                    onChange={handleElectricityPriceChange}
                    onBlur={handleElectricityPriceBlur}
                    step="0.01"
                    min="0.05"
                    max="1"
                    className="w-20 h-8 text-right font-medium"
                  />
                  <span className="text-sm text-muted-foreground">/kWh</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  Gas Price (89 octane avg.)
                  {gasPriceSource === "local" && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/20">
                      <MapPin className="h-2.5 w-2.5 mr-0.5" />Local
                    </Badge>
                  )}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-sm">
                          {gasPriceSource === "local" && localGasData
                            ? `Local mid-grade gas price for ${localGasData.location}. Adjust to match prices at your usual station.`
                            : "National average price for 89 octane (mid-grade) gasoline. Adjust to match your local fuel prices for more accurate estimates."
                          }
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-medium">$</span>
                  <Input
                    type="number"
                    value={gasPriceInput}
                    onChange={handleGasPriceChange}
                    onBlur={handleGasPriceBlur}
                    step="0.01"
                    min="1"
                    max="10"
                    className="w-20 h-8 text-right font-medium"
                  />
                  <span className="text-sm text-muted-foreground">/gal</span>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Purchase Price</span>
              <span className="font-medium">${tco.purchasePrice.toLocaleString()}</span>
            </div>
            {financingCost > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  Loan Interest &amp; Fees
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-sm">
                          Total loan interest and dealer/doc fees from your financing details. This represents the additional cost of financing vs paying cash.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </span>
                <span className="font-medium text-warning">
                  +${financingCost.toLocaleString()}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Est. {isElectric ? "Electricity" : "Fuel"} Cost (5 yr)
              </span>
              <span className="font-medium">${tco.fuelCost5Year.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                Est. Repairs (5 yr)
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                       <p className="text-sm">
                         Expected repair costs are probability-weighted based on documented failure rates for this make/model/year. Range reflects probability-weighted expected costs (low) to maximum plausible scenario if major failures occur (high).
                       </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </span>
              <span className="font-medium text-danger">
                ${tco.repairCost5Year.toLocaleString()}
                {tco.worstCaseRepairCost5Year > 0 && tco.worstCaseRepairCost5Year !== tco.repairCost5Year && (
                  <span className="text-xs text-muted-foreground ml-1">– ${tco.worstCaseRepairCost5Year.toLocaleString()}</span>
                )}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Est. Maintenance (5 yr)</span>
              <span className="font-medium">${tco.maintenanceCost5Year.toLocaleString()}</span>
            </div>
            {tco.insuranceCost5Year > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Shield className="h-3.5 w-3.5" />
                  Est. Insurance (5 yr)
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-sm">
                          Estimated based on NAIC state averages and HLDI vehicle loss data. Assumes standard driver profile (35–40 yrs, clean record, good credit, 12,000 mi/yr, full coverage). Your actual rate will vary based on personal factors.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </span>
                <span className="font-medium">
                  ${tco.insuranceCost5Year.toLocaleString()}
                  {tco.insuranceCost5YearHigh > 0 && tco.insuranceCost5YearHigh !== tco.insuranceCost5Year && (
                    <span className="text-xs text-muted-foreground ml-1">– ${tco.insuranceCost5YearHigh.toLocaleString()}</span>
                  )}
                </span>
              </div>
            )}
            {(tco.mileageDepreciation ?? 0) > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  Excess Mileage Depreciation
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-sm">
                          <strong>How it's calculated:</strong> Driving above 12,000 miles/year adds ~$0.18 per excess mile in depreciation. 
                          This reflects the reduced resale value from higher-than-average mileage accumulation over 5 years.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </span>
                <span className="font-medium text-warning">
                  +${tco.mileageDepreciation?.toLocaleString()}
                </span>
              </div>
            )}
            <div className="border-t pt-3 flex items-center justify-between">
              <span className="font-semibold">Total 5-Year Cost</span>
              <span className="text-lg font-bold text-danger">
                ${(tco.totalTCO + financingCost).toLocaleString()}
                {tco.worstCaseTCO > 0 && tco.worstCaseTCO !== tco.totalTCO && (
                  <span className="text-sm font-normal text-muted-foreground ml-1">– ${(tco.worstCaseTCO + financingCost).toLocaleString()}</span>
                )}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground -mt-1">
              Range: probability-weighted expected costs (low) to maximum plausible scenario if major failures occur (high).
            </p>
          </div>

          {/* Monthly Ownership Cost */}
          <div className="rounded-lg border p-3 min-w-0 mt-3 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground truncate">Monthly Ownership</span>
            </div>
            <p className="text-lg font-bold">${monthlyOwnership} <span className="text-sm font-normal text-muted-foreground">(fuel + maintenance)</span></p>
          </div>
        </div>


        {/* Cost Per Mile */}
        <div className="flex items-center justify-between rounded-lg bg-primary/5 p-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Cost Per Mile</span>
          </div>
          <span className="text-lg font-bold text-danger">${tco.costPerMile.toFixed(2)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
