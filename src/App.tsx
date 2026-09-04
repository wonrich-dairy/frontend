import { AppShell, type Tab } from "./components/AppShell";
import { SignInScreen } from "./components/SignInScreen";
import { SessionProvider } from "./auth/SessionContext";
import { useSession } from "./auth/sessionStore";
import { can, roleFromToken, type Permission } from "./auth/permissions";
import { NavigationProvider } from "./app/navigation";
import { match, useNavigation } from "./app/navigationStore";
import { NotPermitted } from "./components/ui/Feedback";
import { DashboardScreen } from "./features/dashboard/DashboardScreen";
import { RegisterConsignmentScreen } from "./features/consignments/RegisterConsignmentScreen";
import { ConsignmentHistoryScreen } from "./features/consignments/ConsignmentHistoryScreen";
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

interface Screen {
  tab: Tab;
  title?: string;
  parent?: string;
  needs?: Permission;
  element: React.ReactNode;
}

function Screens() {
  const { session, signedIn } = useSession();
  const { path, query, navigate, back } = useNavigation();

  if (!signedIn) {
    return (
      <div className="shell">
        <SignInScreen />
      </div>
    );
  }

  const role = roleFromToken(session?.accessToken);
  const screen = resolve(path, query, navigate);
  const allowed = !screen.needs || can(role, screen.needs);

  return (
    <AppShell
      current={screen.tab}
      title={screen.title}
      onBack={screen.title ? () => back(screen.parent ?? "/") : undefined}
    >
      {allowed ? screen.element : <NotPermitted role={role} />}
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
      needs: "registerConsignments",
      element: (
        <RegisterConsignmentScreen
          onProceedToQualityTest={(reference) =>
            navigate(`/consignments/quality-test?reference=${encodeURIComponent(reference)}`)
          }
        />
      ),
    };
  }

  if (match("/consignments/history", path)) {
    return {
      tab: "consignments",
      title: "Deliveries",
      parent: "/consignments",
      element: <ConsignmentHistoryScreen />,
    };
  }

  if (match("/consignments/quality-test", path)) {
    return {
      tab: "consignments",
      needs: "recordQualityTests",
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
      needs: "pourToTanks",
      element: <PourScreen initialTankCode={pour.code} />,
    };
  }

  const tank = match("/tanks/:code", path);

  if (tank) {
    return {
      tab: "tanks",
      title: tank.code,
      parent: "/tanks",
      element: <TankDetailScreen code={tank.code} />,
    };
  }

  if (match("/dispatch", path)) {
    return {
      tab: "home",
      title: "Dispatch Note",
      parent: "/",
      needs: "recordDispatchNotes",
      element: <DispatchNoteScreen />,
    };
  }

  if (match("/trace", path)) {
    return {
      tab: "home",
      title: "Trace a Batch",
      parent: "/",
      needs: "traceBatches",
      element: <TraceBatchScreen />,
    };
  }

  if (match("/settings", path)) {
    return { tab: "settings", element: <SettingsScreen /> };
  }

  if (match("/settings/societies/new", path)) {
    return { tab: "settings", needs: "manageSocieties", element: <SocietyFormScreen /> };
  }

  const society = match("/settings/societies/:id", path);

  if (society) {
    return {
      tab: "settings",
      needs: "manageSocieties",
      element: <SocietyFormScreen id={society.id} />,
    };
  }

  if (match("/settings/tanks/new", path)) {
    return {
      tab: "settings",
      title: "Add New Tank",
      parent: "/settings",
      needs: "manageTanks",
      element: <TankFormScreen />,
    };
  }

  const editTank = match("/settings/tanks/:code", path);

  if (editTank) {
    return {
      tab: "settings",
      title: `Edit ${editTank.code}`,
      parent: "/settings",
      needs: "manageTanks",
      element: <TankFormScreen code={editTank.code} />,
    };
  }

  if (match("/profile", path)) {
    return { tab: "home", title: "User Profile", parent: "/", element: <UserProfileScreen /> };
  }

  return { tab: "home", element: <NotFound path={path} /> };
}

function NotFound({ path }: { path: string }) {
  const { navigate } = useNavigation();

  return (
    <section className="notfound">
      <h1 className="notfound__title">Nothing here</h1>
      <p className="notfound__detail">
        There is no screen at <strong>{path}</strong>.
      </p>
      <button type="button" className="button" onClick={() => navigate("/")}>
        Back to dashboard
      </button>
    </section>
  );
}

export default App;
