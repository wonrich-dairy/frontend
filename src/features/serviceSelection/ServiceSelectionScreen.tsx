import { useNavigation } from "../../app/navigationStore";
import { useSession } from "../../auth/sessionStore";

export function ServiceSelectionScreen() {
  const { navigate } = useNavigation();
  const { session } = useSession();
  const username = (session as any)?.userName ?? (session as any)?.username ?? "Admin";

  return (
    <div className="shell" style={{ justifyContent: "center", background: "var(--surface-sunken)" }}>
      <div className="shell__body" style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: 16 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ width: 56, height: 56, background: "var(--navy-900)", borderRadius: 16, display: "grid", placeItems: "center", margin: "0 auto 12px", color: "white", fontWeight: 800, fontSize: 20 }}>W</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--navy-900)", margin: 0 }}>Wonrich Dairy</h1>
          <p style={{ fontSize: 13, color: "var(--ink-muted)", marginTop: 6 }}>Welcome, {username} • System Administrator</p>
          <p style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 4 }}>Select a service to continue</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <button type="button" className="card" style={{ textAlign: "left", cursor: "pointer", border: "2px solid var(--navy-900)", padding: 16 }} onClick={() => navigate("/")}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <span style={{ width: 44, height: 44, background: "var(--navy-050)", borderRadius: 12, display: "grid", placeItems: "center", fontSize: 20, flexShrink: 0 }}>MCC</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", display: "block" }}>MCC Service</span>
                <span style={{ fontSize: 12, color: "var(--ink-muted)", display: "block", marginTop: 4, lineHeight: 1.4 }}>Milk Collection Center • Consignments, Quality Tests, Chilling Tanks, Dispatch Notes, Societies</span>
                <span style={{ fontSize: 11, color: "var(--navy-800)", display: "block", marginTop: 8, fontWeight: 600 }}>→ Go to MCC Dashboard</span>
              </div>
            </div>
          </button>

          <button type="button" className="card" style={{ textAlign: "left", cursor: "pointer", border: "2px solid var(--border)", padding: 16 }} onClick={() => navigate("/processing")}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <span style={{ width: 44, height: 44, background: "#fef3c7", borderRadius: 12, display: "grid", placeItems: "center", fontSize: 20, flexShrink: 0 }}>PFS</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", display: "block" }}>Factory Service</span>
                <span style={{ fontSize: 12, color: "var(--ink-muted)", display: "block", marginTop: 4, lineHeight: 1.4 }}>Processing Plant • Storing & Mixing Tanks in KG, Unloads, Lab Panels, Allocations, Heating/Cooling</span>
                <span style={{ fontSize: 11, color: "var(--navy-800)", display: "block", marginTop: 8, fontWeight: 600 }}>→ Go to Factory Floor</span>
              </div>
            </div>
          </button>
        </div>

        <p style={{ fontSize: 11, color: "var(--ink-faint)", textAlign: "center", marginTop: 16, lineHeight: 1.4 }}>
          ProcessingTechnician goes directly to Factory • MccManager/IntakeOfficer go directly to MCC • Only SystemAdministrator sees this chooser
        </p>
      </div>
    </div>
  );
}
