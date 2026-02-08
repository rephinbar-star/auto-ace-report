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
    // Scroll to top on route change
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
