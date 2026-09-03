import { useEffect, useState } from "react";
import { ApiError } from "../../api/http";
import { listTanks, type Tank } from "../../api/tanks";
import { useSession } from "../../auth/sessionStore";
import { DropletIcon, SaveIcon, TankIcon, WarningIcon } from "../../components/icons";
import { ErrorNotice, Loading } from "../../components/ui/Feedback";

/**
 * Adding and editing a chilling tank.
 *
 * The service has no route for either: `TanksController` exposes the list, one tank's manifest,
 * the pourable consignments and the pour, and nothing that creates, renames, re-sizes, retires or
 * deletes a tank. `TankView` carries no status field, so "Under Maintenance" has nowhere to be
 * stored either.
 *
 * The frame is built here so the shape of the work is settled, but the form does not pretend to
 * save. Collecting a capacity this client cannot persist would lose an officer's edit silently,
 * which is worse than saying the route is missing.
 */
export function TankFormScreen({ code }: { code?: string }) {
  const { session } = useSession();
  const token = session?.accessToken ?? null;
  const editing = Boolean(code);

  const [tank, setTank] = useState<Tank | null>(null);
  const [loading, setLoading] = useState(editing);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    if (!code) {
      return;
    }

    const abort = new AbortController();

    listTanks(token, abort.signal)
      .then((tanks) => {
        setTank(tanks.find((one) => one.code === code) ?? null);
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (abort.signal.aborted) {
          return;
        }

        setLoading(false);
        setFailure(error instanceof ApiError ? error.message : "That tank could not be loaded.");
      });

    return () => abort.abort();
  }, [code, token]);

  if (loading) {
    return <Loading label="Loading the tank..." />;
  }

  return (
    <>
      {failure ? <ErrorNotice>{failure}</ErrorNotice> : null}

      <p className="notice notice--info">
        <WarningIcon />
        <span>
          The service has no route for creating or changing a tank, and no field for a tank's
          status. This form is laid out but cannot save; the endpoints have to land first.
        </span>
      </p>

      <section className="card">
        <label className="field">
          <span className="field__label">Tank Name/Number</span>
          <span className="field__wrap">
            <TankIcon className="field__icon" />
            <input
              defaultValue={tank?.name ?? ""}
              placeholder="e.g. Tank 05"
              disabled
              readOnly
            />
          </span>
        </label>

        <label className="field">
          <span className="field__label">Capacity (Liters)</span>
          <span className="field__wrap">
            <DropletIcon className="field__icon" />
            <input
              defaultValue={tank ? String(tank.capacityLitres) : ""}
              placeholder="e.g. 5000"
              inputMode="numeric"
              disabled
              readOnly
            />
          </span>
        </label>

        {editing ? (
          <label className="field">
            <span className="field__label">Status</span>
            <select disabled defaultValue="Active">
              <option>Active</option>
              <option>Under Maintenance</option>
            </select>
            <span className="field__hint">
              No status is stored against a tank today, so this reads Active for every tank.
            </span>
          </label>
        ) : null}

        <button type="button" className="button button--wide" disabled>
          <SaveIcon />
          Save Tank
        </button>
      </section>
    </>
  );
}
