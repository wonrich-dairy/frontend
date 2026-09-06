import type { PourableConsignment, Tank } from "../../api/tanks";

const TANKS_KEY = "wonrich.tanks";
const POURABLE_KEY = "wonrich.pourable";

interface Cached<T> {
  at: string;
  items: T[];
}

export function cacheTanks(tanks: Tank[]): void {
  write(TANKS_KEY, tanks);
}

export function cachePourable(consignments: PourableConsignment[]): void {
  write(POURABLE_KEY, consignments);
}

export function cachedTanks(): Cached<Tank> | null {
  return read<Tank>(TANKS_KEY);
}

export function cachedPourable(): Cached<PourableConsignment> | null {
  return read<PourableConsignment>(POURABLE_KEY);
}

function write<T>(key: string, items: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify({ at: new Date().toISOString(), items }));
  } catch {
  }
}

function read<T>(key: string): Cached<T> | null {
  try {
    const stored = localStorage.getItem(key);

    if (!stored) {
      return null;
    }

    const parsed = JSON.parse(stored) as Cached<T>;

    return Array.isArray(parsed?.items) ? parsed : null;
  } catch {
    return null;
  }
}
