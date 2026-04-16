
User wants the verbatim AI analysis prompt extracted to a downloadable file. Plan: switch to default mode and run a script that reads `supabase/functions/analyze-vehicle/index.ts` lines 261–731 verbatim and writes them to `/mnt/documents/ai-analysis-prompt.md` with minimal section headers, then emit a presentation-artifact tag.

## Plan

1. Read the exact lines containing the system prompt template (~261–617) and user prompt builder (~669–731) from `supabase/functions/analyze-vehicle/index.ts`.
2. Write the raw, verbatim contents to `/mnt/documents/ai-analysis-prompt.md` — no summarization, no paraphrasing. Just the literal template strings as they exist in the source, including all `${...}` substitution placeholders.
3. Deliver as a downloadable artifact.

No code changes to the project.
