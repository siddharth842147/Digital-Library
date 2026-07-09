import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
  en: {
    translation: {
      "Dashboard": "Dashboard",
      "Library": "Library",
      "Resources": "Resources",
      "My Books": "My Books",
      "Payment History": "Payment History",
      "Login": "Login",
      "Register": "Register",
      "Logout": "Logout",
      "Language": "Language",
      "Welcome": "Welcome",
    }
  },
  hi: {
    translation: {
      "Dashboard": "डैशबोर्ड",
      "Library": "पुस्तकालय",
      "Resources": "संसाधन",
      "My Books": "मेरी किताबें",
      "Payment History": "भुगतान इतिहास",
      "Login": "लॉग इन",
      "Register": "पंजीकरण",
      "Logout": "लॉग आउट",
      "Language": "भाषा",
      "Welcome": "स्वागत है",
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false 
    }
  });

export default i18n;
