import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { NavigationContext, normalise, type Navigation, type Route } from "./navigationStore";

/**
 * A minimal path router over the History API.
 *
 * The client carries no routing dependency — the registry is not reachable from the build
 * environment, and the design only needs what is here: a path, a way to push and pop it, and the
 * browser's own back button working. The officer's device back gesture has to leave a screen
 * rather than the app, which is the whole reason this is not a `useState` switch.
 */
export function NavigationProvider({ children }: { children: ReactNode }) {
  const [route, setRoute] = useState<Route>(read);

  useEffect(() => {
    const onPop = () => setRoute(read());

    window.addEventListener("popstate", onPop);

    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = useCallback((to: string) => {
    window.history.pushState({ depth: depthOf() + 1 }, "", to);
    setRoute(read());
    window.scrollTo(0, 0);
  }, []);

  const replace = useCallback((to: string) => {
    window.history.replaceState(window.history.state, "", to);
    setRoute(read());
  }, []);

  const back = useCallback((to = "/") => {
    // Deep-linked straight onto this screen, so there is nothing of ours to go back to and the
    // browser would leave the app. Send the officer to the parent screen instead.
    if (depthOf() > 0) {
      window.history.back();
      return;
    }

    window.history.replaceState({ depth: 0 }, "", to);
    setRoute(read());
  }, []);

  const value = useMemo<Navigation>(
    () => ({ ...route, navigate, replace, back }),
    [route, navigate, replace, back],
  );

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

function read(): Route {
  const url = new URL(window.location.href);

  return {
    path: normalise(url.pathname),
    query: url.searchParams,
  };
}

function depthOf(): number {
  const state = window.history.state as { depth?: number } | null;

  return typeof state?.depth === "number" ? state.depth : 0;
}
