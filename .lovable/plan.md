

# Mobile Responsiveness Implementation Plan

## Summary
Apply mobile-first responsive styles across all report sections and add a sticky bottom bar for mobile users. The breakpoint is 768px (Tailwind `md:`).

---

## 1. Sticky Bottom Bar (Mobile Only)

**New component: `src/components/report/MobileBottomBar.tsx`**

- Fixed bottom, full width, white bg, 1px top border, h-[56px], px-4, z-[60]
- Hidden on `md:` and above (`md:hidden`)
- Left: Verdict badge (small pill) + "· $XXX/mo" text
- Right: "Cheat Sheet" button (primary, small)
- Props: `verdict`, `monthlyCostRange`, `onCheatSheetClick`, `isPaid`, `visible` (same IntersectionObserver logic as StickyNavBar — only show when hero scrolled past)

---

## 2. VerdictHero Mobile Adjustments

**File: `src/components/report/VerdictHero.tsx`**

- Change `flex-col-reverse` to ensure verdict zone renders FIRST on mobile (currently `flex-col-reverse md:flex-row` which already puts right zone first — verify this is correct since the right zone contains the verdict)
- Reduce card padding to `p-4 md:p-5` on left zone, same on right zone

---

## 3. MetricsStrip Mobile

**File: `src/components/report/MetricsStrip.tsx`**

- Already has `overflow-x-auto` and `snap-x`. Add: `-webkit-overflow-scrolling: touch` via style prop and `scrollbar-hide` class
- Ensure `min-w-[130px]` is on each card
- Reduce card padding to `p-2.5 md:p-3`

---

## 4. ExpertAnalysisCard Mobile

**File: `src/components/report/ExpertAnalysisCard.tsx`**

- Findings grid: already `grid-cols-1 md:grid-cols-3` — correct
- Reduce padding: `p-4 md:p-5`

---

## 5. Pricing Section Mobile

**File: `src/pages/Report.tsx` (section-pricing area, ~line 1440)**

- Pricing sources grid: change `grid-cols-3` to `grid-cols-2 md:grid-cols-3`
- Reduce report-card padding on mobile

---

## 6. Risk Bars Mobile

**File: `src/pages/Report.tsx` (~line 2112)**

- Factor name: `min-w-[120px] md:min-w-[180px]`
- Reliability concerns: stack cost + badge below name on mobile using flex-wrap

---

## 7. Vehicle History Tabs Mobile

**File: `src/pages/Report.tsx` (~line 2184)**

- TabsList: add `overflow-x-auto` for horizontal scroll if needed
- Already using `flex-1` tabs — should be fine

---

## 8. StickyNavBar Mobile

**File: `src/components/report/StickyNavBar.tsx`**

- Center nav links already have `hidden md:flex` — correct
- Verify mobile shows only verdict badge + cheat sheet button

---

## 9. Global Card Padding Mobile

**File: `src/index.css`**

- Update `.report-card` to use `padding: 16px` on mobile, `20px 24px` on `md:`
- Add `.scrollbar-hide` utility if not already present

---

## 10. Bottom Bar Integration in Report.tsx

**File: `src/pages/Report.tsx`**

- Import and render `MobileBottomBar` at the bottom of the page
- Pass verdict, monthlyCostRange, cheatSheet handler, isPaid
- Add `pb-16 md:pb-0` to main content on mobile to account for bottom bar height

---

## Files Summary

| File | Action |
|------|--------|
| `src/components/report/MobileBottomBar.tsx` | Create |
| `src/components/report/VerdictHero.tsx` | Minor padding adjustments |
| `src/components/report/MetricsStrip.tsx` | Scrollbar-hide, touch scrolling, padding |
| `src/components/report/ExpertAnalysisCard.tsx` | Padding adjustments |
| `src/components/report/StickyNavBar.tsx` | Already mobile-ready, verify |
| `src/pages/Report.tsx` | Risk bar min-width, pricing grid cols, bottom bar integration, bottom padding |
| `src/index.css` | report-card responsive padding, scrollbar-hide utility |

