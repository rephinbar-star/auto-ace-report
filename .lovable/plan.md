

# Report Page Sections 5-8 Implementation Plan

## Summary
Add four new sections to the report page: TCO with monthly-cost lead, visual risk bars, tabbed vehicle history, and a bottom verdict decision gate. These modify `Report.tsx` inline and create no new component files.

---

## Section 5: TCO + Depreciation Restructure (lines 1792-1977)

**File: `src/pages/Report.tsx`**

Wrap the existing `FuelEconomyCard` and depreciation chart in a new `id="section-financials"` container and prepend a monthly cost hero:

- Add a centered header block above `FuelEconomyCard`:
  - Label: `ESTIMATED MONTHLY OWNERSHIP COST` (12px uppercase, neutral)
  - Value: `$534 – $554 / month` (32px bold, neutral) — uses existing `monthlyCostRange`
  - Subtext: `All-in: payment + electricity + maintenance + insurance + expected repairs` (13px neutral)
- Keep `FuelEconomyCard` and depreciation chart as-is
- In the depreciation table (lines 1870-1950), add a tooltip to the "Net Position" column header using the existing `Tooltip` component: "Total financial gain/loss vs. all costs including purchase price"
- Net Position cells already have bold + semantic color — no change needed there

---

## Section 6: Risk Profile — Visual Bars (lines 1979-2136)

**File: `src/pages/Report.tsx`**

Replace the current `RiskScoreBreakdown` component + Risk Factors card with an inline visual bar chart layout inside `id="section-risk"`:

- Keep the `RiskScoreBreakdown` component rendering (it already has bar progress). Instead, restyle it or replace it inline.
- **Option chosen**: Replace the `section-risk` div content with a new inline block:
  - Header: "Purchase Risk Profile" with overall score badge
  - Upload CarFax banner (keep existing logic from `RiskScoreBreakdown`)
  - **Bar chart rows**: Map `uvprsResult.factors`, sorted by `weighted` descending. Each row:
    - Left: factor label + weight% (13px, min-w-[180px])
    - Center: 8px-high bar container (bg-gray-100, rounded), fill width = `score%`, color by score thresholds (green/amber/red)
    - Right: score value (13px semibold, semantic color, w-12)
  - **Reliability Concerns** subsection below bars:
    - Each concern row: name + dotted leader + probability pill + cost range
    - Probability pills: "High likelihood" (red), "Moderate likelihood" (amber), "Low likelihood" (gray)
    - Cost range: 12px red text, right-aligned
  - Keep depreciation risk + value proposition blocks from Risk Factors card

---

## Section 7: Vehicle History Tabs (lines 2138-2324)

**File: `src/pages/Report.tsx`**

Replace the three separate cards (Vehicle Health, Service History, Recalls + Warranty) with a single tabbed container using the existing `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent` from `@/components/ui/tabs`:

- Import `Tabs, TabsList, TabsTrigger, TabsContent` (already available)
- Wrap in `id="section-history"`
- Tab 1 "Overview": Vehicle Health card content (score, progress bar, positives, concerns)
- Tab 2 "Service Records": `ServiceHistoryTimeline` component content
- Tab 3 "Safety Recalls": Recalls card + Warranty card content combined
- Default active tab: "overview"
- All existing data and handlers preserved — just moved into tab panels

---

## Section 8: Bottom Verdict Decision Gate (lines 2461-2467)

**File: `src/pages/Report.tsx`**

Replace the simple "Analyze Another Vehicle" button with a full-width decision gate card:

- **Top band**: Verdict repeat — tinted background matching verdict color, 2px border, full width. Shows verdict badge + risk score + top finding text
- **Contingency block** (if verdict is "Avoid" or "Conditional Buy"):
  - White box with amber left border
  - "This vehicle may be reconsidered if:" + bullet list from `analysis.finalVerdict?.contingencies` or fallback from reliability concerns
- **Action buttons**:
  - Primary (full-width, verdict-color bg, white text, 44px, 16px text): "Get Negotiation Cheat Sheet →" — scrolls to cheat sheet section
  - Subtitle: "Data-backed price argument you can hand to the dealer"
  - Secondary (full-width, outlined, mt-2): "Get Personalized Insurance Quotes"
  - Subtitle: "Compare rates from 80+ insurers"
  - Tertiary (text link, centered, mt-3, 13px neutral): "Analyze a Different Vehicle" — links to `/analyze`

---

## Files Modified

| File | Action |
|------|--------|
| `src/pages/Report.tsx` | Add monthly cost header, restructure risk section with visual bars, convert history to tabs, add bottom decision gate |

## Technical Notes
- No new component files needed — all changes are inline in Report.tsx
- Existing data flow, state, and handlers remain untouched
- `Tabs` component is already installed and available
- `Tooltip` component is already imported
- Risk bar colors use existing `risk-green`/`risk-amber`/`risk-red` tokens from Phase 1
- Reliability concern probability mapping: derive from `KnownFailurePattern.probabilityTier` when available, else use heuristic based on cost range

