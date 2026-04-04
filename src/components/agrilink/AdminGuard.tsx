import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Shield } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ADMIN_EMAIL } from "@/lib/constants";

export { ADMIN_EMAIL };

const AdminGuard = ({ children }: { children: React.ReactNode }) => {
  const { user, role, isLoggedIn, isLoading } = useAuth();
  const navigate = useNavigate();

  // Accept either the email match OR the resolved role (handles session restore)
  const isAdmin = isLoggedIn && (user?.email === ADMIN_EMAIL || role === "admin");

  useEffect(() => {
    if (isLoading) return;
    if (!isAdmin) {
      navigate("/admin-login", { replace: true });
    }
  }, [isAdmin, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Shield className="w-10 h-10 text-destructive animate-pulse" />
      </div>
    );
  }

  if (!isAdmin) return null;

  return <>{children}</>;
};

export default AdminGuard;
