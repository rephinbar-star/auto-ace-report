import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { SEO } from "@/components/seo/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink,
  PaginationNext, PaginationPrevious, PaginationEllipsis,
} from "@/components/ui/pagination";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import {
  Search, SlidersHorizontal, MapPin, Gauge, Car, Fuel,
  ArrowUpDown, RefreshCw, ExternalLink, ChevronRight, Tag, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getMakes, getModels } from "@/lib/nhtsa";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Listing {
  id: string;
  year: number;
  make: string;
  model: string;
  trim: string | null;
  mileage: number | null;
  asking_price: number;
  condition: string | null;
  zip_code: string | null;
  city: string | null;
  state: string | null;
  images: string[] | null;
  listing_url: string | null;
  source: string;
  seller_type: string | null;
  body_style: string | null;
  fuel_type: string | null;
  transmission: string | null;
  exterior_color: string | null;
  description: string | null;
  status: string;
  created_at: string;
}

interface SearchFilters {
  make: string;
  model: string;
  minYear: string;
  maxYear: string;
  minPrice: number;
  maxPrice: number;
  maxMileage: number;
  zipCode: string;
  radiusMiles: number;
  bodyStyle: string;
  sortBy: string;
}

const DEFAULT_FILTERS: SearchFilters = {
  make: "",
  model: "",
  minYear: "",
  maxYear: "",
  minPrice: 0,
  maxPrice: 150000,
  maxMileage: 200000,
  zipCode: "",
  radiusMiles: 100,
  bodyStyle: "",
  sortBy: "distance",
};

const BODY_STYLES = ["Sedan", "SUV", "Truck", "Coupe", "Convertible", "Hatchback", "Van", "Wagon", "Minivan"];
const SORT_OPTIONS = [
  { value: "newest", label: "Newest First" },
  { value: "distance", label: "Distance: Nearest First" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "mileage_asc", label: "Mileage: Low to High" },
  { value: "year_desc", label: "Year: Newest First" },
];
const RADIUS_OPTIONS = [25, 50, 100, 250, 500];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 1979 }, (_, i) => CURRENT_YEAR + 1 - i);
const PAGE_SIZE = 20;

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatPrice(p: number) {
  return `$${p.toLocaleString()}`;
}

function conditionColor(c: string | null) {
  switch (c) {
    case "excellent": return "bg-[hsl(142_72%_42%/0.12)] text-[hsl(142,72%,32%)] dark:text-[hsl(142,72%,65%)]";
    case "good":      return "bg-[hsl(174_72%_40%/0.12)] text-[hsl(174,72%,32%)] dark:text-[hsl(174,72%,60%)]";
    case "fair":      return "bg-[hsl(38_95%_55%/0.15)] text-[hsl(38,80%,35%)] dark:text-[hsl(38,90%,65%)]";
    case "poor":      return "bg-[hsl(0_72%_51%/0.12)] text-[hsl(0,72%,38%)] dark:text-[hsl(0,72%,68%)]";
    default:          return "bg-muted text-muted-foreground";
  }
}

// No-op: placeholder handled by SVG data URI in the component
function vehiclePlaceholderImage(listing: Listing): string {
  return ""; // signals component to render SVG placeholder
}

function sourceLabel(s: string) {

  if (s === "user_submitted") return "Private";
  if (s === "marketcheck") return "Dealer";
  if (s === "seed") return "Dealer";
  return s;
}

// ─── Listing Card ───────────────────────────────────────────────────────────

// Hue derived from make name for consistent per-brand color
function makeHue(make: string): number {
  let h = 0;
  for (let i = 0; i < make.length; i++) h = (h * 31 + make.charCodeAt(i)) % 360;
  return h;
}

