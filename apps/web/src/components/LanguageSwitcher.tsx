import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { normalizeLanguage, supportedLanguages, type SupportedLanguage } from '../i18n/constants';

const languageOptions: Array<{
  code: SupportedLanguage;
  flag: string;
  shortCode: string;
}> = [
  { code: 'tr', flag: '🇹🇷', shortCode: 'TR' },
  { code: 'en', flag: '🇬🇧', shortCode: 'EN' },
  { code: 'nl', flag: '🇳🇱', shortCode: 'NL' },
  { code: 'de', flag: '🇩🇪', shortCode: 'DE' },
  { code: 'ar', flag: '🇸🇦', shortCode: 'AR' },
];

type LanguageSwitcherProps = {
  mobile?: boolean;
};

export default function LanguageSwitcher({ mobile = false }: LanguageSwitcherProps) {
  const { t, i18n } = useTranslation('common');
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const currentLanguage = normalizeLanguage(i18n.resolvedLanguage || i18n.language);
  const currentOption =
    languageOptions.find((option) => option.code === currentLanguage) || languageOptions[0];

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const changeLanguage = (language: SupportedLanguage) => {
    i18n.changeLanguage(language);
    setOpen(false);
  };

  return (
    <div
      ref={wrapperRef}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        flexShrink: 0,
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={t('languages.label')}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={t('languages.current')}
        style={{
          width: mobile ? '40px' : '42px',
          height: mobile ? '40px' : '42px',
          minWidth: mobile ? '40px' : '42px',
          minHeight: mobile ? '40px' : '42px',
          padding: 0,
          borderRadius: '50%',
          border: open
            ? '1.5px solid rgba(99, 102, 241, 0.5)'
            : '1.5px solid rgba(99, 102, 241, 0.18)',
          background: open
            ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(139, 92, 246, 0.12) 100%)'
            : 'rgba(255, 255, 255, 0.94)',
          color: 'var(--text-primary)',
          boxShadow: open
            ? '0 8px 24px rgba(99, 102, 241, 0.18)'
            : '0 2px 8px rgba(15, 23, 42, 0.06)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1rem',
          fontWeight: 800,
          lineHeight: 1,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
        }}
      >
        <span
          style={{
            fontSize: mobile ? '1.35rem' : '1.3rem',
            lineHeight: 1,
            filter: 'drop-shadow(0 1px 1px rgba(15, 23, 42, 0.12))',
          }}
        >
          {currentOption.flag}
        </span>
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={t('languages.label')}
          style={{
            position: 'absolute',
            top: 'calc(100% + 0.55rem)',
            insetInlineEnd: 0,
            minWidth: '190px',
            maxHeight: 'min(60vh, 320px)',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain',
            padding: '0.4rem',
            borderRadius: '14px',
            background: 'rgba(255, 255, 255, 0.98)',
            border: '1px solid rgba(99, 102, 241, 0.16)',
            boxShadow: '0 18px 44px rgba(15, 23, 42, 0.18)',
            zIndex: 3000,
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
          }}
        >
          {languageOptions.map((option) => {
            const active = option.code === currentLanguage;
            return (
              <button
                key={option.code}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => changeLanguage(option.code)}
                style={{
                  width: '100%',
                  minHeight: '40px',
                  padding: '0.55rem 0.65rem',
                  borderRadius: '10px',
                  background: active
                    ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.14) 0%, rgba(139, 92, 246, 0.14) 100%)'
                    : 'transparent',
                  color: active ? 'var(--primary)' : 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.65rem',
                  fontSize: '0.92rem',
                  fontWeight: active ? 800 : 650,
                  boxShadow: 'none',
                  transform: 'none',
                  textAlign: 'start',
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{ fontSize: '1.15rem', lineHeight: 1 }}>{option.flag}</span>
                  <span>{supportedLanguages[option.code].nativeLabel}</span>
                </span>
                {active && <span style={{ fontSize: '0.95rem', color: 'var(--primary)' }}>✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
