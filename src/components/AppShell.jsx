import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../UserContext";

export function AppShell({ children }) {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <header className="site-header">
        <Link to="/" className="brand">
          <span className="brand-mark" aria-hidden />
          <span className="brand-text">RemoteAccess</span>
        </Link>

        <nav className="site-nav" aria-label="Main">
          {user ? (
            <>
              <NavLink
                to="/dashboard"
                className={({ isActive }) =>
                  isActive ? "nav-link active" : "nav-link"
                }
              >
                Session
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
                Create account
              </Link>
            </>
          )}
        </nav>
      </header>

      <main className="site-main">{children}</main>

      <footer className="site-footer">
        <span>Capstone remote desktop — use only on trusted networks.</span>
      </footer>
    </div>
  );
}
