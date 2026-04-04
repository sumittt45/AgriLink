import { motion } from "framer-motion";
import { Clock, Zap } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

const FreshDealsBanner = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [timeLeft, setTimeLeft] = useState({ h: 5, m: 23, s: 47 });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        let { h, m, s } = prev;
        s--;
        if (s < 0) { s = 59; m--; }
        if (m < 0) { m = 59; h--; }
        if (h < 0) { h = 0; m = 0; s = 0; }
        return { h, m, s };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const pad = (n: number) => n.toString().padStart(2, "0");

  return (
    <div className="py-5 max-w-lg mx-auto px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4 }}
        className="bg-gradient-to-r from-secondary to-agri-yellow rounded-2xl p-5 relative overflow-hidden"
      >
        <div className="absolute top-2 right-2">
          <Zap className="w-20 h-20 text-secondary-foreground/10" />
        </div>
        <div className="flex items-center gap-1.5 mb-2">
          <Clock className="w-4 h-4 text-secondary-foreground" />
          <span className="text-xs font-bold text-secondary-foreground uppercase tracking-wider">{t("fresh_deals_title")}</span>
        </div>
        <h3 className="text-lg font-extrabold text-secondary-foreground">{t("fresh_deals_subtitle")}</h3>
        <p className="text-xs text-secondary-foreground/80 mt-1">Limited time — farm-fresh deals ending soon</p>
        <div className="flex items-center gap-2 mt-4">
          {[pad(timeLeft.h), pad(timeLeft.m), pad(timeLeft.s)].map((v, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="bg-secondary-foreground/20 backdrop-blur-sm text-secondary-foreground text-lg font-extrabold px-3 py-1.5 rounded-xl">{v}</span>
              {i < 2 && <span className="text-secondary-foreground font-bold">:</span>}
            </div>
          ))}
        </div>
        <motion.button
          whileTap={{ scale: 0.93 }}
          onClick={() => navigate("/deals")}
          className="mt-4 bg-secondary-foreground text-secondary text-sm font-bold px-5 py-2.5 rounded-xl active:scale-95 transition-transform"
        >
          {t("grab_deals")}
        </motion.button>
      </motion.div>
    </div>
  );
};

export default FreshDealsBanner;
