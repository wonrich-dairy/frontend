const authBaseUrl = (import.meta.env.VITE_AUTH_API_URL ?? "http://localhost:5238").replace(/\/$/, "");

const STORAGE_KEY = "wonrich.session";

export interface Session {
  accessToken: string;
  expiresAtUtc: string;
  userName: string;
  displayName: string;
  role: string;
  facility: string | null;
}

interface TokenResponse {
  accessToken: string;
  expiresAtUtc: string;
  refreshToken: string;
  refreshExpiresAtUtc: string;
  userName: string;
  displayName: string;
  role: string;
  facility: string | null;
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

  return {
    accessToken: tokens.accessToken,
    expiresAtUtc: tokens.expiresAtUtc,
    userName: tokens.userName ?? userName,
    displayName: tokens.displayName ?? tokens.userName ?? userName,
    role: tokens.role ?? "",
    facility: tokens.facility ?? null,
  };
}

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
  }
}

export function isExpired(session: Session): boolean {
  const expiry = Date.parse(session.expiresAtUtc);

  return Number.isFinite(expiry) && expiry <= Date.now();
}
