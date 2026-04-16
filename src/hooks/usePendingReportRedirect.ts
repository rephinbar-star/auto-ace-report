import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

/**
 * Global hook: after any auth state change, if `pendingReport` is set in
 * localStorage, navigate the user to /report/new so their analysis is not lost.
 *
 * Must be mounted inside <BrowserRouter>.
 */
export function usePendingReportRedirect() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (isLoading || !isAuthenticated) return;

    // Don't redirect if already on the report page
    if (location.pathname.startsWith("/report")) return;

    // Don't redirect if on signup/login (those pages handle it themselves)
    if (location.pathname === "/signup" || location.pathname === "/login") return;

    const hasPending =
      localStorage.getItem("pendingReport") === "true" ||
      sessionStorage.getItem("pendingReport") === "true";

    if (hasPending) {
      localStorage.removeItem("pendingReport");
      sessionStorage.removeItem("pendingReport");
      navigate("/report/new", { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate, location.pathname]);
}
