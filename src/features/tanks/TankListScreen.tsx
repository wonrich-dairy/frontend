import { useEffect, useState } from "react";
import { ApiError } from "../../api/http";
import { listTanks, type Tank } from "../../api/tanks";
import { useSession } from "../../auth/sessionStore";
import { useNavigation } from "../../app/navigationStore";
import { DropletIcon, ThermometerIcon } from "../../components/icons";
import { EmptyState, ErrorNotice, Loading } from "../../components/ui/Feedback";
import { percentFull } from "./fill";

export function TankListScreen() {
  const { session } = useSession();
  const { navigate } = useNavigation();
  const token = session?.accessToken ?? null;

  const [tanks, setTanks] = useState<Tank[] | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    const abort = new AbortController();

    listTanks(token, abort.signal)
      .then(setTanks)
      .catch((error: unknown) => {
        if (abort.signal.aborted) {
          return;
        }

        setTanks([]);
        setFailure(error instanceof ApiError ? error.message : "The tanks could not be loaded.");
      });

    return () => abort.abort();
  }, [token]);

  return (
    <>
      <header className="pagehead">
        <h1 className="pagehead__title">Live Tank Status</h1>
        <p className="pagehead__detail">Monitoring all active cooling units.</p>
      </header>

      {failure ? <ErrorNotice>{failure}</ErrorNotice> : null}

      {tanks === null ? <Loading label="Loading the tanks..." /> : null}

      {tanks?.length === 0 && !failure ? (
        <EmptyState>No chilling tanks are configured at this centre.</EmptyState>
      ) : null}

      {tanks?.map((tank) => (
        <TankCard key={tank.code} tank={tank} onOpen={() => navigate(`/tanks/${tank.code}`)} />
      ))}
    </>
  );
}

function TankCard({ tank, onOpen }: { tank: Tank; onOpen: () => void }) {
  const percent = percentFull(tank);
  const full = percent >= 95;

  return (
    <button type="button" className={`tankcard${full ? " tankcard--alert" : ""}`} onClick={onOpen}>
      <span className="tankcard__head">
        <span>
          <span className="tankcard__code">{tank.code}</span>
          <span className="tankcard__name">{tank.name}</span>
        </span>
        <span className="tankcard__mark">
          {full ? <ThermometerIcon width={18} height={18} /> : <DropletIcon width={18} height={18} />}
        </span>
      </span>

      <span className="tankcard__reading">
        {tank.totalQuantityLitres.toFixed(0)}
        <small>L</small>
      </span>

      <span className="tankcard__meter">
        <span className="tankcard__meterrow">
          <span className="microlabel">Capacity</span>
          <strong>{percent}%</strong>
        </span>
        <span className="meter">
          <span className="meter__fill" style={{ width: `${percent}%` }} />
        </span>
      </span>

      <span className="tankcard__foot">
        {tank.consignmentCount} {tank.consignmentCount === 1 ? "consignment" : "consignments"} in
        fill {tank.fillNumber} &middot; {tank.availableQuantityLitres.toFixed(0)} L to draw
      </span>
    </button>
  );
}
