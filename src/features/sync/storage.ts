import { emptyQueue, type SyncQueue } from "./queue";

const STORAGE_KEY = "wonrich.sync.queue";

/**
 * The queue outlives the tab, unlike the session: a record captured at the gate must survive the
 * browser being closed, the device sleeping, or the app being reopened on the next shift. That is
 * the whole promise of AC6 — a record is never lost — so this is localStorage rather than the
 * sessionStorage the token lives in.
 */
export function loadQueue(): SyncQueue {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);

    if (!stored) {
      return emptyQueue();
    }

    const parsed = JSON.parse(stored) as SyncQueue;

    if (!Array.isArray(parsed?.records) || typeof parsed?.nextSequence !== "number") {
      return emptyQueue();
    }

    return parsed;
  } catch {
    // Corrupt or blocked storage must not stop the officer working; it starts a fresh queue.
    return emptyQueue();
  }
}

export function saveQueue(queue: SyncQueue): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch {
    // A device with storage full or blocked still records online; only the offline promise lapses.
  }
}
