import { useCallback, useMemo, useState, type ReactNode } from "react";
import { loadSession, saveSession, type Session } from "./session";
import { SessionContext, type SessionValue } from "./sessionStore";

export function SessionProvider({
  children,
  initialSession,
}: {
  children: ReactNode;
  initialSession?: Session | null;
}) {
  const [session, setSessionState] = useState<Session | null>(
    () => initialSession ?? loadSession(),
  );

  const setSession = useCallback((next: Session | null) => {
    saveSession(next);
    setSessionState(next);
  }, []);

  const value = useMemo<SessionValue>(
    () => ({
      session,
      signedIn: session !== null,
      setSession,
      signOut: () => setSession(null),
    }),
    [session, setSession],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
