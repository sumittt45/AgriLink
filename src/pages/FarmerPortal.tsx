import { useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowRight, LogIn, Sprout } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import farmLandscape from "@/assets/farm-landscape.jpg";
import BottomNav from "@/components/agrilink/BottomNav";
import { useAuth } from "@/contexts/AuthContext";

const FarmerPortal = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { role, isLoading } = useAuth();

  // If already logged in as farmer, skip this portal and go straight to dashboard
  useEffect(() => {
    if (!isLoading && role === "farmer") {
      navigate("/farmers/dashboard", { replace: true });
    }
  }, [role, isLoading, navigate]);

  return (
    <div className="min-h-screen bg-background pb-20 flex flex-col">
      {/* Hero */}
      <div className="relative flex-1 flex flex-col items-center justify-center px-6 py-12 text-center">
        <img
          src={farmLandscape}
          alt="Farm landscape"
          className="absolute inset-0 w-full h-full object-cover opacity-20"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 max-w-md mx-auto"
        >
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Sprout className="w-8 h-8 text-primary" />
          </div>

          <h1 className="text-2xl md:text-3xl font-extrabold text-foreground">
            {t("portal_title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-3 max-w-xs mx-auto leading-relaxed">
            {t("portal_tagline")}
          </p>

          <div className="flex flex-col gap-3 mt-8 w-full max-w-xs mx-auto">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate("/farmers/register")}
              className="flex items-center justify-center gap-2 w-full bg-primary text-primary-foreground font-bold text-sm py-3.5 rounded-xl shadow-agri hover:shadow-agri-lg transition-all"
            >
              <Sprout className="w-4 h-4" />
              {t("portal_become_partner")}
              <ArrowRight className="w-4 h-4" />
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate("/farmers/login", { replace: true })}
              className="flex items-center justify-center gap-2 w-full bg-card text-foreground font-bold text-sm py-3.5 rounded-xl border border-border shadow-agri hover:shadow-agri-lg transition-all"
            >
              <LogIn className="w-4 h-4" />
              {t("portal_already_partner")}
            </motion.button>
          </div>

          {/* Feature highlights */}
          <div className="grid grid-cols-3 gap-3 mt-10">
            {[
              { label: t("portal_direct_sales"), emoji: "🤝" },
              { label: t("benefit_pricing"), emoji: "💰" },
              { label: t("portal_logistics"), emoji: "🚛" },
            ].map((f) => (
              <div key={f.label} className="bg-card border border-border rounded-xl p-3 shadow-agri">
                <span className="text-xl">{f.emoji}</span>
                <p className="text-[10px] font-semibold text-muted-foreground mt-1">{f.label}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      <BottomNav />
    </div>
  );
};

export default FarmerPortal;
