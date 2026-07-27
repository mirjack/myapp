import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import { getStoredLanguageCode, setStoredLanguageCode } from "@/lib/app-preferences";
import {
  DEFAULT_LANGUAGE_CODE,
  detectDeviceLanguageCode,
  normalizeLanguageCode,
} from "@/lib/language";
import en from "@/lib/locales/en.json";
import ru from "@/lib/locales/ru.json";
import uz from "@/lib/locales/uz.json";

const resources = {
  en: { translation: en },
  ru: { translation: ru },
  uz: { translation: uz },
};

const initialLanguageCode = detectDeviceLanguageCode();

i18n.use(initReactI18next).init({
  compatibilityJSON: "v4",
  fallbackLng: DEFAULT_LANGUAGE_CODE,
  interpolation: {
    escapeValue: false,
  },
  lng: initialLanguageCode,
  resources,
});

getStoredLanguageCode()
  .then((languageCode) => {
    const nextLanguageCode = normalizeLanguageCode(languageCode);
    if (i18n.language !== nextLanguageCode) {
      i18n.changeLanguage(nextLanguageCode).catch(() => {});
    }
  })
  .catch(() => {});

export async function applyAppLanguage(code) {
  const nextLanguageCode = normalizeLanguageCode(code);
  await setStoredLanguageCode(nextLanguageCode);
  if (i18n.language !== nextLanguageCode) {
    await i18n.changeLanguage(nextLanguageCode);
  }
  return nextLanguageCode;
}

export default i18n;
