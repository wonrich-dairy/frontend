import { CloudOffIcon } from "./icons";
import { useSync } from "../features/sync/syncStore";

// Whether this device is connected, and how many offline records are still waiting to upload.
// The queue is the device's, so every module's top bar shows the same state.
export function SyncPill() {
  const { online, syncing, pendingCount } = useSync();

  if (!online) {
    return (
      <span className="pill pill--offline" aria-live="polite">
        <CloudOffIcon width={13} height={13} />
        {pendingCount > 0 ? `Offline - ${pendingCount} waiting` : "Offline"}
      </span>
    );
  }

  if (syncing) {
    return (
      <span className="pill" aria-live="polite">
        <span className="pill__dot" />
        Syncing...
      </span>
    );
  }

  if (pendingCount > 0) {
    return (
      <span className="pill pill--waiting" aria-live="polite">
        <span className="pill__dot pill__dot--waiting" />
        {pendingCount} waiting
      </span>
    );
  }

  return (
    <span className="pill" aria-live="polite">
      <span className="pill__dot" />
      Cloud Sync Active
    </span>
  );
}
