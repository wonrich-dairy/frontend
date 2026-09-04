import { useEffect, useState } from "react";
import { ApiError } from "../../api/http";
import { listSocieties } from "../../api/societies";
import { listTanks, type Tank } from "../../api/tanks";
import type { Society } from "../../api/types";
import { useSession } from "../../auth/sessionStore";
import { useNavigation } from "../../app/navigationStore";
import {
  PencilIcon,
  PersonIcon,
  PlusIcon,
} from "../../components/icons";
import { EmptyState, ErrorNotice, Loading } from "../../components/ui/Feedback";
import { percentFull } from "../tanks/fill";

export function SettingsScreen() {
  const { session } = useSession();
  const { navigate } = useNavigation();
  const token = session?.accessToken ?? null;

  const [societies, setSocieties] = useState<Society[] | null>(null);
  const [tanks, setTanks] = useState<Tank[] | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    const abort = new AbortController();

    Promise.all([listSocieties(token, abort.signal), listTanks(token, abort.signal)])
      .then(([loadedSocieties, loadedTanks]) => {
        setSocieties(loadedSocieties);
        setTanks(loadedTanks);
      })
      .catch((error: unknown) => {
        if (abort.signal.aborted) {
          return;
        }

        setSocieties([]);
        setTanks([]);
        setFailure(error instanceof ApiError ? error.message : "Settings could not be loaded.");
      });

    return () => abort.abort();
  }, [token]);

  return (
    <>
      <header className="pagehead">
        <h1 className="pagehead__title">Manage Societies</h1>
        <p className="pagehead__detail">Directory of active dairy societies.</p>
      </header>

      {failure ? <ErrorNotice>{failure}</ErrorNotice> : null}

      <button
        type="button"
        className="button button--onDark button--wide"
        onClick={() => navigate("/settings/societies/new")}
      >
        <PlusIcon />
        Add Society
      </button>

      {societies === null ? <Loading label="Loading societies..." /> : null}

      {societies?.length === 0 && !failure ? (
        <EmptyState>No societies are registered yet.</EmptyState>
      ) : null}

      {societies?.map((society) => (
        <article
          key={society.id}
          className={`societyrow${society.isActive ? "" : " societyrow--retired"}`}
        >
          <header className="societyrow__head">
            <h2 className="societyrow__name">{society.name}</h2>
            <span className="tag tag--lg">{society.canLabelPrefix}</span>
          </header>

          <div className="societyrow__body">
            <span>
              <span className="microlabel">Society Leader</span>
              <span className="societyrow__leader">
                <span className="avatar">
                  <PersonIcon width={14} height={14} />
                </span>
                {society.contactPerson ?? "Not recorded"}
              </span>
            </span>

            <button
              type="button"
              className="iconbutton iconbutton--outline"
              onClick={() => navigate(`/settings/societies/${society.id}`)}
              title={`Edit ${society.name}`}
            >
              <PencilIcon width={18} height={18} />
              <span className="sr-only">Edit {society.name}</span>
            </button>
          </div>

          {society.isActive ? null : <p className="societyrow__retired">Retired</p>}
        </article>
      ))}

      <header className="pagehead pagehead--spaced">
        <h1 className="pagehead__title">Manage Tanks</h1>
      </header>

      {tanks === null ? null : (
        <>
          {tanks.map((tank) => (
            <article key={tank.code} className="tankrow">
              <header className="tankrow__head">
                <h2 className="tankrow__name">{tank.name}</h2>
              </header>

              <p className="tankrow__status">
                <span className="dot dot--active" />
                {tank.code} &middot; fill {tank.fillNumber}
              </p>

              <dl className="tankrow__facts">
                <div>
                  <dt className="microlabel">Capacity</dt>
                  <dd>{tank.capacityLitres.toFixed(0)} L</dd>
                </div>
                <div>
                  <dt className="microlabel">Holding</dt>
                  <dd>
                    {tank.totalQuantityLitres.toFixed(0)} L ({percentFull(tank)}%)
                  </dd>
                </div>
              </dl>
            </article>
          ))}

          {tanks.length === 0 && !failure ? (
            <EmptyState>No chilling tanks are configured at this centre.</EmptyState>
          ) : null}
        </>
      )}


    </>
  );
}

