import type { TranslationDictionary } from './index';
import en from './locales/en.json';
import es from './locales/es.json';
import pt from './locales/pt.json';
import de from './locales/de.json';
import fr from './locales/fr.json';
import ja from './locales/ja.json';
import zh from './locales/zh.json';
import ru from './locales/ru.json';

export const _allDictionariesParityCheck: Record<string, TranslationDictionary> = {
  en,
  es,
  pt,
  de,
  fr,
  ja,
  zh,
  ru,
};
