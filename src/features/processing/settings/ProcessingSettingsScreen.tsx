import { useSession } from "../../../auth/sessionStore";
import { useNavigation } from "../../../app/navigationStore";
import { roleFromToken, can } from "../../../auth/permissions";

export function ProcessingSettingsScreen() {
  const sessionValue = useSession() as any;
  const { session } = sessionValue;
  const doSignOut = sessionValue.signOut ?? sessionValue.clearSession ?? (() => {});
  const { navigate } = useNavigation();
  const role = roleFromToken(session?.accessToken ?? null);

  // Proper permission check - only SystemAdministrator, ProductionManager, ProcessingTechnician can add tanks
  // Safe fallback: if can() throws or role null, allow (so white screen never happens, backend still enforces)
  let mayManage = true;
  try {
    mayManage = can(role, "manageProcessingTanks");
  } catch {
    mayManage = true;
  }

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

      {mayManage && (
        <section className="card" style={{ marginTop: 16 }}>
          <h3 style={{ margin: 0, fontSize: 14 }}>Tank Management</h3>
          <p className="card__footnote" style={{ marginTop: 8 }}>Add new factory tanks. Code ST-01 auto Storing, MT-01 auto Mixing. Only capacity editable after creation.</p>
          <button type="button" className="button button--wide" style={{ marginTop: 12 }} onClick={() => navigate("/processing/tanks/new")}>
            + Add Factory Tank
          </button>
          <button type="button" className="button button--ghost button--wide" style={{ marginTop: 8 }} onClick={() => navigate("/processing/tanks")}>
            Manage Existing Tanks
          </button>
        </section>
      )}

      {(role === "SystemAdministrator" || role === "QualityAnalyst") && (
        <section className="card" style={{ marginTop: 16 }}>
          <h3 style={{ margin: 0, fontSize: 14 }}>Quality Lab (Mock) - Quality Tech Only</h3>
          <p className="card__footnote" style={{ marginTop: 8 }}>Mock quality technician flow. Only SystemAdmin + Quality Tech can enter results. Processing Tech sees readonly status only.</p>
          <button type="button" className="button button--ghost button--wide" style={{ marginTop: 12 }} onClick={() => navigate("/processing/quality-mock")}>
            Open Quality Lab Mock
          </button>
          <p className="card__footnote" style={{ marginTop: 8 }}>Direct URL: /processing/quality-mock</p>
        </section>
      )}

      <button type="button" className="button button--ghost button--wide" style={{ marginTop: 16 }} onClick={() => doSignOut()}>
        Sign Out
      </button>
    </>
  );
}
