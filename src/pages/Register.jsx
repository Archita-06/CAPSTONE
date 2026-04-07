import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../UserContext";

export function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { user, register } = useAuth();
  const navigate = useNavigate();

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      await register(name.trim(), email.trim(), password);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        err.message ||
        "Registration failed.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-layout">
        <section className="auth-spotlight">
          <p className="eyebrow">Create account</p>
          <h1>Set up your remote access workspace.</h1>
          <p className="auth-lede">
            Register once, connect your host machine, and manage access requests
            through a clean remote desktop dashboard.
          </p>
          <div className="auth-points">
            <div>
              <strong>Host-controlled approval</strong>
              <span>Viewer access still depends on explicit approval and configurable control levels.</span>
            </div>
            <div>
              <strong>Clean operator workflow</strong>
              <span>The interface is structured to make lookup, approval, and session control easy to follow.</span>
            </div>
          </div>
        </section>

        <div className="auth-card">
          <h1>Create account</h1>
          <p className="auth-sub">
            Already registered?{" "}
            <Link to="/login" className="inline-link">
              Sign in
            </Link>
          </p>

          <form onSubmit={handleSubmit} className="auth-form">
            {error ? (
              <div className="form-error" role="alert">
                {error}
              </div>
            ) : null}

            <label className="field">
              <span>Name</span>
              <input
                type="text"
                name="name"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
                className="input"
                placeholder="Your name"
              />
            </label>

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
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="input"
                placeholder="At least 8 characters"
              />
            </label>

            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={loading}
            >
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
