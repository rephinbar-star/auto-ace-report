

## Replace MPG Fallback Defaults with Perplexity Web Search

### Problem

When the EPA FuelEconomy.gov API returns no match, the system falls back to a massive hardcoded dictionary of models and generic body-type defaults (24/32/27 for sedans). This produces wildly inaccurate results for any vehicle not in the dictionary (e.g., 2011 S550 showing 24/32/27 instead of 14/21/16).

### Solution

Replace the entire hardcoded fallback system with a Perplexity web search. The flow becomes:

1. **Try EPA API** (unchanged)
2. **Try EPA with trim-based retry** — if model search fails and a `trim` field is provided, extract the trim name and retry
3. **If EPA fails → Perplexity search** — query `"{year} {make} {model} MPG city highway combined fuel economy"` and use structured output to extract the numbers
4. **No more hardcoded defaults** — if Perplexity also fails, return `null` values with `isEstimate: true` so the UI can show "MPG data unavailable" instead of wrong numbers

### Changes

**`supabase/functions/lookup-mpg/index.ts`** — major rewrite:
- Remove the `FALLBACK_MPG`, `EFFICIENT_MODELS`, and `EV_MAKES` dictionaries entirely (lines 29-220, ~190 lines of hardcoded data)
- Add `trim` as optional field to `MPGRequest`
- After EPA lookup fails, add a second EPA attempt using the trim field (extract first word from trim like "S 550" → try "S550")
- If both EPA attempts fail, call Perplexity API with a targeted query like `"2011 Mercedes-Benz S550 EPA MPG rating city highway combined"` using structured JSON output to extract `mpgCity`, `mpgHighway`, `mpgCombined`, `fuelType`, and optionally `evRange`
- In the error catch block, return `null` MPG values instead of fake 24/32/27 defaults
- Mark Perplexity results as `isEstimate: true` (since not directly from EPA)

**`supabase/functions/analyze-vehicle/index.ts`** — minor update:
- Pass `trim` to the `lookup-mpg` function call so EPA retry can use it

### Perplexity Integration Detail

The `PERPLEXITY_API_KEY` is already configured as a secret. The Perplexity call will use the `sonar` model with structured output:

```typescript
const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'sonar',
    messages: [
      { role: 'system', content: 'Return only the EPA fuel economy data.' },
      { role: 'user', content: `What are the EPA MPG ratings for a ${year} ${make} ${model}? Provide city MPG, highway MPG, combined MPG, and fuel type.` }
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'mpg_data',
        schema: {
          type: 'object',
          properties: {
            mpgCity: { type: 'number' },
            mpgHighway: { type: 'number' },
            mpgCombined: { type: 'number' },
            fuelType: { type: 'string' },
            evRange: { type: 'number', nullable: true }
          }
        }
      }
    }
  }),
});
```

### Files Modified
1. `supabase/functions/lookup-mpg/index.ts` — remove hardcoded fallbacks, add trim retry + Perplexity search
2. `supabase/functions/analyze-vehicle/index.ts` — pass trim to lookup-mpg call

