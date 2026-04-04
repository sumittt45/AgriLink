import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, MapPin, ChevronLeft, Check } from "lucide-react";
import { INDIA_LOCATIONS, INDIA_STATES } from "@/lib/india-locations";
import { useAppLocation } from "@/contexts/LocationContext";

interface Props {
  open: boolean;
  onClose: () => void;
}

const LocationModal = ({ open, onClose }: Props) => {
  const { state: savedState, city: savedCity, setLocation } = useAppLocation();

  const [step, setStep]               = useState<"state" | "city">("state");
  const [selectedState, setSelectedState] = useState(savedState);
  const [selectedCity, setSelectedCity]   = useState(savedCity);
  const [stateSearch, setStateSearch]     = useState("");

  // Reset to saved values each time modal opens
  useEffect(() => {
    if (open) {
      setSelectedState(savedState);
      setSelectedCity(savedCity);
      setStep(savedState ? "city" : "state");
      setStateSearch("");
    }
  }, [open, savedState, savedCity]);

  const filteredStates = INDIA_STATES.filter(s =>
    s.toLowerCase().includes(stateSearch.toLowerCase())
  );
  const cities = selectedState ? (INDIA_LOCATIONS[selectedState] ?? []) : [];

  const handleStateSelect = (s: string) => {
    setSelectedState(s);
    setSelectedCity("");
    setStep("city");
    setStateSearch("");
  };

  const handleSave = () => {
    setLocation(selectedState, selectedCity);
    onClose();
  };

  const handleSkip = () => {
    setLocation("", "");
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Bottom sheet */}
          <motion.div
            key="sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-[70] bg-background rounded-t-3xl shadow-2xl max-h-[85vh] flex flex-col"
          >
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 bg-muted-foreground/20 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center">
                  <MapPin className="w-4 h-4 text-primary" />
                </div>
                <h2 className="text-base font-bold text-foreground">
                  {step === "state" ? "Select State" : "Select City"}
                </h2>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center active:scale-90 transition-transform"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-hidden flex flex-col px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
              <AnimatePresence mode="wait">

                {/* ── State step ── */}
                {step === "state" && (
                  <motion.div
                    key="state"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="flex flex-col flex-1 overflow-hidden"
                  >
                    {/* Search */}
                    <input
                      type="text"
                      value={stateSearch}
                      onChange={e => setStateSearch(e.target.value)}
                      placeholder="Search state…"
                      className="w-full px-4 py-2.5 mb-3 rounded-xl border border-border bg-muted text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 shrink-0"
                    />
                    <div className="overflow-y-auto flex-1 space-y-1.5 pr-1">
                      {filteredStates.map(s => (
                        <button
                          key={s}
                          onClick={() => handleStateSelect(s)}
                          className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all active:scale-[0.98] ${
                            s === selectedState
                              ? "border-primary bg-primary/10 text-primary font-bold"
                              : "border-border bg-card hover:border-primary/50 text-foreground"
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={handleSkip}
                      className="mt-3 text-xs text-muted-foreground underline underline-offset-2 shrink-0"
                    >
                      Clear location
                    </button>
                  </motion.div>
                )}

                {/* ── City step ── */}
                {step === "city" && (
                  <motion.div
                    key="city"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.2 }}
                    className="flex flex-col flex-1 overflow-hidden"
                  >
                    {/* Back */}
                    <button
                      onClick={() => setStep("state")}
                      className="flex items-center gap-1 text-xs text-primary font-semibold mb-3 shrink-0"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" /> {selectedState}
                    </button>

                    <div className="overflow-y-auto flex-1 space-y-1.5 pr-1">
                      {cities.map(c => (
                        <button
                          key={c}
                          onClick={() => setSelectedCity(c)}
                          className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all active:scale-[0.98] flex items-center justify-between ${
                            c === selectedCity
                              ? "border-primary bg-primary/10 text-primary font-bold"
                              : "border-border bg-card hover:border-primary/50 text-foreground"
                          }`}
                        >
                          <span>{c}</span>
                          {c === selectedCity && <Check className="w-4 h-4 shrink-0" />}
                        </button>
                      ))}
                    </div>

                    {/* Save button */}
                    <button
                      onClick={handleSave}
                      disabled={!selectedCity}
                      className="w-full mt-4 bg-primary text-primary-foreground font-bold text-sm py-3.5 rounded-2xl shadow-agri disabled:opacity-40 active:scale-[0.98] transition-all shrink-0 flex items-center justify-center gap-2"
                    >
                      <MapPin className="w-4 h-4" />
                      Set {selectedCity || "Location"}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default LocationModal;
