import { createContext, useContext } from "react";
import type { Session } from "./session";

export interface SessionValue {
  session: Session | null;
  signedIn: boolean;
  setSession: (session: Session | null) => void;
  signOut: () => void;
}

export const SessionContext = createContext<SessionValue | null>(null);

export function useSession(): SessionValue {
  const value = useContext(SessionContext);

  if (!value) {
    throw new Error("useSession must be used inside a SessionProvider.");
  }

  return value;
}
