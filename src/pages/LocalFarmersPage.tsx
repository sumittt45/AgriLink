import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, MapPin, Star, ShieldCheck, Wheat, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/agrilink/BottomNav";
import { useAppLocation } from "@/contexts/LocationContext";

interface LocalFarmer {
  id: string;
  farm_name: string;
  location: string;
  rating: number | null;
  total_orders: number | null;
  verified_status: boolean;
  bio: string | null;
  profile_image_url: string | null;
  active_listings: number;
}

const LocalFarmersPage = () => {
  const navigate = useNavigate();
  const { city, state } = useAppLocation();
  const [farmers, setFarmers] = useState<LocalFarmer[]>([]);
  const [loading, setLoading] = useState(true);
  const [locationLabel, setLocationLabel] = useState("Your Area");
  const [scope, setScope] = useState<"city" | "state" | "all">("all");

  useEffect(() => {
    const fetchFarmers = async () => {
      setLoading(true);

      let farmerRows: any[] | null = null;
      let resolvedScope: "city" | "state" | "all" = "all";

      // 1 — try city
      if (city) {
        const { data } = await (supabase as any)
          .from("farmers")
          .select("*")
          .eq("city", city)
          .order("rating", { ascending: false })
          .limit(20);
        if (data && data.length > 0) {
          farmerRows = data;
          resolvedScope = "city";
          setLocationLabel(city);
        }
      }

      // 2 — try state
      if (!farmerRows && state) {
        const { data } = await (supabase as any)
          .from("farmers")
          .select("*")
          .eq("state", state)
          .order("rating", { ascending: false })
          .limit(20);
        if (data && data.length > 0) {
          farmerRows = data;
          resolvedScope = "state";
          setLocationLabel(state);
        }
      }

      setScope(resolvedScope);

      if (!farmerRows || farmerRows.length === 0) {
        setFarmers([]);
        setLoading(false);
        return;
      }

      // Fetch active listing counts for all matched farmers
      const ids = farmerRows.map((f: any) => f.id);
      const { data: listingsData } = await supabase
        .from("crop_listings")
        .select("farmer_id")
        .in("farmer_id", ids)
        .eq("is_active", true)
        .gt("available_quantity", 0);

      const countMap: Record<string, number> = {};
      (listingsData || []).forEach((l: any) => {
        countMap[l.farmer_id] = (countMap[l.farmer_id] || 0) + 1;
      });

      const enriched: LocalFarmer[] = farmerRows.map((f: any) => ({
        id: f.id,
        farm_name: f.farm_name,
        location: f.location || "",
        rating: f.rating ?? null,
        total_orders: f.total_orders ?? null,
        verified_status: f.verified_status ?? false,
        bio: f.bio ?? null,
        profile_image_url: f.profile_image_url ?? null,
        active_listings: countMap[f.id] || 0,
      }));

      // Prefer farmers with active listings, but fall back to all
      const withListings = enriched.filter((f) => f.active_listings > 0);
      setFarmers(withListings.length > 0 ? withListings : enriched);
      setLoading(false);
    };

    fetchFarmers();
  }, [city, state]);

  const bannerGradient =
    scope === "city"  ? "from-agri-red to-agri-orange" :
    scope === "state" ? "from-primary to-primary/70"   :
    "from-agri-orange to-agri-yellow";

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-between px-4 py-3 max-w-lg mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 active:scale-90 transition-transform"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="text-base font-bold text-foreground">Local Farmer Picks</h1>
          <div className="w-8" />
        </div>
      </header>

      <div className="px-4 max-w-lg mx-auto py-4 space-y-4">
        {/* Location banner */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`bg-gradient-to-r ${bannerGradient} rounded-2xl p-5 text-white`}
        >
          <div className="flex items-center gap-2 mb-1">
            <MapPin className="w-4 h-4" />
            <p className="text-xs font-bold uppercase tracking-wider opacity-90">
              {scope === "city" ? "Near You" : scope === "state" ? "In Your State" : "Across India"}
            </p>
          </div>
          <h2 className="text-xl font-extrabold">Farmers in {locationLabel}</h2>
          <p className="text-xs opacity-80 mt-1">
            Top-rated farmers with active crop listings
          </p>
        </motion.div>

        {/* Loading skeletons */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-card border border-border rounded-2xl p-4 animate-pulse flex gap-3"
              >
                <div className="w-14 h-14 bg-muted rounded-full shrink-0" />
                <div className="flex-1 space-y-2 pt-1">
                  <div className="h-4 w-32 bg-muted rounded" />
                  <div className="h-3 w-24 bg-muted rounded" />
                  <div className="h-3 w-20 bg-muted rounded" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && farmers.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-5xl mb-4">🌾</div>
            <h3 className="text-base font-bold text-foreground mb-1">No farmers available in your area</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Try changing your location
            </p>
            <button
              onClick={() => navigate("/onboarding/location")}
              className="bg-primary text-primary-foreground text-sm font-bold px-6 py-2.5 rounded-xl active:scale-95 transition-transform"
            >
              Change Location
            </button>
          </div>
        )}

        {/* Farmers list */}
        {!loading && farmers.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {farmers.length} farmer{farmers.length !== 1 ? "s" : ""} found in {locationLabel}
            </p>

            {farmers.map((farmer, i) => (
              <motion.div
                key={farmer.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => navigate(`/farm-profile?id=${farmer.id}`)}
                className="bg-card border border-border rounded-2xl p-4 shadow-sm cursor-pointer active:scale-[0.98] transition-transform"
              >
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center text-2xl overflow-hidden shrink-0 ring-2 ring-border">
                    {farmer.profile_image_url ? (
                      <img
                        src={farmer.profile_image_url}
                        alt={farmer.farm_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      "👨‍🌾"
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <p className="text-sm font-bold text-foreground truncate">
                        {farmer.farm_name}
                      </p>
                      {farmer.verified_status && (
                        <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0" />
                      )}
                    </div>

                    {farmer.location && (
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-muted-foreground" />
                        <span className="text-[11px] text-muted-foreground truncate">
                          {farmer.location}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      {farmer.rating !== null && farmer.rating > 0 && (
                        <div className="flex items-center gap-0.5">
                          <Star className="w-3 h-3 text-secondary fill-secondary" />
                          <span className="text-[11px] font-semibold text-foreground">
                            {farmer.rating}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-0.5">
                        <Wheat className="w-3 h-3 text-primary" />
                        <span className="text-[11px] text-muted-foreground">
                          {farmer.active_listings}{" "}
                          {farmer.active_listings === 1 ? "crop" : "crops"}
                        </span>
                      </div>
                      {farmer.total_orders !== null && farmer.total_orders > 0 && (
                        <span className="text-[11px] text-muted-foreground">
                          {farmer.total_orders} orders
                        </span>
                      )}
                    </div>
                  </div>

                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </div>

                {farmer.bio && (
                  <p className="text-[11px] text-muted-foreground mt-2 line-clamp-1 pl-[68px]">
                    {farmer.bio}
                  </p>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default LocalFarmersPage;
