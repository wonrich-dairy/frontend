import { AppShell, type Tab } from "./components/AppShell";
import { SignInScreen } from "./components/SignInScreen";
import { SessionProvider } from "./auth/SessionContext";
import { useSession } from "./auth/sessionStore";
import { NavigationProvider } from "./app/navigation";
import { match, useNavigation } from "./app/navigationStore";
import { DashboardScreen } from "./features/dashboard/DashboardScreen";
import { RegisterConsignmentScreen } from "./features/consignments/RegisterConsignmentScreen";
import { QualityTestPanelScreen } from "./features/qualityTests/QualityTestPanelScreen";
import { PendingQueueScreen } from "./features/sync/PendingQueueScreen";
import { TankListScreen } from "./features/tanks/TankListScreen";
import { TankDetailScreen } from "./features/tanks/TankDetailScreen";
import { PourScreen } from "./features/tanks/PourScreen";
import { DispatchNoteScreen } from "./features/dispatch/DispatchNoteScreen";
import { TraceBatchScreen } from "./features/trace/TraceBatchScreen";
import { SettingsScreen } from "./features/settings/SettingsScreen";
import { SocietyFormScreen } from "./features/settings/SocietyFormScreen";
import { TankFormScreen } from "./features/settings/TankFormScreen";
import { UserProfileScreen } from "./features/profile/UserProfileScreen";
import { SyncProvider } from "./features/sync/SyncProvider";
import "./styles/app.css";
import "./styles/screens.css";

export function App() {
  return (
    <NavigationProvider>
      <SessionProvider>
        <SyncProvider>
          <Screens />
        </SyncProvider>
      </SessionProvider>
    </NavigationProvider>
  );
}

/** What the shell shows for one path: which tab is lit, and the compact bar's title if any. */
interface Screen {
  tab: Tab;
  title?: string;
  /** Where back goes when the officer deep-linked straight onto the screen. */
  parent?: string;
  element: React.ReactNode;
}

function Screens() {
  const { signedIn } = useSession();
  const { path, query, navigate, back } = useNavigation();

  if (!signedIn) {
    return (
      <div className="shell">
        <SignInScreen />
      </div>
    );
  }

  const screen = resolve(path, query, navigate);

  return (
    <AppShell
      current={screen.tab}
      title={screen.title}
      onBack={screen.title ? () => back(screen.parent ?? "/") : undefined}
    >
      {screen.element}
    </AppShell>
  );
}

function resolve(path: string, query: URLSearchParams, navigate: (to: string) => void): Screen {
  if (match("/", path)) {
    return { tab: "home", element: <DashboardScreen /> };
  }

  if (match("/consignments", path)) {
    return {
      tab: "consignments",
      element: (
        <RegisterConsignmentScreen
          onProceedToQualityTest={(reference) =>
            navigate(`/consignments/quality-test?reference=${encodeURIComponent(reference)}`)
          }
        />
      ),
    };
  }

  if (match("/consignments/quality-test", path)) {
    return {
      tab: "consignments",
      element: <QualityTestPanelScreen initialReference={query.get("reference") ?? undefined} />,
    };
  }

  if (match("/queue", path)) {
    return { tab: "home", title: "Pending Uploads", parent: "/", element: <PendingQueueScreen /> };
  }

  if (match("/tanks", path)) {
    return { tab: "tanks", element: <TankListScreen /> };
  }

  const pour = match("/tanks/:code/pour", path);

  if (pour) {
    return {
      tab: "tanks",
      title: "Pour Consignment",
      parent: `/tanks/${encodeURIComponent(pour.code)}`,
      element: <PourScreen initialTankCode={pour.code} />,
    };
  }

  const tank = match("/tanks/:code", path);

  if (tank) {
    return { tab: "tanks", title: tank.code, parent: "/tanks", element: <TankDetailScreen code={tank.code} /> };
  }

  if (match("/dispatch", path)) {
    return { tab: "home", title: "Dispatch Note", parent: "/", element: <DispatchNoteScreen /> };
  }

  if (match("/trace", path)) {
    return { tab: "home", title: "Trace a Batch", parent: "/", element: <TraceBatchScreen /> };
  }

  if (match("/settings", path)) {
    return { tab: "settings", element: <SettingsScreen /> };
  }

  if (match("/settings/societies/new", path)) {
    return { tab: "settings", element: <SocietyFormScreen /> };
  }

  const society = match("/settings/societies/:id", path);

  if (society) {
    return { tab: "settings", element: <SocietyFormScreen id={society.id} /> };
  }

  if (match("/settings/tanks/new", path)) {
    return {
      tab: "settings",
      title: "Add New Tank",
      parent: "/settings",
      element: <TankFormScreen />,
    };
  }

  const editTank = match("/settings/tanks/:code", path);

  if (editTank) {
    return {
      tab: "settings",
      title: `Edit ${editTank.code}`,
      parent: "/settings",
      element: <TankFormScreen code={editTank.code} />,
    };
  }

  if (match("/profile", path)) {
    return { tab: "home", title: "User Profile", parent: "/", element: <UserProfileScreen /> };
  }

  return {
    tab: "home",
    element: (
      <p className="emptystate">
        There is nothing at <code>{path}</code>. Use the tabs below to get back.
      </p>
    ),
  };
}

export default App;
