/**
 * Risk color utility — maps scores and verdicts to semantic CSS color tokens.
 * Returns Tailwind class names referencing design system tokens.
 */

export type RiskColorToken = "risk-green" | "risk-amber" | "risk-red";

export function getRiskColorToken(score: number): RiskColorToken {
  if (score <= 30) return "risk-green";
  if (score <= 55) return "risk-amber";
  return "risk-red";
}

export function getVerdictColorToken(verdict: string): RiskColorToken {
  const v = verdict.toLowerCase();
  if (v === "avoid" || v === "walk away") return "risk-red";
  if (v === "caution" || v === "conditional buy" || v === "negotiate") return "risk-amber";
  return "risk-green";
}

/** Returns a Tailwind text color class */
export function getRiskTextClass(score: number): string {
  return `text-${getRiskColorToken(score)}`;
}

/** Returns a Tailwind bg color class */
export function getRiskBgClass(score: number): string {
  return `bg-${getRiskColorToken(score)}`;
}

export function getVerdictTextClass(verdict: string): string {
  return `text-${getVerdictColorToken(verdict)}`;
}

export function getVerdictBgClass(verdict: string): string {
  return `bg-${getVerdictColorToken(verdict)}`;
}

/** Returns the raw HSL CSS variable value for inline styles */
export function getRiskHsl(score: number): string {
  const token = getRiskColorToken(score);
  return `hsl(var(--${token}))`;
}

export function getVerdictHsl(verdict: string): string {
  const token = getVerdictColorToken(verdict);
  return `hsl(var(--${token}))`;
}
