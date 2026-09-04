import { useEffect, useState } from "react";
import { ApiError } from "../../api/http";
import {
  getTankManifest,
  listTankTemperatures,
  logTankTemperature,
  type TankManifest,
  type TankTemperature,
} from "../../api/tanks";
import { useSession } from "../../auth/sessionStore";
import { useNavigation } from "../../app/navigationStore";
import { DropletIcon, MinusIcon, PlusIcon, SaveIcon, ThermometerIcon } from "../../components/icons";
import { EmptyState, ErrorNotice, Loading } from "../../components/ui/Feedback";
import { percentFull } from "./fill";

export function TankDetailScreen({ code }: { code: string }) {
  const { session } = useSession();
  const { navigate } = useNavigation();
  const token = session?.accessToken ?? null;

  const [manifest, setManifest] = useState<TankManifest | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [readings, setReadings] = useState<TankTemperature[]>([]);
  const [celsius, setCelsius] = useState("");
  const [logging, setLogging] = useState(false);
  const [logFailure, setLogFailure] = useState<string | null>(null);

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

  useEffect(() => {
    const abort = new AbortController();

    listTankTemperatures(code, token, abort.signal)
      .then(setReadings)
      .catch(() => undefined);

    return () => abort.abort();
  }, [code, token]);

  const step = (by: number) => {
    const current = Number(celsius);

    setCelsius(((Number.isFinite(current) ? current : 0) + by).toFixed(1));
  };

  const logReading = async () => {
    const value = Number(celsius);

    if (celsius.trim() === "" || !Number.isFinite(value) || logging) {
      return;
    }

    setLogging(true);
    setLogFailure(null);

    try {
      const reading = await logTankTemperature(code, value, token);

      setReadings((current) => [reading, ...current]);
      setCelsius("");
    } catch (error: unknown) {
      setLogFailure(
        error instanceof ApiError ? error.message : "That reading could not be recorded.",
      );
    } finally {
      setLogging(false);
    }
  };

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
          Fill {tank.fillNumber} &middot; {tank.availableQuantityLitres.toFixed(0)} L to draw
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


      <section className="card" aria-label="Log temperature">
        <h3 className="card__title">
          <ThermometerIcon />
          Log Temperature
        </h3>

        {logFailure ? <ErrorNotice>{logFailure}</ErrorNotice> : null}

        <label className="field">
          <span className="field__label">Current reading (°C)</span>
          <span className="stepper">
            <button
              type="button"
              className="stepper__button"
              disabled={logging}
              onClick={() => step(-0.1)}
            >
              <MinusIcon />
              <span className="sr-only">Decrease the reading</span>
            </button>
            <input
              className="stepper__value"
              value={celsius}
              inputMode="decimal"
              disabled={logging}
              placeholder="0.0"
              aria-label="Current reading"
              onChange={(event) => setCelsius(event.target.value)}
            />
            <button
              type="button"
              className="stepper__button"
              disabled={logging}
              onClick={() => step(0.1)}
            >
              <PlusIcon />
              <span className="sr-only">Increase the reading</span>
            </button>
          </span>
        </label>

        <button
          type="button"
          className="button button--wide"
          disabled={celsius.trim() === "" || logging}
          onClick={logReading}
        >
          <SaveIcon />
          {logging ? "Saving..." : "Save Reading"}
        </button>

        {readings.length === 0 ? (
          <EmptyState>No reading has been taken against this tank yet.</EmptyState>
        ) : (
          <table className="readings">
            <thead>
              <tr>
                <th scope="col">Time</th>
                <th scope="col">Temp</th>
                <th scope="col">User</th>
              </tr>
            </thead>
            <tbody>
              {readings.map((reading) => (
                <tr key={reading.recordedAtUtc}>
                  <td>{formatTime(reading.recordedAtUtc)}</td>
                  <td>{reading.celsius.toFixed(1)} °C</td>
                  <td>{reading.recordedBy ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
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
