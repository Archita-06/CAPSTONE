import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../UserContext";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/dashboard";

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        err.message ||
        "Sign in failed. Check your details.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-layout">
        <section className="auth-spotlight">
          <p className="eyebrow">Welcome back</p>
          <h1>Reconnect to your secure remote workspace.</h1>
          <p className="auth-lede">
            Step into a cleaner command center for viewer sessions, access requests,
            and approved desktop control.
          </p>
          <div className="auth-points">
            <div>
              <strong>Zero guesswork</strong>
              <span>See host status, approval posture, and session logs in one place.</span>
            </div>
            <div>
              <strong>Low-friction flow</strong>
              <span>From sign-in to approved session, every action stays guided and obvious.</span>
            </div>
          </div>
        </section>

        <div className="auth-card">
          <h1>Sign in</h1>
          <p className="auth-sub">
            No account?{" "}
            <Link to="/register" className="inline-link">
              Create one
            </Link>
          </p>

          <form onSubmit={handleSubmit} className="auth-form">
            {error ? (
              <div className="form-error" role="alert">
                {error}
              </div>
            ) : null}

            <label className="field">
              <span>Email</span>
              <input
                type="email"
                name="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="input"
                placeholder="you@example.com"
              />
            </label>

            <label className="field">
              <span>Password</span>
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="input"
                placeholder="Enter your password"
              />
            </label>

            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
