import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import HttpBackend from "i18next-http-backend";

const SUPPORTED_LANGS = ["en", "hi", "bn", "mr", "ta", "te", "kn", "ml", "gu", "pa"];

// Read from "language" (new canonical key) or legacy "lang" key. Fallback to "en".
const savedLang =
  localStorage.getItem("language") ||
  localStorage.getItem("lang") ||
  "en";

i18n
  .use(HttpBackend)           // lazy-loads only the active language's JSON
  .use(initReactI18next)
  .init({
    lng: SUPPORTED_LANGS.includes(savedLang) ? savedLang : "en",
    fallbackLng: "en",
    supportedLngs: SUPPORTED_LANGS,

    backend: {
      // Vite serves /public/** at the root, so this resolves correctly in
      // both dev (vite dev server) and prod (static hosting).
      loadPath: "/locales/{{lng}}/translation.json",
    },

    interpolation: {
      escapeValue: false, // React already escapes values
    },

    react: {
      useSuspense: false, // prevent Suspense-throwing on language change (avoids full app remount)
    },
  });

export default i18n;

/** Change the active language and persist the choice. */
export const setLanguage = (lang: string) => {
  localStorage.setItem("language", lang); // canonical key used by onboarding guard
  localStorage.setItem("lang", lang);     // legacy key kept for i18n init on next load
  i18n.changeLanguage(lang);
};
