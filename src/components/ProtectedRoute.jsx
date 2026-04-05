import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../UserContext";

export function ProtectedRoute({ children }) {
  const { user, bootstrapping } = useAuth();
  const location = useLocation();

  if (bootstrapping) {
    return (
      <div className="boot-screen">
        <div className="boot-spinner" aria-hidden />
        <p>Loading…</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
