import axios from "axios";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAppDispatch } from "../app/hooks";
import { setSession } from "../app/authSlice";
import { login, signup } from "../services/authService";

export default function AuthPage(): JSX.Element {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    try {
      setLoading(true);
      setError(null);
      const result =
        mode === "login"
          ? await login({ email: email.trim(), password })
          : await signup({ name: name.trim(), email: email.trim(), password });

      dispatch(setSession({ token: result.token, user: result.user }));
      navigate("/");
    } catch (authError) {
      if (axios.isAxiosError(authError)) {
        setError(authError.response?.data?.message ?? authError.message);
      } else {
        setError(authError instanceof Error ? authError.message : "Authentication failed");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto max-w-lg rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-semibold text-slate-900">Sign In or Create Account</h1>
      <p className="mt-2 text-sm text-slate-600">
        Authentication is required to run analysis, access report history, and enforce user-level data boundaries.
      </p>

      <div className="mt-6 inline-flex rounded-xl bg-slate-100 p-1 text-sm">
        <button
          type="button"
          onClick={() => setMode("login")}
          className={`rounded-lg px-4 py-2 font-medium ${
            mode === "login" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
          }`}
        >
          Login
        </button>
        <button
          type="button"
          onClick={() => setMode("signup")}
          className={`rounded-lg px-4 py-2 font-medium ${
            mode === "signup" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
          }`}
        >
          Create Account
        </button>
      </div>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        {mode === "signup" ? (
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Your name"
            className="block w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm"
            required
          />
        ) : null}

        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email"
          className="block w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm"
          required
        />

        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
          className="block w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm"
          required
        />

        {error ? <p className="text-sm text-rose-700">{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (mode === "login" ? "Signing In..." : "Creating Account...") : mode === "login" ? "Sign In" : "Create Account"}
        </button>
      </form>
    </section>
  );
}
