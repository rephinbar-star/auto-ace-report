

## Problem

The "Use location" button triggers browser geolocation successfully, but the subsequent reverse geocoding request to OpenStreetMap Nominatim fails silently. The error message "Location lookup failed. Enter ZIP manually." appears, which comes from the `catch` block in `ConditionStep.tsx` (line 107-108).

**Root cause**: Nominatim's usage policy requires a valid `User-Agent` header identifying the application. The current fetch only sends `Accept-Language` but no `User-Agent`. Nominatim may reject or block requests without proper identification. Additionally, there's no error logging, making debugging difficult.

## Plan

**File**: `src/components/analysis/ConditionStep.tsx`

1. Add a proper `User-Agent` header to the Nominatim fetch request (e.g., `CarWise/1.0 (carwise.expert)`)
2. Add `console.error` logging in the catch block so failures are visible in dev tools
3. Add a fallback: if the Nominatim request fails, try a second geocoding service (optional, depending on preference)

### Technical detail

```typescript
const res = await fetch(
  `https://nominatim.openstreetmap.org/reverse?lat=${coords.latitude}&lon=${coords.longitude}&format=json`,
  { 
    headers: { 
      "Accept-Language": "en",
      "User-Agent": "CarWise/1.0 (https://carwise.expert)"
    } 
  }
);
if (!res.ok) {
  throw new Error(`Nominatim returned ${res.status}`);
}
```

Also add `console.error` in the catch block for debugging visibility.

