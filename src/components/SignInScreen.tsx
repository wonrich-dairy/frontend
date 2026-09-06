import { useState } from "react";
import { signIn } from "../auth/session";
import { useSession } from "../auth/sessionStore";
import { BadgeIcon, LockIcon, LoginIcon, LogoMark, WarningIcon } from "./icons";

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
    <div className="signinpage">
      <span className="pill pill--standalone">
        <span className="pill__dot" />
        Secure Access
      </span>

      <form className="signin" onSubmit={submit} noValidate>
      <span className="signin__mark">
        <LogoMark width={44} height={44} />
      </span>

      <h1 className="signin__title">Wonrich Dairy</h1>
      <p className="signin__subtitle">Field Management System</p>

      <div className="field">
        <label className="field__label" htmlFor="signin-username">
          Employee ID
        </label>
        <span className="field__wrap">
          <BadgeIcon className="field__icon" />
          <input
            id="signin-username"
            value={userName}
            autoComplete="username"
            disabled={busy}
            placeholder="Enter ID..."
            onChange={(event) => setUserName(event.target.value)}
          />
        </span>
      </div>

      <div className="field">
        <label className="field__label" htmlFor="signin-password">
          PIN / Password
        </label>
        <span className="field__wrap">
          <LockIcon className="field__icon" />
          <input
            id="signin-password"
            type="password"
            value={password}
            autoComplete="current-password"
            disabled={busy}
            onChange={(event) => setPassword(event.target.value)}
          />
        </span>
      </div>

      {failure ? (
        <p className="notice notice--error" role="alert">
          <WarningIcon />
          {failure}
        </p>
      ) : null}

      <button type="submit" className="button button--wide" disabled={busy}>
        {busy ? "Signing in..." : <><LoginIcon /> Log In</>}
      </button>

      <p className="signin__foot">Secure Access Environment</p>
      </form>
    </div>
  );
}
