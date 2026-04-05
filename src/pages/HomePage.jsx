import { Link } from "react-router-dom";
import { useAuth } from "../UserContext";

export function HomePage() {
  const { user } = useAuth();

  return (
    <div className="home">
      <section className="hero">
        <p className="eyebrow">Secure remote sessions</p>
        <h1>Control desktops from the browser</h1>
        <p className="lede">
          Sign in to start a WebRTC session with your native host. Encrypted
          video and a private control channel — designed for your capstone
          workflow.
        </p>
        <div className="hero-actions">
          {user ? (
            <Link to="/dashboard" className="btn btn-primary btn-lg">
              Open session
            </Link>
          ) : (
            <>
              <Link to="/register" className="btn btn-primary btn-lg">
                Get started
              </Link>
              <Link to="/login" className="btn btn-secondary btn-lg">
                Sign in
              </Link>
            </>
          )}
        </div>
      </section>

      <section className="feature-grid">
        <article className="feature-card">
          <h3>Authenticated access</h3>
          <p>
            Passwords are hashed on the server. Sessions use signed JWTs — no
            credentials in URLs.
          </p>
        </article>
        <article className="feature-card">
          <h3>WebRTC pipeline</h3>
          <p>
            Low-latency screen share with a dedicated data channel for mouse and
            keyboard.
          </p>
        </article>
        <article className="feature-card">
          <h3>Clean routing</h3>
          <p>
            Public marketing pages, protected dashboard, and consistent layout
            across the app.
          </p>
        </article>
      </section>
    </div>
  );
}
