

# Report Page Redesign — Implementation Plan
*Phases 1-7 and 9 (skipping Phase 8: TCO + Depreciation)*

## Summary
Transform the Report page from a two-column sidebar layout to a single-column (900px max-width) design with a sticky nav bar, verdict hero, metrics strip, restructured expert analysis, and reorganized pricing. The TCO/Depreciation section stays as-is.

---

## Phase 1: Design System Tokens

**Files: `src/index.css`, `tailwind.config.ts`, new `src/lib/risk-colors.ts`**

- Add CSS variables `--risk-red`, `--risk-amber`, `--risk-green`, `--surface`, `--surface-muted`, `--border-card` to `:root` and `.dark`
- Add `risk-red`, `risk-amber`, `risk-green` to Tailwind color config
- Create `src/lib/risk-colors.ts` with `getRiskColor(score, verdict)` utility
- Standardize card style class: white bg, 1px `#E5E7EB` border, 12px radius, 20/24px padding, no shadows

---

## Phase 2: Single-Column Layout

**File: `src/pages/Report.tsx`**

- Remove the `grid gap-8 lg:grid-cols-3` wrapper (line ~1651)
- Set all content to max-width 900px centered
- Relocate all sidebar content (images, UVPRS, recalls, health, service history, risk factors, dealer review, warranty, ad) into the main flow at positions defined below

---

## Phase 3: Sticky Navigation Bar

**New file: `src/components/report/StickyNavBar.tsx`**

- Hidden initially, appears when Verdict Hero scrolls out of view (IntersectionObserver)
- Full-width white bar, 52px, z-50, 1px bottom border
- Left: verdict colored pill + vehicle label
- Center: Overview | Pricing | Financials | Risk | History — active state via IntersectionObserver
- Right: "Negotiation Cheat Sheet" button (small primary)
- Mobile (<768px): hide center links

Props: `verdict`, `vehicleLabel`, `isPaid`, `cheatSheetTrigger`

---

## Phase 4: Verdict Hero

**New file: `src/components/report/VerdictHero.tsx`**

Replaces current header (lines ~1244-1408) and Final Verdict card (lines ~2310-2388). Two-zone card:

- **Left (55%)**: Vehicle photo or initials fallback, title, VIN/mileage/price, action buttons (Re-Analyze, Upload CarFax, Download PDF) as outlined buttons
- **Right (45%)**: Verdict card with tinted bg + 2px border. Large verdict badge pill (28px), circular SVG risk gauge (80px), top 3 findings, CTA row (Negotiation Cheat Sheet + Get Insurance Quote)
- Mobile: stack vertically, verdict first
- Ref on this section for IntersectionObserver (sticky nav trigger)

---

## Phase 5: Metrics Strip

**New file: `src/components/report/MetricsStrip.tsx`**

`id="section-overview"` — 6 cards in a horizontal row (scrollable on mobile):
1. Price vs Market — semantic color, click scrolls to `#section-pricing`
2. Risk Score — click scrolls to `#section-risk`
3. Vehicle Health — click scrolls to `#section-history`
4. Monthly Ownership Cost — from TCO calculations
5. Safety Recalls — red tint if open, click scrolls to `#section-history`
6. Warranty Status — click scrolls to `#section-history`

Each card: 130px min-width, white bg, 1px border, 10px radius, semantic colors.

---

## Phase 6: Expert Analysis

**New file: `src/components/report/ExpertAnalysisCard.tsx`**

Replaces current Expert Opinion card (lines ~2294-2308):
- **Part A**: Primary finding banner — full-width, verdict-color left border, top finding, icon
- **Part B**: 3-column grid of top findings from aiFindings (faults + patterns sorted by severity), each with colored left border, severity icon, heading, detail, cost badge
- **Part C**: Collapsible "Read Full Expert Analysis" — existing `sanitizedExpertOpinion` with animated expand/collapse

---

## Phase 7: Pricing Analysis Restructure

**File: `src/pages/Report.tsx` (inline changes)**

`id="section-pricing"`:
- Add "Is this a good deal?" header (18px semibold) with semantic answer line above existing price gauge
- Keep the existing price bar visualization unchanged
- Move pricing sources into collapsible "View All Pricing Sources" (collapsed by default)
- Move financing card below pricing (not above), with summary line + "Edit Financing Details" expander

---

## Phase 9: Section Redistribution & Final Order

All former sidebar content placed in the main column. New section order:

1. **Verdict Hero** (new component)
2. **Metrics Strip** `#section-overview` (new component)
3. **Expert Analysis** (new component)
4. **Pricing Analysis** `#section-pricing` (restructured)
5. **Financing Details** (moved below pricing)
6. **Fuel Economy & TCO** `#section-financials` (kept as-is)
7. **Depreciation Chart** (kept as-is)
8. **Risk Assessment** `#section-risk` — UVPRS Score Breakdown + Risk Factors
9. **History & Condition** `#section-history` — Vehicle Health + Service History + Recalls + Warranty
10. **Vehicle Specifications** (moved from top to here)
11. **Dealer Review**
12. **Negotiation Cheat Sheet**
13. **Analyze Another Vehicle** button

---

## Files Summary

| File | Action |
|------|--------|
| `src/lib/risk-colors.ts` | Create |
| `src/components/report/StickyNavBar.tsx` | Create |
| `src/components/report/VerdictHero.tsx` | Create |
| `src/components/report/MetricsStrip.tsx` | Create |
| `src/components/report/ExpertAnalysisCard.tsx` | Create |
| `src/index.css` | Modify — add risk color tokens |
| `tailwind.config.ts` | Modify — add risk colors |
| `src/pages/Report.tsx` | Major restructure — single column, new order, integrate new components |
| `src/components/report/RiskScoreBreakdown.tsx` | Minor style updates for new card style |

## Technical Notes
- All data fetching, state management, DB persistence, and business logic in Report.tsx remain untouched
- Existing handlers (`refreshPricing`, `handleDownloadPDF`, history uploads) keep their logic — only button locations move
- Circular gauge is a simple SVG `<circle>` + `<text>` — no new dependencies
- IntersectionObserver uses React refs; two observers: one for sticky nav visibility, one for active section tracking

