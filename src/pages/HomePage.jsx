import { Link } from "react-router-dom";
import { useAuth } from "../UserContext";

export function HomePage() {
  const { user } = useAuth();

  return (
    <div className="home">
      <section className="hero">
        <div className="hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">Secure remote access</p>
            <h1>Remote desktop sessions with clear approval, live viewing, and controlled access.</h1>
            <p className="lede">
              RemoteAccess Suite helps a viewer connect to a registered host,
              request the right access level, and start a live WebRTC session after
              host approval.
            </p>
            <div className="hero-actions">
              {user ? (
                <Link to="/dashboard" className="btn btn-primary btn-lg">
                  Open dashboard
                </Link>
              ) : (
                <>
                  <Link to="/register" className="btn btn-primary btn-lg">
                    Create account
                  </Link>
                  <Link to="/login" className="btn btn-secondary btn-lg">
                    Sign in
                  </Link>
                </>
              )}
            </div>
          </div>

          <div className="hero-showcase">
            <div className="hero-panel hero-panel-primary">
              <span className="hero-panel-label">Session flow</span>
              <strong>Viewer request, host approval, remote session</strong>
              <p>Every connection follows a clear sequence before screen access begins.</p>
            </div>
            <div className="hero-panel hero-panel-secondary">
              <span className="hero-panel-label">Platform design</span>
              <strong>Built for demonstrations, reviews, and real deployments</strong>
              <p>A sharper interface, cleaner hierarchy, and a more professional product presentation.</p>
            </div>
            <div className="hero-metrics">
              <article className="metric-card">
                <span>Approval model</span>
                <strong>Ask, auto, or deny</strong>
              </article>
              <article className="metric-card">
                <span>Access modes</span>
                <strong>View, app control, full control</strong>
              </article>
              <article className="metric-card">
                <span>Transport</span>
                <strong>WebRTC plus websocket signaling</strong>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section className="feature-grid">
        <article className="feature-card">
          <span className="feature-kicker">Security</span>
          <h3>Identity-first remote sessions</h3>
          <p>
            Passwords stay hashed, JWT sessions stay signed, and every connection request is anchored to a real user identity.
          </p>
        </article>
        <article className="feature-card">
          <span className="feature-kicker">Streaming</span>
          <h3>Fast viewing with operator precision</h3>
          <p>
            Low-latency desktop streaming meets a dedicated control channel for keyboard, mouse, and wheel events.
          </p>
        </article>
        <article className="feature-card">
          <span className="feature-kicker">Approval</span>
          <h3>Clear handoff from request to approval</h3>
          <p>
            Hosts stay in charge while viewers get a clean, modern path from discovery to approved access.
          </p>
        </article>
        <article className="feature-card feature-card-accent">
          <span className="feature-kicker">Product</span>
          <h3>Designed to feel ready for production</h3>
          <p>
            A stronger visual system helps the product feel credible during demos, reviews, and client-facing walkthroughs.
          </p>
        </article>
      </section>
    </div>
  );
}
