

## Simplify Price Assessment: Remove Deal Rating, Keep Price Graph

### What changes

Remove the opinionated "This vehicle is a great deal / poor deal" headline and the Negotiation Targets section from the Price Assessment card. Keep only the horizontal gradient bar with markers (Trade-In, Private Sale, Dealer Retail, Fair Market Value, Asking Price, Negotiated Price) so users can visually judge the pricing themselves.

### Why

The deal rating is purely price-based and creates misleading contradictions when a vehicle has serious risk factors (accidents, high mileage) but happens to be priced below market. Removing the subjective label and letting users interpret the visual bar eliminates this incongruency entirely.

### File: `src/pages/Report.tsx`

1. **Remove the deal rating headline block** (lines 1273-1323) — the `<h3>This vehicle is a great deal</h3>` section with the contextual message about being above/below market.

2. **Keep the price bar visualization** (lines 1325-1458) — the gradient bar with floating Asking Price / Negotiated Price labels, dots, and below-bar markers (Trade-In, Fair Market Value, Private Sale / Dealer Retail). Add a simple neutral title like "Price vs. Market" above the bar.

3. **Remove the Negotiation Targets section** (lines 1464-1506) — the green box showing Fair/Good/Excellent deal target prices.

4. **Clean up `dealRatingColors`** (line 851-857) and the card header badge that references `dealRating` (around line 1222-1268) — remove any badge/tag that shows the rating label.

5. **Keep `dealRating` in the data model** — it's stored in the database and used in PDF generation and comparison features; no schema changes needed. Just stop displaying it prominently in the report UI.

### Result

The Price Assessment card will show:
- Card title: "Price Assessment"
- The gradient bar with all price markers (Trade-In, FMV, Private Sale/Dealer Retail, Asking Price, Negotiated Price)
- Pricing Sources section (unchanged)
- No subjective deal label, no negotiation targets

