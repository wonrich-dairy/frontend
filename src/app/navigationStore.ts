import { createContext, useContext } from "react";

export interface Route {
  path: string;
  query: URLSearchParams;
}

export interface Navigation extends Route {
  navigate: (to: string) => void;
  replace: (to: string) => void;
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

export function normalise(path: string): string {
  const trimmed = path.replace(/\/+$/, "");

  return trimmed === "" ? "/" : trimmed;
}

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
