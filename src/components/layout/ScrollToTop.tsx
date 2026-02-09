import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * ScrollToTop component resets scroll position to top on route changes.
 * This fixes the issue where navigating to a new page shows the bottom
 * of the page instead of the top.
 */
export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Smooth scroll to top on route change
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);

  return null;
}
