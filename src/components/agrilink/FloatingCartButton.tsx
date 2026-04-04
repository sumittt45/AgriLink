import { useNavigate, useLocation } from "react-router-dom";
import { useCart } from "@/contexts/CartContext";
import { ChevronRight } from "lucide-react";

const HIDE_ON = ["/cart", "/checkout"];

const FloatingCartButton = () => {
  const { items, totalItems } = useCart();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  if (items.length === 0 || HIDE_ON.includes(pathname)) return null;

  const previewEmoji = items[0]?.emoji ?? "🛒";
  const label = `${items.length} item${items.length > 1 ? "s" : ""}`;

  return (
    <button
      onClick={() => navigate("/cart")}
      className="active:scale-[0.97] transition-transform"
      style={{
        position: "fixed",
        bottom: "80px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 1000,
        background: "#0c831f",
        color: "white",
        border: "none",
        borderRadius: "999px",
        padding: "10px 16px",
        width: "auto",
        maxWidth: "90vw",
        minWidth: "220px",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {/* Emoji thumbnail */}
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: "rgba(255,255,255,0.2)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 18, flexShrink: 0,
      }}>
        {previewEmoji}
      </div>

      {/* Text */}
      <div style={{ flex: 1, textAlign: "left" }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, lineHeight: 1.2 }}>View cart</p>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 500, opacity: 0.8 }}>{label} · {totalItems} kg</p>
      </div>

      {/* Arrow */}
      <ChevronRight size={18} style={{ flexShrink: 0, opacity: 0.9 }} />
    </button>
  );
};

export default FloatingCartButton;
