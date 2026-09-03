import { createContext, useContext } from "react";

/**
 * The routing context and the path matcher, kept out of the provider module so that file exports
 * components only — the same split `sessionStore` and `SessionContext` already use.
 */

export interface Route {
  /** Path with no query string, e.g. `/tanks/T1`. */
  path: string;
  /** Parsed query string. */
  query: URLSearchParams;
}

export interface Navigation extends Route {
  /** Pushes a new entry, so back returns to the current screen. */
  navigate: (to: string) => void;
  /** Replaces the current entry, for a redirect that should not be re-enterable. */
  replace: (to: string) => void;
  /** Steps back, falling back to `to` when this is the first screen in the session. */
  back: (to?: string) => void;
}

export const NavigationContext = createContext<Navigation | null>(null);

export function useNavigation(): Navigation {
  const navigation = useContext(NavigationContext);

  if (!navigation) {
    throw new Error("useNavigation must be used inside a NavigationProvider.");
  }

  return navigation;
}

/** Trailing slashes are dropped so `/tanks` and `/tanks/` are one route. */
export function normalise(path: string): string {
  const trimmed = path.replace(/\/+$/, "");

  return trimmed === "" ? "/" : trimmed;
}

/**
 * Matches `pattern` against `path`, returning the named segments or null.
 * `:name` captures one segment; nothing else is special.
 */
export function match(pattern: string, path: string): Record<string, string> | null {
  const patternParts = normalise(pattern).split("/");
  const pathParts = normalise(path).split("/");

  if (patternParts.length !== pathParts.length) {
    return null;
  }

  const params: Record<string, string> = {};

  for (const [index, part] of patternParts.entries()) {
    const actual = pathParts[index];

    if (part.startsWith(":")) {
      if (actual === "") {
        return null;
      }

      params[part.slice(1)] = decodeURIComponent(actual);
      continue;
    }

    if (part !== actual) {
      return null;
    }
  }

  return params;
}
