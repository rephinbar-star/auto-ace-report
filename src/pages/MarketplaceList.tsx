import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { VinCameraScanner } from "@/components/analysis/VinCameraScanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { decodeVIN, getMakes, getModels, isValidVIN } from "@/lib/nhtsa";
import {
  CheckCircle2, Loader2, Car, MapPin, DollarSign,
  Image as ImageIcon, X, Upload, ChevronRight, Info
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Schema ────────────────────────────────────────────────────────────────

const schema = z.object({
  vin: z.string().optional(),
  year: z.coerce.number().min(1980).max(new Date().getFullYear() + 1),
  make: z.string().min(1, "Make is required"),
  model: z.string().min(1, "Model is required"),
  trim: z.string().optional(),
  bodyStyle: z.string().optional(),
  fuelType: z.string().optional(),
  transmission: z.string().optional(),
  drivetrain: z.string().optional(),
  exteriorColor: z.string().optional(),
  mileage: z.coerce.number().min(0, "Mileage is required"),
  askingPrice: z.coerce.number().min(1, "Price is required"),
  condition: z.enum(["excellent", "good", "fair", "poor"]),
  zipCode: z.string().length(5, "Enter a valid 5-digit ZIP"),
  description: z.string().max(1000).optional(),
});

type FormValues = z.infer<typeof schema>;

// ─── Helpers ───────────────────────────────────────────────────────────────

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 1979 }, (_, i) => CURRENT_YEAR + 1 - i);

const CONDITION_LABELS: Record<string, string> = {
  excellent: "Excellent",
  good: "Good",
  fair: "Fair",
  poor: "Poor",
};

const CONDITION_COLORS: Record<string, string> = {
  excellent: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-300",
  good: "bg-sky-100 text-sky-900 dark:bg-sky-900/30 dark:text-sky-300",
  fair: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-300",
  poor: "bg-rose-100 text-rose-900 dark:bg-rose-900/30 dark:text-rose-300",
};

// ─── Main Component ────────────────────────────────────────────────────────

