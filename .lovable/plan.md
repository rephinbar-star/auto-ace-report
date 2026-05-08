
## Goal
Switch all production LLM calls from the Lovable AI Gateway to OpenRouter (OpenAI-compatible). Perplexity sonar lookups stay direct.

## Step 1 — Add secret
Request `OPENROUTER_API_KEY` (user pastes `sk-or-v1-...`).

## Step 2 — Shared helper
Create `supabase/functions/_shared/openrouter.ts`:

```ts
export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export function openRouterHeaders() {
  return {
    "Authorization": `Bearer ${Deno.env.get("OPENROUTER_API_KEY")}`,
    "Content-Type": "application/json",
    "HTTP-Referer": "https://carwise.expert",
    "X-Title": "CarWise",
  };
}
```

## Step 3 — Model migration map

| Edge function | Old (Lovable Gateway) | New (OpenRouter) | Reason |
|---|---|---|---|
| `analyze-vehicle` | `google/gemini-3-flash-preview` | `anthropic/claude-sonnet-4.6` | Heaviest reasoning |
| `generate-cheat-sheet` | `google/gemini-3-flash-preview` | `anthropic/claude-haiku-4.5` | Light text gen |
| `analyze-dealer` | `google/gemini-3-flash-preview` | `anthropic/claude-haiku-4.5` | Light JSON gen |
| `scrape-listing` | `google/gemini-3-flash-preview` | `anthropic/claude-haiku-4.5` | Text extraction, no vision |
| `extract-from-screenshot` | `google/gemini-3-flash-preview` | `google/gemini-2.5-flash` | Vision task |
| `parse-history-report` (3-flash structured call, line 504) | `google/gemini-3-flash-preview` | `anthropic/claude-haiku-4.5` | Structured extraction |
| `parse-history-report` (2.5-flash vision OCR, lines 149/264/376) | `google/gemini-2.5-flash` | **unchanged — stays on Lovable Gateway** | Vision OCR |

## Step 4 — Per-function fetch refactor
For each migrated call:
- Import: `import { OPENROUTER_BASE_URL, openRouterHeaders } from "../_shared/openrouter.ts";`
- Replace key check: drop `LOVABLE_API_KEY` requirement (or keep only where Lovable Gateway is still used — i.e. `parse-history-report`).
- Replace `fetch("https://ai.gateway.lovable.dev/v1/chat/completions", { headers: { Authorization: Bearer ${LOVABLE_API_KEY}, ... } })` with:

```ts
const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
  method: "POST",
  headers: openRouterHeaders(),
  body: JSON.stringify({
    model: "anthropic/claude-sonnet-4.6", // varies per function
    messages: [...],                      // unchanged
    // existing tools / tool_choice / response_format / temperature preserved
  }),
});
```

- Response parsing (`response.choices[0].message.content` and tool_calls path) is unchanged — OpenRouter is OpenAI-compatible.
- Preserve all existing error handling for 429 / 402 (OpenRouter returns the same status codes for rate limit / insufficient credits).

## Step 5 — Perplexity functions
- `lookup-mpg`: unchanged (`sonar`).
- `lookup-gas-price`: unchanged (`sonar`).
- `lookup-maintenance`: upgrade `sonar` → `sonar-pro` (single string change at line 54).

## Step 6 — Pre-deploy preview
Before deploying, surface for review:
1. Updated `analyze-vehicle/index.ts` lines around 733–740 (new `OPENROUTER_BASE_URL`, `openRouterHeaders()`, and `model: "anthropic/claude-sonnet-4.6"`).
2. The shared `_shared/openrouter.ts` file contents.
3. Confirmation that `parse-history-report` vision OCR calls (lines 142, 257, 369) remain on the Lovable Gateway with `gemini-2.5-flash`, and only the line-497 structured call moved.

After approval, deploy: `analyze-vehicle`, `generate-cheat-sheet`, `analyze-dealer`, `scrape-listing`, `extract-from-screenshot`, `parse-history-report`, `lookup-maintenance`.

## Out of scope
- No client-side changes.
- No DB / config.toml changes.
- No changes to non-LLM helpers (MarketCheck, VinAudit, auto.dev, NHTSA, Firecrawl).