function ListingCard({ listing, onClick }: { listing: Listing; onClick: () => void }) {
  // Only use stored images if they're from a trusted, hotlink-friendly source
  const isUsable = (url: string) =>
    !url.includes("wikimedia.org") &&
    !url.includes("wikipedia.org") &&
    !url.includes("picsum.photos") &&
    url.startsWith("http");

  const img = listing.images?.find(isUsable) ?? null;
  const location = [listing.city, listing.state].filter(Boolean).join(", ") || listing.zip_code;
  const hue = makeHue(listing.make);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.22 }}
    >
      <Card
        className="group overflow-hidden cursor-pointer border-border hover:border-primary/40 hover:shadow-card transition-all duration-200"
        onClick={onClick}
      >
        {/* Image */}
        <div className="relative aspect-[16/10] overflow-hidden" style={{ background: `hsl(${hue} 25% 14%)` }}>
          {img ? (
            <img
              src={img}
              alt={`${listing.year} ${listing.make} ${listing.model}`}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 select-none">
              <Car className="h-12 w-12 opacity-20" style={{ color: `hsl(${hue} 70% 70%)` }} />
              <span className="text-xs font-semibold tracking-widest uppercase opacity-30" style={{ color: `hsl(${hue} 60% 80%)` }}>
                {listing.make}
              </span>
            </div>
          )}
          {/* Source badge */}
          <div className="absolute top-2 left-2">
            <Badge variant="secondary" className="text-xs font-medium backdrop-blur-sm bg-background/80">
              {sourceLabel(listing.source)}
            </Badge>
          </div>
          {/* Condition badge */}
          {listing.condition && (
            <div className="absolute top-2 right-2">
              <Badge className={cn("text-xs font-medium capitalize backdrop-blur-sm border-0", conditionColor(listing.condition))}>
                {listing.condition}
              </Badge>
            </div>
          )}
        </div>

        <CardContent className="p-4 space-y-3">
          {/* Title + price */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-semibold text-foreground leading-snug truncate">
                {listing.year} {listing.make} {listing.model}
              </h3>
              {listing.trim && (
                <p className="text-xs text-muted-foreground truncate">{listing.trim}</p>
              )}
            </div>
            <span className="text-lg font-bold text-primary shrink-0 tabular-nums">
              {formatPrice(listing.asking_price)}
            </span>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
            {listing.mileage != null && (
              <span className="flex items-center gap-1">
                <Gauge className="h-3 w-3" />
                {listing.mileage.toLocaleString()} mi
              </span>
            )}
            {listing.fuel_type && (
              <span className="flex items-center gap-1">
                <Fuel className="h-3 w-3" />
                {listing.fuel_type}
              </span>
            )}
            {location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {location}
              </span>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-1 border-t border-border">
            <span className="text-xs text-muted-foreground">
              {listing.body_style || "Vehicle"}
            </span>
            <span className="text-xs font-medium text-primary flex items-center gap-1 group-hover:gap-2 transition-all">
              View details <ChevronRight className="h-3 w-3" />
            </span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Listing Card Skeleton ──────────────────────────────────────────────────

function ListingCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <Skeleton className="aspect-[16/10] w-full rounded-none" />
      <CardContent className="p-4 space-y-3">
        <div className="flex justify-between gap-2">
          <div className="space-y-1.5 flex-1">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-6 w-20" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-px w-full" />
        <div className="flex justify-between">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-20" />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Filter Panel ───────────────────────────────────────────────────────────

interface FilterPanelProps {
  filters: SearchFilters;
  onChange: (f: Partial<SearchFilters>) => void;
  onReset: () => void;
  makes: string[];
  models: string[];
  activeCount: number;
  locationDetecting?: boolean;
}

function FilterPanel({ filters, onChange, onReset, makes, models, activeCount, locationDetecting }: FilterPanelProps) {
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-sm text-foreground flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-primary" />
          Filters
          {activeCount > 0 && (
            <Badge className="h-5 text-xs bg-primary text-primary-foreground">{activeCount}</Badge>
          )}
        </h2>
        {activeCount > 0 && (
          <Button variant="ghost" size="sm" onClick={onReset} className="h-7 text-xs text-muted-foreground hover:text-foreground">
            <X className="h-3 w-3 mr-1" /> Clear
          </Button>
        )}
      </div>

      <Separator />

      {/* Make */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Make</Label>
        <Select value={filters.make || "all"} onValueChange={v => onChange({ make: v === "all" ? "" : v, model: "" })}>
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder="Any make" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any make</SelectItem>
            {makes.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Model */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Model</Label>
        <Select
          value={filters.model || "all"}
          onValueChange={v => onChange({ model: v === "all" ? "" : v })}
          disabled={!filters.make}
        >
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder={filters.make ? "Any model" : "Select make first"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any model</SelectItem>
            {models.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Year range */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Year</Label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs text-muted-foreground">From</Label>
            <Select value={filters.minYear || "all"} onValueChange={v => onChange({ minYear: v === "all" ? "" : v })}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Any" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any</SelectItem>
                {YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">To</Label>
            <Select value={filters.maxYear || "all"} onValueChange={v => onChange({ maxYear: v === "all" ? "" : v })}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Any" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any</SelectItem>
                {YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Price range */}
      <div className="space-y-3">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Price Range
        </Label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs text-muted-foreground">Min</Label>
            <Select
              value={String(filters.minPrice)}
              onValueChange={v => onChange({ minPrice: Number(v) })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[0,5000,10000,15000,20000,25000,30000,40000,50000,75000].map(p => (
                  <SelectItem key={p} value={String(p)}>{p === 0 ? "No min" : formatPrice(p)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Max</Label>
            <Select
              value={String(filters.maxPrice)}
              onValueChange={v => onChange({ maxPrice: Number(v) })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10000,15000,20000,25000,30000,40000,50000,75000,100000,150000].map(p => (
                  <SelectItem key={p} value={String(p)}>{formatPrice(p)}{p === 150000 ? "+" : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Max mileage */}
      <div className="space-y-3">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Max Mileage
          <span className="ml-2 font-normal normal-case text-foreground">
            {filters.maxMileage >= 200000 ? "Any" : `${filters.maxMileage.toLocaleString()} mi`}
          </span>
        </Label>
        <Slider
          min={0}
          max={200000}
          step={5000}
          value={[filters.maxMileage]}
          onValueChange={([v]) => onChange({ maxMileage: v })}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>0 mi</span>
          <span>200k+ mi</span>
        </div>
      </div>

      {/* Body style */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Body Style</Label>
        <Select value={filters.bodyStyle || "all"} onValueChange={v => onChange({ bodyStyle: v === "all" ? "" : v })}>
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder="Any style" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any style</SelectItem>
            {BODY_STYLES.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Location */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Location</Label>
        <div className="relative">
          <Input
            placeholder={locationDetecting ? "Detecting location…" : "ZIP code"}
            value={filters.zipCode}
            onChange={e => onChange({ zipCode: e.target.value })}
            maxLength={5}
            className="h-9 text-sm"
            disabled={locationDetecting}
          />
          {locationDetecting && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="h-3.5 w-3.5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          )}
        </div>
        {filters.zipCode.length === 5 && (
          <Select
            value={String(filters.radiusMiles)}
            onValueChange={v => onChange({ radiusMiles: Number(v) })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RADIUS_OPTIONS.map(r => (
                <SelectItem key={r} value={String(r)}>Within {r} miles</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
}

// ─── Active filter chip ──────────────────────────────────────────────────────

function ActiveChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border border-primary/30 bg-primary/8 text-xs font-medium text-primary">
      {label}
      <button onClick={onRemove} className="hover:text-destructive transition-colors">
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

// ─── Empty state ────────────────────────────────────────────────────────────

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
      <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
        <Car className="h-8 w-8 text-muted-foreground" />
      </div>
      <div>
        <h3 className="font-semibold text-foreground">No listings found</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-xs">
          Try adjusting your filters or expanding your search radius.
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={onReset} className="gap-2">
          <RefreshCw className="h-4 w-4" /> Reset filters
        </Button>
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function Marketplace() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // State
  const [filters, setFilters] = useState<SearchFilters>(() => ({
    ...DEFAULT_FILTERS,
    make: searchParams.get("make") || "",
    model: searchParams.get("model") || "",
    zipCode: searchParams.get("zip") || "",
  }));
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
  const [page, setPage] = useState(1);
  const [listings, setListings] = useState<Listing[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [makes, setMakes] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [locationDetecting, setLocationDetecting] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-detect user location via geolocation on mount (only if no ZIP in URL)
  useEffect(() => {
    if (filters.zipCode.length === 5) return; // already set from URL
    if (!navigator.geolocation) return;

    setLocationDetecting(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          // Reverse-geocode with Nominatim (same as analysis flow)
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`,
            { headers: { "Accept-Language": "en-US" } }
          );
          if (!res.ok) return;
          const data = await res.json();
          const zip = data.address?.postcode?.slice(0, 5);
          if (zip && /^\d{5}$/.test(zip)) {
            setFilters(prev => ({ ...prev, zipCode: zip, sortBy: "distance" }));
          }
        } catch {
          // silently ignore
        } finally {
          setLocationDetecting(false);
        }
      },
      () => setLocationDetecting(false), // denied — no-op
      { timeout: 8000 }
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load makes
  useEffect(() => {
    getMakes(CURRENT_YEAR).then(setMakes);
  }, []);

  // Load models when make changes
  useEffect(() => {
    if (!filters.make) { setModels([]); return; }
    getModels(filters.make, CURRENT_YEAR).then(setModels);
  }, [filters.make]);

  // Count active filters
  const activeFilterCount = [
    filters.make,
    filters.model,
    filters.minYear,
    filters.maxYear,
    filters.bodyStyle,
    filters.zipCode.length === 5,
    filters.minPrice > 0,
    filters.maxPrice < 150000,
    filters.maxMileage < 200000,
  ].filter(Boolean).length;

  // ─── Fetch from edge function ───────────────────────────────────────────

  const fetchListings = useCallback(async (f: SearchFilters, p: number, q: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("search-marketplace", {
        body: {
          make: f.make || undefined,
          model: f.model || undefined,
          minYear: f.minYear ? Number(f.minYear) : undefined,
          maxYear: f.maxYear ? Number(f.maxYear) : undefined,
          zipCode: f.zipCode.length === 5 ? f.zipCode : undefined,
          radiusMiles: f.radiusMiles,
          minPrice: f.minPrice > 0 ? f.minPrice : undefined,
          maxPrice: f.maxPrice < 150000 ? f.maxPrice : undefined,
          maxMileage: f.maxMileage < 200000 ? f.maxMileage : undefined,
          bodyStyle: f.bodyStyle || undefined,
          page: p,
          limit: PAGE_SIZE,
        },
      });

      if (error) throw error;

      let result: Listing[] = data?.data?.listings ?? [];
      // Use the actual DB count (number of rows matching filters) for pagination,
      // not MarketCheck's global num_found which is far larger than what's stored locally.
      let resultTotal: number = data?.data?.dbCount ?? result.length;

      // Apply local text search filter
      if (q) {
        const lower = q.toLowerCase();
        result = result.filter(l =>
          `${l.year} ${l.make} ${l.model} ${l.trim ?? ""}`.toLowerCase().includes(lower)
        );
        resultTotal = result.length;
      }

      // Sort — "featured" preserves DB ORDER BY (dealer-interleaved random), all others re-sort
      switch (f.sortBy) {
        case "price_asc":   result.sort((a, b) => a.asking_price - b.asking_price); break;
        case "price_desc":  result.sort((a, b) => b.asking_price - a.asking_price); break;
        case "mileage_asc": result.sort((a, b) => (a.mileage ?? 0) - (b.mileage ?? 0)); break;
        case "year_desc":   result.sort((a, b) => b.year - a.year); break;
        case "distance": {
          const userZip = f.zipCode.length === 5 ? Number(f.zipCode) : null;
          if (userZip !== null) {
            result.sort((a, b) => {
              const da = a.zip_code && /^\d{5}$/.test(a.zip_code)
                ? Math.abs(Number(a.zip_code) - userZip) : 999999;
              const db = b.zip_code && /^\d{5}$/.test(b.zip_code)
                ? Math.abs(Number(b.zip_code) - userZip) : 999999;
              return da - db;
            });
          }
          break;
        }
        // "featured" or default: preserve DB interleaved order — do not sort
        default: break;
      }

      setListings(result);
      setTotal(resultTotal);
    } catch (err) {
      console.error("Marketplace search failed:", err);
      setListings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Single unified fetch effect: debounce filter/search changes (reset to p1),
  // but page changes fire immediately.
  // Use serialized values so we compare by content, not object reference.
  const isFirstRender = useRef(true);
  const prevFiltersKey = useRef(JSON.stringify(filters));
  const prevSearchRef = useRef(searchQuery);
  const prevPageRef = useRef(page);

  useEffect(() => {
    const filtersKey = JSON.stringify(filters);
    const filtersChanged = prevFiltersKey.current !== filtersKey || prevSearchRef.current !== searchQuery;
    const pageChanged = prevPageRef.current !== page;

    prevFiltersKey.current = filtersKey;
    prevSearchRef.current = searchQuery;
    prevPageRef.current = page;

    if (isFirstRender.current) {
      isFirstRender.current = false;
      fetchListings(filters, page, searchQuery);
      return;
    }

    if (filtersChanged) {
      // Filters/search changed — debounce and reset to page 1
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setPage(1);
        fetchListings(filters, 1, searchQuery);
      }, 300);
      return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    } else if (pageChanged) {
      // Page changed — fetch immediately and scroll to top
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      fetchListings(filters, page, searchQuery);
    }
  }, [filters, searchQuery, page, fetchListings]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateFilters = (partial: Partial<SearchFilters>) => {
    setFilters(prev => ({ ...prev, ...partial }));
  };

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setSearchQuery("");
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  // ─── Pagination ─────────────────────────────────────────────────────────

  function renderPagination() {
    if (totalPages <= 1) return null;
    const pages: (number | "…")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push("…");
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
      if (page < totalPages - 2) pages.push("…");
      pages.push(totalPages);
    }
    return (
      <Pagination className="mt-8">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              onClick={e => { e.preventDefault(); if (page > 1) setPage(p => p - 1); }}
              className={page === 1 ? "pointer-events-none opacity-50" : ""}
            />
          </PaginationItem>
          {pages.map((p, i) =>
            p === "…" ? (
              <PaginationItem key={`ellipsis-${i}`}>
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={p}>
                <PaginationLink
                  href="#"
                  isActive={p === page}
                  onClick={e => { e.preventDefault(); setPage(p as number); }}
                >
                  {p}
                </PaginationLink>
              </PaginationItem>
            )
          )}
          <PaginationItem>
            <PaginationNext
              href="#"
              onClick={e => { e.preventDefault(); if (page < totalPages) setPage(p => p + 1); }}
              className={page === totalPages ? "pointer-events-none opacity-50" : ""}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <>
      <SEO
        title="Car Marketplace – Find Your Next Vehicle"
        description="Browse thousands of used cars, trucks, and SUVs from private sellers and dealers near you."
      />
      <div className="min-h-screen flex flex-col bg-background">
        <Header />

        {/* Hero bar */}
        <div className="border-b border-border bg-card">
          <div className="max-w-7xl mx-auto px-4 py-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Browse Vehicles</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {loading ? "Searching…" : `${total.toLocaleString()} listing${total !== 1 ? "s" : ""} found`}
                </p>
              </div>
              <Button
                onClick={() => navigate("/marketplace/list")}
                className="shrink-0 gap-2"
              >
                <Tag className="h-4 w-4" />
                List Your Vehicle
              </Button>
            </div>

            {/* Search bar */}
            <div className="mt-4 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Search by make, model, year…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9 h-10"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Sort (desktop) */}
              <Select value={filters.sortBy} onValueChange={v => updateFilters({ sortBy: v })}>
                <SelectTrigger className="h-10 w-[180px] hidden sm:flex">
                  <ArrowUpDown className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>

              {/* Mobile filter button */}
              <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" className="sm:hidden h-10 gap-2 relative">
                    <SlidersHorizontal className="h-4 w-4" />
                    Filters
                    {activeFilterCount > 0 && (
                      <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center">
                        {activeFilterCount}
                      </span>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-80 overflow-y-auto">
                  <SheetHeader className="mb-4">
                    <SheetTitle>Filter Vehicles</SheetTitle>
                  </SheetHeader>
                   <FilterPanel
                    filters={filters}
                    onChange={updateFilters}
                    onReset={resetFilters}
                    makes={makes}
                    models={models}
                    activeCount={activeFilterCount}
                    locationDetecting={locationDetecting}
                  />
                  <Button className="w-full mt-6" onClick={() => setMobileFiltersOpen(false)}>
                    Show {total} results
                  </Button>
                </SheetContent>
              </Sheet>
            </div>

            {/* Active filter chips */}
            {activeFilterCount > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {filters.make && (
                  <ActiveChip label={filters.make} onRemove={() => updateFilters({ make: "", model: "" })} />
                )}
                {filters.model && (
                  <ActiveChip label={filters.model} onRemove={() => updateFilters({ model: "" })} />
                )}
                {(filters.minYear || filters.maxYear) && (
                  <ActiveChip
                    label={filters.minYear && filters.maxYear ? `${filters.minYear}–${filters.maxYear}` : filters.minYear ? `From ${filters.minYear}` : `Up to ${filters.maxYear}`}
                    onRemove={() => updateFilters({ minYear: "", maxYear: "" })}
                  />
                )}
                {filters.bodyStyle && (
                  <ActiveChip label={filters.bodyStyle} onRemove={() => updateFilters({ bodyStyle: "" })} />
                )}
                {filters.minPrice > 0 && (
                  <ActiveChip label={`From ${formatPrice(filters.minPrice)}`} onRemove={() => updateFilters({ minPrice: 0 })} />
                )}
                {filters.maxPrice < 150000 && (
                  <ActiveChip label={`Up to ${formatPrice(filters.maxPrice)}`} onRemove={() => updateFilters({ maxPrice: 150000 })} />
                )}
                {filters.maxMileage < 200000 && (
                  <ActiveChip label={`≤${filters.maxMileage.toLocaleString()} mi`} onRemove={() => updateFilters({ maxMileage: 200000 })} />
                )}
                {filters.zipCode.length === 5 && (
                  <ActiveChip label={`Near ${filters.zipCode}`} onRemove={() => updateFilters({ zipCode: "" })} />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
          <div className="flex gap-6">

            {/* Desktop filter sidebar */}
            <aside className="hidden lg:block w-64 shrink-0">
              <div className="sticky top-24 bg-card border border-border rounded-lg p-5">
                <FilterPanel
                  filters={filters}
                  onChange={updateFilters}
                  onReset={resetFilters}
                  makes={makes}
                  models={models}
                  activeCount={activeFilterCount}
                  locationDetecting={locationDetecting}
                />
              </div>
            </aside>

            {/* Listings grid */}
            <div className="flex-1 min-w-0">
              {/* Sort bar (mobile) */}
              <div className="flex items-center justify-between mb-4 sm:hidden">
                <span className="text-sm text-muted-foreground">
                  {loading ? "Searching…" : `${total} results`}
                </span>
                <Select value={filters.sortBy} onValueChange={v => updateFilters({ sortBy: v })}>
                  <SelectTrigger className="h-8 w-40 text-xs">
                    <ArrowUpDown className="h-3 w-3 mr-1.5 text-muted-foreground" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SORT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {Array.from({ length: 9 }).map((_, i) => <ListingCardSkeleton key={i} />)}
                </div>
              ) : listings.length === 0 ? (
                <EmptyState onReset={resetFilters} />
              ) : (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${JSON.stringify(filters)}-${page}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
                  >
                    {listings.map(l => (
                      <ListingCard
                        key={l.id}
                        listing={l}
        onClick={() => navigate(`/marketplace/${l.id}`)}
                      />
                    ))}
                  </motion.div>
                </AnimatePresence>
              )}

              {renderPagination()}
            </div>
          </div>
        </div>

        <Footer />
      </div>
    </>
  );
}

