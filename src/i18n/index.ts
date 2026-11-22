import { useEffect, useState } from 'react';
import en from './locales/en.json';

export type TranslationDictionary = typeof en;

export const SUPPORTED_LOCALES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'pt', label: 'Português' },
  { code: 'de', label: 'Deutsch' },
  { code: 'fr', label: 'Français' },
  { code: 'ja', label: '日本語' },
  { code: 'zh', label: '简体中文' },
  { code: 'ru', label: 'Русский' },
] as const;

export type LocaleCode = (typeof SUPPORTED_LOCALES)[number]['code'];

export const DEFAULT_LOCALE: LocaleCode = 'en';
export const LOCALE_STORAGE_KEY = 'movmp4_locale';
const LOCALE_CHANGE_EVENT = 'movmp4:locale-change';

const cache = new Map<LocaleCode, TranslationDictionary>([['en', en]]);

const loaders: Record<Exclude<LocaleCode, 'en'>, () => Promise<{ default: TranslationDictionary }>> = {
  es: () => import('./locales/es.json'),
  pt: () => import('./locales/pt.json'),
  de: () => import('./locales/de.json'),
  fr: () => import('./locales/fr.json'),
  ja: () => import('./locales/ja.json'),
  zh: () => import('./locales/zh.json'),
  ru: () => import('./locales/ru.json'),
};

export function isValidLocale(value: unknown): value is LocaleCode {
  return typeof value === 'string' && SUPPORTED_LOCALES.some((item) => item.code === value);
}

export function getSavedLocale(): LocaleCode {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  try {
    const saved = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isValidLocale(saved)) return saved;
  } catch {
    // Ignore storage access errors in private contexts.
  }
  return DEFAULT_LOCALE;
}

export function getCachedDictionary(locale: LocaleCode): TranslationDictionary {
  return cache.get(locale) ?? en;
}

export async function loadDictionary(locale: LocaleCode): Promise<TranslationDictionary> {
  const existing = cache.get(locale);
  if (existing) return existing;
  if (locale === 'en') return en;
  const loaded = await loaders[locale]();
  cache.set(locale, loaded.default);
  return loaded.default;
}

export function resolveTranslationKey(dict: TranslationDictionary, keyPath: string): string | null {
  const segments = keyPath.split('.');
  let current: unknown = dict;
  for (const segment of segments) {
    if (current && typeof current === 'object' && segment in current) {
      current = (current as Record<string, unknown>)[segment];
    } else {
      return null;
    }
  }
  return typeof current === 'string' ? current : null;
}

export function applyDomTranslations(dict: TranslationDictionary, locale: LocaleCode): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = locale;

  const textNodes = document.querySelectorAll<HTMLElement>('[data-i18n]');
  for (const el of textNodes) {
    const key = el.dataset.i18n;
    if (!key) continue;
    const translated = resolveTranslationKey(dict, key);
    if (translated !== null) {
      el.textContent = translated;
    }
  }

  const ariaNodes = document.querySelectorAll<HTMLElement>('[data-i18n-aria]');
  for (const el of ariaNodes) {
    const key = el.dataset.i18nAria;
    if (!key) continue;
    const translated = resolveTranslationKey(dict, key);
    if (translated !== null) {
      el.setAttribute('aria-label', translated);
    }
  }

  const titleKey = document.documentElement.dataset.i18nTitle;
  if (titleKey) {
    const titleVal = resolveTranslationKey(dict, titleKey);
    if (titleVal) document.title = titleVal;
  }

  const descKey = document.documentElement.dataset.i18nDesc;
  if (descKey) {
    const descVal = resolveTranslationKey(dict, descKey);
    const metaDesc = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (descVal && metaDesc) metaDesc.content = descVal;
  }
}

export async function setLocale(locale: LocaleCode): Promise<void> {
  if (typeof window === 'undefined') return;
  const dict = await loadDictionary(locale);
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Ignore storage errors.
  }
  applyDomTranslations(dict, locale);
  window.dispatchEvent(new CustomEvent<{ locale: LocaleCode; dict: TranslationDictionary }>(LOCALE_CHANGE_EVENT, {
    detail: { locale, dict },
  }));
}

export function useI18n(): { locale: LocaleCode; dict: TranslationDictionary } {
  const [state, setState] = useState<{ locale: LocaleCode; dict: TranslationDictionary }>(() => ({
    locale: DEFAULT_LOCALE,
    dict: en,
  }));

  useEffect(() => {
    let active = true;
    const saved = getSavedLocale();
    if (saved !== DEFAULT_LOCALE) {
      void loadDictionary(saved).then((dict) => {
        if (!active) return;
        applyDomTranslations(dict, saved);
        setState({ locale: saved, dict });
      });
    }

    const handleLocaleChange = (event: Event) => {
      const custom = event as CustomEvent<{ locale: LocaleCode; dict: TranslationDictionary }>;
      if (!custom.detail) return;
      setState({ locale: custom.detail.locale, dict: custom.detail.dict });
    };

    window.addEventListener(LOCALE_CHANGE_EVENT, handleLocaleChange);
    return () => {
      active = false;
      window.removeEventListener(LOCALE_CHANGE_EVENT, handleLocaleChange);
    };
  }, []);

  return state;
}

export { en as defaultDictionary };
