import { useState } from "react";
import { signIn } from "../auth/session";
import { useSession } from "../auth/sessionStore";
import { WarningIcon } from "./icons";

/**
 * Every intake route is guarded (SCRUM-34), so the officer signs in before the gate screen can
 * read societies or record anything. Kept deliberately small: the token comes from the shared
 * auth service and is the only thing this screen is here to obtain.
 */
export function SignInScreen() {
  const { setSession } = useSession();
  const [userName, setUserName] = useState("");
  const [password, setPassword] = useState("");
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFailure(null);

    if (userName.trim() === "" || password === "") {
      setFailure("Enter your username and password.");
      return;
    }

    setBusy(true);

    try {
      setSession(await signIn(userName.trim(), password));
    } catch (error: unknown) {
      setFailure(error instanceof Error ? error.message : "Sign-in failed. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="signin" onSubmit={submit} noValidate>
      <h1 className="signin__title">Wonrich Dairy</h1>
      <p className="signin__subtitle">Milk collection centre intake</p>

      <div className="field">
        <label className="microlabel" htmlFor="signin-username">
          Username
        </label>
        <input
          id="signin-username"
          value={userName}
          autoComplete="username"
          disabled={busy}
          onChange={(event) => setUserName(event.target.value)}
        />
      </div>

      <div className="field">
        <label className="microlabel" htmlFor="signin-password">
          Password
        </label>
        <input
          id="signin-password"
          type="password"
          value={password}
          autoComplete="current-password"
          disabled={busy}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>

      {failure ? (
        <p className="notice notice--error" role="alert">
          <WarningIcon />
          {failure}
        </p>
      ) : null}

      <button type="submit" className="button" disabled={busy}>
        {busy ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
