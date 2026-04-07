import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../UserContext";

export function AppShell({ children }) {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <div className="site-chrome" aria-hidden />

      <header className="site-header">
        <div className="site-header-inner">
          <Link to="/" className="brand">
            <span className="brand-mark" aria-hidden>
              <span className="brand-mark-core" />
            </span>
            <span className="brand-copy">
              <span className="brand-text">Velora Remote</span>
              <span className="brand-subtext">Secure cinematic desktop access</span>
            </span>
          </Link>

          <nav className="site-nav" aria-label="Main">
            <NavLink
              to="/"
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
            >
              Overview
            </NavLink>

            {user ? (
              <>
                <NavLink
                  to="/dashboard"
                  className={({ isActive }) =>
                    isActive ? "nav-link active" : "nav-link"
                  }
                >
                  Mission control
                </NavLink>
                <span className="nav-user">{user.name}</span>
                <button type="button" className="btn btn-ghost" onClick={logout}>
                  Sign out
                </button>
              </>
            ) : (
              <>
                <NavLink
                  to="/login"
                  className={({ isActive }) =>
                    isActive ? "nav-link active" : "nav-link"
                  }
                >
                  Sign in
                </NavLink>
                <Link to="/register" className="btn btn-primary btn-sm">
                  Launch workspace
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="site-main">{children}</main>

      <footer className="site-footer">
        <div className="site-footer-inner">
          <span>Built for trusted sessions, approval-based access, and live operator control.</span>
          <span>Capstone remote desktop platform.</span>
        </div>
      </footer>
    </div>
  );
}
