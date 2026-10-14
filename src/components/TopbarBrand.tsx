import { useNavigation } from "../app/navigationStore";
import { useSession } from "../auth/sessionStore";
import { roleFromToken } from "../auth/permissions";
import { LogoMark } from "./icons";

export function TopbarBrand({ service }: { service: string }) {
  const { session } = useSession();
  const { navigate } = useNavigation();
  const brand = (
    <>
      <LogoMark />
      <span>
        Wonrich
        <br />
        {service}
      </span>
    </>
  );

  if (roleFromToken(session?.accessToken) === "SystemAdministrator") {
    return (
      <button
        type="button"
        className="topbar__brand topbar__brand--button"
        onClick={() => navigate("/select-service")}
        aria-label={`Wonrich ${service}, choose service`}
      >
        {brand}
      </button>
    );
  }

  return <span className="topbar__brand">{brand}</span>;
}
