import { useEffect, useState } from "react";
import { ApiError } from "../../api/http";
import {
  listProcessingTanks,
  setProcessingTankInService,
  TANK_KINDS,
  type ProcessingTank,
  type TankKind,
} from "../../api/processing";
import { useSession } from "../../auth/sessionStore";
import { useNavigation } from "../../app/navigationStore";
import { can, roleFromToken } from "../../auth/permissions";
import { MoreIcon, PencilIcon, PlusIcon, PowerIcon } from "../../components/icons";
import { ActionSheet, ConfirmDialog, SheetAction } from "../../components/ui/Modal";
import { EmptyState, ErrorNotice, Loading } from "../../components/ui/Feedback";

const KIND_LABELS: Record<TankKind, string> = {
  Storing: "Storing",
  Mixing: "Mixing",
};

export function ProcessingTanksScreen() {
  const { session } = useSession();
  const { navigate } = useNavigation();
  const token = session?.accessToken ?? null;
  const mayManage = can(roleFromToken(token), "manageProcessingTanks");

  const [kind, setKind] = useState<TankKind | null>(null);
  const [tanks, setTanks] = useState<ProcessingTank[] | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [menu, setMenu] = useState<ProcessingTank | null>(null);
  const [changing, setChanging] = useState<ProcessingTank | null>(null);
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    const abort = new AbortController();

    listProcessingTanks(token, abort.signal, kind ?? undefined)
      .then((loaded) => {
        setTanks(loaded);
        setFailure(null);
      })
      .catch((error: unknown) => {
        if (abort.signal.aborted) {
          return;
        }

        setTanks([]);
        setFailure(error instanceof ApiError ? error.message : "The tanks could not be loaded.");
      });

    return () => abort.abort();
  }, [token, kind, reloads]);

  return (
    <>
      <p className="pagehead__detail pagehead__detail--lead">
        Storing tanks take what a bowser brings. Mixing tanks take allocations from them.
      </p>

      <div className="filterbar" role="group" aria-label="Filter by kind">
        <button
          type="button"
          className={`chip${kind === null ? " chip--on" : ""}`}
          aria-pressed={kind === null}
          onClick={() => setKind(null)}
        >
          All
        </button>

        {TANK_KINDS.map((candidate) => (
          <button
            key={candidate}
            type="button"
            className={`chip${kind === candidate ? " chip--on" : ""}`}
            aria-pressed={kind === candidate}
            onClick={() => setKind(candidate)}
          >
            {KIND_LABELS[candidate]}
          </button>
        ))}
      </div>

      {mayManage ? (
        <button
          type="button"
          className="button button--onDark button--wide"
          onClick={() => navigate("/processing/tanks/new")}
        >
          <PlusIcon />
          Add Tank
        </button>
      ) : null}

      {failure ? <ErrorNotice>{failure}</ErrorNotice> : null}

      {tanks === null ? <Loading label="Loading the tanks..." /> : null}

      {tanks?.length === 0 && !failure ? (
        <EmptyState>
          {kind === null
            ? "No tank is configured at this factory yet."
            : `No ${KIND_LABELS[kind].toLowerCase()} tank is configured yet.`}
        </EmptyState>
      ) : null}

      {tanks?.map((tank) => (
        <article key={tank.code} className="tankrow">
          <header className="tankrow__head">
            <h2 className="tankrow__name">{tank.name}</h2>
            {mayManage ? (
              <button
                type="button"
                className="iconbutton"
                onClick={() => setMenu(tank)}
                title={`Options for ${tank.name}`}
              >
                <MoreIcon width={18} height={18} />
                <span className="sr-only">Options for {tank.name}</span>
              </button>
            ) : null}
          </header>

          <p className="tankrow__status">
            <span className={tank.status === "Active" ? "dot dot--active" : "dot dot--warn"} />
            {tank.status === "Active" ? "Active" : "Under Maintenance"}
            <span className="tankrow__code">
              {tank.code} &middot; {KIND_LABELS[tank.kind]}
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
                {tank.heldLitres.toFixed(0)} L &middot; {tank.availableLitres.toFixed(0)} L free
              </dd>
            </div>
          </dl>
        </article>
      ))}

      {menu ? (
        <ActionSheet
          eyebrow={menu.code.toUpperCase()}
          title="Tank Options"
          onClose={() => setMenu(null)}
        >
          <SheetAction
            icon={<PencilIcon width={18} height={18} />}
            label="Edit Tank"
            onClick={() => {
              const code = menu.code;
              setMenu(null);
              navigate(`/processing/tanks/${encodeURIComponent(code)}`);
            }}
          />
          <SheetAction
            icon={<PowerIcon width={18} height={18} />}
            label={menu.status === "Active" ? "Take Out of Service" : "Put Back in Service"}
            danger={menu.status === "Active"}
            onClick={() => {
              setChanging(menu);
              setMenu(null);
            }}
          />
        </ActionSheet>
      ) : null}

      {changing ? (
        <ConfirmDialog
          title={
            changing.status === "Active"
              ? "Take this tank out of service?"
              : "Put it back in service?"
          }
          subject={changing.name}
          detail={
            changing.status === "Active"
              ? "Nothing can go into it until it is back in service. A tank still holding milk cannot be taken out."
              : "It will start accepting milk again."
          }
          confirmLabel={
            changing.status === "Active" ? "Take out of service" : "Put back in service"
          }
          onCancel={() => setChanging(null)}
          onConfirm={async () => {
            const target = changing;
            setChanging(null);

            try {
              await setProcessingTankInService(target.code, target.status !== "Active", token);
              setReloads((count) => count + 1);
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
