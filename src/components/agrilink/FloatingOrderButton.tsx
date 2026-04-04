import { motion, useScroll, useMotionValueEvent } from "framer-motion";
import { Zap } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

const FloatingOrderButton = () => {
  const { scrollY } = useScroll();
  const [visible, setVisible] = useState(false);
  const navigate = useNavigate();

  useMotionValueEvent(scrollY, "change", (v) => {
    setVisible(v > 400);
  });

  return (
    <motion.button
      initial={{ scale: 0, opacity: 0 }}
      animate={visible ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      onClick={() => navigate("/quick-order")}
      className="fixed bottom-20 right-4 z-40 bg-primary text-primary-foreground shadow-agri-lg rounded-2xl px-4 py-3 flex items-center gap-2 active:scale-95 transition-transform"
    >
      <Zap className="w-4 h-4" />
      <span className="text-sm font-bold">Quick Order</span>
    </motion.button>
  );
};

export default FloatingOrderButton;
