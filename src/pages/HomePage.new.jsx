import { Link } from "react-router-dom";
import { useAuth } from "../UserContext";

export function HomePage() {
  const { user } = useAuth();

  return (
    <div className="home">
      <section className="hero">
        <div className="hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">Trusted remote operations</p>
            <h1>Command a desktop from anywhere with the confidence of a private control room.</h1>
            <p className="lede">
              Velora Remote blends approval-based access, low-latency WebRTC streaming,
              and a polished viewer workflow into a capstone experience that feels ready
              for production.
            </p>
            <div className="hero-actions">
              {user ? (
                <Link to="/dashboard" className="btn btn-primary btn-lg">
                  Enter mission control
                </Link>
              ) : (
                <>
                  <Link to="/register" className="btn btn-primary btn-lg">
                    Create your workspace
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
              <span className="hero-panel-label">Live stack</span>
              <strong>Encrypted stream plus control channel</strong>
              <p>Viewer requests, host approval, and guided takeover in one seamless flow.</p>
            </div>
            <div className="hero-panel hero-panel-secondary">
              <span className="hero-panel-label">Production posture</span>
              <strong>Designed to look enterprise-grade, not student-grade</strong>
              <p>Clean dashboard surfaces, confident hierarchy, and a visual language built to impress.</p>
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
          <span className="feature-kicker">Access</span>
          <h3>Identity-first remote sessions</h3>
          <p>
            Passwords stay hashed, JWT sessions stay signed, and every connection request is anchored to a real user identity.
          </p>
        </article>
        <article className="feature-card">
          <span className="feature-kicker">Latency</span>
          <h3>Fast viewing with operator precision</h3>
          <p>
            Low-latency desktop streaming meets a dedicated control channel for keyboard, mouse, and wheel events.
          </p>
        </article>
        <article className="feature-card">
          <span className="feature-kicker">Workflow</span>
          <h3>Clear handoff from request to approval</h3>
          <p>
            Hosts stay in charge while viewers get a clean, modern path from discovery to approved access.
          </p>
        </article>
        <article className="feature-card feature-card-accent">
          <span className="feature-kicker">Presentation</span>
          <h3>Built to stand out in a capstone review</h3>
          <p>
            Strong visual identity, polished spacing, and premium dashboard framing turn the demo into a statement.
          </p>
        </article>
      </section>
    </div>
  );
}
