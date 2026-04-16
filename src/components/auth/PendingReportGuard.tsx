import { usePendingReportRedirect } from "@/hooks/usePendingReportRedirect";

/**
 * Thin wrapper component that activates the pending-report redirect hook.
 * Placed inside <BrowserRouter> in App.tsx so it has access to navigation.
 */
export function PendingReportGuard() {
  usePendingReportRedirect();
  return null;
}
