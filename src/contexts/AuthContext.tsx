import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User as SupabaseUser, Session } from "@supabase/supabase-js";
import { ADMIN_EMAIL } from "@/lib/constants";

export interface Profile {
  id: string; // = auth.users.id
  name: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  city: string | null;
  state: string | null;
  avatar_url: string | null;
}

interface AuthContextType {
  user: SupabaseUser | null;
  profile: Profile | null;
  session: Session | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  role: "buyer" | "farmer" | "admin" | null;
  login: (email: string, password: string) => Promise<{ error: string | null; role: "buyer" | "farmer" | "admin" | null }>;
  register: (data: {
    name: string;
    email: string;
    mobile: string;
    password: string;
    role?: "buyer" | "farmer";
    farmName?: string;
    state?: string;
    city?: string;
    farmSize?: string;
    cropTypes?: string;
    profileImageUrl?: string;
    governmentIdUrl?: string;
  }) => Promise<{ error: string | null; needsVerification?: boolean }>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  redirectPath: string | null;
  setRedirectPath: (path: string | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<"buyer" | "farmer" | "admin" | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [redirectPath, setRedirectPath] = useState<string | null>(null);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (data) {
      // Force-logout check: admin can kick a user out remotely
      if ((data as any).force_logout) {
        console.warn("[fetchProfile] force_logout set — signing out user:", userId);
        await (supabase as any).from("profiles").update({ force_logout: false }).eq("id", userId);
        await supabase.auth.signOut();
        return;
      }

      const p = data as unknown as Profile;
      if (!p.city && !p.state && !p.location) {
        const { data: { user: liveUser } } = await supabase.auth.getUser();
        const meta = liveUser?.user_metadata || {};
        const metaCity     = (meta.city  as string) || "";
        const metaState    = (meta.state as string) || "";
        const metaLocation = metaCity && metaState
          ? `${metaCity}, ${metaState}`
          : metaCity || metaState || (meta.location as string) || "";
        if (metaCity || metaState || metaLocation) {
          await supabase
            .from("profiles")
            .update({ city: metaCity || null, state: metaState || null, location: metaLocation || null })
            .eq("id", userId);
          setProfile({ ...p, city: metaCity || null, state: metaState || null, location: metaLocation || null });
          return;
        }
      }
      setProfile(p);
      return;
    }

    // No profile row — trigger failed silently; create from user_metadata + user_roles
    const { data: { user: liveUser } } = await supabase.auth.getUser();
    if (!liveUser) return;

    const meta         = liveUser.user_metadata || {};
    const metaCity     = (meta.city  as string) || "";
    const metaState    = (meta.state as string) || "";
    const metaLocation = metaCity && metaState
      ? `${metaCity}, ${metaState}`
      : metaCity || metaState || (meta.location as string) || "";

    // Resolve role: user_roles table → user_metadata → default buyer
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .single();
    const resolvedRole: string =
      (roleRow?.role as string) ||
      (meta.role as string) ||
      "buyer";

    console.log("[fetchProfile] creating missing profile for", userId, "role:", resolvedRole);

    const { data: created } = await (supabase as any)
      .from("profiles")
      .upsert(
        {
          id:         userId,
          email:      liveUser.email || null,
          role:       resolvedRole,
          name:       (meta.name as string) || (meta.full_name as string) || "",
          phone:      (meta.phone as string) || null,
          location:   metaLocation || null,
          city:       metaCity  || null,
          state:      metaState || null,
          avatar_url: (meta.profile_image_url as string) || null,
        },
        { onConflict: "id" }
      )
      .select()
      .single();

    if (created) setProfile(created as unknown as Profile);
  }, []);

  const fetchRole = useCallback(async (userId: string) => {
    // ── Admin shortcut: always "admin", never buyer/farmer ──────────────────
    const { data: { user: liveUser } } = await supabase.auth.getUser();
    if (liveUser?.email === ADMIN_EMAIL) {
      setRole("admin");
      // Keep user_roles in sync (idempotent)
      await (supabase as any)
        .from("user_roles")
        .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id" });
      return;
    }

    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .single();

    if (data) {
      // Guard: non-admin users must never have role "admin"
      const r = (data.role as string) === "admin" ? "buyer" : data.role as "buyer" | "farmer";
      setRole(r);
      return;
    }

    // No user_roles row found — resolve from metadata first (works immediately),
    // then confirm in background that the auth account actually exists.
    // Never sign out here: a missing user_roles row is almost always a trigger
    // timing issue, not a deleted account. Only sign out if getUser() explicitly
    // returns an auth error (invalid token), not just a missing DB row.
    const metaRole = liveUser?.user_metadata?.role;
    const resolvedRole: "buyer" | "farmer" = metaRole === "farmer" ? "farmer" : "buyer";
    setRole(resolvedRole); // set immediately so UI doesn't flicker

    // Try to recreate the missing row in the background
    supabase.auth.getUser().then(({ data: { user: authCheck }, error: authCheckErr }) => {
      if (authCheckErr) {
        // Real auth error (expired/invalid token) — now it's safe to sign out
        console.warn("[fetchRole] getUser auth error — signing out:", authCheckErr.message);
        supabase.auth.signOut();
        return;
      }
      if (authCheck) {
        // Account confirmed — recreate missing user_roles row
        (supabase as any)
          .from("user_roles")
          .upsert({ user_id: userId, role: resolvedRole }, { onConflict: "user_id" })
          .then(({ error: e }: any) => {
            if (e) console.warn("[fetchRole] user_roles recreate warning:", e.message);
            else console.log("[fetchRole] user_roles row recreated for:", userId);
          });
      }
    });
  }, []);

  useEffect(() => {
    let mounted = true;

    // ── Phase 1: getSession() reads the persisted token from localStorage.
    // It resolves in <1ms on every platform — no network call required unless
    // the token is expired and needs a refresh.  We clear isLoading HERE so the
    // app renders immediately regardless of how fast the DB calls below are.
    supabase.auth.getSession()
      .then(({ data: { session: initialSession } }) => {
        if (!mounted) return;
        console.log("[auth] getSession:", initialSession?.user?.id ?? null);
        setSession(initialSession);
        setUser(initialSession?.user ?? null);

        // Profile + role load in background — they must NOT block the UI.
        if (initialSession?.user) {
          fetchProfile(initialSession.user.id).catch(console.error);
          fetchRole(initialSession.user.id).catch(console.error);
        }
      })
      .catch((err) => {
        console.error("[auth] getSession failed:", err);
      })
      .finally(() => {
        // ALWAYS runs — this is the one guaranteed place isLoading becomes false.
        if (mounted) setIsLoading(false);
      });

    // ── Phase 2: listen for live auth changes (login, logout, token refresh).
    // INITIAL_SESSION is skipped — getSession() above already handled that.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        if (event === "INITIAL_SESSION") return; // handled by getSession() above

        console.log("[auth] event:", event, "user:", session?.user?.id ?? null);

        if (event === "SIGNED_OUT") {
          // Explicit logout — wipe everything, never restore.
          setSession(null);
          setUser(null);
          setProfile(null);
          setRole(null);
          return;
        }

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          fetchProfile(session.user.id).catch(console.error);
          fetchRole(session.user.id).catch(console.error);
        } else {
          setProfile(null);
          setRole(null);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile, fetchRole]);

  const login = useCallback(async (email: string, password: string): Promise<{ error: string | null; role: "buyer" | "farmer" | "admin" | null }> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.message.includes("Email not confirmed")) {
        return { error: "Please verify your email before logging in.", role: null };
      }
      return { error: error.message, role: null };
    }

    // Block check — sign out and reject if account is blocked
    const { data: profileData } = await (supabase as any)
      .from("profiles")
      .select("is_blocked")
      .eq("id", data.user.id)
      .single();
    if (profileData?.is_blocked) {
      console.warn("[login] blocked user attempted login:", data.user.id);
      await supabase.auth.signOut();
      return { error: "Your account has been blocked. Please contact support.", role: null };
    }

    // Admin always gets role "admin"
    if (data.user.email === ADMIN_EMAIL) {
      return { error: null, role: "admin" };
    }

    // Fetch role immediately after login
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id)
      .single();
    const rawRole = (roleData?.role as string) ?? null;
    // Ensure non-admin users never carry the admin role
    const userRole: "buyer" | "farmer" | "admin" | null =
      rawRole === "farmer" ? "farmer" : rawRole === "admin" ? "buyer" : rawRole === "buyer" ? "buyer" : null;
    return { error: null, role: userRole } as { error: string | null; role: "buyer" | "farmer" | "admin" | null };
  }, []);

  const register = useCallback(
    async (data: {
      name: string;
      email: string;
      mobile: string;
      password: string;
      role?: "buyer" | "farmer";
      farmName?: string;
      state?: string;
      city?: string;
      farmSize?: string;
      cropTypes?: string;
      profileImageUrl?: string;
      governmentIdUrl?: string;
    }) => {
      const location = data.state && data.city ? `${data.city}, ${data.state}` : (data.state || data.city || "");
      const intendedRole = data.role || "buyer";
      console.log("[register] attempting signUp for", data.email, "role:", intendedRole);

      // Cross-role conflict check (email + phone) via SECURITY DEFINER RPC.
      // Runs before signUp so we never create an auth.users row for a blocked registration.
      const { data: conflictResult, error: conflictError } = await (supabase.rpc as any)(
        "check_role_conflict",
        { p_email: data.email, p_phone: data.mobile || "", p_intended_role: intendedRole }
      );
      if (conflictError) {
        console.error("[register] conflict check error:", conflictError.message);
        // Non-fatal: fall through and let signUp itself catch duplicate-email errors
      } else if (conflictResult && !(conflictResult as any).ok) {
        return { error: (conflictResult as any).message as string };
      }

      const { data: signUpData, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            name: data.name,
            phone: data.mobile,
            role: data.role || "buyer",
            farm_name: data.farmName,
            location,
            state: data.state,
            city: data.city,
            farm_size: data.farmSize,
            crop_types: data.cropTypes,
            profile_image_url: data.profileImageUrl,
            government_id_url: data.governmentIdUrl,
          },
        },
      });
      if (error) {
        console.error("[register] signUp error:", error.message, error);
        return { error: error.message };
      }

      const newUserId = signUpData?.user?.id;
      console.log("[register] signUp success, user:", newUserId);

      // Insert profile row immediately — don't rely solely on DB trigger.
      // This guarantees the admin panel sees the user even before email confirmation.
      if (newUserId) {
        const metaLocation = data.state && data.city
          ? `${data.city}, ${data.state}`
          : data.state || data.city || "";

        const { error: profErr } = await (supabase as any)
          .from("profiles")
          .upsert(
            {
              id:         newUserId,
              email:      data.email,
              name:       data.name,
              phone:      data.mobile || null,
              state:      data.state  || null,
              city:       data.city   || null,
              location:   metaLocation || null,
              avatar_url: data.profileImageUrl || null,
            },
            { onConflict: "id" }
          );

        if (profErr) {
          // Non-fatal: trigger may have already inserted the row
          console.warn("[register] profile upsert warning:", profErr.message);
        } else {
          console.log("[register] profile row created for:", newUserId);
        }

        // Insert user_roles row as well
        const { error: roleErr } = await supabase
          .from("user_roles")
          .upsert({ user_id: newUserId, role: intendedRole }, { onConflict: "user_id" } as any);
        if (roleErr) console.warn("[register] user_roles upsert warning:", roleErr.message);

        // For farmers: insert the farmers row immediately with all registration data.
        // This prevents the dashboard from showing blank data and ensures crop listings work.
        if (intendedRole === "farmer") {
          const farmerLocation = data.state && data.city
            ? `${data.city}, ${data.state}`
            : data.state || data.city || "";

          const { error: farmerErr } = await (supabase as any)
            .from("farmers")
            .upsert(
              {
                user_id:           newUserId,
                farm_name:         data.farmName || `${data.name}'s Farm`,
                location:          farmerLocation,
                state:             data.state  || null,
                city:              data.city   || null,
                farm_size:         data.farmSize ? parseFloat(data.farmSize) : null,
                profile_image_url: data.profileImageUrl || null,
                government_id_url: data.governmentIdUrl || null,
                phone_number:      data.mobile || null,
                crop_types:        data.cropTypes || null,
                verified_status:   false,
              },
              { onConflict: "user_id" }
            );

          if (farmerErr) console.warn("[register] farmers upsert warning:", farmerErr.message);
          else console.log("[register] farmers row created for:", newUserId);
        }
      }

      return { error: null, needsVerification: true };
    },
    []
  );

  const logout = useCallback(async () => {
    // signOut() FIRST — clears the Supabase SDK's localStorage token so
    // no token refresh can write it back between our setState calls.
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRole(null);
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    });
    if (error) return { error: error.message };
    return { error: null };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        isLoggedIn: !!session,
        isLoading,
        role,
        login,
        register,
        logout,
        resetPassword,
        redirectPath,
        setRedirectPath,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
