/**
 * Route → navigation context helper.
 *
 * CarWise is a four-solution product. The shared header shows the solution
 * hub navigation on the homepage and solution routes, and the original
 * used-car-analysis navigation once the user is inside the analysis product.
 */

export type NavContext = "solutions" | "analysis";

export type SolutionStatus = "live" | "beta" | "coming_soon";

export interface SolutionLink {
  name: string;
  href: string;
  status: SolutionStatus;
  description: string;
}

export const SOLUTION_LINKS: SolutionLink[] = [
  {
    name: "Best Deals",
    href: "/best-deal",
    status: "beta",
    description: "Rank real lease and purchase opportunities near you",
  },
  {
    name: "Best Value",
    href: "/best-value",
    status: "coming_soon",
    description: "Cash offers, trade-in, and private-party value",
  },
  {
    name: "Negative Equity",
    href: "/negative-equity",
    status: "coming_soon",
    description: "Model loan and lease shortfall scenarios",
  },
  {
    name: "Used Car Analysis",
    href: "/analyze",
    status: "live",
    description: "Expert AI analysis of any used-car listing",
  },
];

export const SOLUTION_STATUS_LABEL: Record<SolutionStatus, string> = {
  live: "Available now",
  beta: "Available in beta",
  coming_soon: "Coming soon",
};

/** Routes that belong to the four-solution hub context. */
const SOLUTION_HUB_ROUTES = new Set([
  "/",
  "/best-deal",
  "/best-value",
  "/negative-equity",
]);

/** Analysis-product routes (prefix matched). */
const ANALYSIS_ROUTE_PREFIXES = [
  "/analyze",
  "/marketplace",
  "/sample-report",
  "/how-it-works",
  "/report",
  "/compare",
];

export function getNavContext(pathname: string): NavContext {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") || "/" : pathname;
  if (SOLUTION_HUB_ROUTES.has(path)) return "solutions";
  if (ANALYSIS_ROUTE_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) {
    return "analysis";
  }
  // Shared/global routes (pricing, auth, dashboard, legal, …) keep the
  // analysis navigation, which is the full-product menu.
  return "analysis";
}

/** True when the given solution href matches the active route. */
export function isSolutionActive(href: string, pathname: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
