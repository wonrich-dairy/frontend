import { useNavigation } from "../../app/navigationStore";
import { useSession } from "../../auth/sessionStore";

// Each service has its own colour, so the administrator can tell the cards apart at a glance.
const SERVICES = [
  {
    tone: "mcc",
    badge: "MCC",
    name: "MCC Service",
    detail: "Milk Collection Center • Consignments, Quality Tests, Chilling Tanks, Dispatch Notes, Societies",
    go: "Go to MCC Dashboard",
    path: "/",
  },
  {
    tone: "factory",
    badge: "PFS",
    name: "Factory Service",
    detail: "Processing Plant • Storing & Mixing Tanks in KG, Unloads, Lab Panels, Allocations, Heating/Cooling",
    go: "Go to Factory Floor",
    path: "/processing",
  },
  {
    tone: "lab",
    badge: "QLS",
    name: "Quality Lab Service",
    detail: "Quality Laboratory • Chemical Panels, Sensory Evaluations, Specification Thresholds, Determinations",
    go: "Go to Quality Lab",
    path: "/quality-lab/panels",
  },
  {
    tone: "qco",
    badge: "QCO",
    name: "Quality Control",
    detail: "Traceability • Batch Status, Fail-Rate Trends, Failure Reasons, Checkpoint Deviations, Recent Failures",
    go: "Go to QCO Dashboard",
    path: "/qco",
  },
] as const;

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

        <div className="cardgrid">
          {SERVICES.map((service) => (
            <button
              key={service.tone}
              type="button"
              className={`servicecard servicecard--${service.tone}`}
              onClick={() => navigate(service.path)}
            >
              <span className="servicecard__badge" aria-hidden="true">
                {service.badge}
              </span>
              <span className="servicecard__body">
                <span className="servicecard__name">{service.name}</span>
                <span className="servicecard__detail">{service.detail}</span>
                <span className="servicecard__go">→ {service.go}</span>
              </span>
            </button>
          ))}
        </div>

      </div>
    </div>
  );
}
