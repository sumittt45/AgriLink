import { motion } from "framer-motion";
import { Carrot, Apple, Wheat, Milk, Leaf, Flame } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

const categories = [
  { key: "cat_vegetables", icon: Carrot, bg: "bg-accent", iconColor: "text-primary" },
  { key: "cat_fruits", icon: Apple, bg: "bg-agri-orange-light", iconColor: "text-agri-orange" },
  { key: "cat_grains", icon: Wheat, bg: "bg-agri-earth-light", iconColor: "text-agri-earth" },
  { key: "cat_dairy", icon: Milk, bg: "bg-muted", iconColor: "text-foreground" },
  { key: "cat_organic", icon: Leaf, bg: "bg-accent", iconColor: "text-primary" },
  { key: "cat_farm_deals", icon: Flame, bg: "bg-agri-orange-light", iconColor: "text-agri-red" },
];

const QuickCategories = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  return (
    <div className="py-5 max-w-lg mx-auto">
      <h2 className="text-base font-bold text-foreground px-4 mb-3">{t("shop_by_category")}</h2>
      <div className="flex gap-3 overflow-x-auto scrollbar-hide px-4 pb-1">
        {categories.map((cat, i) => (
          <motion.button
            key={cat.key}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * i, duration: 0.35 }}
            whileTap={{ scale: 0.93 }}
            onClick={() => navigate("/category")}
            className="flex flex-col items-center gap-2 min-w-[72px]"
          >
            <div className={`w-16 h-16 ${cat.bg} rounded-2xl flex items-center justify-center shadow-agri transition-shadow hover:shadow-agri-lg`}>
              <cat.icon className={`w-7 h-7 ${cat.iconColor}`} />
            </div>
            <span className="text-[11px] font-semibold text-foreground text-center leading-tight">{t(cat.key)}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
};

export default QuickCategories;
