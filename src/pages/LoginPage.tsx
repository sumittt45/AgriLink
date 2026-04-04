import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, LogIn, UserPlus, Mail, CheckCircle2, Phone } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import BottomNav from "@/components/agrilink/BottomNav";

const DEMO_OTP = "123456";

const LoginPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const message = searchParams.get("message");
  const { login, register, resetPassword, redirectPath, setRedirectPath, role, isLoading } = useAuth();

  // Already logged in — skip login page (replace so back button skips it too)
  useEffect(() => {
    if (isLoading) return;
    if (role === "farmer") navigate("/farmers/dashboard", { replace: true });
    else if (role === "buyer") navigate(redirectPath || "/", { replace: true });
  }, [role, isLoading, navigate, redirectPath]);
  const { toast } = useToast();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [step, setStep] = useState<"form" | "otp" | "verify-email" | "forgot">("form");
  const [form, setForm] = useState({ name: "", email: "", mobile: "", password: "", city: "", state: "" });
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");

  const handleLogin = async () => {
    if (!form.email || !form.password) return;
    setLoading(true);
    const { error, role } = await login(form.email, form.password);
    setLoading(false);
    if (error) {
      toast({ title: "Login Failed", description: error, variant: "destructive" });
      return;
    }
    if (role === "farmer") {
      toast({
        title: "Wrong Login Section",
        description: "This account is registered as a Farmer. Please login from the Farmer section.",
        variant: "destructive",
      });
      return;
    }
    const dest = redirectPath || "/";
    setRedirectPath(null);
    navigate(dest, { replace: true });
  };

  const handleRegister = async () => {
    if (!form.name || !form.email || !form.password) return;
    if (form.mobile && !otpVerified) {
      setStep("otp");
      return;
    }
    setLoading(true);
    const { error, needsVerification } = await register({
      name: form.name, email: form.email, mobile: form.mobile,
      password: form.password, city: form.city || undefined, state: form.state || undefined,
    });
    setLoading(false);
    if (error) {
      toast({ title: "Registration Failed", description: error, variant: "destructive" });
      return;
    }
    if (needsVerification) {
      setStep("verify-email");
    }
  };

  const handleOtpVerify = () => {
    if (otp === DEMO_OTP) {
      setOtpVerified(true);
      toast({ title: "✅ Phone Verified", description: "Phone number verified successfully." });
      setStep("form");
      // Auto-submit registration after OTP
      setTimeout(async () => {
        setLoading(true);
        const { error, needsVerification } = await register({
          name: form.name, email: form.email, mobile: form.mobile,
          password: form.password, city: form.city || undefined, state: form.state || undefined,
        });
        setLoading(false);
        if (error) {
          toast({ title: "Registration Failed", description: error, variant: "destructive" });
          return;
        }
        if (needsVerification) setStep("verify-email");
      }, 500);
    } else {
      toast({ title: "Invalid OTP", description: "Please enter the correct OTP (123456 for demo).", variant: "destructive" });
    }
  };

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

  const update = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  // Email Verification Screen
  if (step === "verify-email") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center max-w-sm">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-5">
            <Mail className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-xl font-extrabold text-foreground mb-2">{t("login_verify_email_title")}</h2>
          <p className="text-sm text-muted-foreground mb-6">
            We've sent a verification link to <strong className="text-foreground">{form.email}</strong>. Please verify your email before logging in.
          </p>
          <Button onClick={() => { setStep("form"); setMode("login"); }} className="w-full rounded-xl h-12">
            {t("login_go_to_login")}
          </Button>
        </motion.div>
      </div>
    );
  }

  // OTP Screen
  if (step === "otp") {
    return (
      <div className="min-h-screen bg-background pb-20">
        <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border">
          <div className="flex items-center justify-between px-4 py-3 max-w-4xl mx-auto">
            <button onClick={() => setStep("form")} className="p-1.5">
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </button>
            <h1 className="text-base font-bold text-foreground">{t("login_otp_screen_title")}</h1>
            <div className="w-8" />
          </div>
        </header>
        <div className="px-4 max-w-md mx-auto py-10 text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-5">
            <Phone className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-lg font-extrabold text-foreground mb-1">{t("login_enter_otp")}</h2>
          <p className="text-sm text-muted-foreground mb-6">
            We've sent a 6-digit code to <strong>{form.mobile}</strong>
          </p>
          <p className="text-xs text-muted-foreground mb-4 bg-accent rounded-lg p-2">
            Demo mode: Use OTP <strong className="text-primary">123456</strong>
          </p>
          <div className="flex justify-center mb-6">
            <InputOTP maxLength={6} value={otp} onChange={setOtp}>
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>
          <Button onClick={handleOtpVerify} disabled={otp.length !== 6} className="w-full rounded-xl h-12 font-bold">
            {t("login_verify_otp")}
          </Button>
        </div>
      </div>
    );
  }

  // Forgot Password Screen
  if (step === "forgot") {
    return (
      <div className="min-h-screen bg-background pb-20">
        <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border">
          <div className="flex items-center justify-between px-4 py-3 max-w-4xl mx-auto">
            <button onClick={() => setStep("form")} className="p-1.5">
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </button>
            <h1 className="text-base font-bold text-foreground">{t("login_reset_screen_title")}</h1>
            <div className="w-8" />
          </div>
        </header>
        <div className="px-4 max-w-md mx-auto py-10">
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
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-between px-4 py-3 max-w-4xl mx-auto">
          <button onClick={() => navigate(-1)} className="p-1.5">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="text-base font-bold text-foreground">{mode === "login" ? t("auth_login") : t("login_create_account")}</h1>
          <div className="w-8" />
        </div>
      </header>

      <div className="px-4 max-w-md mx-auto py-8">
        {message && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-accent border border-border rounded-xl p-3 mb-6 text-center">
            <p className="text-sm text-foreground font-medium">{message}</p>
          </motion.div>
        )}

        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-accent rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">🌾</div>
          <h2 className="text-xl font-extrabold text-foreground">{t("login_welcome")}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === "login" ? t("login_subtitle_login") : t("login_subtitle_register")}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex bg-muted rounded-xl p-1 mb-6">
          <button
            onClick={() => setMode("login")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-bold rounded-lg transition-colors ${mode === "login" ? "bg-card text-foreground shadow-agri" : "text-muted-foreground"}`}
          >
            <LogIn className="w-4 h-4" /> {t("auth_login")}
          </button>
          <button
            onClick={() => setMode("register")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-bold rounded-lg transition-colors ${mode === "register" ? "bg-card text-foreground shadow-agri" : "text-muted-foreground"}`}
          >
            <UserPlus className="w-4 h-4" /> {t("auth_register")}
          </button>
        </div>

        <AnimatePresence mode="wait">
          {mode === "login" ? (
            <motion.div key="login" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-3">
              <Input placeholder={t("login_email")} type="email" value={form.email} onChange={(e) => update("email", e.target.value)} className="rounded-xl h-12" />
              <Input placeholder={t("auth_password")} type="password" value={form.password} onChange={(e) => update("password", e.target.value)} className="rounded-xl h-12" />
              <Button onClick={handleLogin} disabled={loading} className="w-full rounded-xl h-12 text-base font-bold shadow-agri">
                {loading ? t("login_logging_in") : t("auth_login")}
              </Button>
              <div className="flex justify-between items-center">
                <button onClick={() => setStep("forgot")} className="text-xs text-primary font-semibold">
                  {t("login_forgot_link")}
                </button>
                <button onClick={() => setMode("register")} className="text-xs text-primary font-semibold">
                  {t("login_create_account")}
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div key="register" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-3">
              <Input placeholder={t("login_full_name")} value={form.name} onChange={(e) => update("name", e.target.value)} className="rounded-xl h-12" />
              <Input placeholder={t("login_email")} type="email" value={form.email} onChange={(e) => update("email", e.target.value)} className="rounded-xl h-12" />
              <Input placeholder={t("login_mobile")} type="tel" value={form.mobile} onChange={(e) => update("mobile", e.target.value)} className="rounded-xl h-12" />
              <Input placeholder={t("auth_password")} type="password" value={form.password} onChange={(e) => update("password", e.target.value)} className="rounded-xl h-12" />
              <Input placeholder="City" value={form.city} onChange={(e) => update("city", e.target.value)} className="rounded-xl h-12" />
              <Input placeholder="State" value={form.state} onChange={(e) => update("state", e.target.value)} className="rounded-xl h-12" />
              {otpVerified && (
                <div className="flex items-center gap-2 text-xs text-primary bg-accent rounded-lg p-2">
                  <CheckCircle2 className="w-4 h-4" /> {t("login_phone_verified")}
                </div>
              )}
              <Button onClick={handleRegister} disabled={loading} className="w-full rounded-xl h-12 text-base font-bold shadow-agri">
                {loading ? t("login_creating_account") : t("login_create_account")}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                {t("login_already_buyer")}{" "}
                <button onClick={() => setMode("login")} className="text-primary font-semibold">{t("auth_login")}</button>
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <BottomNav />
    </div>
  );
};

export default LoginPage;
