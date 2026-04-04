import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Lock, CheckCircle2 } from "lucide-react";

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setIsRecovery(true);
    }
  }, []);

  const handleReset = async () => {
    if (password !== confirm) {
      toast({ title: "Error", description: "Passwords don't match.", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Error", description: "Password must be at least 6 characters.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setSuccess(true);
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-xl font-extrabold text-foreground mb-2">{t("reset_success_title")}</h2>
          <p className="text-sm text-muted-foreground mb-6">{t("reset_success_msg")}</p>
          <Button onClick={() => navigate("/login")} className="w-full rounded-xl h-12">{t("reset_go_login")}</Button>
        </div>
      </div>
    );
  }

  if (!isRecovery) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <h2 className="text-xl font-extrabold text-foreground mb-2">{t("reset_invalid_title")}</h2>
          <p className="text-sm text-muted-foreground mb-6">{t("reset_invalid_msg")}</p>
          <Button onClick={() => navigate("/login")} className="w-full rounded-xl h-12">{t("reset_go_login")}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-xl font-extrabold text-foreground">{t("reset_title")}</h2>
        </div>
        <div className="space-y-3">
          <Input type="password" placeholder="New Password" value={password} onChange={(e) => setPassword(e.target.value)} className="rounded-xl h-12" />
          <Input type="password" placeholder="Confirm Password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="rounded-xl h-12" />
          <Button onClick={handleReset} disabled={loading} className="w-full rounded-xl h-12 font-bold">
            {loading ? t("reset_updating") : t("reset_update_btn")}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
