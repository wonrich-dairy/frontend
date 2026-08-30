import { useState } from "react";
import { AppShell, type Tab } from "./components/AppShell";
import { SignInScreen } from "./components/SignInScreen";
import { SessionProvider } from "./auth/SessionContext";
import { useSession } from "./auth/sessionStore";
import { RegisterConsignmentScreen } from "./features/consignments/RegisterConsignmentScreen";
import { QualityTestPanelScreen } from "./features/qualityTests/QualityTestPanelScreen";
import { PendingQueueScreen } from "./features/sync/PendingQueueScreen";
import { PourScreen } from "./features/tanks/PourScreen";
import { SyncProvider } from "./features/sync/SyncProvider";
import "./styles/app.css";

export function App() {
  return (
    <SessionProvider>
      <SyncProvider>
        <Screens />
      </SyncProvider>
    </SessionProvider>
  );
}

function Screens() {
  const { session, signedIn, signOut } = useSession();
  const [tab, setTab] = useState<Tab>("register");
  const [testing, setTesting] = useState<string | undefined>(undefined);

  if (!signedIn) {
    return (
      <div className="shell">
        <SignInScreen />
      </div>
    );
  }

  return (
    <AppShell
      userName={session?.userName}
      current={tab}
      onNavigate={(next) => {
        setTesting(undefined);
        setTab(next);
      }}
      onSignOut={signOut}
    >
      {tab === "register" ? (
        <RegisterConsignmentScreen
          onProceedToQualityTest={(reference) => {
            setTesting(reference);
            setTab("quality");
          }}
        />
      ) : null}

      {tab === "quality" ? <QualityTestPanelScreen initialReference={testing} /> : null}

      {tab === "tanks" ? <PourScreen /> : null}

      {tab === "queue" ? <PendingQueueScreen /> : null}
    </AppShell>
  );
}

export default App;
