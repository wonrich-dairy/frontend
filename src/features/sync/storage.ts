import { emptyQueue, type SyncQueue } from "./queue";

const STORAGE_KEY = "wonrich.sync.queue";

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
    return emptyQueue();
  }
}

export function saveQueue(queue: SyncQueue): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch {
  }
}
