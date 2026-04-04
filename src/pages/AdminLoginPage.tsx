import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Shield, Mail, Lock, Loader2, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ADMIN_EMAIL } from "@/lib/constants";

const AdminLoginPage = () => {
  const navigate = useNavigate();
  const { user, isLoggedIn, isLoading } = useAuth();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Already logged in as admin → skip to dashboard
  useEffect(() => {
    if (isLoading) return;
    if (isLoggedIn && user?.email === ADMIN_EMAIL) {
      navigate("/admin-dashboard", { replace: true });
    }
  }, [isLoggedIn, isLoading, user, navigate]);

  const handleLogin = async () => {
    if (!email || !password) return;
    setLoading(true);
    console.log("[AdminLogin] attempting login for:", email);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setLoading(false);
      toast({ title: "Login Failed", description: error.message, variant: "destructive" });
      return;
    }

    if (data.user?.email !== ADMIN_EMAIL) {
      console.warn("[AdminLogin] non-admin email attempted:", data.user?.email);
      await supabase.auth.signOut();
      setLoading(false);
      toast({
        title: "Access Denied",
        description: "This account does not have admin privileges.",
        variant: "destructive",
      });
      return;
    }

    console.log("[AdminLogin] admin authenticated:", data.user.id);
    setLoading(false);
    navigate("/admin-dashboard", { replace: true });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-destructive border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <button
          onClick={() => navigate("/profile")}
          className="flex items-center gap-1.5 text-xs text-muted-foreground mb-6 hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Profile
        </button>

        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-xl font-extrabold text-foreground">Admin Login</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Restricted access — authorized personnel only
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="email"
              placeholder="Admin email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="pl-10 rounded-xl"
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              className="pl-10 rounded-xl"
            />
          </div>
          <Button
            onClick={handleLogin}
            disabled={loading || !email || !password}
            className="w-full rounded-xl font-bold bg-destructive hover:bg-destructive/90 text-destructive-foreground"
          >
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Verifying...</>
              : <><Shield className="w-4 h-4 mr-2" />Login as Admin</>
            }
          </Button>
        </div>

        <p className="text-center text-[10px] text-muted-foreground mt-4">
          Unauthorized access attempts are logged
        </p>
      </motion.div>
    </div>
  );
};

export default AdminLoginPage;
