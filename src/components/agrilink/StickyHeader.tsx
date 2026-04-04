import { useState } from "react";
import { ShoppingCart, User, MapPin, ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { useAppLocation } from "@/contexts/LocationContext";
import agrilinkIcon from "@/assets/agrilink-icon.png";
import LanguageSwitcher from "@/components/agrilink/LanguageSwitcher";
import LocationModal from "@/components/agrilink/LocationModal";

const StickyHeader = () => {
  const navigate = useNavigate();
  const { totalItems } = useCart();
  const { role, isLoggedIn } = useAuth();
  const { city, state, hasLocation } = useAppLocation();
  const [locationModalOpen, setLocationModalOpen] = useState(false);

  const locationLabel = city
    ? `${city}${state ? `, ${state}` : ""}`
    : state || null;

  return (
    <>
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border">
        {/* ── Row 1: Brand + Actions ── */}
        <div className="flex items-center justify-between px-4 pt-3 pb-1.5 max-w-lg mx-auto">
          {/* Brand */}
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 active:scale-95 transition-transform shrink-0"
          >
            <img src={agrilinkIcon} alt="AgriLink" className="w-8 h-8 rounded-lg" width={32} height={32} />
            <div className="flex items-baseline gap-0.5 leading-none">
              <span className="text-[16px] font-extrabold text-primary tracking-tight">Agri</span>
              <span className="text-[16px] font-extrabold text-secondary tracking-tight">Link</span>
            </div>
          </button>

          {/* Actions */}
          <div className="flex items-center gap-2.5">
            <LanguageSwitcher compact />
            <button
              onClick={() => navigate("/cart")}
              className="relative p-1.5 active:scale-90 transition-transform"
            >
              <ShoppingCart className="w-5 h-5 text-foreground" />
              {totalItems > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-secondary text-secondary-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                  {totalItems > 99 ? "99+" : totalItems}
                </span>
              )}
            </button>
            {/* Profile + role badge */}
            <div className="relative shrink-0">
              <button
                onClick={() => navigate(role === "admin" ? "/admin-dashboard" : "/profile")}
                className="w-8 h-8 rounded-full bg-accent flex items-center justify-center active:scale-90 transition-transform"
              >
                <User className="w-4 h-4 text-accent-foreground" />
              </button>
              {isLoggedIn && role === "admin" && (
                <span
                  title="Admin Mode"
                  className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full text-[9px] flex items-center justify-center shadow-sm border-2 border-card bg-destructive text-destructive-foreground"
                >
                  🛡️
                </span>
              )}
              {isLoggedIn && (role === "farmer" || role === "buyer") && (
                <span
                  title={role === "farmer" ? "Farmer Mode" : "Buyer Mode"}
                  className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full text-[9px] flex items-center justify-center shadow-sm border-2 border-card ${
                    role === "farmer"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground"
                  }`}
                >
                  {role === "farmer" ? "🌾" : "🛒"}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Row 2: Location bar + role mode ── */}
        <div className="px-4 pb-2.5 max-w-lg mx-auto flex items-center justify-between gap-2">
          <button
            onClick={() => setLocationModalOpen(true)}
            className="flex items-center gap-1.5 group min-w-0"
          >
            <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
            {hasLocation && locationLabel ? (
              <>
                <span className="text-xs font-bold text-foreground truncate max-w-[200px]">
                  {locationLabel}
                </span>
                <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
              </>
            ) : (
              <>
                <span className="text-xs font-semibold text-muted-foreground">
                  Select Location
                </span>
                <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
              </>
            )}
          </button>

          {/* Role mode pill */}
          {isLoggedIn && role === "admin" && (
            <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 bg-destructive/10 text-destructive">
              🛡️ Admin
            </span>
          )}
          {isLoggedIn && (role === "farmer" || role === "buyer") && (
            <span
              className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                role === "farmer"
                  ? "bg-primary/10 text-primary"
                  : "bg-secondary/10 text-secondary"
              }`}
            >
              {role === "farmer" ? "👨‍🌾 Farmer" : "🛒 Buyer"}
            </span>
          )}
        </div>
      </header>

      <LocationModal
        open={locationModalOpen}
        onClose={() => setLocationModalOpen(false)}
      />
    </>
  );
};

export default StickyHeader;
