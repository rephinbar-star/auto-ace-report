
# Simplified Marketplace Listing Form with VIN Photo Scan

## What's Being Built

A single-page authenticated form at `/marketplace/list` that lets users list their vehicle in one scroll, with a **VIN photo scanner** prominently placed so users can capture VIN data from any source (sticker, door jamb, paperwork, or a listing screenshot).

---

## Context: What Already Exists

- **`VinCameraScanner`** (`src/components/analysis/VinCameraScanner.tsx`) — fully working component that accepts a photo/camera capture, sends it to the `extract-from-screenshot` edge function (Gemini Vision), and returns the VIN. Used in the analyze flow already.
- **`extract-from-screenshot`** edge function — extracts vehicle details including VIN from any image.
- **`decodeVIN`** from `src/lib/nhtsa.ts` — auto-fills Year/Make/Model/Trim once a VIN is scanned.
- **`ProtectedRoute`** — existing auth guard pattern.
- **`getMakes` / `getModels`** from `src/lib/nhtsa.ts` — same NHTSA dropdowns used in analyze flow.

---

## Database Migration

Creates the `marketplace_listings` table (needed for form submission) and `marketplace_search_cache` (for future browse/search feature).

```sql
CREATE TABLE public.marketplace_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'user_submitted',
  external_id text,
  year integer NOT NULL,
  make text NOT NULL,
  model text NOT NULL,
  trim text,
  mileage integer,
  asking_price numeric NOT NULL,
  zip_code text,
  city text,
  state text,
  vin text,
  images text[] DEFAULT '{}',
  listing_url text,
  seller_type text DEFAULT 'private',
  seller_name text,
  body_style text,
  fuel_type text,
  transmission text,
  drivetrain text,
  exterior_color text,
  description text,
  status text NOT NULL DEFAULT 'active',
  fetched_at timestamptz DEFAULT now(),
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.marketplace_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active listings"
  ON public.marketplace_listings FOR SELECT
  USING (status = 'active' OR user_id = auth.uid());

CREATE POLICY "Authenticated users can create listings"
  ON public.marketplace_listings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners can update their listings"
  ON public.marketplace_listings FOR UPDATE TO authenticated
  USING (source = 'user_submitted' AND auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners can delete their listings"
  ON public.marketplace_listings FOR DELETE TO authenticated
  USING (source = 'user_submitted' AND auth.uid() = user_id);

CREATE TABLE public.marketplace_search_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  search_key text UNIQUE NOT NULL,
  last_fetched_at timestamptz NOT NULL DEFAULT now(),
  total_results integer DEFAULT 0
);

ALTER TABLE public.marketplace_search_cache ENABLE ROW LEVEL SECURITY;
```

Storage policy to allow uploading photos to the existing `vehicle-images` bucket:
```sql
CREATE POLICY "Authenticated users can upload marketplace images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'vehicle-images'
    AND (storage.foldername(name))[1] = 'marketplace'
  );
```

---

## New File: `src/pages/MarketplaceList.tsx`

Single-page authenticated form. Layout:

```text
┌─────────────────────────────────────────────┐
│  Header                                     │
├───────────────────────┬─────────────────────┤
│  FORM (left col)      │  PREVIEW (right col) │
│                       │  (sticky)           │
│  ┌─ VIN Entry ──────┐ │  2022 Honda Civic   │
│  │ [VIN input]      │ │  $15,500            │
│  │ [📷 Scan VIN]    │ │  45,000 mi          │
│  │ [Decode →]       │ │  Good · ZIP 90210   │
│  └──────────────────┘ │                     │
│  ┌─ Vehicle ────────┐ │  [Publish Listing]  │
│  │ Year Make Model  │ │                     │
│  │ Trim (opt)       │ │                     │
│  └──────────────────┘ │                     │
│  ┌─ Details ────────┐ │                     │
│  │ Mileage  Price   │ │                     │
│  │ Condition  ZIP   │ │                     │
│  │ Description(opt) │ │                     │
│  └──────────────────┘ │                     │
│  ┌─ Photos ─────────┐ │                     │
│  │ [+ Add Photos]   │ │                     │
│  │ [thumb][thumb]   │ │                     │
│  └──────────────────┘ │                     │
└───────────────────────┴─────────────────────┘
```

On mobile: single column, sticky bottom bar shows vehicle title + Publish button.

### VIN Scan Section (top of form)

This is the key UX improvement. The VIN entry area has three methods clearly laid out:

1. **Photo scan** — "📷 Scan VIN" button using the existing `VinCameraScanner` component. On mobile this triggers the camera; on desktop it opens a file picker. Accepts photos of: VIN sticker, door jamb label, dashboard, title document, or any listing screenshot.
2. **Type it in** — plain text input (17 chars), same validation as analyze flow.
3. **Skip** — "I don't have my VIN" collapses the section; Year/Make/Model still required.

When a VIN is captured via photo or typed and confirmed:
- Calls `decodeVIN()` from NHTSA 
- Auto-fills Year, Make, Model, Trim fields
- Shows a green "✓ VIN Decoded: 2022 Honda Civic EX" confirmation banner
- User can still override any auto-filled field

### Form Fields

**Required (minimum to publish):**
- Year, Make, Model (NHTSA dropdowns — auto-filled from VIN scan if available)
- Mileage
- Asking Price
- Condition (Select: Excellent / Good / Fair / Poor)
- ZIP Code

**Optional:**
- VIN (text + scan button)
- Trim
- Body Style, Fuel Type, Transmission, Drivetrain, Color
- Description (textarea, 1000 char limit)
- Photos (up to 10, each ≤ 10MB)

### Live Preview Panel (right column)

Updates in real-time as the user fills the form:
- Vehicle title: `{year} {make} {model} {trim}`
- Price in green, large
- Mileage · Condition badge · ZIP
- Photo count
- "Publish Listing" button (disabled until required fields are valid)

### Submission Flow

1. User clicks "Publish Listing"
2. If photos selected: batch-upload to `vehicle-images/marketplace/{user_id}/{uuid}/` via `supabase.storage`
3. Insert row into `marketplace_listings` directly via Supabase client (RLS enforces security)
4. On success: toast "Your listing is live!" + navigate to `/marketplace`
5. On error: toast with error message, form stays populated

---

## Files Modified

### `src/App.tsx`
Add lazy-loaded protected route:
```tsx
const MarketplaceListPage = lazy(() => import("./pages/MarketplaceList"));
// ...
<Route path="/marketplace/list" element={
  <ProtectedRoute><MarketplaceListPage /></ProtectedRoute>
} />
```

---

## Technical Notes

- **`VinCameraScanner` re-used as-is** — no changes to the existing component. It already handles mobile camera vs desktop file picker, loading states, and error toasts.
- **On mobile**: `capture="environment"` attribute on the file input inside `VinCameraScanner` triggers the rear camera directly — ideal for scanning a VIN sticker.
- **NHTSA auto-fill**: After a successful VIN scan, `decodeVIN(vin)` is called and the result populates the Year/Make/Model/Trim selects using `form.setValue()`.
- **Photo upload timing**: Photos are uploaded on submit (not eagerly) using `Promise.all()` across all selected files, with a single loading spinner on the Publish button.
- **`react-hook-form` + Zod**: Flat schema, single `useForm` instance covering all fields — no multi-step state machine.
- **Draft listing UUID**: Generated with `crypto.randomUUID()` when the component mounts, used as the storage path prefix for photos. Stable for the session.
