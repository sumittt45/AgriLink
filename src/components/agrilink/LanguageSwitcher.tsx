import { useTranslation } from "react-i18next";
import { setLanguage } from "@/i18n";
import { Globe } from "lucide-react";

const LANGUAGES = [
  { code: "en", native: "English"   },
  { code: "hi", native: "हिंदी"    },
  { code: "bn", native: "বাংলা"    },
  { code: "mr", native: "मराठी"    },
  { code: "ta", native: "தமிழ்"    },
  { code: "te", native: "తెలుగు"   },
  { code: "kn", native: "ಕನ್ನಡ"    },
  { code: "ml", native: "മലയാളം"   },
  { code: "gu", native: "ગુજરાતી"  },
  { code: "pa", native: "ਪੰਜਾਬੀ"  },
];

interface Props {
  /** Compact mode: just shows the globe icon + current language code */
  compact?: boolean;
}

const LanguageSwitcher = ({ compact = false }: Props) => {
  const { i18n, t } = useTranslation();
  const currentLang = i18n.language;

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLanguage(e.target.value);
  };

  if (compact) {
    return (
      <label className="flex items-center gap-1.5 cursor-pointer">
        <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
        <select
          value={currentLang}
          onChange={handleChange}
          className="text-xs font-semibold bg-transparent text-foreground border-none outline-none cursor-pointer appearance-none pr-1"
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.native}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Globe className="w-4 h-4 text-primary" />
        <span className="text-sm font-bold text-foreground">{t("profile_language")}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {LANGUAGES.map((lang) => (
          <button
            key={lang.code}
            onClick={() => setLanguage(lang.code)}
            className={`py-2.5 px-3 rounded-xl text-xs font-semibold text-left transition-colors active:scale-95 ${
              currentLang === lang.code
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-foreground hover:bg-accent"
            }`}
          >
            {lang.native}
          </button>
        ))}
      </div>
    </div>
  );
};

export default LanguageSwitcher;
