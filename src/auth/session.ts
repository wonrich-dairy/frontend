/**
 * Sign-in against the shared auth service (SCRUM-34). Every intake route is guarded, so the
 * screen needs a token before it can do anything; the token is validated by the intake service
 * itself, which never calls back here.
 */
const authBaseUrl = (import.meta.env.VITE_AUTH_API_URL ?? "http://localhost:5238").replace(/\/$/, "");

const STORAGE_KEY = "wonrich.session";

export interface Session {
  accessToken: string;
  expiresAtUtc: string;
  userName: string;
}

interface TokenResponse {
  accessToken: string;
  expiresAtUtc: string;
  refreshToken: string;
  refreshExpiresAtUtc: string;
}

export async function signIn(userName: string, password: string): Promise<Session> {
  const response = await fetch(`${authBaseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ userName, password }),
  }).catch(() => null);

  if (!response) {
    throw new Error("Cannot reach the authentication service. Check the connection and try again.");
  }

  if (response.status === 401) {
    throw new Error("That username and password were not accepted.");
  }

  if (!response.ok) {
    throw new Error("Sign-in failed. Try again.");
  }

  const tokens = (await response.json()) as TokenResponse;

  return { accessToken: tokens.accessToken, expiresAtUtc: tokens.expiresAtUtc, userName };
}

/**
 * Held in sessionStorage rather than localStorage: the gate device is shared, so closing the tab
 * should end the shift's session rather than leave it signed in for whoever picks it up next.
 */
export function loadSession(): Session | null {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);

    if (!stored) {
      return null;
    }

    const session = JSON.parse(stored) as Session;

    return isExpired(session) ? null : session;
  } catch {
    return null;
  }
}

export function saveSession(session: Session | null): void {
  try {
    if (session) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // A device with storage blocked still works; the session just does not survive a reload.
  }
}

export function isExpired(session: Session): boolean {
  const expiry = Date.parse(session.expiresAtUtc);

  return Number.isFinite(expiry) && expiry <= Date.now();
}
