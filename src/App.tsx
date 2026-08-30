import { useState } from "react";
import { AppShell } from "./components/AppShell";
import { SignInScreen } from "./components/SignInScreen";
import { SessionProvider } from "./auth/SessionContext";
import { useSession } from "./auth/sessionStore";
import { RegisterConsignmentScreen } from "./features/consignments/RegisterConsignmentScreen";
import { QualityTestPanelScreen } from "./features/qualityTests/QualityTestPanelScreen";
import "./styles/app.css";

export function App() {
  return (
    <SessionProvider>
      <Screens />
    </SessionProvider>
  );
}

/**
 * The two screens built so far. Registering a delivery leads into its quality test, which is the
 * order the gate works in and the handoff the design draws.
 */
type View = { screen: "register" } | { screen: "quality"; reference?: string };

function Screens() {
  const { session, signedIn, signOut } = useSession();
  const [view, setView] = useState<View>({ screen: "register" });

  if (!signedIn) {
    return (
      <div className="shell">
        <SignInScreen />
      </div>
    );
  }

  return (
    <AppShell userName={session?.userName} onSignOut={signOut}>
      {view.screen === "register" ? (
        <RegisterConsignmentScreen
          onProceedToQualityTest={(reference) => setView({ screen: "quality", reference })}
        />
      ) : (
        <QualityTestPanelScreen initialReference={view.reference} />
      )}
    </AppShell>
  );
}

export default App;
