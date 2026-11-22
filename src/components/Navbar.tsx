import { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  Briefcase,
  Coffee,
  ExternalLink,
  Globe,
  Home,
  Menu,
  Moon,
  Sun,
  X,
} from 'lucide-react';
import {
  SUPPORTED_LOCALES,
  setLocale,
  useI18n,
  type LocaleCode,
} from '../i18n';
import { applyTheme, getTheme, subscribeTheme, type ThemeMode } from '../lib/theme';

const SUPPORT_URL = 'https://kisharadilshan.gumroad.com/coffee';

interface NavbarProps {
  currentPath?: string;
}

function BrandMark() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      fill="none"
      className="h-8 w-8 shrink-0"
      aria-hidden="true"
    >
      <rect width="64" height="64" rx="16" fill="#967E76" />
      <rect x="6" y="6" width="52" height="52" rx="12" stroke="#EEE3CB" strokeOpacity="0.4" strokeWidth="2" />
      <rect x="12" y="18" width="22" height="28" rx="4" fill="#EEE3CB" />
      <path d="M19 26.5L28 32L19 37.5V26.5Z" fill="#231F1E" />
      <path
        d="M36 32H49M49 32L43.5 26.5M49 32L43.5 37.5"
        stroke="#B7C4CF"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-5 w-5 shrink-0"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

