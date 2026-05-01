import { useSettings } from '../settings/SettingsContext';
import { translations, detectLanguage, type Language, type Strings } from './translations';

export type { Language, Strings };
export { translations, detectLanguage };

export function useI18n(): { t: Strings; lang: Language } {
  const { settings } = useSettings();
  const lang: Language = (settings.language as Language) || detectLanguage();
  const t = translations[lang] ?? translations['en'];
  return { t, lang };
}
