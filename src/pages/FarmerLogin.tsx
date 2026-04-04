import { useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, LogIn, Mail, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const FarmerLogin = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { login, resetPassword, role, isLoading } = useAuth();

  // Already logged in — skip login page entirely (replace so back button skips it too)
  useEffect(() => {
    if (isLoading) return;
    if (role === "farmer") navigate("/farmers/dashboard", { replace: true });
    else if (role === "buyer") navigate("/", { replace: true });
  }, [role, isLoading, navigate]);
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"form" | "forgot">("form");
  const [forgotEmail, setForgotEmail] = useState("");

  const handleForgotPassword = async () => {
    if (!forgotEmail) return;
    setLoading(true);
    const { error } = await resetPassword(forgotEmail);
    setLoading(false);
    if (error) {
      toast({ title: "Error", description: error, variant: "destructive" });
      return;
    }
    toast({ title: "Email Sent", description: "Check your inbox for password reset instructions." });
    setStep("form");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error, role } = await login(email, password);
    setLoading(false);
    if (error) {
      toast({ title: "Login Failed", description: error, variant: "destructive" });
      return;
    }
    if (role === "buyer") {
      toast({
        title: "Wrong Login Section",
        description: "This account is registered as a Buyer. Please login from the Buyer section.",
        variant: "destructive",
      });
      return;
    }
    navigate("/farmers/dashboard", { replace: true });
  };

  if (step === "forgot") {
    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-30 bg-card/95 backdrop-blur-md border-b border-border px-4 py-3 flex items-center gap-3">
          <button onClick={() => setStep("form")} className="p-1">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="text-base font-bold text-foreground">{t("login_reset_screen_title")}</h1>
        </div>
        <div className="max-w-md mx-auto px-6 py-10">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">🔑</div>
            <h2 className="text-lg font-extrabold text-foreground">{t("login_forgot_title")}</h2>
            <p className="text-sm text-muted-foreground mt-1">{t("login_forgot_subtitle")}</p>
          </div>
          <div className="space-y-3">
            <Input
              placeholder="Email Address"
              type="email"
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              className="rounded-xl h-12"
            />
            <Button onClick={handleForgotPassword} disabled={loading} className="w-full rounded-xl h-12 font-bold">
              {loading ? t("login_sending") : t("login_send_reset_link")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-30 bg-card/95 backdrop-blur-md border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate("/farmers")} className="p-1">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <h1 className="text-base font-bold text-foreground">{t("farmer_login_title")}</h1>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="max-w-md mx-auto px-6 py-10">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <LogIn className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-xl font-extrabold text-foreground">{t("farmer_login_welcome")}</h2>
          <p className="text-sm text-muted-foreground mt-1">{t("farmer_login_subtitle")}</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-foreground mb-1.5 block">{t("login_email")}</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input type="email" placeholder="farmer@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 rounded-xl border-border" required />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-foreground mb-1.5 block">{t("auth_password")}</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 rounded-xl border-border" required />
            </div>
          </div>
          <Button type="submit" disabled={loading} className="w-full rounded-xl py-3 font-bold shadow-agri">
            {loading ? t("farmer_login_logging_in") : t("auth_login")}
          </Button>
        </form>

        <div className="flex justify-between items-center mt-4">
          <button onClick={() => { setForgotEmail(email); setStep("forgot"); }} className="text-xs text-primary font-semibold">
            {t("login_forgot_link")}
          </button>
          <button onClick={() => navigate("/farmers/register")} className="text-xs text-primary font-semibold">
            {t("portal_become_partner")}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default FarmerLogin;
