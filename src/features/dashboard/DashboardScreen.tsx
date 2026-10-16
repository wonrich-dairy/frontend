import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { searchConsignments } from "../../api/consignments";
import { ApiError } from "../../api/http";
import type { Consignment } from "../../api/types";
import { useSession } from "../../auth/sessionStore";
import { can, roleFromToken } from "../../auth/permissions";
import { useNavigation } from "../../app/navigationStore";
import {
  ClipboardIcon,
  CalendarIcon,
  ClockIcon,
  DropletIcon,
  GridPlusIcon,
  TraceIcon,
  TruckIcon,
  UsersIcon,
} from "../../components/icons";
import { ErrorNotice, Loading } from "../../components/ui/Feedback";

export function DashboardScreen() {
  const { session } = useSession();
  const { navigate } = useNavigation();
  const token = session?.accessToken ?? null;
  const role = roleFromToken(token);

  const [consignments, setConsignments] = useState<Consignment[] | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const todayId = useId();
  const actionsId = useId();

  useEffect(() => {
    const abort = new AbortController();

    searchConsignments(token, abort.signal)
      .then((page) => setConsignments(page.items))
      .catch((error: unknown) => {
        if (abort.signal.aborted) {
          return;
        }

        setConsignments([]);
        setFailure(
          error instanceof ApiError ? error.message : "Today's figures could not be loaded.",
        );
      });

    return () => abort.abort();
  }, [token]);

  const today = useMemo(() => localDate(), []);

  const stats = useMemo(() => {
    const forToday = (consignments ?? []).filter((one) => one.arrivalDate === today);

    return {
      litres: forToday.reduce((total, one) => total + one.totalQuantityLitres, 0),
      count: forToday.length,
      accepted: forToday.filter((one) => one.status === "Accepted").length,
      rejected: forToday.filter((one) => one.status === "Rejected").length,
    };
  }, [consignments, today]);

  return (
    <>
      <header className="qcohead">
        <h1 className="panelhead__title">Milk Collection Centre Dashboard</h1>
        <p className="qcohead__fresh shiftbar__meta">
          <span>{session?.displayName ?? "Officer"}</span>
          <span>
            <CalendarIcon width={14} height={14} />
            {formatDate(today)}
          </span>
          <span>
            <ClockIcon width={14} height={14} />
            {shiftFor(new Date())}
          </span>
        </p>
      </header>

      <div className="qcogrid">
        <section className="qcopanel qcopanel--full" aria-labelledby={todayId}>
          <h2 id={todayId} className="qcopanel__title">
            Today at this centre
          </h2>
          {failure ? <ErrorNotice>{failure}</ErrorNotice> : null}
          {consignments === null ? (
            <Loading label="Loading today's figures..." />
          ) : failure ? null : (
            <dl className="statusgrid">
              <Stat label="Total intake" value={formatKilolitres(stats.litres)} tone="neutral" />
              <Stat label="Consignments" value={String(stats.count)} tone="neutral" />
              <Stat label="Accepted" value={String(stats.accepted)} tone="cleared" />
              <Stat label="Rejected" value={String(stats.rejected)} tone="failed" />
            </dl>
          )}
        </section>

        <section className="qcopanel qcopanel--full" aria-labelledby={actionsId}>
          <h2 id={actionsId} className="qcopanel__title">
            Quick actions
          </h2>

          <div className="actions">
            {can(role, "registerConsignments") ? (
              <Action
                icon={<GridPlusIcon width={20} height={20} />}
                title="Register Consignment"
                detail="Log new milk deliveries from farmers or societies."
                tone="solid"
                onClick={() => navigate("/consignments")}
              />
            ) : null}
            <Action
              icon={<ClipboardIcon width={20} height={20} />}
              title="Deliveries"
              detail="Review consignments and filter them by status."
              onClick={() => navigate("/consignments/history")}
            />
            <Action
              icon={<DropletIcon width={20} height={20} />}
              title="Chilling Tanks"
              detail="Monitor capacity and current temperatures."
              onClick={() => navigate("/tanks")}
            />
            {can(role, "recordDispatchNotes") ? (
              <Action
                icon={<TruckIcon width={20} height={20} />}
                title="Dispatch Note"
                detail="Create waybills for outgoing processed batches."
                onClick={() => navigate("/dispatch")}
              />
            ) : null}
            {/* {can(role, "readProcessing") ? (
              <Action
                icon={<TankIcon width={20} height={20} />}
                title="Factory Tanks"
                detail="Configure storing and mixing tanks at the factory."
                onClick={() => navigate("/processing/tanks")}
              />
            ) : null}
            {can(role, "readProcessing") ? (
              <Action
                icon={<TruckIcon width={20} height={20} />}
                title="Unloading Bay"
                detail="Record a bowser load into a storing tank."
                onClick={() => navigate("/processing/unloads")}
              />
            ) : null} */}
            {can(role, "traceBatches") ? (
              <Action
                icon={<TraceIcon width={20} height={20} />}
                title="Trace a Batch"
                detail="Look up history by scanning lot numbers."
                onClick={() => navigate("/trace")}
              />
            ) : null}
            <Action
              icon={<UsersIcon width={20} height={20} />}
              title="Manage Societies"
              detail="View supplier profiles and recent performance."
              onClick={() => navigate("/settings")}
            />
          </div>
        </section>
      </div>
    </>
  );
}

// The QCO dashboard's status tile, so a count reads the same in every module's home.
function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "neutral" | "cleared" | "failed";
}) {
  return (
    <div className={`statustile statustile--${tone}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Action({
  icon,
  title,
  detail,
  tone,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  detail: string;
  tone?: "solid";
  onClick: () => void;
}) {
  return (
    <button type="button" className="action" onClick={onClick}>
      <span className={`action__icon${tone === "solid" ? " action__icon--solid" : ""}`}>{icon}</span>
      <span className="action__body">
        <span className="action__title">{title}</span>
        <span className="action__detail">{detail}</span>
      </span>
    </button>
  );
}

function localDate(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");

  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const months = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");

  return `${months[(month ?? 1) - 1]} ${day}, ${year}`;
}

function formatKilolitres(litres: number): string {
  return `${(litres / 1000).toFixed(1)} kL`;
}

function shiftFor(now: Date): string {
  const hour = now.getHours();

  if (hour < 12) {
    return "Morning Shift";
  }

  return hour < 17 ? "Afternoon Shift" : "Evening Shift";
}