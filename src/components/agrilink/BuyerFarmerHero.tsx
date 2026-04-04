import { motion, useScroll, useTransform } from "framer-motion";
import { useRef, useState } from "react";
import { ShoppingCart, Store, TrendingUp, DollarSign, Truck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import farmlandImg from "@/assets/farmland-hero.jpg";

const farmerBenefits = [
  { icon: TrendingUp, key: "benefit_market" },
  { icon: DollarSign, key: "benefit_pricing" },
  { icon: Truck, key: "benefit_logistics" },
];

const BuyerFarmerHero = () => {
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const imgY = useTransform(scrollYProgress, [0, 1], ["-10%", "10%"]);
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div ref={ref} className="py-5 max-w-4xl mx-auto px-4">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="relative rounded-2xl overflow-hidden min-h-[280px] md:min-h-[340px]"
      >
        <motion.img
          src={farmlandImg}
          alt="Lush green farmland"
          className="absolute inset-0 w-full h-[120%] object-cover"
          style={{ y: imgY }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-foreground/80 via-foreground/60 to-foreground/30" />

        <div className="relative z-10 p-6 md:p-10 flex flex-col justify-center h-full min-h-[280px] md:min-h-[340px]">
          <motion.h2
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15, duration: 0.5 }}
            className="text-xl md:text-2xl lg:text-3xl font-extrabold text-primary-foreground leading-tight max-w-md"
          >
            {t("connect_farmers").split("\n").map((line, i) => (
              <span key={i}>{line}{i === 0 && <br />}</span>
            ))}
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="text-sm md:text-base text-primary-foreground/80 mt-2"
          >
            {t("bulk_tagline")}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.45, duration: 0.5 }}
            className="flex flex-wrap gap-3 mt-5"
          >
            <button
              onClick={() => navigate("/bulk-marketplace")}
              className="flex items-center gap-2 bg-primary text-primary-foreground text-sm font-bold px-5 py-2.5 rounded-xl shadow-agri hover:shadow-agri-lg active:scale-95 transition-all"
            >
              <ShoppingCart className="w-4 h-4" />
              {t("start_bulk_buying")}
            </button>

            <div className="relative">
              <button
                onClick={() => navigate("/farmers")}
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                onFocus={() => setShowTooltip(true)}
                onBlur={() => setShowTooltip(false)}
                className="flex items-center gap-2 bg-primary-foreground/20 backdrop-blur-sm text-primary-foreground text-sm font-bold px-5 py-2.5 rounded-xl border border-primary-foreground/30 hover:bg-primary-foreground/30 active:scale-95 transition-all"
              >
                <Store className="w-4 h-4" />
                {t("sell_produce")}
              </button>

              <motion.div
                initial={false}
                animate={showTooltip ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 8, scale: 0.95 }}
                className="absolute bottom-full left-0 mb-2 bg-card rounded-xl border border-border shadow-agri-lg p-3 min-w-[180px] pointer-events-none z-20"
              >
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">{t("farmer_benefits")}</p>
                {farmerBenefits.map(b => (
                  <div key={b.key} className="flex items-center gap-2 py-1">
                    <b.icon className="w-3.5 h-3.5 text-primary" />
                    <span className="text-xs font-semibold text-foreground">{t(b.key)}</span>
                  </div>
                ))}
              </motion.div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
};

export default BuyerFarmerHero;
