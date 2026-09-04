import { useEffect, useMemo, useState } from "react";
import { searchConsignments } from "../../api/consignments";
import type { Consignment } from "../../api/types";
import { useSession } from "../../auth/sessionStore";
import { useNavigation } from "../../app/navigationStore";
import { BadgeIcon, ClipboardIcon, ClockIcon, LogOutIcon, PersonIcon } from "../../components/icons";
import { useSync } from "../sync/syncStore";

export function UserProfileScreen() {
  const { session, signOut } = useSession();
  const { navigate } = useNavigation();
  const { pendingCount } = useSync();
  const token = session?.accessToken ?? null;

  const [consignments, setConsignments] = useState<Consignment[]>([]);

  useEffect(() => {
    const abort = new AbortController();

    searchConsignments(token, abort.signal)
      .then((page) => setConsignments(page.items))
      .catch(() => {
        if (!abort.signal.aborted) {
          setConsignments([]);
        }
      });

    return () => abort.abort();
  }, [token]);

  const mine = useMemo(() => {
    const today = localDate();

    return consignments.filter(
      (one) => one.arrivalDate === today && one.registeredBy === session?.userName,
    ).length;
  }, [consignments, session?.userName]);

  return (
    <>
      <section className="profilecard">
        <span className="profilecard__avatar">
          <PersonIcon width={30} height={30} />
        </span>
        <span>
          <h1 className="profilecard__name">{session?.displayName ?? "Officer"}</h1>
          <p className="profilecard__id">
            <BadgeIcon width={14} height={14} />
            {session?.userName}
            {session?.facility ? ` · ${session.facility}` : ""}
          </p>
        </span>
      </section>

      <h2 className="microlabel microlabel--section">Shift Summary</h2>

      <Fact icon={<ClockIcon width={16} height={16} />} label="Current Shift" value={shiftFor(new Date())} />
      <Fact
        icon={<ClipboardIcon width={16} height={16} />}
        label="Intake Count"
        value={`${mine} ${mine === 1 ? "consignment" : "consignments"}`}
      />
      {pendingCount > 0 ? (
        <Fact
          icon={<ClipboardIcon width={16} height={16} />}
          label="Waiting to upload"
          value={`${pendingCount} on this device`}
        />
      ) : null}

      <button
        type="button"
        className="button button--dangerOutline button--wide"
        onClick={() => {
          signOut();
          navigate("/");
        }}
      >
        <LogOutIcon />
        Log Out
      </button>

      {pendingCount > 0 ? (
        <p className="card__footnote">
          Signing out leaves {pendingCount} unsent {pendingCount === 1 ? "record" : "records"} on
          this device. They upload when someone signs in again with a connection.
        </p>
      ) : null}
    </>
  );
}

function Fact({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <section className="factcard">
      <p className="factcard__label">
        {icon}
        {label}
      </p>
      <p className="factcard__value">{value}</p>
    </section>
  );
}

function localDate(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");

  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function shiftFor(now: Date): string {
  const hour = now.getHours();

  if (hour < 12) {
    return "Morning";
  }

  return hour < 17 ? "Afternoon" : "Evening";
}
