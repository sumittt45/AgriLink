import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Upload, User, Phone, Mail, MapPin, Lock, Home, Ruler, CheckCircle2, Camera, X, ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { INDIA_LOCATIONS, INDIA_STATES } from "@/lib/india-locations";

const DEMO_OTP = "123456";

const CROP_OPTIONS = [
  "Wheat", "Rice", "Tomato", "Potato", "Onion", "Spinach",
  "Capsicum", "Carrot", "Mango", "Banana", "Apple", "Fruits", "Dairy", "Other",
];

const uploadAnon = async (file: File, bucket: string): Promise<string | null> => {
  const ext = file.name.split(".").pop() || "bin";
  const path = `pending/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { data, error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
  if (error) return null;
  return supabase.storage.from(bucket).getPublicUrl(data.path).data.publicUrl;
};

const FarmerRegister = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { register } = useAuth();
  const { toast } = useToast();

  const [form, setForm] = useState({
    fullName: "", farmName: "", mobile: "", email: "",
    state: "", city: "", farmSize: "", password: "", confirmPassword: "",
  });
  const [selectedCrops, setSelectedCrops] = useState<string[]>([]);
  const [otherCrop, setOtherCrop] = useState("");
  const [step, setStep] = useState<"form" | "otp" | "verify-email">("form");
  const [otp, setOtp] = useState("");
  const [otpVerified, setOtpVerified] = useState(false);
  const [loading, setLoading] = useState(false);

  const [profilePreview, setProfilePreview] = useState<string | null>(null);
  const [profileFile, setProfileFile] = useState<File | null>(null);
  const [govtIdFile, setGovtIdFile] = useState<File | null>(null);
  const [govtIdName, setGovtIdName] = useState<string | null>(null);

  const profileRef = useRef<HTMLInputElement>(null);
  const govtIdRef = useRef<HTMLInputElement>(null);

  const update = (key: string, val: string) => setForm(p => ({ ...p, [key]: val }));

  const toggleCrop = (crop: string) => {
    setSelectedCrops(prev =>
      prev.includes(crop) ? prev.filter(c => c !== crop) : [...prev, crop]
    );
  };

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProfileFile(file);
    setProfilePreview(URL.createObjectURL(file));
  };

  const handleGovtIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setGovtIdFile(file);
    setGovtIdName(file.name);
  };

  // Core registration logic — called either directly or after OTP verification
  const performRegistration = async () => {
    setLoading(true);

    let profileImageUrl = "";
    let governmentIdUrl = "";
    if (profileFile) profileImageUrl = (await uploadAnon(profileFile, "profile-images")) || "";
    if (govtIdFile)  governmentIdUrl = (await uploadAnon(govtIdFile,  "farmer-documents")) || "";

    const cropTypes = [
      ...selectedCrops.filter(c => c !== "Other"),
      ...(selectedCrops.includes("Other") && otherCrop ? [otherCrop] : []),
    ].join(",");

    const { error, needsVerification } = await register({
      name:            form.fullName,
      email:           form.email,
      mobile:          form.mobile,
      password:        form.password,
      role:            "farmer",
      farmName:        form.farmName,
      state:           form.state,
      city:            form.city,
      farmSize:        form.farmSize,
      cropTypes,
      profileImageUrl,
      governmentIdUrl,
    });

    setLoading(false);
    if (error) {
      console.error("[FarmerRegister] registration error:", error);
      toast({ title: "Registration Failed", description: error, variant: "destructive" });
      return;
    }
    if (needsVerification) setStep("verify-email");
  };

  // After OTP is verified → auto-proceed to registration (no second button click needed)
  const handleOtpVerify = async () => {
    if (otp === DEMO_OTP) {
      setOtpVerified(true);
      toast({ title: "Phone Verified ✓", description: "Completing your registration..." });
      await performRegistration();
    } else {
      toast({ title: "Invalid OTP", description: "Use 123456 for demo.", variant: "destructive" });
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.state || !form.city) {
      toast({ title: "Location Required", description: "Please select your state and city.", variant: "destructive" });
      return;
    }
    if (form.password !== form.confirmPassword) {
      toast({ title: "Error", description: "Passwords don't match.", variant: "destructive" });
      return;
    }
    if (selectedCrops.length === 0) {
      toast({ title: "Error", description: "Please select at least one crop type.", variant: "destructive" });
      return;
    }
    // Mobile entered but OTP not yet verified → go to OTP screen first
    if (form.mobile && !otpVerified) { setStep("otp"); return; }
    await performRegistration();
  };

  // ── OTP Screen ──────────────────────────────────────────
  if (step === "otp") {
    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-30 bg-card/95 backdrop-blur-md border-b border-border px-4 py-3 flex items-center gap-3">
          <button onClick={() => setStep("form")} className="p-1"><ArrowLeft className="w-5 h-5 text-foreground" /></button>
          <h1 className="text-base font-bold text-foreground">{t("login_otp_screen_title")}</h1>
        </div>
        <div className="max-w-md mx-auto px-6 py-10 text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-5">
            <Phone className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-lg font-extrabold text-foreground mb-1">{t("login_enter_otp")}</h2>
          <p className="text-sm text-muted-foreground mb-4">{t("farmer_reg_code_sent", { phone: form.mobile })}</p>
          <p className="text-xs text-muted-foreground mb-4 bg-accent rounded-lg p-2">
            Demo OTP: <strong className="text-primary">123456</strong>
          </p>
          <div className="flex justify-center mb-6">
            <InputOTP maxLength={6} value={otp} onChange={setOtp}>
              <InputOTPGroup>
                {[0,1,2,3,4,5].map(i => <InputOTPSlot key={i} index={i} />)}
              </InputOTPGroup>
            </InputOTP>
          </div>
          <Button onClick={handleOtpVerify} disabled={otp.length !== 6 || loading} className="w-full rounded-xl h-12 font-bold">
            {loading ? "Registering..." : t("login_verify_otp")}
          </Button>
        </div>
      </div>
    );
  }

  // ── Email Verification Screen ────────────────────────────
  if (step === "verify-email") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center max-w-sm">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-5">
            <Mail className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-xl font-extrabold text-foreground mb-2">{t("login_verify_email_title")}</h2>
          <p className="text-sm text-muted-foreground mb-6">
            We've sent a verification link to <strong className="text-foreground">{form.email}</strong>.
            Please verify before logging in.
          </p>
          <Button onClick={() => navigate("/farmers/login")} className="w-full rounded-xl h-12">{t("login_go_to_login")}</Button>
        </motion.div>
      </div>
    );
  }

  // ── Main Registration Form ───────────────────────────────
  return (
    <div className="min-h-screen bg-background pb-10">
      <div className="sticky top-0 z-30 bg-card/95 backdrop-blur-md border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate("/farmers")} className="p-1"><ArrowLeft className="w-5 h-5 text-foreground" /></button>
        <h1 className="text-base font-bold text-foreground">{t("farmer_reg_title")}</h1>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-md mx-auto px-6 py-8">
        <div className="text-center mb-6">
          <h2 className="text-xl font-extrabold text-foreground">{t("portal_become_partner")}</h2>
          <p className="text-sm text-muted-foreground mt-1">{t("farmer_reg_subtitle")}</p>
        </div>

        {otpVerified && (
          <div className="flex items-center gap-2 text-xs text-primary bg-accent rounded-lg p-2 mb-4">
            <CheckCircle2 className="w-4 h-4" /> {t("login_phone_verified")}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-5">

          {/* Profile Photo */}
          <div>
            <label className="text-xs font-semibold text-foreground mb-2 block">{t("farmer_reg_profile_photo")}</label>
            <div className="flex items-center gap-4">
              <div
                className="w-16 h-16 bg-accent rounded-full flex items-center justify-center overflow-hidden cursor-pointer border-2 border-border hover:border-primary/50 transition-colors"
                onClick={() => profileRef.current?.click()}
              >
                {profilePreview
                  ? <img src={profilePreview} alt="Profile" className="w-full h-full object-cover" />
                  : <Camera className="w-6 h-6 text-muted-foreground" />
                }
              </div>
              <div>
                <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => profileRef.current?.click()}>
                  {profilePreview ? t("farmer_reg_change_photo") : t("farmer_reg_upload_photo")}
                </Button>
                <p className="text-[10px] text-muted-foreground mt-1">{t("farmer_reg_photo_hint")}</p>
              </div>
            </div>
            <input ref={profileRef} type="file" accept="image/*" className="hidden" onChange={handleProfileChange} />
          </div>

          {/* Text Fields */}
          {[
            { key: "fullName", label: t("auth_name"),             icon: User,  type: "text",   placeholder: "Ramesh Patel",       required: true  },
            { key: "farmName", label: t("farmer_reg_farm_name"),  icon: Home,  type: "text",   placeholder: "Patel Organic Farm", required: true  },
            { key: "mobile",   label: t("farmer_reg_mobile"),     icon: Phone, type: "tel",    placeholder: "+91 98765 43210",    required: false },
            { key: "email",    label: t("login_email"),           icon: Mail,  type: "email",  placeholder: "farmer@example.com", required: true  },
            { key: "farmSize", label: t("farmer_reg_farm_size"),  icon: Ruler, type: "number", placeholder: "12",                 required: false },
          ].map(f => (
            <div key={f.key}>
              <label className="text-xs font-semibold text-foreground mb-1.5 block">{f.label}</label>
              <div className="relative">
                <f.icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type={f.type}
                  placeholder={f.placeholder}
                  value={form[f.key as keyof typeof form]}
                  onChange={e => update(f.key, e.target.value)}
                  className="pl-10 rounded-xl border-border"
                  required={f.required}
                />
              </div>
            </div>
          ))}

          {/* State + City Dropdowns */}
          <div>
            <label className="text-xs font-semibold text-foreground mb-1.5 block">
              State <span className="text-destructive">*</span>
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <select
                value={form.state}
                onChange={e => { update("state", e.target.value); update("city", ""); }}
                required
                className="w-full pl-10 pr-9 h-10 rounded-xl border border-border bg-background text-sm text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="" disabled>{t("farmer_reg_choose_state")}</option>
                {INDIA_STATES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground mb-1.5 block">
              City <span className="text-destructive">*</span>
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <select
                value={form.city}
                onChange={e => update("city", e.target.value)}
                required
                disabled={!form.state}
                className="w-full pl-10 pr-9 h-10 rounded-xl border border-border bg-background text-sm text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="" disabled>
                  {form.state ? t("farmer_reg_choose_city") : t("farmer_reg_select_state_first")}
                </option>
                {(INDIA_LOCATIONS[form.state] || []).map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            {form.state && form.city && (
              <p className="text-[11px] text-primary mt-1 font-semibold">
                📍 {form.city}, {form.state}
              </p>
            )}
          </div>

          {/* Multi-select Crops */}
          <div>
            <label className="text-xs font-semibold text-foreground mb-2 block">
              {t("farmer_reg_crops_label")} <span className="text-destructive">*</span>
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {CROP_OPTIONS.map(crop => (
                <button
                  key={crop}
                  type="button"
                  onClick={() => toggleCrop(crop)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                    selectedCrops.includes(crop)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-muted-foreground border-border hover:border-primary/50"
                  }`}
                >
                  {crop}
                </button>
              ))}
            </div>
            {selectedCrops.includes("Other") && (
              <Input
                placeholder={t("farmer_reg_specify_crop")}
                value={otherCrop}
                onChange={e => setOtherCrop(e.target.value)}
                className="rounded-xl"
              />
            )}
            {selectedCrops.length > 0 && (
              <p className="text-[10px] text-primary mt-1.5">
                Selected: {[...selectedCrops.filter(c => c !== "Other"), ...(selectedCrops.includes("Other") && otherCrop ? [otherCrop] : [])].join(", ")}
              </p>
            )}
          </div>

          {/* Password */}
          {[
            { key: "password",        label: t("auth_password"),              placeholder: "••••••••" },
            { key: "confirmPassword", label: t("farmer_reg_confirm_password"), placeholder: "••••••••" },
          ].map(f => (
            <div key={f.key}>
              <label className="text-xs font-semibold text-foreground mb-1.5 block">{f.label}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="password"
                  placeholder={f.placeholder}
                  value={form[f.key as keyof typeof form]}
                  onChange={e => update(f.key, e.target.value)}
                  className="pl-10 rounded-xl border-border"
                  required
                />
              </div>
            </div>
          ))}

          {/* Government ID Upload */}
          <div>
            <label className="text-xs font-semibold text-foreground mb-1.5 block">
              {t("farmer_reg_govt_id")}
            </label>
            <div
              className="border-2 border-dashed border-border rounded-xl p-5 text-center bg-muted/30 cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => govtIdRef.current?.click()}
            >
              {govtIdName ? (
                <div className="flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                  <span className="text-sm font-semibold text-foreground truncate max-w-[200px]">{govtIdName}</span>
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); setGovtIdFile(null); setGovtIdName(null); }}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-xs font-semibold text-foreground">{t("farmer_reg_govt_id_upload")}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{t("farmer_reg_govt_id_hint")}</p>
                </>
              )}
            </div>
            <input ref={govtIdRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleGovtIdChange} />
          </div>

          <Button type="submit" disabled={loading} className="w-full rounded-xl py-3 font-bold shadow-agri">
            {loading ? t("farmer_reg_registering") : t("farmer_reg_submit")}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-6">
          {t("farmer_reg_already_partner")}{" "}
          <button onClick={() => navigate("/farmers/login")} className="text-primary font-semibold">{t("auth_login")}</button>
        </p>
      </motion.div>
    </div>
  );
};

export default FarmerRegister;
