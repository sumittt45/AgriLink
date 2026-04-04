import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Protects routes that only require a valid session — does NOT check role.
 * Use for: /cart, /checkout, /orders, /profile.
 * Use RoleGuard for role-specific routes (/farmers/dashboard).
 */
const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  const { isLoggedIn, isLoading, setRedirectPath } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Ref so we always have the latest location without it being an effect dep.
  const locationRef = useRef(location);
  locationRef.current = location;

  useEffect(() => {
    if (isLoading) return;
    if (!isLoggedIn) {
      console.log("[AuthGuard] no session → redirect to /login");
      setRedirectPath(locationRef.current.pathname + locationRef.current.search);
      navigate("/login", { replace: true });
    }
  }, [isLoggedIn, isLoading, navigate, setRedirectPath]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isLoggedIn) return null;

  return <>{children}</>;
};

export default AuthGuard;
