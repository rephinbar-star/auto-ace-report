

## Eliminate Horizontal Scrolling on Mobile

The horizontal scrollbar on the report page is caused by several elements that extend beyond the mobile viewport (375px). Here's what needs to be fixed and how:

### Root Causes Identified

1. **Feedback Widget** -- The floating tab is positioned at `right: 0` with its content protruding past the viewport edge, pushing the document width beyond 100%.

2. **Depreciation Table** -- 7 columns (Year, Private Value, Trade-In, Loan Balance, Repairs, Maintenance, Net Equity) are too wide for a 375px screen. The `overflow-x-auto` wrapper only prevents the *table* from overflowing, but the overall page width is already pushed wider by other elements.

3. **Price Assessment Gradient Bar** -- Marker labels use `whitespace-nowrap` and absolute positioning, which can push content outside the container bounds on narrow screens.

4. **Page-Level Overflow** -- There is no global `overflow-x: hidden` on the page or body, so any element that extends past the viewport causes a horizontal scrollbar on the entire page.

### Implementation Plan

**Step 1: Add global overflow-x clamp**
- In `src/index.css`, add `overflow-x: hidden` to the `body` rule. This is the single most impactful fix -- it prevents *any* slightly overflowing element from creating a page-wide scrollbar.

**Step 2: Fix Feedback Widget positioning**
- In `src/components/feedback/FeedbackWidget.tsx`, change the trigger button positioning so it doesn't extend past the viewport. Use `right: -1px` or adjust the tab so its width is fully within the viewport boundary.

**Step 3: Constrain the Price Assessment bar container**
- In `src/pages/Report.tsx`, add `overflow: hidden` to the gradient bar's parent container (the `relative pt-14 pb-14` div) so absolutely-positioned marker labels don't push the page width.

**Step 4: Make depreciation table cells compact on mobile**
- Apply `text-xs whitespace-nowrap` to all table cells (not just the Year column) so the table fits better within the `overflow-x-auto` wrapper.
- Shorten column headers on mobile (e.g., "Maint." instead of "Maintenance").

### Technical Details

| File | Change |
|------|--------|
| `src/index.css` | Add `overflow-x: hidden` to `body` |
| `src/components/feedback/FeedbackWidget.tsx` | Adjust trigger positioning to prevent overflow |
| `src/pages/Report.tsx` | Add `overflow-hidden` to price bar container; compact table cells |

These changes are minimal and non-breaking -- they only constrain overflow behavior without altering the visual layout on desktop.

