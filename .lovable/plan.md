
## VIN Camera Scanning for Mobile & Tablet

### Overview
Add a "Scan VIN" camera button on the VIN Lookup tab that appears only on mobile/tablet devices. When tapped, it opens the device camera, captures a photo, and uses the existing AI screenshot extraction pipeline (Gemini Vision via `extract-from-screenshot`) to read the VIN directly from the image — no manual typing needed.

---

### How It Works

```text
User taps "Scan VIN"
       ↓
Hidden <input type="file" accept="image/*" capture="environment">
       ↓
Device rear camera opens natively (no extra library needed)
       ↓
User photographs VIN sticker (dashboard, door jamb, etc.)
       ↓
Image sent to extract-from-screenshot edge function (Gemini Vision)
       ↓
VIN extracted → auto-filled into the VIN input field
       ↓
User taps "Decode VIN" to confirm (or it auto-submits if valid)
```

---

### Technical Plan

**1. New Component: `src/components/analysis/VinCameraScanner.tsx`**
- A small self-contained component that renders a camera capture button
- Uses a hidden `<input type="file" accept="image/*" capture="environment">` — this is the native, zero-dependency way to invoke the rear camera on iOS and Android
- On file selection, sends the image to the existing `extractFromScreenshot()` function in `src/lib/api/extract-screenshot.ts`
- Parses out the `vin` field from the returned `ExtractedVehicle` object
- Calls an `onVinCaptured(vin: string)` callback prop to pass the result back
- Shows a loading spinner while AI is processing, and an error toast if extraction fails or no VIN is found

**2. Update: `src/components/analysis/VehicleInputStep.tsx`**
- Import `useIsMobile` from `@/hooks/use-mobile` to gate the button (mobile/tablet only)
- Import and render `<VinCameraScanner>` inside the VIN Lookup tab's `FormItem`, next to the VIN `<Input>` field
- The input and camera button will sit side-by-side in a flex row:
  ```
  [ VIN Input field .............. ] [ 📷 Scan ]
  ```
- Wire the `onVinCaptured` callback to call `vinForm.setValue("vin", vin)` followed by `vinForm.handleSubmit(handleVINSubmit)()` to auto-decode once a valid VIN is returned

---

### UI Details
- The "Scan VIN" button uses the `Camera` icon (already imported in `VehicleInputStep.tsx`) and a short label
- Styled as a secondary outline button, same height as the input (`h-10`)
- While scanning: button shows a `Loader2` spinner and is disabled
- Only rendered when `useIsMobile()` returns `true` — desktop users won't see it
- A small helper text below the input: *"Mobile users: tap Scan to use your camera"* — only shown on mobile

---

### Files Changed
| File | Change |
|------|--------|
| `src/components/analysis/VinCameraScanner.tsx` | **Create** — new camera capture component |
| `src/components/analysis/VehicleInputStep.tsx` | **Edit** — add `VinCameraScanner` next to the VIN input in the VIN Lookup tab |

No new dependencies, no edge function changes, no database changes needed.
