import { Home, LayoutGrid, ClipboardList, Users, User } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";

const navItems = [
  { key: "nav_home", icon: Home, path: "/" },
  { key: "nav_categories", icon: LayoutGrid, path: "/category" },
  { key: "nav_orders", icon: ClipboardList, path: "/orders" },
  { key: "nav_farmers", icon: Users, path: "/farmers" },
  { key: "nav_profile", icon: User, path: "/profile" },
];

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { role } = useAuth();

  const getPath = (path: string) => {
    if (role === "admin") {
      // Admin profile icon goes to dashboard; other tabs go home
      if (path === "/profile") return "/admin-dashboard";
      if (path === "/orders" || path === "/farmers") return "/";
      return path;
    }
    if (role === "farmer") {
      // Farmers should go to their dashboard, not the buyer orders or portal pages
      if (path === "/orders" || path === "/farmers") return "/farmers/dashboard";
    }
    return path;
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-t border-border">
      <div className="flex items-stretch pb-[max(0.25rem,env(safe-area-inset-bottom))]">
        {navItems.map(item => {
          const active = location.pathname === item.path;
          return (
            <button
              key={item.key}
              onClick={() => navigate(getPath(item.path))}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 pt-2 pb-1.5 min-w-0 transition-colors ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              <span className="text-[10px] font-semibold truncate w-full text-center px-1">{t(item.key)}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
