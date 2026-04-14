import { useLocale, LOCALE_LABELS, type Locale } from '../i18n';

/*
 * LocaleSwitcher — native <select> styled to match the sidebar.
 * Shares the `openclaw.i18n.locale` localStorage key with Control UI.
 */
export default function LocaleSwitcher() {
  const { locale, setLocale } = useLocale();
  const locales = Object.keys(LOCALE_LABELS) as Locale[];

  return (
    <select
      value={locale}
      onChange={(e) => setLocale(e.target.value as Locale)}
      style={{
        width: '100%',
        padding: '6px 8px',
        background: 'var(--bg-accent)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        color: 'var(--text)',
        fontFamily: 'var(--font-body)',
        fontSize: 11,
        cursor: 'pointer',
        outline: 'none',
      }}
    >
      {locales.map((l) => (
        <option key={l} value={l}>{LOCALE_LABELS[l]}</option>
      ))}
    </select>
  );
}
