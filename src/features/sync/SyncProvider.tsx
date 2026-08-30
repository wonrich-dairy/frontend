import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { uploadQueue } from "../../api/sync";
import { useSession } from "../../auth/sessionStore";
import { SyncContext, type SyncValue } from "./syncStore";
import {
  applyOutcomes,
  discard,
  enqueue,
  failed,
  pending,
  retry,
  type NewRecord,
  type SyncQueue,
} from "./queue";
import { loadQueue, saveQueue } from "./storage";

/**
 * Holds the offline queue and drains it when the network comes back (SCRUM-10).
 *
 * The browser's online event is a hint, not a promise — it fires when the interface has a link,
 * which at a chilling centre is not the same as being able to reach the service. So a failed
 * upload is not treated as an error to show the officer: the records stay queued and the next
 * window tries again.
 */
export function SyncProvider({
  children,
  initialQueue,
}: {
  children: ReactNode;
  /** Supplied by tests so a queue can be rendered without touching storage. */
  initialQueue?: SyncQueue;
}) {
  const { session } = useSession();
  const token = session?.accessToken ?? null;

  const [queue, setQueue] = useState<SyncQueue>(() => initialQueue ?? loadQueue());
  const [online, setOnline] = useState<boolean>(() => navigator.onLine);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    saveQueue(queue);
  }, [queue]);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  const waiting = useMemo(() => pending(queue), [queue]);
  const refused = useMemo(() => failed(queue), [queue]);

  // One upload at a time: the queue is sent whole, and two in flight would race on the outcomes.
  const inFlight = useRef(false);

  const sync = useCallback(async () => {
    const records = pending(queue);

    if (inFlight.current || records.length === 0 || !token) {
      return;
    }

    inFlight.current = true;
    setSyncing(true);

    try {
      const batch = await uploadQueue(records, token);

      setQueue((current) => applyOutcomes(current, batch.results));
    } catch {
      // Still unreachable. The records keep their place and the next window tries again.
    } finally {
      inFlight.current = false;
      setSyncing(false);
    }
  }, [queue, token]);

  // AC4: on reconnection the queue uploads on its own, without the officer asking. Synchronising
  // with the network is what effects are for, and the progress flag the upload sets is what the
  // pill in the top bar reports, so the state update here is the point rather than an accident.
  useEffect(() => {
    if (online && waiting.length > 0 && token) {
      // oxlint-disable-next-line react/set-state-in-effect
      void sync();
    }
  }, [online, waiting.length, token, sync]);

  const value = useMemo<SyncValue>(
    () => ({
      online,
      syncing,
      pending: waiting,
      failed: refused,
      pendingCount: waiting.length,
      enqueue: (record: NewRecord) => setQueue((current) => enqueue(current, record)),
      sync,
      retry: (id: string) => setQueue((current) => retry(current, id)),
      discard: (id: string) => setQueue((current) => discard(current, id)),
    }),
    [online, syncing, waiting, refused, sync],
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}
