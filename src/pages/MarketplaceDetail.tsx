import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { SEO } from "@/components/seo/SEO";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { setWithExpiry } from "@/lib/storage-utils";
import { useAuth } from "@/hooks/useAuth";
import {
  ChevronLeft, ChevronRight, ExternalLink, Gauge, MapPin, Car,
  Fuel, Zap, GitMerge, Palette, Calendar, Tag, User, Building2,
  ShieldCheck, AlertCircle, ArrowRight, Share2, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

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
  seller_name: string | null;
  body_style: string | null;
  fuel_type: string | null;
  transmission: string | null;
  drivetrain: string | null;
  exterior_color: string | null;
  description: string | null;
  vin: string | null;
  status: string;
  created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function vehiclePlaceholderImage(listing: Listing): string {
  const seeds: Record<string, string> = {
    toyota: "https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=640&q=80",
    honda: "https://images.unsplash.com/photo-1619767886558-efdc259cde1a?w=640&q=80",
    ford: "https://images.unsplash.com/photo-1612825173281-9a193378527e?w=640&q=80",
    chevrolet: "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=640&q=80",
    tesla: "https://images.unsplash.com/photo-1560958089-b8a1929cea89?w=640&q=80",
    bmw: "https://images.unsplash.com/photo-1555215695-3004980ad54e?w=640&q=80",
    mercedes: "https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=640&q=80",
    audi: "https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=640&q=80",
    jeep: "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=640&q=80",
    subaru: "https://images.unsplash.com/photo-1609521263047-f8f205293f24?w=640&q=80",
    truck: "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=640&q=80",
    suv: "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=640&q=80",
    default: "https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=640&q=80",
  };
  const make = listing.make.toLowerCase().split("-")[0].split(" ")[0];
  const bodyStyle = (listing.body_style || "").toLowerCase();
  if (seeds[make]) return seeds[make];
  if (bodyStyle.includes("truck") || bodyStyle.includes("pickup")) return seeds.truck;
  if (bodyStyle.includes("suv") || bodyStyle.includes("crossover")) return seeds.suv;
  return seeds.default;
}

function formatPrice(p: number) {
  return `$${p.toLocaleString()}`;
}

function conditionColor(c: string | null) {
  switch (c) {
    case "excellent": return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300";
    case "good":      return "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300";
    case "fair":      return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
    case "poor":      return "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300";
    default:          return "bg-muted text-muted-foreground";
  }
}

// ─── Photo Gallery ────────────────────────────────────────────────────────────

function PhotoGallery({ images, title }: { images: string[]; title: string }) {
  const [current, setCurrent] = useState(0);
  const [thumbStart, setThumbStart] = useState(0);
  const THUMBS_VISIBLE = 5;

  const prev = () => setCurrent(i => (i - 1 + images.length) % images.length);
  const next = () => setCurrent(i => (i + 1) % images.length);

  useEffect(() => {
    if (current < thumbStart) setThumbStart(current);
    else if (current >= thumbStart + THUMBS_VISIBLE) setThumbStart(current - THUMBS_VISIBLE + 1);
  }, [current, thumbStart]);

  if (images.length === 0) {
    return (
      <div className="aspect-[16/10] w-full bg-muted rounded-xl flex flex-col items-center justify-center gap-3 text-muted-foreground">
        <Car className="h-16 w-16 opacity-20" />
        <span className="text-sm">No photos available</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Main image */}
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl bg-muted group">
        <AnimatePresence mode="wait">
          <motion.img
            key={current}
            src={images[current]}
            alt={`${title} — photo ${current + 1}`}
            className="w-full h-full object-cover"
            initial={{ opacity: 0, scale: 1.03 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg"; }}
          />
        </AnimatePresence>

        {/* Arrows */}
        {images.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-background/80 backdrop-blur flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background shadow-md"
              aria-label="Previous photo"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={next}
              className="absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-background/80 backdrop-blur flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background shadow-md"
              aria-label="Next photo"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}

        {/* Counter */}
        <div className="absolute bottom-3 right-3 bg-background/80 backdrop-blur text-xs font-medium px-2.5 py-1 rounded-full">
          {current + 1} / {images.length}
        </div>
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-hidden">
          {images.slice(thumbStart, thumbStart + THUMBS_VISIBLE).map((img, relIdx) => {
            const absIdx = thumbStart + relIdx;
            return (
              <button
                key={absIdx}
                onClick={() => setCurrent(absIdx)}
                className={cn(
                  "flex-1 aspect-[4/3] rounded-lg overflow-hidden border-2 transition-all",
                  absIdx === current ? "border-primary shadow-sm" : "border-transparent opacity-70 hover:opacity-100"
                )}
              >
                <img
                  src={img}
                  alt={`Thumbnail ${absIdx + 1}`}
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg"; }}
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Spec Row ─────────────────────────────────────────────────────────────────

function SpecRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground truncate">{value}</p>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MarketplaceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data, error } = await supabase
        .from("marketplace_listings")
        .select("*")
        .eq("id", id)
        .eq("status", "active")
        .maybeSingle();

      if (error || !data) {
        setNotFound(true);
      } else {
        setListing(data);
      }
      setLoading(false);
    })();
  }, [id]);

  const handleAnalyzeDeal = () => {
    if (!listing) return;

    // Pre-fill VehicleInfo
    const vehicleInfo = {
      year: listing.year,
      make: listing.make,
      model: listing.model,
      trim: listing.trim ?? undefined,
      bodyStyle: listing.body_style ?? undefined,
      fuelType: listing.fuel_type ?? undefined,
      transmission: listing.transmission ?? undefined,
      drivetrain: listing.drivetrain ?? undefined,
      exteriorColor: listing.exterior_color ?? undefined,
      vin: listing.vin ?? undefined,
    };

    // Pre-fill VehicleCondition
    const conditionInfo = {
      mileage: listing.mileage ?? 0,
      askingPrice: listing.asking_price,
      condition: (listing.condition as "excellent" | "good" | "fair" | "poor") ?? "good",
      sellerType: (listing.seller_type as "private" | "dealer") ?? "dealer",
      sellerName: listing.seller_name ?? undefined,
      listingUrl: listing.listing_url ?? undefined,
      zipCode: listing.zip_code ?? undefined,
      images: listing.images ?? undefined,
    };

    // Persist to sessionStorage + localStorage (same pattern as Analyze.tsx)
    const prefilledData = { vehicleInfo, conditionInfo, fromMarketplace: true, listingId: listing.id };
    sessionStorage.setItem("marketplacePrefill", JSON.stringify(prefilledData));
    setWithExpiry("marketplacePrefill", prefilledData);

    navigate("/analyze", { state: { prefill: prefilledData } });
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  if (loading) return <DetailSkeleton />;

  if (notFound) {
    return (
      <>
        <SEO title="Listing Not Found" description="This listing is no longer available." />
        <div className="min-h-screen flex flex-col bg-background">
          <Header />
          <main className="flex-1 flex flex-col items-center justify-center gap-4 py-20 px-4 text-center">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-muted-foreground" />
            </div>
            <h1 className="text-xl font-bold">Listing Not Found</h1>
            <p className="text-muted-foreground max-w-xs">This listing may have been removed or is no longer active.</p>
            <Button onClick={() => navigate("/marketplace")} className="gap-2">
              <ChevronLeft className="h-4 w-4" /> Browse Listings
            </Button>
          </main>
          <Footer />
        </div>
      </>
    );
  }

  if (!listing) return null;

  const title = `${listing.year} ${listing.make} ${listing.model}${listing.trim ? ` ${listing.trim}` : ""}`;
  const location = [listing.city, listing.state].filter(Boolean).join(", ") || listing.zip_code || "Location unknown";
  const rawImages = listing.images?.filter(Boolean) ?? [];
  const images = rawImages.length > 0 ? rawImages : [vehiclePlaceholderImage(listing)];

  return (
    <>
      <SEO
        title={`${title} — ${formatPrice(listing.asking_price)}`}
        description={`${title} with ${listing.mileage?.toLocaleString() ?? "?"} miles for ${formatPrice(listing.asking_price)} in ${location}. View details and analyze this deal.`}
      />
      <div className="min-h-screen flex flex-col bg-background">
        <Header />

        <main className="flex-1">
          {/* Breadcrumb */}
          <div className="border-b border-border bg-card">
            <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-2 text-sm text-muted-foreground">
              <button onClick={() => navigate("/marketplace")} className="hover:text-foreground transition-colors flex items-center gap-1">
                <ChevronLeft className="h-3.5 w-3.5" /> Marketplace
              </button>
              <span>/</span>
              <span className="text-foreground font-medium truncate">{title}</span>
            </div>
          </div>

          <div className="max-w-6xl mx-auto px-4 py-6 lg:py-10">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8">

              {/* ── LEFT ───────────────────────────────────────────────── */}
              <div className="space-y-6">
                <PhotoGallery images={images} title={title} />

                {/* Description */}
                {listing.description && (
                  <Card>
                    <CardContent className="p-5">
                      <h2 className="font-semibold text-foreground mb-3">About This Vehicle</h2>
                      <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                        {listing.description}
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* Vehicle Specs */}
                <Card>
                  <CardContent className="p-5">
                    <h2 className="font-semibold text-foreground mb-1">Vehicle Specs</h2>
                    <Separator className="mb-2" />
                    <div className="divide-y divide-border">
                      <SpecRow icon={Calendar}   label="Year"          value={String(listing.year)} />
                      <SpecRow icon={Car}         label="Make / Model"  value={`${listing.make} ${listing.model}`} />
                      <SpecRow icon={Tag}         label="Trim"          value={listing.trim} />
                      <SpecRow icon={Car}         label="Body Style"    value={listing.body_style} />
                      <SpecRow icon={Gauge}       label="Mileage"       value={listing.mileage != null ? `${listing.mileage.toLocaleString()} miles` : null} />
                      <SpecRow icon={Fuel}        label="Fuel Type"     value={listing.fuel_type} />
                      <SpecRow icon={Zap}         label="Transmission"  value={listing.transmission} />
                      <SpecRow icon={GitMerge}    label="Drivetrain"    value={listing.drivetrain} />
                      <SpecRow icon={Palette}     label="Exterior Color" value={listing.exterior_color} />
                      {listing.vin && (
                        <SpecRow icon={ShieldCheck} label="VIN"         value={listing.vin} />
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* ── RIGHT ──────────────────────────────────────────────── */}
              <div className="space-y-4 lg:sticky lg:top-24 h-fit">

                {/* Price card */}
                <Card className="overflow-hidden border-border">
                  <div className="bg-gradient-to-br from-primary/5 to-primary/10 p-5 border-b border-border">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h1 className="text-xl font-bold text-foreground leading-tight">{title}</h1>
                        {listing.trim && (
                          <p className="text-sm text-muted-foreground mt-0.5">{listing.trim}</p>
                        )}
                      </div>
                      <button
                        onClick={handleShare}
                        className="h-8 w-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                        title="Copy link"
                      >
                        {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Share2 className="h-3.5 w-3.5" />}
                      </button>
                    </div>

                    <div className="mt-3 flex items-baseline gap-3">
                      <span className="text-3xl font-bold text-primary tabular-nums">
                        {formatPrice(listing.asking_price)}
                      </span>
                      {listing.condition && (
                        <Badge className={cn("text-xs font-medium border-0 capitalize", conditionColor(listing.condition))}>
                          {listing.condition}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <CardContent className="p-5 space-y-4">
                    {/* Quick stats */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-muted rounded-lg p-3 text-center">
                        <Gauge className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">Mileage</p>
                        <p className="text-sm font-semibold text-foreground">
                          {listing.mileage != null ? `${listing.mileage.toLocaleString()} mi` : "—"}
                        </p>
                      </div>
                      <div className="bg-muted rounded-lg p-3 text-center">
                        <MapPin className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">Location</p>
                        <p className="text-sm font-semibold text-foreground truncate">{location}</p>
                      </div>
                    </div>

                    {/* Seller info */}
                    <div className="bg-muted/50 rounded-lg p-3 flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        {listing.seller_type === "dealer" ? (
                          <Building2 className="h-4 w-4 text-primary" />
                        ) : (
                          <User className="h-4 w-4 text-primary" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Listed by</p>
                        <p className="text-sm font-medium text-foreground truncate">
                          {listing.seller_name || (listing.seller_type === "dealer" ? "Dealership" : "Private Seller")}
                        </p>
                        <p className="text-xs text-muted-foreground capitalize">{listing.seller_type ?? "Unknown"}</p>
                      </div>
                    </div>

                    <Separator />

                    {/* Analyze CTA — primary action */}
                    <div className="space-y-2.5">
                      <Button
                        size="lg"
                        className="w-full gap-2 text-base"
                        onClick={handleAnalyzeDeal}
                      >
                        <ShieldCheck className="h-5 w-5" />
                        Analyze This Deal
                        <ArrowRight className="h-4 w-4 ml-auto" />
                      </Button>
                      <p className="text-xs text-muted-foreground text-center leading-snug">
                        Get AI-powered fair market price, 5-year depreciation, risk score&nbsp;&amp; expert verdict.
                      </p>
                    </div>

                    {/* External link */}
                    {listing.listing_url && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-2 text-xs"
                        onClick={() => window.open(listing.listing_url!, "_blank", "noopener")}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        View Original Listing
                      </Button>
                    )}
                  </CardContent>
                </Card>

                {/* Why analyze callout */}
                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="p-4">
                    <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-2">Why Analyze?</p>
                    <ul className="space-y-1.5">
                      {[
                        "Know if you're overpaying vs. market",
                        "5-year ownership cost & depreciation",
                        "AI risk score & expert verdict",
                        "Negotiation guidance & fair offer price",
                      ].map(item => (
                        <li key={item} className="flex items-start gap-2 text-xs text-foreground">
                          <Check className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <div className="max-w-6xl mx-auto px-4 py-6 lg:py-10 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8">
          <div className="space-y-4">
            <Skeleton className="aspect-[16/10] w-full rounded-xl" />
            <div className="flex gap-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="flex-1 aspect-[4/3] rounded-lg" />)}
            </div>
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-72 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
