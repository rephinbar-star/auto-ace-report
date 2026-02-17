import * as React from "react";

const MOBILE_BREAKPOINT = 768;
const UA_MOBILE = /Android|iPhone|iPad|iPod|webOS|BlackBerry|Opera Mini|IEMobile/i;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const isMobileUA = UA_MOBILE.test(navigator.userAgent);
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT || isMobileUA);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT || isMobileUA);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}
