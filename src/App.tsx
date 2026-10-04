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
import { ProcessingTanksScreen } from "./features/processing/tanks/ProcessingTanksScreen";
import { ProcessingTankFormScreen } from "./features/processing/tanks/ProcessingTankFormScreen";
import { ProcessingTankDetailScreen } from "./features/processing/tanks/ProcessingTankDetailScreen";
import { ProcessingDashboardScreen } from "./features/processing/dashboard/ProcessingDashboardScreen";
import { ProcessingUnloadScreen } from "./features/processing/unloads/ProcessingUnloadScreen";
import { ProcessingSettingsScreen } from "./features/processing/settings/ProcessingSettingsScreen";
import { QualityMockScreen } from "./features/processing/quality/QualityMockScreen";
import { ServiceSelectionScreen } from "./features/serviceSelection/ServiceSelectionScreen";
import { ProcessingAppShell, type ProcessingTab } from "./components/processing/ProcessingAppShell";
import { QcoAppShell, type QcoTab } from "./components/qco/QcoAppShell";
import { QualityLabAppShell, type QualityLabTab } from "./components/qualityLab/QualityLabAppShell";
import { QcoDashboardScreen } from "./features/qco/dashboard/QcoDashboardScreen";
import { UserProfileScreen } from "./features/profile/UserProfileScreen";
import { QualityLabPanelScreen } from "./features/qualityLab/panels/QualityLabPanelScreen";
import { SpecThresholdScreen } from "./features/qualityLab/specs/SpecThresholdScreen";
import { QualityLabSettingsScreen } from "./features/qualityLab/settings/QualityLabSettingsScreen";
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
  processingTab?: ProcessingTab;
  qcoTab?: QcoTab;
  qualityLabTab?: QualityLabTab;
  title?: string;
  parent?: string;
  needs?: Permission;
  // List and dashboard screens use the whole shell on wide screens; forms keep a readable width.
  wide?: boolean;
  element: React.ReactNode;
  isProcessing?: boolean;
  isQco?: boolean;
  isQualityLab?: boolean;
  isServiceSelection?: boolean;
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
  const isProcessingRole = role === "ProcessingTechnician";
  const isProcessingPath = path.startsWith("/processing");
  const isServiceSelectionPath = path === "/select-service";

  if (isServiceSelectionPath) {
    return <ServiceSelectionScreen />;
  }

  if (isProcessingRole && path === "/") {
    window.history.replaceState(window.history.state, "", "/processing");
    return (
      <ProcessingAppShell current="factory" title={undefined} onBack={undefined} wide>
        <ProcessingDashboardScreen />
      </ProcessingAppShell>
    );
  }

  // Quality Control Officer → QCO dashboard (SCRUM-136)
  const isQcoRole = role === "QualityControlOfficer";
  const isQcoPath = path === "/qco" || path.startsWith("/qco/");

  if (isQcoRole && path === "/") {
    window.history.replaceState(window.history.state, "", "/qco");
    return (
      <QcoAppShell current="overview" title={undefined} onBack={undefined}>
        <QcoDashboardScreen section="overview" />
      </QcoAppShell>
    );
  }

  // Quality Analyst → Quality Lab panels (SCRUM-20)
  const isQualityAnalystRole = role === "QualityAnalyst";
  const isQualityLabPath = path === "/quality-lab" || path.startsWith("/quality-lab/");

  if (isQualityAnalystRole && path === "/") {
    window.history.replaceState(window.history.state, "", "/quality-lab/panels");
    return (
      <QualityLabAppShell current="panels" role={role} wide>
        <QualityLabPanelScreen />
      </QualityLabAppShell>
    );
  }

  const screen = resolve(path, query, navigate);
  const allowed = !screen.needs || can(role, screen.needs);

  if (screen.isServiceSelection) {
    return screen.element as React.ReactNode;
  }

  // Before the processing branch, which a Processing Technician always takes: on /qco they
  // must be refused inside the QCO shell, not the factory one.
  if (screen.isQco || isQcoPath) {
    return (
      <QcoAppShell
        current={screen.qcoTab}
        title={screen.title}
        onBack={screen.title ? () => back(screen.parent ?? "/qco") : undefined}
      >
        {allowed ? screen.element : <NotPermitted role={role} />}
      </QcoAppShell>
    );
  }

  // Also before the processing branch, for the same reason: every role meets the lab
  // screens in the lab shell, with the lab's own navigation.
  if (screen.isQualityLab || isQualityLabPath) {
    return (
      <QualityLabAppShell
        current={screen.qualityLabTab ?? "panels"}
        role={role}
        title={screen.title}
        onBack={screen.title ? () => back(screen.parent ?? "/quality-lab/panels") : undefined}
        wide={screen.wide}
      >
        {allowed ? screen.element : <NotPermitted role={role} />}
      </QualityLabAppShell>
    );
  }

  if (isProcessingRole || screen.isProcessing || isProcessingPath) {
    return (
      <ProcessingAppShell
        current={screen.processingTab ?? (path === "/processing" ? "factory" : path.startsWith("/processing/tanks") ? "processingTanks" : path.startsWith("/processing/unloads") ? "unloads" : "processingSettings")}
        title={screen.title}
        onBack={screen.title ? () => back(screen.parent ?? "/processing") : undefined}
        wide={screen.wide}
      >
        {allowed ? screen.element : <NotPermitted role={role} />}
      </ProcessingAppShell>
    );
  }

  return (
    <AppShell
      current={screen.tab}
      title={screen.title}
      onBack={screen.title ? () => back(screen.parent ?? "/") : undefined}
      wide={screen.wide}
    >
      {allowed ? screen.element : <NotPermitted role={role} />}
    </AppShell>
  );
}

