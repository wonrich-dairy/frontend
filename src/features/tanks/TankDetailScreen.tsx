import { useEffect, useState } from "react";
import { ApiError } from "../../api/http";
import { getTankManifest, type TankManifest } from "../../api/tanks";
import { useSession } from "../../auth/sessionStore";
import { useNavigation } from "../../app/navigationStore";
import { DropletIcon, ThermometerIcon } from "../../components/icons";
import { EmptyState, ErrorNotice, Loading } from "../../components/ui/Feedback";
import { percentFull } from "./fill";

/**
 * One tank: what it holds, the pour action, and the manifest behind the fill.
 *
 * The frame pairs this with a temperature log. No endpoint records or reads a tank temperature —
 * `GET /api/tanks` publishes capacity and fill and nothing thermal — so that card states what it
 * needs rather than collecting readings this client would then drop on the floor. The manifest
 * takes the place the "recent readings" table holds in the design: it is the record of what
 * actually went into the tank, and it is real.
 */
export function TankDetailScreen({ code }: { code: string }) {
  const { session } = useSession();
  const { navigate } = useNavigation();
  const token = session?.accessToken ?? null;

  const [manifest, setManifest] = useState<TankManifest | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    const abort = new AbortController();

    getTankManifest(code, token, abort.signal)
      .then(setManifest)
      .catch((error: unknown) => {
        if (abort.signal.aborted) {
          return;
        }

        setFailure(
          error instanceof ApiError ? error.message : "That tank's manifest could not be loaded.",
        );
      });

    return () => abort.abort();
  }, [code, token]);

  if (failure) {
    return <ErrorNotice>{failure}</ErrorNotice>;
  }

  if (!manifest) {
    return <Loading label="Loading the tank..." />;
  }

  const { tank, entries } = manifest;

  return (
    <>
      <header className="tankhead">
        <span>
          <p className="tankhead__code">{tank.code}</p>
          <p className="tankhead__name">{tank.name}</p>
        </span>
        <span className="tankhead__capacity">
          <span className="microlabel">Capacity</span>
          <strong>{tank.capacityLitres.toFixed(0)} L</strong>
        </span>
      </header>

      <section className="card" aria-label="Current fill">
        <div className="tankhead__meterrow">
          <span className="microlabel">Holding</span>
          <strong>
            {tank.totalQuantityLitres.toFixed(1)} L &middot; {percentFull(tank)}%
          </strong>
        </div>
        <span className="meter">
          <span className="meter__fill" style={{ width: `${percentFull(tank)}%` }} />
        </span>
        <p className="card__footnote">
          Fill {tank.fillNumber} &middot; {tank.availableQuantityLitres.toFixed(0)} L still free
        </p>
      </section>

      <button
        type="button"
        className="button button--onDark button--wide"
        onClick={() => navigate(`/tanks/${encodeURIComponent(tank.code)}/pour`)}
      >
        <DropletIcon />
        Pour Consignment Here
      </button>

      <section className="card card--muted" aria-label="Log temperature">
        <h3 className="card__title">
          <ThermometerIcon />
          Log Temperature
        </h3>
        <p className="card__footnote">
          The service does not yet record tank temperatures — no endpoint reads or writes one, and
          `GET /api/tanks` returns capacity and fill only. Readings taken here would be lost, so
          the control is held back until the service can keep them.
        </p>
      </section>

      <section className="card" aria-label="Tank manifest">
        <h3 className="card__title">
          Manifest
          <span className="card__count">{entries.length}</span>
        </h3>

        {entries.length === 0 ? (
          <EmptyState>Nothing has been poured into this tank yet.</EmptyState>
        ) : (
          <table className="readings">
            <thead>
              <tr>
                <th scope="col">Poured</th>
                <th scope="col">Society</th>
                <th scope="col">Litres</th>
                <th scope="col">Officer</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={`${entry.consignmentReference}-${entry.pouredAtUtc}`}>
                  <td>{formatTime(entry.pouredAtUtc)}</td>
                  <td>
                    <strong>{entry.societyCode}</strong>
                    <span className="readings__sub">{entry.consignmentReference}</span>
                  </td>
                  <td>{entry.quantityLitres.toFixed(1)}</td>
                  <td>{entry.pouredBy ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}

function formatTime(utc: string): string {
  const at = new Date(utc);

  if (Number.isNaN(at.getTime())) {
    return "-";
  }

  return at.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}
