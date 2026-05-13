import { useLocale } from '../i18n';

export default function EmptyState() {
  const { t } = useLocale();
  return (
    <div
      style={{
        display: 'flex',
        height: '100%',
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
        fontFamily: 'var(--font-body)',
      }}
    >
      <div
        style={{
          maxWidth: 560,
          textAlign: 'center',
          background: 'var(--panel)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: 32,
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 12 }}>🦞</div>
        <h2
          style={{
            margin: 0,
            marginBottom: 12,
            color: 'var(--text)',
            fontSize: 18,
            fontWeight: 600,
          }}
        >
          {t('empty.title')}
        </h2>
        <p
          style={{
            margin: 0,
            marginBottom: 20,
            color: 'var(--muted)',
            fontSize: 13,
            lineHeight: 1.55,
          }}
        >
          {t('empty.subtitle')}
        </p>
        <pre
          style={{
            background: 'var(--bg)',
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            fontSize: 13,
            fontFamily: 'var(--font-mono)',
            margin: 0,
            color: 'var(--text)',
            textAlign: 'left',
          }}
        >
          openclaw init
        </pre>
        <p
          style={{
            marginTop: 16,
            marginBottom: 0,
            color: 'var(--muted)',
            fontSize: 12,
          }}
        >
          {t('empty.hint')}
        </p>
      </div>
    </div>
  );
}
