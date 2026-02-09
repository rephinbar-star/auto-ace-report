

# Integrate Real-Time Vehicle Pricing via Perplexity

## Problem
Currently, Fair Market Value, Private Sale Value, and Trade-in Value are generated purely by the AI model (Gemini) based on its training data. This can produce inaccurate or outdated pricing estimates.

## Solution
Use the Perplexity API to perform a real-time web search for current market pricing of the specific vehicle being analyzed, then inject those search results into the Gemini prompt so the AI produces grounded, accurate valuations.

## How It Works

1. When a user submits a vehicle for analysis, the backend will first query Perplexity for current market pricing data
2. Perplexity searches the web (KBB, Edmunds, CarGurus, Autotrader, etc.) and returns pricing with citations
3. Those real-world pricing data points are injected into the Gemini prompt as reference material
4. Gemini then uses the real data to produce its structured analysis, resulting in far more accurate valuations

## Implementation Steps

### Step 1: Connect Perplexity
- Use the Perplexity connector to link credentials to this project
- This makes `PERPLEXITY_API_KEY` available as an environment variable in backend functions

### Step 2: Create a `lookup-pricing` backend function
- New edge function: `supabase/functions/lookup-pricing/index.ts`
- Accepts year, make, model, trim, mileage, and condition
- Calls Perplexity `sonar` model with a targeted query like:  
  *"What is the current fair market value, private party sale price, and trade-in value for a [year] [make] [model] [trim] with [mileage] miles in [condition] condition? Include KBB, Edmunds, and NADA values."*
- Returns the Perplexity response text and citations
- Add to `supabase/config.toml` with `verify_jwt = false`

### Step 3: Update `analyze-vehicle` to use real pricing
- Call `lookup-pricing` in parallel alongside the existing MPG lookup
- Inject the Perplexity pricing results into the Gemini system/user prompt as grounding context, e.g.:  
  *"REAL-TIME MARKET DATA (use these as your primary pricing reference): [Perplexity results]"*
- The AI will then base its `fairMarketPrivate`, `fairMarketTradeIn`, and `fairOfferPrice` on actual current market data

### Step 4: Surface data sources on the report
- Add a "Pricing Sources" section or footnote on the report page showing Perplexity citations (e.g., KBB, Edmunds links)
- Return the citations array from the backend alongside the existing analysis response
- Display as small linked references under the Price Assessment card

## Technical Details

- Perplexity `sonar` model is used (fast, grounded search -- ideal for factual lookups)
- The pricing lookup runs in parallel with the MPG lookup, so it adds no extra wait time
- If Perplexity fails or is rate-limited, the system falls back to the current AI-only estimates (graceful degradation)
- Citations are passed through to the frontend so users can verify pricing sources

