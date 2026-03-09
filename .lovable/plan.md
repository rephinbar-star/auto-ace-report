
## Plan: Prominent NHTSA Recall Banner on Report Page

### What's currently happening
- `lookupRecalls()` in `src/lib/nhtsa.ts` fetches recalls by **year/make/model** (not VIN-specific) from NHTSA's free public API
- The recall data is already fetched inside `computeUVPRS()` (lines 550–564) but is **only fed into the UVPRS risk score** — it is never displayed directly to the user
- The NHTSA API returns each recall as `{ component: string, summary: string }` but currently those individual recall details are discarded (only the count is kept)

### What needs changing

**1. Upgrade `RecallResult` type in `src/lib/nhtsa.ts`**
Add a `NHTSACampaignNumber` and `RemedyDescription` to the recalled items so users can look up official campaign numbers.

**2. Add recall state to `Report.tsx`**
- Add `recallData` state: `{ count: number; open: number; resolved: number; recalls: { component: string; summary: string }[] } | null`
- In `computeUVPRS()`, save the full recall list (not just counts) to this state alongside the UVPRS computation

**3. Add a dedicated NHTSA Recall Card in the sidebar (right column)**
Place it after the Vehicle Health card and before Service History Timeline. The card will:

- **If `recallData` is null** (no VIN or NHTSA unavailable): show nothing / skeleton
- **If `open > 0`**: render a red/destructive alert banner at the top — "⚠ X Open Recalls Found" with a prominent red border, then expand each recall in a collapsible list
- **If `open === 0` but `count > 0`**: show a green "All X Recalls Resolved" confirmation
- **If `count === 0`**: show a green "No Recalls on Record" badge

Each recall item shows:
- Component name (bolded)
- Summary text (truncated, expandable)
- Link to `https://www.nhtsa.gov/vehicle/${vin}/complaints` if VIN is available, otherwise to the NHTSA search page

**4. Note on VIN vs Year/Make/Model**
NHTSA's free **recallsByVehicle** endpoint only supports year/make/model filtering — not VIN-level lookup. However, NHTSA does have a separate VIN-specific complaints endpoint. We'll use year/make/model for recalls (what's already implemented), but add a "Check VIN-specific complaints" link using the VIN if available.

### Card placement in sidebar
```text
Right column (sidebar):
  ├── VehicleImageGallery
  ├── RiskScoreBreakdown (UVPRS)
  ├── *** NEW: NHTSA Recall Card ***  ← inserted here
  ├── Vehicle Health
  ├── ServiceHistoryTimeline
  ├── Risk Factors
  ├── DealerReview
  └── Warranty Analysis
```

### Files to change
1. **`src/pages/Report.tsx`** — add `recallData` state, populate it in `computeUVPRS`, add the recall card JSX in the sidebar
2. **`src/lib/nhtsa.ts`** — optionally extend `RecallResult` to include `remedyDescription` field

### Visual design
- **Open recalls**: `border-danger bg-danger/5` card, `ShieldAlert` icon in red, each recall in a collapsible `Accordion`
- **All resolved**: `border-success bg-success/5` card, `ShieldCheck` icon in green  
- **No recalls**: `border-success bg-success/5` card with a simple green badge
- Loading state: `Loader2` spinner while NHTSA data is being fetched
