import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import heroBanner from "@/assets/hero-banner.jpg";

const HeroBanner = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="px-4 max-w-lg mx-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="relative rounded-2xl overflow-hidden h-44"
      >
        <motion.img
          src={heroBanner}
          alt="Fresh vegetables and fruits"
          className="w-full h-full object-cover"
          whileHover={{ scale: 1.03 }}
          transition={{ duration: 0.4 }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-foreground/70 via-foreground/40 to-transparent" />
        <div className="absolute inset-0 flex flex-col justify-center px-5">
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="text-xl font-extrabold text-primary-foreground leading-tight"
          >
            {t("hero_title").split("\n").map((line, i) => (
              <span key={i}>{line}{i === 0 && <br />}</span>
            ))}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.4 }}
            className="text-xs text-primary-foreground/80 mt-1.5 italic"
          >
            "{t("hero_tagline")}"
          </motion.p>
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.4 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate("/category")}
            className="mt-3 bg-secondary text-secondary-foreground text-sm font-bold px-5 py-2 rounded-xl w-fit shadow-agri"
          >
            {t("shop_now")}
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
};

export default HeroBanner;
