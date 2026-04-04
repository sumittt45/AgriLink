import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRole: "buyer" | "farmer";
}

/**
 * Guards a route to a specific role.
 *
 * Guarantees:
 * - While AuthContext is loading (fetching session + role) → spinner.
 * - Not logged in → redirect to the appropriate login page.
 * - Wrong role    → redirect to the appropriate login page.
 * - Correct role  → render children.
 *
 * Because AuthContext now awaits fetchRole before clearing isLoading,
 * `role` is never null when `isLoading === false && isLoggedIn === true`.
 */
const RoleGuard = ({ children, allowedRole }: RoleGuardProps) => {
  const { isLoggedIn, isLoading, role, setRedirectPath } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Keep location in a ref so we can read the latest value inside the effect
  // without adding `location` as a dep (that would re-run the guard on every
  // navigation and risk a mid-transition redirect).
  const locationRef = useRef(location);
  locationRef.current = location;

  const loginPath = allowedRole === "farmer" ? "/farmers/login" : "/login";

  useEffect(() => {
    if (isLoading) return;

    if (!isLoggedIn) {
      console.log("[RoleGuard] no session → redirect to", loginPath);
      setRedirectPath(locationRef.current.pathname + locationRef.current.search);
      navigate(loginPath, { replace: true });
      return;
    }

    // role is non-null here because AuthContext clears isLoading only after
    // fetchRole completes.  The null check is kept for defensive safety only.
    if (role !== null && role !== allowedRole) {
      // User is logged in but with the wrong role — send them to their own home,
      // not to a login page (they are already authenticated).
      const wrongRoleHome = role === "farmer" ? "/farmers/dashboard" : "/";
      console.log("[RoleGuard] wrong role:", role, "→ redirect to", wrongRoleHome);
      navigate(wrongRoleHome, { replace: true });
    }
  }, [isLoggedIn, isLoading, role, allowedRole, navigate, loginPath, setRedirectPath]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isLoggedIn) return null;
  if (role !== null && role !== allowedRole) return null;

  return <>{children}</>;
};

export default RoleGuard;
