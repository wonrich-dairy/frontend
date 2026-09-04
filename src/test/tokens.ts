import type { Role } from "../auth/permissions";

const ROLE_CLAIM = "http://schemas.microsoft.com/ws/2008/06/identity/claims/role";

export function accessTokenFor(role: Role, userName = "k.perera"): string {
  const claims = {
    [ROLE_CLAIM]: role,
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name": userName,
  };

  const body = btoa(JSON.stringify(claims)).split("+").join("-").split("/").join("_");

  return "header." + body + ".signature";
}

export function sessionFor(role: Role, userName = "k.perera") {
  return {
    accessToken: accessTokenFor(role, userName),
    expiresAtUtc: new Date(Date.now() + 3_600_000).toISOString(),
    userName,
  };
}
