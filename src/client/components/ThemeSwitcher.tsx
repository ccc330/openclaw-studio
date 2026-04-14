import { useEffect, useState } from 'react';

/*
 * ThemeSwitcher — writes to the same localStorage key that OpenClaw Control UI
 * uses (`openclaw.control.settings.v1`), so a choice here propagates to the
 * Control UI tab on next load (and vice versa).
 *
 * Three theme families × two modes:
 *   claw (red, default) | knot (crimson) | dash (amber)
 *   dark | light
 */

type ThemeFamily = 'claw' | 'knot' | 'dash';
type ThemeMode = 'dark' | 'light';

const STORAGE_KEY = 'openclaw.control.settings.v1';

const FAMILY_LABEL: Record<ThemeFamily, string> = {
  claw: 'Claw',
  knot: 'Knot',
  dash: 'Dash',
};

const FAMILY_DOT: Record<ThemeFamily, string> = {
  claw: '#ff5c5c',
  knot: '#e5243b',
  dash: '#b47840',
};

function readSettings(): { theme: ThemeFamily; themeMode: ThemeMode } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      const theme = (['claw', 'knot', 'dash'] as const).includes(s?.theme) ? s.theme : 'claw';
      const mode = s?.themeMode === 'light' ? 'light' : 'dark';
      return { theme, themeMode: mode };
    }
  } catch {
    /* noop */
  }
  const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
  return { theme: 'claw', themeMode: prefersLight ? 'light' : 'dark' };
}

function writeSettings(theme: ThemeFamily, themeMode: ThemeMode) {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    const merged = { ...(existing ? JSON.parse(existing) : {}), theme, themeMode };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {
    /* noop */
  }
}

function applyTheme(theme: ThemeFamily, themeMode: ThemeMode) {
  const resolved =
    theme === 'knot'
      ? themeMode === 'light'
        ? 'openknot-light'
        : 'openknot'
      : theme === 'dash'
      ? themeMode === 'light'
        ? 'dash-light'
        : 'dash'
      : themeMode === 'light'
      ? 'light'
      : 'dark';
  if (resolved === 'dark') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', resolved);
  }
  document.documentElement.setAttribute('data-theme-mode', themeMode);
}

export default function ThemeSwitcher() {
  const initial = readSettings();
  const [theme, setTheme] = useState<ThemeFamily>(initial.theme);
  const [mode, setMode] = useState<ThemeMode>(initial.themeMode);

  useEffect(() => {
    applyTheme(theme, mode);
    writeSettings(theme, mode);
  }, [theme, mode]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 4px 0',
      }}
    >
      <div
        style={{
          display: 'flex',
          background: 'var(--bg-accent)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-full)',
          padding: 2,
          flex: 1,
        }}
      >
        {(Object.keys(FAMILY_LABEL) as ThemeFamily[]).map((f) => {
          const active = theme === f;
          return (
            <button
              key={f}
              onClick={() => setTheme(f)}
              title={`${FAMILY_LABEL[f]} theme`}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
                padding: '4px 6px',
                background: active ? 'var(--bg-elevated)' : 'transparent',
                border: 'none',
                borderRadius: 'var(--radius-full)',
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
                fontSize: 10,
                fontWeight: 600,
                color: active ? 'var(--text-strong)' : 'var(--muted)',
                letterSpacing: '-0.01em',
                transition: 'color var(--duration-fast) var(--ease-out), background var(--duration-fast) var(--ease-out)',
                boxShadow: active ? 'var(--shadow-sm)' : 'none',
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: FAMILY_DOT[f],
                  boxShadow: active ? `0 0 6px ${FAMILY_DOT[f]}` : 'none',
                  flexShrink: 0,
                }}
              />
              {FAMILY_LABEL[f]}
            </button>
          );
        })}
      </div>
      <button
        onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}
        title={`Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`}
        style={{
          width: 28,
          height: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-accent)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-full)',
          cursor: 'pointer',
          color: 'var(--text)',
          fontSize: 13,
          lineHeight: 1,
          transition: 'background var(--duration-fast) var(--ease-out), color var(--duration-fast) var(--ease-out)',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--bg-hover)';
          e.currentTarget.style.color = 'var(--text-strong)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'var(--bg-accent)';
          e.currentTarget.style.color = 'var(--text)';
        }}
      >
        {mode === 'dark' ? '☾' : '☀'}
      </button>
    </div>
  );
}
