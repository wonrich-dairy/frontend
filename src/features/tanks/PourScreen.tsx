import { useEffect, useMemo, useState } from "react";
import { ApiError } from "../../api/http";
import { listPourable, listTanks, pourIntoTank, type PourableConsignment, type Tank } from "../../api/tanks";
import { useSession } from "../../auth/sessionStore";
import { ArrowRightIcon, CheckIcon, CloudOffIcon, DropletIcon, WarningIcon } from "../../components/icons";
import { useSync } from "../sync/syncStore";
import { cachePourable, cacheTanks, cachedPourable, cachedTanks } from "./cache";

/**
 * Pouring accepted consignments into a chilling tank (SCRUM-52), and doing it with no network
 * (SCRUM-10, AC1 and AC7).
 *
 * The design pours several consignments at once; the service takes one per call, so a selection of
 * three is three records — which is also what the offline queue holds, one per consignment, so the
 * two paths agree on what a pour is.
 */
export function PourScreen({
  initialTankCode,
}: {
  /** Set when the officer came from a tank's own screen, so the tank is not asked for twice. */
  initialTankCode?: string;
} = {}) {
  const { session, signOut } = useSession();
  const { online, enqueue: queueRecord } = useSync();
  const token = session?.accessToken ?? null;

  const [tanks, setTanks] = useState<Tank[]>(() => cachedTanks()?.items ?? []);
  const [pourable, setPourable] = useState<PourableConsignment[]>(() => cachedPourable()?.items ?? []);
  // Whether a fetch has landed this session. Staleness follows from that and the connection, so
  // it is derived rather than held.
  const [fresh, setFresh] = useState(false);
  const stale = !online || !fresh;

  const [tank, setTank] = useState<Tank | null>(
    () => cachedTanks()?.items.find((one) => one.code === initialTankCode) ?? null,
  );
  const [chosen, setChosen] = useState<string[]>([]);
  const [failure, setFailure] = useState<string | null>(null);
  const [pouring, setPouring] = useState(false);
  const [poured, setPoured] = useState<{ count: number; queued: boolean } | null>(null);

  useEffect(() => {
    if (!online) {
      return;
    }

    const abort = new AbortController();

    Promise.all([listTanks(token, abort.signal), listPourable(token, abort.signal)])
      .then(([loadedTanks, loadedPourable]) => {
        setTanks(loadedTanks);
        setPourable(loadedPourable);
        setTank((current) =>
          current ?? loadedTanks.find((one) => one.code === initialTankCode) ?? null,
        );
        cacheTanks(loadedTanks);
        cachePourable(loadedPourable);
        setFresh(true);
      })
      .catch(() => {
        // Whatever the device last saw is better than an empty screen at the tank.
        if (!abort.signal.aborted) {
          setFresh(false);
        }
      });

    return () => abort.abort();
  }, [online, token, initialTankCode]);

  const selected = useMemo(
    () => pourable.filter((consignment) => chosen.includes(consignment.reference)),
    [pourable, chosen],
  );

  const litres = selected.reduce((total, consignment) => total + consignment.totalQuantityLitres, 0);

  const reset = () => {
    setTank(null);
    setChosen([]);
    setPoured(null);
    setFailure(null);
  };

  const confirm = async () => {
    if (!tank || selected.length === 0) {
      return;
    }

    setFailure(null);

    if (!online) {
      queueSelected(tank, selected);
      return;
    }

    setPouring(true);

    try {
      for (const consignment of selected) {
        await pourIntoTank(tank.code, consignment.reference, token);
      }

      setPoured({ count: selected.length, queued: false });
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 0) {
        queueSelected(tank, selected);
        return;
      }

      setFailure(
        error instanceof ApiError ? error.message : "The pour could not be recorded. Try again.",
      );

      if (error instanceof ApiError && error.status === 401) {
        signOut();
      }
    } finally {
      setPouring(false);
    }
  };

  const queueSelected = (into: Tank, consignments: PourableConsignment[]) => {
    for (const consignment of consignments) {
      queueRecord({
        kind: "PourToTank",
        summary: `${consignment.reference} into ${into.name}`,
        pour: { tankCode: into.code, consignmentReference: consignment.reference },
      });
    }

    setPouring(false);
    setPoured({ count: consignments.length, queued: true });
  };

  if (poured) {
    return <PouredConfirmation count={poured.count} queued={poured.queued} onPourAgain={reset} />;
  }

  if (!tank) {
    return <TankList tanks={tanks} stale={stale} failure={failure} onChoose={setTank} />;
  }

  return (
    <section aria-label="Pour into tank">
      <header className="panelhead">
        <h2 className="panelhead__title">Pour Consignment</h2>
        <p className="panelhead__subtitle">
          Into <strong>{tank.name}</strong> ({tank.code}) &middot; holding{" "}
          {tank.totalQuantityLitres.toFixed(1)} of {tank.capacityLitres.toFixed(0)} L
        </p>
        {initialTankCode ? null : (
          <button type="button" className="panelhead__change" onClick={() => setTank(null)} disabled={pouring}>
            Choose a different tank
          </button>
        )}
      </header>

      <section className="card" aria-label="Accepted consignments">
        <h3 className="card__title">
          Accepted consignments
          <span className="card__count">{pourable.length}</span>
        </h3>

        {stale ? (
          <p className="notice notice--info" style={{ marginTop: 0 }}>
            <CloudOffIcon />
            Offline. This is the list the device last saw, so it may have moved on.
          </p>
        ) : null}

        {pourable.length === 0 ? (
          <p className="queue__empty">
            Nothing is waiting to be poured. A consignment appears here once it passes the gate.
          </p>
        ) : (
          <ul className="queue">
            {pourable.map((consignment) => (
              <li key={consignment.reference} className="queue__item">
                <label className="pourpick">
                  <input
                    type="checkbox"
                    checked={chosen.includes(consignment.reference)}
                    disabled={pouring}
                    onChange={(event) =>
                      setChosen((current) =>
                        event.target.checked
                          ? [...current, consignment.reference]
                          : current.filter((reference) => reference !== consignment.reference),
                      )
                    }
                  />
                  <span className="queue__body">
                    <strong className="queue__summary">{consignment.reference}</strong>
                    <span className="queue__time">{consignment.societyName}</span>
                  </span>
                  <span className="pourpick__litres">{consignment.totalQuantityLitres.toFixed(1)} L</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </section>

      {failure ? (
        <p className="notice notice--error" role="alert">
          <WarningIcon />
          {failure}
        </p>
      ) : null}

      <section className="total" aria-label="Pour total">
        <span className="microlabel">Total litres to pour</span>
        <p className="total__value">
          {litres.toFixed(1)}
          <small>L</small>
        </p>

        <button
          type="button"
          className="button button--onDark"
          disabled={pouring || selected.length === 0}
          onClick={() => void confirm()}
        >
          {pouring ? "Pouring..." : `Confirm pour of ${selected.length || "no"} consignment${selected.length === 1 ? "" : "s"}`}
          {pouring ? null : <ArrowRightIcon />}
        </button>
      </section>
    </section>
  );
}

function TankList({
  tanks,
  stale,
  failure,
  onChoose,
}: {
  tanks: Tank[];
  stale: boolean;
  failure: string | null;
  onChoose: (tank: Tank) => void;
}) {
  return (
    <section aria-label="Chilling tanks">
      <header className="panelhead">
        <h2 className="panelhead__title">Live Tank Status</h2>
        <p className="panelhead__subtitle">Monitoring all active cooling units.</p>
      </header>

      {stale ? (
        <p className="notice notice--info">
          <CloudOffIcon />
          Offline. Showing what the device last saw.
        </p>
      ) : null}

      {failure ? (
        <p className="notice notice--error" role="alert">
          <WarningIcon />
          {failure}
        </p>
      ) : null}

      {tanks.length === 0 ? (
        <p className="queue__empty">No tanks have been loaded on this device yet.</p>
      ) : (
        tanks.map((tank) => {
          const filled = tank.capacityLitres > 0 ? tank.totalQuantityLitres / tank.capacityLitres : 0;

          return (
            <button key={tank.code} type="button" className="tankcard" onClick={() => onChoose(tank)}>
              <span className="tankcard__head">
                <span>
                  <span className="microlabel">{tank.code}</span>
                  <strong className="tankcard__name">{tank.name}</strong>
                </span>
                <span className="tankcard__icon">
                  <DropletIcon />
                </span>
              </span>

              <span className="tankcard__figure">
                {tank.totalQuantityLitres.toFixed(1)}
                <small> / {tank.capacityLitres.toFixed(0)} L</small>
              </span>

              <span className="tankcard__bar">
                <span className="tankcard__fill" style={{ width: `${Math.min(100, filled * 100)}%` }} />
              </span>

              <span className="tankcard__foot">
                {Math.round(filled * 100)}% full &middot; {tank.consignmentCount} consignment
                {tank.consignmentCount === 1 ? "" : "s"}
              </span>
            </button>
          );
        })
      )}
    </section>
  );
}

function PouredConfirmation({
  count,
  queued,
  onPourAgain,
}: {
  count: number;
  queued: boolean;
  onPourAgain: () => void;
}) {
  return (
    <section className="saved" aria-live="polite">
      <span className={`saved__mark${queued ? " saved__mark--pending" : ""}`}>
        {queued ? <CloudOffIcon width={40} height={40} /> : <CheckIcon width={40} height={40} />}
      </span>

      <h2 className="saved__title">{queued ? "Saved on this device" : "Poured"}</h2>
      <p className="saved__detail">
        {queued
          ? `${count} pour${count === 1 ? "" : "s"} queued. They upload by themselves when the network returns.`
          : `${count} consignment${count === 1 ? "" : "s"} recorded against the tank.`}
      </p>

      <button type="button" className="button" style={{ marginTop: "var(--space-6)" }} onClick={onPourAgain}>
        Pour another
      </button>
    </section>
  );
}
