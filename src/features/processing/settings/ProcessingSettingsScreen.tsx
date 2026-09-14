import { useSession } from "../../../auth/sessionStore";
import { roleFromToken } from "../../../auth/permissions";

export function ProcessingSettingsScreen() {
  const sessionValue = useSession() as any;
  const { session } = sessionValue;
  const doSignOut = sessionValue.signOut ?? sessionValue.clearSession ?? (() => {});
  const role = roleFromToken(session?.accessToken ?? null);

  return (
    <>
      <div className="pagehead">
        <h1 className="pagehead__title">Factory Settings</h1>
        <p className="pagehead__detail">Processing service - no MCC societies</p>
      </div>

      <section className="card">
        <h3 style={{ margin: 0, fontSize: 14 }}>Your Profile</h3>
        <dl style={{ marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
            <dt className="microlabel">Username</dt>
            <dd style={{ margin: 0, fontWeight: 600, fontSize: 13 }}>{session?.userName ?? session?.username}</dd>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
            <dt className="microlabel">Role</dt>
            <dd style={{ margin: 0, fontWeight: 600, fontSize: 13 }}>{role}</dd>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0" }}>
            <dt className="microlabel">Facility</dt>
            <dd style={{ margin: 0, fontWeight: 600, fontSize: 13 }}>{session?.facility ?? "Factory"}</dd>
          </div>
        </dl>
      </section>

      <button type="button" className="button button--ghost button--wide" style={{ marginTop: 16 }} onClick={() => doSignOut()}>
        Sign Out
      </button>
    </>
  );
}
