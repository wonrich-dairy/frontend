import { createContext, useContext } from "react";
import type { NewRecord, QueuedRecord } from "./queue";

export interface SyncValue {
  /** Whether the browser believes it has a network. */
  online: boolean;
  syncing: boolean;
  pending: QueuedRecord[];
  failed: QueuedRecord[];
  pendingCount: number;
  enqueue: (record: NewRecord) => void;
  sync: () => Promise<void>;
  retry: (clientRecordId: string) => void;
  discard: (clientRecordId: string) => void;
}

/** Split from the provider so the module exports only one kind of thing. */
export const SyncContext = createContext<SyncValue | null>(null);

export function useSync(): SyncValue {
  const value = useContext(SyncContext);

  if (!value) {
    throw new Error("useSync must be used inside a SyncProvider.");
  }

  return value;
}
