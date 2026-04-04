import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { CheckCircle2, ShoppingBag, Wheat, Shield, ArrowRight } from "lucide-react";

const AuthCallback = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const handle = async () => {
      const hash   = window.location.hash;
      const search = window.location.search;
      const params = new URLSearchParams(search);
      const code   = params.get("code");
      const type   = params.get("type") || (hash.includes("type=recovery") ? "recovery" : "signup");

      try {
        let session = null;

        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          session = data.session;
        } else {
          const { data, error } = await supabase.auth.getSession();
          if (error) throw error;
          session = data.session;
        }

        if (session) {
          if (type === "recovery") {
            navigate("/reset-password" + hash, { replace: true });
          } else {
            setStatus("success");
          }
        } else {
          setErrorMsg("Link expired or invalid. Please register again.");
          setStatus("error");
        }
      } catch (err: any) {
        console.error("[AuthCallback] error:", err?.message ?? err);
        setErrorMsg("Verification failed. Please try again.");
        setStatus("error");
      }
    };

    handle();
  }, [navigate]);

  // ── Loading ──
  if (status === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-5xl mb-5">🌾</div>
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm font-semibold text-muted-foreground">Verifying your email...</p>
        </div>
      </div>
    );
  }

  // ── Error ──
  if (status === "error") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">❌</div>
          <h2 className="text-xl font-extrabold text-foreground mb-2">Verification Failed</h2>
          <p className="text-sm text-muted-foreground mb-6">{errorMsg}</p>
          <button
            onClick={() => navigate("/login", { replace: true })}
            className="w-full bg-primary text-white font-bold py-3 rounded-xl text-sm"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  // ── Success ──
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        {/* Success header */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", damping: 12, stiffness: 200, delay: 0.1 }}
            className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4"
          >
            <CheckCircle2 className="w-10 h-10 text-primary" />
          </motion.div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
            <h2 className="text-2xl font-extrabold text-foreground">Email Verified! 🎉</h2>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              Aapka email successfully verify ho gaya hai.<br />
              Ab aap login karke AgriLink use kar sakte hain.
            </p>
          </motion.div>
        </div>

        {/* Role cards */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="space-y-3 mb-6"
        >
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider text-center mb-3">
            Aap kaise login karna chahte hain?
          </p>

          {/* Buyer */}
          <button
            onClick={() => navigate("/login", { replace: true })}
            className="w-full bg-card border border-border rounded-2xl p-4 flex items-center gap-4 hover:border-blue-400 hover:bg-blue-50/50 transition-all active:scale-95 text-left"
          >
            <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center shrink-0">
              <ShoppingBag className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-foreground">Buyer / Khareedaar</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Seedha kisan se khareedein</p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </button>

          {/* Farmer */}
          <button
            onClick={() => navigate("/farmers/login", { replace: true })}
            className="w-full bg-card border border-border rounded-2xl p-4 flex items-center gap-4 hover:border-primary/50 hover:bg-primary/5 transition-all active:scale-95 text-left"
          >
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
              <Wheat className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-foreground">Farmer / Kisan</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Apni fasal seedha bechain</p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </button>

          {/* Admin */}
          <button
            onClick={() => navigate("/admin-login", { replace: true })}
            className="w-full bg-card border border-border rounded-2xl p-4 flex items-center gap-4 hover:border-destructive/40 hover:bg-destructive/5 transition-all active:scale-95 text-left"
          >
            <div className="w-12 h-12 bg-destructive/10 rounded-xl flex items-center justify-center shrink-0">
              <Shield className="w-6 h-6 text-destructive" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-foreground">Admin</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Platform manage karein</p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </button>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-center text-[11px] text-muted-foreground"
        >
          🌱 AgriLink — Kisan se seedha aapke ghar tak
        </motion.p>
      </motion.div>
    </div>
  );
};

export default AuthCallback;
