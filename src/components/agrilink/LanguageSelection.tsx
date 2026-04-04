import { useState } from "react";
import { motion } from "framer-motion";
import { setLanguage } from "@/i18n";

interface Props {
  onSelect: () => void;
}

const LANGUAGES = [
  { code: "en", label: "English",    native: "English"    },
  { code: "hi", label: "Hindi",      native: "हिंदी"      },
  { code: "bn", label: "Bengali",    native: "বাংলা"      },
  { code: "mr", label: "Marathi",    native: "मराठी"      },
  { code: "ta", label: "Tamil",      native: "தமிழ்"      },
  { code: "te", label: "Telugu",     native: "తెలుగు"     },
  { code: "kn", label: "Kannada",    native: "ಕನ್ನಡ"      },
  { code: "ml", label: "Malayalam",  native: "മലയാളം"     },
  { code: "gu", label: "Gujarati",   native: "ગુજરાતી"    },
  { code: "pa", label: "Punjabi",    native: "ਪੰਜਾਬੀ"    },
];

const LanguageSelection = ({ onSelect }: Props) => {
  const [selected, setSelected] = useState("en");

  const handleContinue = () => {
    setLanguage(selected);
    onSelect();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5">
      {/* Logo / brand */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-8"
      >
        <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-agri">
          <span className="text-3xl">🌾</span>
        </div>
        <h1 className="text-2xl font-extrabold text-foreground">AgriLink</h1>
        <p className="text-sm text-muted-foreground mt-1">Fair for Farmers, Fresh for You.</p>
      </motion.div>

      {/* Prompt */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
        className="text-center mb-6"
      >
        <h2 className="text-lg font-bold text-foreground">Select Your Language</h2>
        <p className="text-sm text-muted-foreground mt-1">
          अपनी भाषा चुनें • ভাষা বেছে নিন • ভাষা বেছে নিন
        </p>
      </motion.div>

      {/* Language grid */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.4 }}
        className="w-full max-w-sm grid grid-cols-2 gap-3 mb-8"
      >
        {LANGUAGES.map((lang) => {
          const isSelected = selected === lang.code;
          return (
            <button
              key={lang.code}
              onClick={() => setSelected(lang.code)}
              className={`relative flex flex-col items-center justify-center py-4 px-3 rounded-2xl border-2 transition-all active:scale-95 ${
                isSelected
                  ? "border-primary bg-primary/10 shadow-agri"
                  : "border-border bg-card hover:border-primary/40"
              }`}
            >
              {isSelected && (
                <motion.div
                  layoutId="lang-check"
                  className="absolute top-2 right-2 w-4 h-4 rounded-full bg-primary flex items-center justify-center"
                >
                  <svg className="w-2.5 h-2.5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </motion.div>
              )}
              <span className="text-xl font-bold text-foreground leading-tight">
                {lang.native}
              </span>
              <span className="text-[10px] text-muted-foreground mt-0.5">{lang.label}</span>
            </button>
          );
        })}
      </motion.div>

      {/* Continue button */}
      <motion.button
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.4 }}
        whileTap={{ scale: 0.97 }}
        onClick={handleContinue}
        className="w-full max-w-sm bg-primary text-primary-foreground font-bold text-base py-4 rounded-2xl shadow-agri-lg"
      >
        Continue →
      </motion.button>
    </div>
  );
};

export default LanguageSelection;
