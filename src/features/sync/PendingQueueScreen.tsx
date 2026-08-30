import { CloudIcon, CloudOffIcon, TrashIcon, WarningIcon } from "../../components/icons";
import { useSync } from "./syncStore";
import type { QueuedRecord } from "./queue";

const KIND_LABEL: Record<QueuedRecord["kind"], string> = {
  RegisterConsignment: "Consignment",
  RecordQualityTest: "Quality panel",
  PourToTank: "Pour",
};

/**
 * What is still on the device (AC3), and what the service refused (AC6). A refused record is never
 * dropped on the client's say-so: it waits here with the reason until someone decides.
 */
export function PendingQueueScreen() {
  const { online, syncing, pending, failed, sync, retry, discard } = useSync();

  return (
    <section aria-label="Offline queue">
      <header className="panelhead">
        <h2 className="panelhead__title">Offline queue</h2>
        <p className="panelhead__subtitle">
          {online
            ? "Connected. Anything waiting uploads on its own."
            : "No connection. Records are held here until the network returns."}
        </p>
      </header>

      <section className="card" aria-label="Waiting to upload">
        <h3 className="card__title">
          Waiting to upload
          <span className="card__count">{pending.length}</span>
        </h3>

        {pending.length === 0 ? (
          <p className="queue__empty">Nothing is waiting. Every record has reached the service.</p>
        ) : (
          <ul className="queue">
            {pending.map((record) => (
              <li key={record.clientRecordId} className="queue__item">
                <span className="queue__icon queue__icon--pending">
                  <CloudOffIcon />
                </span>
                <span className="queue__body">
                  <span className="microlabel">{KIND_LABEL[record.kind]}</span>
                  <strong className="queue__summary">{record.summary}</strong>
                  <span className="queue__time">Captured {formatTime(record.createdAt)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          className="button button--ghost"
          style={{ marginTop: "var(--space-3)" }}
          disabled={!online || syncing || pending.length === 0}
          onClick={() => void sync()}
        >
          <CloudIcon />
          {syncing ? "Uploading..." : "Upload now"}
        </button>
      </section>

      {failed.length > 0 ? (
        <section className="card" aria-label="Needs review">
          <h3 className="card__title">
            Needs review
            <span className="card__count card__count--danger">{failed.length}</span>
          </h3>

          <p className="queue__empty">
            The service refused these. They stay on the device until someone decides what to do.
          </p>

          <ul className="queue">
            {failed.map((record) => (
              <li key={record.clientRecordId} className="queue__item queue__item--failed">
                <span className="queue__icon queue__icon--failed">
                  <WarningIcon />
                </span>
                <span className="queue__body">
                  <span className="microlabel">{KIND_LABEL[record.kind]}</span>
                  <strong className="queue__summary">{record.summary}</strong>
                  <span className="queue__error">{record.error}</span>

                  <span className="queue__actions">
                    <button type="button" className="queue__action" onClick={() => retry(record.clientRecordId)}>
                      Try again
                    </button>
                    <button
                      type="button"
                      className="queue__action queue__action--danger"
                      onClick={() => discard(record.clientRecordId)}
                    >
                      <TrashIcon width={13} height={13} />
                      Discard
                    </button>
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  );
}

function formatTime(iso: string): string {
  const at = new Date(iso);

  return Number.isNaN(at.getTime())
    ? "earlier"
    : at.toLocaleString(undefined, { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" });
}
