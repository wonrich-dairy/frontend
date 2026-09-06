import { useEffect, useState } from "react";
import { ApiError } from "../../api/http";
import { listSocieties } from "../../api/societies";
import { listTanks, setTankInService, type Tank } from "../../api/tanks";
import type { Society } from "../../api/types";
import { useSession } from "../../auth/sessionStore";
import { useNavigation } from "../../app/navigationStore";
import { can, roleFromToken } from "../../auth/permissions";
import {
  MoreIcon,
  PencilIcon,
  PersonIcon,
  PlusIcon,
  PowerIcon,
} from "../../components/icons";
import { EmptyState, ErrorNotice, Loading } from "../../components/ui/Feedback";
import { ActionSheet, ConfirmDialog, SheetAction } from "../../components/ui/Modal";
import { percentFull } from "../tanks/fill";

export function SettingsScreen() {
  const { session } = useSession();
  const { navigate } = useNavigation();
  const token = session?.accessToken ?? null;
  const role = roleFromToken(token);
  const mayManageTanks = can(role, "manageTanks");
  const [tankMenu, setTankMenu] = useState<Tank | null>(null);
  const [retiring, setRetiring] = useState<Tank | null>(null);

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

      {mayManageTanks ? (
        <button
          type="button"
          className="button button--onDark button--wide"
          onClick={() => navigate("/settings/tanks/new")}
        >
          <PlusIcon />
          Add Tank
        </button>
      ) : null}

      {tanks === null ? null : (
        <>
          {tanks.map((tank) => (
            <article key={tank.code} className="tankrow">
              <header className="tankrow__head">
                <h2 className="tankrow__name">{tank.name}</h2>
                {mayManageTanks ? (
                  <button
                    type="button"
                    className="iconbutton"
                    onClick={() => setTankMenu(tank)}
                    title={`Options for ${tank.name}`}
                  >
                    <MoreIcon width={18} height={18} />
                    <span className="sr-only">Options for {tank.name}</span>
                  </button>
                ) : null}
              </header>

              <p className="tankrow__status">
                <span
                  className={tank.status === "Active" ? "dot dot--active" : "dot dot--warn"}
                />
                {tank.status === "Active" ? "Active" : "Under Maintenance"}
                <span className="tankrow__code">
                  {tank.code} &middot; fill {tank.fillNumber}
                </span>
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


      {tankMenu ? (
        <ActionSheet
          eyebrow={tankMenu.code.toUpperCase()}
          title="Tank Options"
          onClose={() => setTankMenu(null)}
        >
          <SheetAction
            icon={<PencilIcon width={18} height={18} />}
            label="Edit Tank"
            onClick={() => {
              const code = tankMenu.code;
              setTankMenu(null);
              navigate(`/settings/tanks/${encodeURIComponent(code)}`);
            }}
          />
          <SheetAction
            icon={<PowerIcon width={18} height={18} />}
            label={tankMenu.status === "Active" ? "Take Out of Service" : "Put Back in Service"}
            danger={tankMenu.status === "Active"}
            onClick={() => {
              setRetiring(tankMenu);
              setTankMenu(null);
            }}
          />
        </ActionSheet>
      ) : null}

      {retiring ? (
        <ConfirmDialog
          title={
            retiring.status === "Active" ? "Take this tank out of service?" : "Put it back in service?"
          }
          subject={retiring.name}
          detail={
            retiring.status === "Active"
              ? "Nothing can be poured into it until it is back in service. A tank still holding milk cannot be taken out."
              : "It will start accepting pours again."
          }
          confirmLabel={retiring.status === "Active" ? "Take out of service" : "Put back in service"}
          onCancel={() => setRetiring(null)}
          onConfirm={async () => {
            const target = retiring;
            setRetiring(null);

            try {
              await setTankInService(target.code, target.status !== "Active", token);
              setTanks(await listTanks(token));
            } catch (error: unknown) {
              setFailure(
                error instanceof ApiError ? error.message : "That tank could not be changed.",
              );
            }
          }}
        />
      ) : null}
    </>
  );
}