function resolve(path: string, query: URLSearchParams, navigate: (to: string) => void): Screen {
  if (match("/select-service", path)) {
    return { tab: "home", isServiceSelection: true, element: <ServiceSelectionScreen /> };
  }

  if (match("/", path)) {
    return { tab: "home", wide: true, element: <DashboardScreen /> };
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
      wide: true,
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
    return { tab: "home", title: "Pending Uploads", parent: "/queue", element: <PendingQueueScreen /> };
  }

  if (match("/tanks", path)) {
    return { tab: "tanks", wide: true, element: <TankListScreen /> };
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
    return { tab: "settings", wide: true, element: <SettingsScreen /> };
  }

  if (match("/quality-lab/settings", path)) {
    return {
      tab: "settings",
      qualityLabTab: "labSettings",
      isQualityLab: true,
      needs: "recordLabPanels",
      element: <QualityLabSettingsScreen />,
    };
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

  if (match("/processing", path)) {
    return { tab: "home", processingTab: "factory", isProcessing: true, wide: true, needs: "readProcessing", element: <ProcessingDashboardScreen /> };
  }

  if (match("/processing/tanks", path)) {
    return {
      tab: "tanks",
      processingTab: "processingTanks",
      isProcessing: true,
      title: "Factory Tanks",
      parent: "/processing",
      wide: true,
      needs: "readProcessing",
      element: <ProcessingTanksScreen />,
    };
  }

  if (match("/processing/tanks/new", path)) {
    return {
      tab: "tanks",
      processingTab: "processingTanks",
      isProcessing: true,
      title: "Add Factory Tank",
      parent: "/processing/tanks",
      needs: "manageProcessingTanks",
      element: <ProcessingTankFormScreen />,
    };
  }

  const processingTankEdit = match("/processing/tanks/:code/edit", path);

  if (processingTankEdit) {
    return {
      tab: "tanks",
      processingTab: "processingTanks",
      isProcessing: true,
      title: `Edit ${processingTankEdit.code}`,
      parent: `/processing/tanks/${encodeURIComponent(processingTankEdit.code)}`,
      needs: "manageProcessingTanks",
      element: <ProcessingTankFormScreen code={processingTankEdit.code} />,
    };
  }

  const processingTank = match("/processing/tanks/:code", path);

  if (processingTank) {
    return {
      tab: "tanks",
      processingTab: "processingTanks",
      isProcessing: true,
      title: `${processingTank.code}`,
      parent: "/processing/tanks",
      needs: "readProcessing",
      element: <ProcessingTankDetailScreen code={processingTank.code} />,
    };
  }

  if (match("/processing/unloads", path)) {
    return {
      tab: "tanks",
      processingTab: "unloads",
      isProcessing: true,
      title: "Unloading Bay",
      parent: "/processing",
      needs: "readProcessing",
      element: <ProcessingUnloadScreen />,
    };
  }

  if (match("/processing/quality-mock", path)) {
    return {
      tab: "settings",
      processingTab: "processingSettings",
      isProcessing: true,
      title: "Quality Lab (Mock)",
      parent: "/processing/settings",
      needs: "readProcessing",
      element: <QualityMockScreen />,
    };
  }

  if (match("/processing/settings", path)) {
    return {
      tab: "settings",
      processingTab: "processingSettings",
      isProcessing: true,
      title: "Factory Settings",
      parent: "/processing",
      needs: "readProcessing",
      element: <ProcessingSettingsScreen />,
    };
  }

  if (match("/quality-lab/panels", path)) {
    return {
      tab: "home",
      qualityLabTab: "panels",
      isQualityLab: true,
      wide: true,
      needs: "recordLabPanels",
      element: <QualityLabPanelScreen />,
    };
  }

  if (match("/quality-lab/specs", path)) {
    return {
      tab: "home",
      qualityLabTab: "specs",
      isQualityLab: true,
      wide: true,
      needs: "viewLabSpecs",
      element: <SpecThresholdScreen />,
    };
  }

  if (match("/qco", path)) {
    return { tab: "home", qcoTab: "overview", isQco: true, needs: "viewQcoDashboard", element: <QcoDashboardScreen section="overview" /> };
  }

  // The dashboard's other tabs. Each one is refused to other roles, not merely hidden.
  for (const section of ["trends", "causes", "societies"] as const) {
    if (match(`/qco/${section}`, path)) {
      return {
        tab: "home",
        qcoTab: section,
        isQco: true,
        needs: "viewQcoDashboard",
        element: <QcoDashboardScreen section={section} />,
      };
    }
  }

  // Each module opens the profile under its own prefix, so it renders in that module's shell
  // rather than the MCC one. Same screen; the MCC-only intake count is left out.
  if (match("/qco/profile", path)) {
    return {
      tab: "home",
      isQco: true,
      title: "User Profile",
      parent: "/qco",
      needs: "viewQcoDashboard",
      element: <UserProfileScreen showIntake={false} />,
    };
  }

  if (match("/quality-lab/profile", path)) {
    return {
      tab: "home",
      qualityLabTab: "labSettings",
      isQualityLab: true,
      title: "User Profile",
      parent: "/quality-lab/settings",
      // The one lab permission every lab-shell role holds, the Production Manager included.
      needs: "viewLabSpecs",
      element: <UserProfileScreen showIntake={false} />,
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
