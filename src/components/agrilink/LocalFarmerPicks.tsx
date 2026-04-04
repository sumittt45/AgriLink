import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { MapPin, Star, ShieldCheck, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { useAppLocation } from "@/contexts/LocationContext";

interface LocalFarmer {
  id: string;
  farmName: string;
  location: string;
  city: string | null;
  rating: number | null;
  verified: boolean;
  crops: string[];
  cropEmojis: string[];
}

function mapFarmers(data: any[]): LocalFarmer[] {
  return data.map((f) => {
    const listings: any[] = f.crop_listings || [];
    const crops: string[] = [];
    const cropEmojis: string[] = [];
    listings.forEach((l) => {
      const crop = l.crops;
      if (crop && !crops.includes(crop.name)) {
        crops.push(crop.name);
        cropEmojis.push(crop.emoji || "🌾");
      }
    });
    return {
      id: f.id,
      farmName: f.farm_name,
      location: f.location || "",
      city: f.city || null,
      rating: f.rating ?? null,
      verified: f.verified_status ?? false,
      crops,
      cropEmojis,
    };
  });
}

const LocalFarmerPicks = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { city: userCity, state: userState } = useAppLocation();
  const [farmers, setFarmers] = useState<LocalFarmer[]>([]);
  const [scopeLabel, setScopeLabel] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {

    const fetchFarmers = async () => {
      setLoading(true);

      const select =
        "id, farm_name, location, state, city, rating, verified_status, crop_listings(crops(name, emoji))";

      try {
        // Step 1: Same city
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (userCity) {
          const { data, error } = await (supabase as any)
            .from("farmers")
            .select(select)
            .eq("city", userCity)
            .limit(2);
          if (error) console.error("[LocalFarmerPicks] city fetch:", error.message);
          if (data && data.length > 0) {
            setScopeLabel(t("loc_farmers_in_city", { city: userCity }));
            setFarmers(mapFarmers(data));
            return; // finally still runs → setLoading(false)
          }
        }

        // Step 2: Same state
        if (userState) {
          const { data, error } = await (supabase as any)
            .from("farmers")
            .select(select)
            .eq("state", userState)
            .limit(2);
          if (error) console.error("[LocalFarmerPicks] state fetch:", error.message);
          if (data && data.length > 0) {
            setScopeLabel(t("loc_farmers_in_state", { state: userState }));
            setFarmers(mapFarmers(data));
            return; // finally still runs → setLoading(false)
          }
        }

        // Step 3: All farmers
        const { data, error } = await (supabase as any)
          .from("farmers")
          .select(select)
          .limit(2);
        if (error) console.error("[LocalFarmerPicks] all-farmers fetch:", error.message);
        console.log("[LocalFarmerPicks] loaded", data?.length ?? 0, "farmers");
        setScopeLabel(t("loc_all_farmers"));
        setFarmers(mapFarmers(data || []));
      } catch (err) {
        console.error("[LocalFarmerPicks] unexpected error:", err);
        setFarmers([]);
      } finally {
        setLoading(false);
      }
    };

    fetchFarmers();
  }, [t, userCity, userState]);

  if (!loading && farmers.length === 0) return null;

  return (
    <div className="py-5 max-w-lg mx-auto px-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-base font-bold text-foreground">
            {t("local_farmer_picks")}
          </h2>
          {scopeLabel && (
            <p className="text-[11px] text-primary font-semibold mt-0.5">
              📍 {scopeLabel}
            </p>
          )}
        </div>
        <button
          onClick={() => navigate("/local-farmers")}
          className="text-xs font-semibold text-primary"
        >
          {t("see_all")}
        </button>
      </div>

      {/* Skeleton */}
      {loading && (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="bg-card border border-border rounded-2xl p-4 animate-pulse"
            >
              <div className="flex gap-3">
                <div className="w-14 h-14 bg-muted rounded-xl shrink-0" />
                <div className="flex-1 space-y-2 pt-1">
                  <div className="h-4 w-28 bg-muted rounded" />
                  <div className="h-3 w-40 bg-muted rounded" />
                  <div className="flex gap-1.5 mt-1">
                    {[1, 2, 3].map((j) => (
                      <div key={j} className="w-7 h-7 bg-muted rounded-lg" />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Farmer cards */}
      {!loading && farmers.length > 0 && (
        <div className="space-y-3">
          {farmers.map((farmer, i) => (
            <motion.div
              key={farmer.id}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.4 }}
              onClick={() =>
                navigate(`/farm-profile?id=${farmer.id}`)
              }
              className="bg-card border border-border rounded-2xl p-4 shadow-agri hover:shadow-card-hover transition-all cursor-pointer"
            >
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center text-2xl shrink-0">
                  👨‍🌾
                </div>

                <div className="flex-1 min-w-0">
                  {/* Name + verified */}
                  <div className="flex items-center gap-2 flex-wrap pr-4">
                    <h3 className="text-sm font-bold text-foreground">
                      {farmer.farmName}
                    </h3>
                    {farmer.verified && (
                      <div className="flex items-center gap-0.5 text-primary">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-semibold">Verified</span>
                      </div>
                    )}
                  </div>

                  {/* Location + rating */}
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <div className="flex items-center gap-0.5">
                      <MapPin className="w-3 h-3 text-primary shrink-0" />
                      <span className="text-xs text-muted-foreground">
                        {farmer.city || farmer.location}
                      </span>
                    </div>
                    {farmer.rating !== null && (
                      <div className="flex items-center gap-0.5">
                        <Star className="w-3 h-3 text-secondary fill-secondary" />
                        <span className="text-xs font-semibold text-foreground">
                          {farmer.rating}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Crop emoji badges */}
                  {farmer.cropEmojis.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      {farmer.cropEmojis.slice(0, 5).map((emoji, j) => (
                        <span
                          key={j}
                          title={farmer.crops[j]}
                          className="w-7 h-7 bg-accent rounded-lg flex items-center justify-center text-sm"
                        >
                          {emoji}
                        </span>
                      ))}
                      {farmer.crops.length > 5 && (
                        <span className="text-[10px] text-muted-foreground font-semibold">
                          +{farmer.crops.length - 5} more
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <ArrowRight className="w-4 h-4 text-muted-foreground mt-1 shrink-0" />
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LocalFarmerPicks;
