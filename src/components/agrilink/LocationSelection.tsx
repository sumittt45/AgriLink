import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin } from "lucide-react";
import { INDIA_LOCATIONS, INDIA_STATES } from "@/lib/india-locations";
import { useAppLocation } from "@/contexts/LocationContext";

interface Props {
  onSelect: () => void;
}

const LocationSelection = ({ onSelect }: Props) => {
  const { setLocation } = useAppLocation();
  const [step, setStep] = useState<"state" | "city">("state");
  const [selectedState, setSelectedState] = useState("");
  const [selectedCity, setSelectedCity] = useState("");

  const states = INDIA_STATES;
  const cities = selectedState ? INDIA_LOCATIONS[selectedState] : [];

  const handleStateSelect = (state: string) => {
    setSelectedState(state);
    setSelectedCity("");
    setStep("city");
  };

  const handleContinue = () => {
    setLocation(selectedState, selectedCity);
    onSelect();
  };

  const handleSkip = () => {
    // Store empty strings so the onboarding guard knows this step was seen
    setLocation("", "");
    onSelect();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5">
      {/* Icon + title */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="text-center mb-6"
      >
        <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-agri">
          <MapPin className="w-8 h-8 text-primary-foreground" />
        </div>
        <h1 className="text-xl font-extrabold text-foreground">Select Your Location</h1>
        <p className="text-sm text-muted-foreground mt-1">
          We'll show you local farmers near you
        </p>
      </motion.div>

      {/* Step dots */}
      <div className="flex gap-2 mb-6">
        <div className={`h-1.5 w-12 rounded-full transition-colors ${step === "state" ? "bg-primary" : "bg-primary/40"}`} />
        <div className={`h-1.5 w-12 rounded-full transition-colors ${step === "city" ? "bg-primary" : "bg-muted"}`} />
      </div>

      <div className="w-full max-w-sm">
        <AnimatePresence mode="wait">
          {step === "state" && (
            <motion.div
              key="state-step"
              initial={{ opacity: 0, x: -25 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -25 }}
              transition={{ duration: 0.3 }}
            >
              <p className="text-sm font-bold text-foreground mb-3">Select State</p>
              <div className="h-64 overflow-y-auto space-y-1.5 pr-1 rounded-xl">
                {states.map((state) => (
                  <button
                    key={state}
                    onClick={() => handleStateSelect(state)}
                    className="w-full text-left px-4 py-3 rounded-xl border border-border bg-card hover:border-primary hover:bg-primary/5 active:scale-[0.98] transition-all text-sm font-medium text-foreground"
                  >
                    {state}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {step === "city" && (
            <motion.div
              key="city-step"
              initial={{ opacity: 0, x: 25 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 25 }}
              transition={{ duration: 0.3 }}
            >
              <button
                onClick={() => setStep("state")}
                className="flex items-center gap-1 text-xs text-primary mb-2 font-semibold"
              >
                ← {selectedState}
              </button>
              <p className="text-sm font-bold text-foreground mb-3">Select City</p>
              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {cities.map((city) => (
                  <button
                    key={city}
                    onClick={() => setSelectedCity(city)}
                    className={`w-full text-left px-4 py-3 rounded-xl border transition-all active:scale-[0.98] text-sm font-medium ${
                      selectedCity === city
                        ? "border-primary bg-primary/10 text-primary font-bold"
                        : "border-border bg-card hover:border-primary/50 text-foreground"
                    }`}
                  >
                    {city}
                  </button>
                ))}
              </div>
              <button
                onClick={handleContinue}
                disabled={!selectedCity}
                className="w-full mt-5 bg-primary text-primary-foreground font-bold text-base py-4 rounded-2xl shadow-agri disabled:opacity-40 active:scale-[0.98] transition-all"
              >
                Continue →
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <button
        onClick={handleSkip}
        className="mt-5 text-xs text-muted-foreground underline underline-offset-2"
      >
        Skip for now
      </button>
    </div>
  );
};

export default LocationSelection;
