

# Buyer Negotiation Cheat Sheet

## Overview
Add a "Negotiation Cheat Sheet" button immediately after the Final Verdict card. Clicking it calls a new edge function that uses AI to generate a structured negotiation document, displayed in a modal with PDF download.

## Placement
After the Final Verdict card (line ~2387 in Report.tsx), before the "Analyze Another Vehicle" button.

## Implementation Steps

### 1. Edge Function: `supabase/functions/generate-cheat-sheet/index.ts`
- Accepts structured report data (vehicle, pricing, condition, history, risk, recalls, financing, TCO, aiFindings)
- **Pre-computes the offer price deterministically server-side** using the rules from the prompt:
  - Start from `fairMarketPrivate`
  - Deduct per open recall ($200 avg), service gaps ($300-$1000), overdue maintenance (50% cost), known faults (75% of lowest-probability cost), unverified battery SoH ($800-$2000)
  - Floor at `fairMarketTradeIn`, round to nearest $250
- Builds the deduction table as structured data
- Sends the full prompt (with all the tone/format/constraint rules from the user's spec) plus all injected numbers to Lovable AI (`google/gemini-3-flash-preview`)
- Uses tool calling to get structured JSON back (6 sections, each with header + bullet array)
- Returns: `{ sections: [...], deductionTable: [...], targetOfferPrice: number }`

### 2. Component: `src/components/report/NegotiationCheatSheet.tsx`
- Dialog modal triggered by button click
- Loading state while AI generates
- Renders all 6 sections with headers and bullet points
- Deduction table rendered as a formatted HTML table
- Final offer price highlighted prominently
- "Download PDF" button inside the modal
- Gated to premium/pro subscribers

### 3. PDF: `src/lib/generateCheatSheetPDF.ts`
- Single-page PDF using jsPDF (already a project dependency)
- Clean layout: document header, 6 sections with bullets, deduction table, final offer price
- Matches the ~400-550 word constraint for single-page fit

### 4. Report Page Integration (`src/pages/Report.tsx`)
- Add `NegotiationCheatSheet` component after the verdict card (line ~2387)
- Pass all required data: vehicle info, priceAssessment, riskAssessment, condition, history, financing, recallData, aiFindings, displayVerdict, uvprsResult
- Gate behind premium/pro tier using existing `useSubscription` hook

## Data Flow
```text
Report.tsx (all structured data)
  → Edge function (deterministic offer calc + AI prose)
  → Modal display + PDF download
```

## Key Safeguards
- Offer price is computed server-side, not by AI -- prevents hallucinated numbers
- All dollar amounts, mileage figures, and findings injected verbatim into the prompt
- Floor at trade-in value enforced in code
- "Avoid" verdict triggers contingency language requirement in prompt
- No CarWise references in output (enforced in system prompt)

