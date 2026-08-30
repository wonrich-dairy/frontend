import type { PourableConsignment, Tank } from "../../api/tanks";

/**
 * The last tanks and pourable consignments the device saw.
 *
 * Pouring has to work with no network (SCRUM-10, AC1), and the officer cannot choose from a list
 * that has to be fetched. The tanks are plant rather than reference data — three of them, shipped
 * with the schema — so a cached copy is as good as a fetched one; the pourable list goes stale,
 * which the screen says out loud rather than pretending otherwise.
 */

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
    // Without storage the screen simply has nothing to offer offline.
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
