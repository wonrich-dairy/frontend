import { AppShell } from "./components/AppShell";
import { SignInScreen } from "./components/SignInScreen";
import { SessionProvider } from "./auth/SessionContext";
import { useSession } from "./auth/sessionStore";
import { RegisterConsignmentScreen } from "./features/consignments/RegisterConsignmentScreen";
import "./styles/app.css";

export function App() {
  return (
    <SessionProvider>
      <Screens />
    </SessionProvider>
  );
}

function Screens() {
  const { session, signedIn, signOut } = useSession();

  if (!signedIn) {
    return (
      <div className="shell">
        <SignInScreen />
      </div>
    );
  }

  return (
    <AppShell userName={session?.userName} onSignOut={signOut}>
      <RegisterConsignmentScreen />
    </AppShell>
  );
}

export default App;