function MarketplaceListForm() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  // NHTSA data
  const [makes, setMakes] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [loadingMakes, setLoadingMakes] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);

  // VIN state
  const [vinInput, setVinInput] = useState("");
  const [vinDecoding, setVinDecoding] = useState(false);
  const [vinDecoded, setVinDecoded] = useState<string | null>(null);
  const [vinError, setVinError] = useState<string | null>(null);

  // Photos
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const draftId = useRef(crypto.randomUUID());

  // Submission
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isValid },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: {
      condition: "good",
      year: CURRENT_YEAR,
    },
  });

  const watchedValues = watch();

  // Load makes on mount
  useEffect(() => {
    setLoadingMakes(true);
    getMakes(watchedValues.year || CURRENT_YEAR)
      .then(setMakes)
      .finally(() => setLoadingMakes(false));
  }, []);

  // Load models when make+year changes
  useEffect(() => {
    if (!watchedValues.make || !watchedValues.year) return;
    setLoadingModels(true);
    getModels(watchedValues.make, watchedValues.year)
      .then((m) => {
        setModels(m);
      })
      .finally(() => setLoadingModels(false));
  }, [watchedValues.make, watchedValues.year]);

  // ─── VIN decode ────────────────────────────────────────────────────────

  const decodeAndFill = useCallback(async (vin: string) => {
    if (!isValidVIN(vin)) {
      setVinError("Invalid VIN format (17 alphanumeric chars, no I/O/Q)");
      return;
    }
    setVinDecoding(true);
    setVinError(null);
    try {
      const info = await decodeVIN(vin);
      if (!info) {
        setVinError("Couldn't decode this VIN. Please fill in vehicle details manually.");
        return;
      }
      setValue("year", info.year, { shouldValidate: true });
      setValue("make", info.make, { shouldValidate: true });
      setValue("model", info.model, { shouldValidate: true });
      if (info.trim) setValue("trim", info.trim);
      if (info.bodyStyle) setValue("bodyStyle", info.bodyStyle);
      if (info.fuelType) setValue("fuelType", info.fuelType);
      if (info.transmission) setValue("transmission", info.transmission);
      if (info.drivetrain) setValue("drivetrain", info.drivetrain);

      // Load models for decoded make+year
      const fetchedModels = await getModels(info.make, info.year);
      setModels(fetchedModels);

      setVinDecoded(`${info.year} ${info.make} ${info.model}${info.trim ? ` ${info.trim}` : ""}`);
    } catch {
      setVinError("VIN decode failed. Please fill in vehicle details manually.");
    } finally {
      setVinDecoding(false);
    }
  }, [setValue]);

  const handleVinScanned = useCallback((vin: string) => {
    setVinInput(vin);
    decodeAndFill(vin);
  }, [decodeAndFill]);

  // ─── Photo handling ────────────────────────────────────────────────────

  const addPhotos = (files: FileList | null) => {
    if (!files) return;
    const newFiles = Array.from(files).slice(0, 10 - photos.length);
    const validFiles = newFiles.filter(f => f.size <= 10 * 1024 * 1024);
    if (validFiles.length < newFiles.length) {
      toast({ title: "Some photos skipped", description: "Max 10MB per photo", variant: "destructive" });
    }
    setPhotos(prev => [...prev, ...validFiles]);
    validFiles.forEach(f => {
      const url = URL.createObjectURL(f);
      setPhotoPreviews(prev => [...prev, url]);
    });
  };

  const removePhoto = (index: number) => {
    URL.revokeObjectURL(photoPreviews[index]);
    setPhotos(prev => prev.filter((_, i) => i !== index));
    setPhotoPreviews(prev => prev.filter((_, i) => i !== index));
  };

  // ─── Submit ────────────────────────────────────────────────────────────

  const onSubmit = async (values: FormValues) => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      // Upload photos
      let imageUrls: string[] = [];
      if (photos.length > 0) {
        const uploads = await Promise.all(
          photos.map(async (file) => {
            const ext = file.name.split(".").pop();
            const path = `marketplace/${user.id}/${draftId.current}/${crypto.randomUUID()}.${ext}`;
            const { error } = await supabase.storage
              .from("vehicle-images")
              .upload(path, file, { contentType: file.type });
            if (error) throw error;
            const { data: urlData } = supabase.storage
              .from("vehicle-images")
              .getPublicUrl(path);
            return urlData.publicUrl;
          })
        );
        imageUrls = uploads;
      }

      // Insert listing
      const { error: insertError } = await supabase
        .from("marketplace_listings")
        .insert({
          source: "user_submitted",
          user_id: user.id,
          year: values.year,
          make: values.make,
          model: values.model,
          trim: values.trim || null,
          vin: vinInput || null,
          body_style: values.bodyStyle || null,
          fuel_type: values.fuelType || null,
          transmission: values.transmission || null,
          drivetrain: values.drivetrain || null,
          exterior_color: values.exteriorColor || null,
          mileage: values.mileage,
          asking_price: values.askingPrice,
          condition: values.condition,
          zip_code: values.zipCode,
          description: values.description || null,
          images: imageUrls,
          status: "active",
          seller_type: "private",
          fetched_at: new Date().toISOString(),
        });

      if (insertError) throw insertError;

      toast({ title: "Your listing is live!", description: "Buyers can now find your vehicle." });
      navigate("/marketplace");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      toast({ title: "Failed to publish", description: msg, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Preview data ─────────────────────────────────────────────────────

  const previewTitle = [watchedValues.year, watchedValues.make, watchedValues.model, watchedValues.trim]
    .filter(Boolean).join(" ") || "Your Vehicle";
  const previewPrice = watchedValues.askingPrice
    ? `$${Number(watchedValues.askingPrice).toLocaleString()}`
    : null;
  const previewMileage = watchedValues.mileage
    ? `${Number(watchedValues.mileage).toLocaleString()} mi`
    : null;

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8 max-w-6xl mx-auto px-4 py-10">

        {/* ── LEFT: Form ─────────────────────────────────────────────── */}
        <div className="space-y-6">

          {/* VIN Entry */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Info className="h-4 w-4 text-muted-foreground" />
                VIN <span className="text-muted-foreground font-normal text-sm">(optional — auto-fills vehicle details)</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    placeholder="17-character VIN"
                    value={vinInput}
                    onChange={e => {
                      setVinInput(e.target.value.toUpperCase());
                      setVinDecoded(null);
                      setVinError(null);
                    }}
                    maxLength={17}
                    className={cn(
                      "font-mono tracking-wider pr-10",
                      vinDecoded && "border-green-500 focus-visible:ring-green-500",
                      vinError && "border-destructive"
                    )}
                  />
                  {vinDecoded && (
                    <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => decodeAndFill(vinInput)}
                  disabled={vinInput.length !== 17 || vinDecoding}
                >
                  {vinDecoding ? <Loader2 className="h-4 w-4 animate-spin" /> : "Decode"}
                </Button>
                <VinCameraScanner onVinCaptured={handleVinScanned} label="Scan" />
              </div>

              {vinDecoded && (
                <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  VIN decoded: <strong>{vinDecoded}</strong>
                </p>
              )}
              {vinError && (
                <p className="text-sm text-destructive">{vinError}</p>
              )}

              <p className="text-xs text-muted-foreground">
                Scan or type your VIN to auto-fill Year, Make, Model and more.
                Find it on the driver-side door jamb, dashboard, or title.
              </p>
            </CardContent>
          </Card>

          {/* Vehicle Details */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Car className="h-4 w-4 text-muted-foreground" />
                Vehicle
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {/* Year */}
                <div className="space-y-1">
                  <Label>Year <span className="text-destructive">*</span></Label>
                  <Controller
                    control={control}
                    name="year"
                    render={({ field }) => (
                      <Select
                        value={String(field.value || "")}
                        onValueChange={v => {
                          field.onChange(Number(v));
                          setValue("make", "");
                          setValue("model", "");
                          setMakes([]);
                          setModels([]);
                          setLoadingMakes(true);
                          getMakes(Number(v)).then(setMakes).finally(() => setLoadingMakes(false));
                        }}
                      >
                        <SelectTrigger><SelectValue placeholder="Year" /></SelectTrigger>
                        <SelectContent>
                          {YEARS.map(y => (
                            <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                {/* Make */}
                <div className="space-y-1">
                  <Label>Make <span className="text-destructive">*</span></Label>
                  <Controller
                    control={control}
                    name="make"
                    render={({ field }) => (
                      <Select
                        value={field.value || ""}
                        onValueChange={v => {
                          field.onChange(v);
                          setValue("model", "");
                          setModels([]);
                          if (watchedValues.year) {
                            setLoadingModels(true);
                            getModels(v, watchedValues.year).then(setModels).finally(() => setLoadingModels(false));
                          }
                        }}
                        disabled={loadingMakes}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={loadingMakes ? "Loading…" : "Make"} />
                        </SelectTrigger>
                        <SelectContent>
                          {makes.map(m => (
                            <SelectItem key={m} value={m}>{m}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                {/* Model */}
                <div className="space-y-1">
                  <Label>Model <span className="text-destructive">*</span></Label>
                  <Controller
                    control={control}
                    name="model"
                    render={({ field }) => (
                      <Select
                        value={field.value || ""}
                        onValueChange={field.onChange}
                        disabled={!watchedValues.make || loadingModels}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={loadingModels ? "Loading…" : "Model"} />
                        </SelectTrigger>
                        <SelectContent>
                          {models.map(m => (
                            <SelectItem key={m} value={m}>{m}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Trim</Label>
                  <Input placeholder="e.g. EX, Sport" {...register("trim")} />
                </div>
                <div className="space-y-1">
                  <Label>Exterior Color</Label>
                  <Input placeholder="e.g. Midnight Blue" {...register("exteriorColor")} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="space-y-1">
                  <Label>Body Style</Label>
                  <Controller control={control} name="bodyStyle" render={({ field }) => (
                    <Select value={field.value || ""} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue placeholder="Style" /></SelectTrigger>
                      <SelectContent>
                        {["Sedan", "SUV", "Truck", "Coupe", "Van", "Wagon", "Convertible", "Hatchback"].map(s => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )} />
                </div>
                <div className="space-y-1">
                  <Label>Fuel</Label>
                  <Controller control={control} name="fuelType" render={({ field }) => (
                    <Select value={field.value || ""} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue placeholder="Fuel" /></SelectTrigger>
                      <SelectContent>
                        {["Gasoline", "Hybrid", "Electric", "Diesel"].map(f => (
                          <SelectItem key={f} value={f}>{f}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )} />
                </div>
                <div className="space-y-1">
                  <Label>Trans.</Label>
                  <Controller control={control} name="transmission" render={({ field }) => (
                    <Select value={field.value || ""} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue placeholder="Trans." /></SelectTrigger>
                      <SelectContent>
                        {["Automatic", "Manual", "CVT"].map(t => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )} />
                </div>
                <div className="space-y-1">
                  <Label>Drive</Label>
                  <Controller control={control} name="drivetrain" render={({ field }) => (
                    <Select value={field.value || ""} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue placeholder="Drive" /></SelectTrigger>
                      <SelectContent>
                        {["FWD", "RWD", "AWD", "4WD"].map(d => (
                          <SelectItem key={d} value={d}>{d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Listing Details */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                Listing Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Mileage <span className="text-destructive">*</span></Label>
                  <div className="relative">
                    <Input
                      type="number"
                      min={0}
                      placeholder="e.g. 45000"
                      className="pr-12"
                      {...register("mileage")}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">mi</span>
                  </div>
                  {errors.mileage && <p className="text-xs text-destructive">{errors.mileage.message}</p>}
                </div>

                <div className="space-y-1">
                  <Label>Asking Price <span className="text-destructive">*</span></Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      type="number"
                      min={1}
                      placeholder="e.g. 15500"
                      className="pl-7"
                      {...register("askingPrice")}
                    />
                  </div>
                  {errors.askingPrice && <p className="text-xs text-destructive">{errors.askingPrice.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Condition <span className="text-destructive">*</span></Label>
                  <Controller control={control} name="condition" render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(["excellent", "good", "fair", "poor"] as const).map(c => (
                          <SelectItem key={c} value={c}>{CONDITION_LABELS[c]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )} />
                </div>

                <div className="space-y-1">
                  <Label>ZIP Code <span className="text-destructive">*</span></Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="90210"
                      maxLength={5}
                      className="pl-8"
                      {...register("zipCode")}
                    />
                  </div>
                  {errors.zipCode && <p className="text-xs text-destructive">{errors.zipCode.message}</p>}
                </div>
              </div>

              <div className="space-y-1">
                <Label>Description <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Textarea
                  placeholder="Describe the vehicle's condition, any recent work done, reason for selling…"
                  rows={3}
                  maxLength={1000}
                  {...register("description")}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {(watchedValues.description?.length ?? 0)}/1000
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Photos */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-muted-foreground" />
                Photos <span className="text-muted-foreground font-normal text-sm">(optional, up to 10)</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={e => addPhotos(e.target.files)}
              />

              {photos.length < 10 && (
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-border rounded-lg p-6 flex flex-col items-center gap-2 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                >
                  <Upload className="h-6 w-6" />
                  <span className="text-sm font-medium">Add photos</span>
                  <span className="text-xs">JPG, PNG, WEBP · Max 10MB each</span>
                </button>
              )}

              {photoPreviews.length > 0 && (
                <div className="grid grid-cols-4 gap-2">
                  {photoPreviews.map((src, i) => (
                    <div key={i} className="relative group aspect-square rounded-md overflow-hidden border border-border">
                      <img src={src} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                      {i === 0 && (
                        <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] text-center py-0.5">
                          Main
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => removePhoto(i)}
                        className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── RIGHT: Preview & Publish ────────────────────────────────── */}
        <div className="lg:sticky lg:top-24 h-fit space-y-4">
          <Card className="overflow-hidden">
            {photoPreviews[0] ? (
              <div className="aspect-video w-full overflow-hidden bg-muted">
                <img src={photoPreviews[0]} alt="Main photo" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="aspect-video w-full bg-muted flex items-center justify-center">
                <Car className="h-12 w-12 text-muted-foreground/30" />
              </div>
            )}

            <CardContent className="pt-4 space-y-3">
              <div>
                <h2 className="text-xl font-bold leading-tight">{previewTitle}</h2>
                {previewPrice && (
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-0.5">
                    {previewPrice}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                {previewMileage && <span>{previewMileage}</span>}
                {previewMileage && watchedValues.condition && <span>·</span>}
                {watchedValues.condition && (
                  <Badge className={cn("text-xs font-medium border-0", CONDITION_COLORS[watchedValues.condition])}>
                    {CONDITION_LABELS[watchedValues.condition]}
                  </Badge>
                )}
                {watchedValues.zipCode?.length === 5 && (
                  <>
                    <span>·</span>
                    <span className="flex items-center gap-0.5">
                      <MapPin className="h-3 w-3" /> {watchedValues.zipCode}
                    </span>
                  </>
                )}
              </div>

              {photos.length > 0 && (
                <p className="text-xs text-muted-foreground">{photos.length} photo{photos.length !== 1 ? "s" : ""} selected</p>
              )}

              <div className="pt-2">
                <Button
                  type="submit"
                  className="w-full gap-2"
                  disabled={!isValid || isSubmitting}
                  size="lg"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Publishing…
                    </>
                  ) : (
                    <>
                      Publish Listing
                      <ChevronRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground text-center mt-2">
                  Free · No fees · Edit or remove anytime
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Mobile sticky publish bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur border-t border-border px-4 py-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{previewTitle !== "Your Vehicle" ? previewTitle : "Complete required fields"}</p>
          {previewPrice && <p className="text-xs text-green-600 dark:text-green-400 font-medium">{previewPrice}</p>}
        </div>
        <Button
          type="submit"
          disabled={!isValid || isSubmitting}
          className="shrink-0"
        >
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Publish"}
        </Button>
      </div>
      {/* Spacer for mobile bar */}
      <div className="lg:hidden h-20" />
    </form>
  );
}

// ─── Page Wrapper ──────────────────────────────────────────────────────────

export default function MarketplaceListPage() {
  return (
    <ProtectedRoute>
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1">
          <div className="max-w-6xl mx-auto px-4 pt-8 pb-2">
            <h1 className="text-2xl font-bold">List Your Vehicle</h1>
            <p className="text-muted-foreground mt-1">
              Free to list · Scan your VIN to auto-fill details · Publish in minutes
            </p>
          </div>
          <MarketplaceListForm />
        </main>
        <Footer />
      </div>
    </ProtectedRoute>
  );
}
