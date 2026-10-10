import { useNavigation } from "../../../app/navigationStore";
import { useSession } from "../../../auth/sessionStore";

/** Settings screen for the Quality Analyst role — quick links to lab features. */
export function QualityLabSettingsScreen() {
  const { navigate } = useNavigation();
  const { signOut } = useSession();

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "1.5rem" }}>
      <header className="pagehead">
        <h1 className="pagehead__title">Quality Lab Settings</h1>
        <p className="pagehead__detail">Manage your lab configuration and tools.</p>
      </header>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "1rem" }}>
        <button
          type="button"
          className="button button--onDark button--wide"
          onClick={() => navigate("/quality-lab/panels")}
        >
          Chemical Panels
        </button>
        <button
          type="button"
          className="button button--onDark button--wide"
          onClick={() => navigate("/quality-lab/specs")}
        >
          Specification Thresholds
        </button>
        <button
          type="button"
          className="button button--onDark button--wide"
          onClick={() => navigate("/quality-lab/history")}
        >
          Lab History
        </button>
        <button
          type="button"
          className="button button--onDark button--wide"
          onClick={() => navigate("/profile")}
        >
          User Profile
        </button>

        <hr style={{ border: "none", borderTop: "1px solid #e5e7eb", margin: "0.75rem 0" }} />

        <button
          type="button"
          className="button button--wide"
          style={{ background: "#ef4444", color: "#fff" }}
          onClick={signOut}
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
