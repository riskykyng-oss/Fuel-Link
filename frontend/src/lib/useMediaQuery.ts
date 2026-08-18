import { useEffect, useState } from "react";

/**
 * Subscribe to a CSS media query. Used to swap between the desktop dashboard
 * and the dedicated phone layout without CSS-only hacks.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches,
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    setMatches(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/** Breakpoint where the garage app switches from phone to desktop layout. */
export const MOBILE_QUERY = "(max-width: 820px)";