export default function Navbar({ currentPath = '/' }: NavbarProps) {
  const { locale, dict } = useI18n();
  const [theme, setTheme] = useState<ThemeMode>('light');
  const [menuOpen, setMenuOpen] = useState(false);

  const navContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setTheme(getTheme());
    return subscribeTheme(setTheme);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (navContainerRef.current && !navContainerRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  const normalizedPath = currentPath !== '/' && currentPath.endsWith('/') ? currentPath.slice(0, -1) : currentPath;
  const isHome = normalizedPath === '/' || normalizedPath === '/index.html';
  const isHowTo = normalizedPath === '/how-to-use';
  const isHireMe = normalizedPath === '/hire-me';

  const handleLanguageChange = (nextLocale: string) => {
    void setLocale(nextLocale as LocaleCode);
  };

  return (
    <header
      className="sticky top-0 z-40 border-b backdrop-blur-md transition-colors"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--bg-card) 88%, transparent)',
          borderColor: 'var(--border-main)',
        }}
      >
        <nav
          ref={navContainerRef}
          aria-label="Primary Navigation"
          className="relative mx-auto flex h-16 max-w-6xl items-center justify-between px-3 sm:px-6"
        >
          {/* Desktop Navigation (lg+): Main Nav Items + Single Utility Toggle Icon */}
          <div className="hidden lg:flex w-full items-center justify-between gap-4">
            <a
              href="/"
              aria-label={dict.nav.homeAria}
              className="flex items-center gap-3 font-bold tracking-tight text-lg transition-opacity hover:opacity-85"
              style={{ color: 'var(--text-primary)' }}
            >
              <BrandMark />
              <span>{dict.nav.brand}</span>
            </a>

            <div className="flex items-center gap-2">
              <a
                href="/how-to-use"
                className={`inline-flex h-10 items-center rounded-xl px-3.5 text-sm font-semibold transition-colors ${
                  isHowTo ? 'underline decoration-2 underline-offset-4' : 'hover:opacity-80'
                }`}
                style={{
                  color: 'var(--text-primary)',
                  backgroundColor: isHowTo ? 'var(--bg-subtle)' : 'transparent',
                }}
              >
                {dict.nav.howToUse}
              </a>

              <a
                href="/hire-me"
                className={`inline-flex h-10 items-center rounded-xl px-3.5 text-sm font-semibold transition-colors ${
                  isHireMe ? 'underline decoration-2 underline-offset-4' : 'hover:opacity-80'
                }`}
                style={{
                  color: 'var(--text-primary)',
                  backgroundColor: isHireMe ? 'var(--bg-subtle)' : 'transparent',
                }}
              >
                {dict.nav.hireMe}
              </a>

              <a
                href={SUPPORT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold shadow-xs transition-all hover:opacity-90"
                style={{
                  backgroundColor: 'var(--action-primary)',
                  color: 'var(--action-primary-text)',
                }}
              >
                <Coffee className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{dict.nav.support}</span>
              </a>

              <button
                type="button"
                onClick={() => setMenuOpen((prev) => !prev)}
                aria-label={dict.nav.menuAria}
                aria-expanded={menuOpen}
                aria-haspopup="true"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border transition-colors hover:opacity-85 cursor-pointer"
                style={{
                  borderColor: menuOpen ? 'var(--accent-taupe)' : 'var(--border-main)',
                  backgroundColor: menuOpen ? 'var(--accent-mist)' : 'var(--bg-subtle)',
                  color: menuOpen ? '#231F1E' : 'var(--text-primary)',
                }}
              >
                {menuOpen ? (
                  <X className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <Menu className="h-5 w-5" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          {/* Mobile & Tablet Ultra-Minimal Icons-Only Navbar (< lg): Main Icons + Single Toggle Icon */}
          <div className="flex lg:hidden w-full items-center justify-between gap-2">
            <a
              href="/"
              aria-label={dict.nav.homeAria}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors"
              style={{
                borderColor: isHome ? 'var(--accent-taupe)' : 'var(--border-main)',
                backgroundColor: isHome ? 'var(--accent-mist)' : 'var(--bg-subtle)',
                color: isHome ? '#231F1E' : 'var(--text-primary)',
              }}
            >
              <Home className="h-5 w-5" aria-hidden="true" />
            </a>

            <div className="flex items-center gap-2">
              <a
                href="/how-to-use"
                aria-label={dict.nav.howToUse}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors"
                style={{
                  borderColor: isHowTo ? 'var(--accent-taupe)' : 'var(--border-main)',
                  backgroundColor: isHowTo ? 'var(--accent-mist)' : 'var(--bg-subtle)',
                  color: isHowTo ? '#231F1E' : 'var(--text-primary)',
                }}
              >
                <BookOpen className="h-5 w-5" aria-hidden="true" />
              </a>

              <a
                href="/hire-me"
                aria-label={dict.nav.hireMe}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors"
                style={{
                  borderColor: isHireMe ? 'var(--accent-taupe)' : 'var(--border-main)',
                  backgroundColor: isHireMe ? 'var(--accent-mist)' : 'var(--bg-subtle)',
                  color: isHireMe ? '#231F1E' : 'var(--text-primary)',
                }}
              >
                <Briefcase className="h-5 w-5" aria-hidden="true" />
              </a>

              <a
                href={SUPPORT_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={dict.nav.support}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-opacity hover:opacity-90"
                style={{
                  backgroundColor: 'var(--action-primary)',
                  color: 'var(--action-primary-text)',
                }}
              >
                <Coffee className="h-5 w-5" aria-hidden="true" />
              </a>

              <button
                type="button"
                onClick={() => setMenuOpen((prev) => !prev)}
                aria-label={dict.nav.menuAria}
                aria-expanded={menuOpen}
                aria-haspopup="true"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors cursor-pointer"
                style={{
                  borderColor: menuOpen ? 'var(--accent-taupe)' : 'var(--border-main)',
                  backgroundColor: menuOpen ? 'var(--accent-mist)' : 'var(--bg-subtle)',
                  color: menuOpen ? '#231F1E' : 'var(--text-primary)',
                }}
              >
                {menuOpen ? (
                  <X className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <Menu className="h-5 w-5" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          {/* Toggle Menu Popover (Theme, 8-Language Selector, GitHub Link) */}
          {menuOpen && (
            <div
              role="region"
              aria-label={dict.nav.settingsTitle}
              className="absolute right-3 sm:right-6 top-[calc(100%+0.5rem)] w-72 rounded-2xl border p-4 shadow-xl space-y-4 z-50"
              style={{
                backgroundColor: 'var(--bg-card)',
                borderColor: 'var(--border-main)',
                color: 'var(--text-primary)',
              }}
            >
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                {dict.nav.settingsTitle}
              </p>

              {/* Theme Selector */}
              <div className="space-y-1.5">
                <span className="block text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                  {dict.nav.themeLabel}
                </span>
                <div
                  className="grid grid-cols-2 gap-1.5 rounded-xl border p-1"
                  style={{
                    backgroundColor: 'var(--bg-subtle)',
                    borderColor: 'var(--border-main)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => applyTheme('light')}
                    aria-label={dict.nav.switchToLight}
                    aria-pressed={theme === 'light'}
                    className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors cursor-pointer"
                    style={{
                      backgroundColor: theme === 'light' ? 'var(--bg-card)' : 'transparent',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <Sun className="h-4 w-4" aria-hidden="true" />
                    <span>{dict.nav.lightLabel}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyTheme('dark')}
                    aria-label={dict.nav.switchToDark}
                    aria-pressed={theme === 'dark'}
                    className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors cursor-pointer"
                    style={{
                      backgroundColor: theme === 'dark' ? 'var(--accent-mist)' : 'transparent',
                      color: theme === 'dark' ? '#1E2226' : 'var(--text-primary)',
                    }}
                  >
                    <Moon className="h-4 w-4" aria-hidden="true" />
                    <span>{dict.nav.darkLabel}</span>
                  </button>
                </div>
              </div>

              {/* Language Selector */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                  {dict.nav.languageLabel}
                  <div className="relative mt-1.5 flex items-center">
                    <Globe
                      className="pointer-events-none absolute left-3 h-4 w-4"
                      style={{ color: 'var(--text-muted)' }}
                      aria-hidden="true"
                    />
                    <select
                      aria-label={dict.nav.languageAria}
                      value={locale}
                      onChange={(event) => handleLanguageChange(event.target.value)}
                      className="w-full min-h-[44px] appearance-none rounded-xl border pl-9 pr-8 text-sm font-semibold outline-none cursor-pointer"
                      style={{
                        borderColor: 'var(--border-main)',
                        backgroundColor: 'var(--bg-subtle)',
                        color: 'var(--text-primary)',
                      }}
                    >
                      {SUPPORTED_LOCALES.map((item) => (
                        <option key={item.code} value={item.code}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </label>
              </div>

              {/* GitHub Repository */}
              <a
                href="https://github.com/Kishara007/movmp4"
                target="_blank"
                rel="noopener noreferrer"
                aria-label={dict.nav.githubAria}
                onClick={() => setMenuOpen(false)}
                className="flex min-h-[44px] items-center justify-between rounded-xl border px-3.5 py-2 text-sm font-semibold transition-opacity hover:opacity-85"
                style={{
                  borderColor: 'var(--border-main)',
                  backgroundColor: 'var(--bg-subtle)',
                  color: 'var(--text-primary)',
                }}
              >
                <span className="flex items-center gap-2.5">
                  <GithubIcon />
                  <span>{dict.nav.githubLabel}</span>
                </span>
                <ExternalLink className="h-4 w-4 opacity-70" aria-hidden="true" />
              </a>
            </div>
          )}
        </nav>
      </header>
  );
}
