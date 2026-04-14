import { useEffect, useState } from 'react';

/*
 * Studio i18n — shares the localStorage key `openclaw.i18n.locale` with
 * OpenClaw Control UI, so a language choice in either surface propagates
 * to the other. Studio ships with en (default) and zh-CN strings; other
 * locales Control UI supports (zh-TW, ja-JP, ko, fr, de, es, id, pt-BR,
 * ru, it) fall back to en until translations are contributed.
 */

export type Locale =
  | 'en'
  | 'zh-CN'
  | 'zh-TW'
  | 'ja-JP'
  | 'ko'
  | 'fr'
  | 'de'
  | 'es'
  | 'id'
  | 'pt-BR'
  | 'ru'
  | 'it';

const STORAGE_KEY = 'openclaw.i18n.locale';
const SUPPORTED: Locale[] = [
  'en', 'zh-CN', 'zh-TW', 'ja-JP', 'ko', 'fr', 'de', 'es', 'id', 'pt-BR', 'ru', 'it',
];

type Dict = Record<string, string>;

const en: Dict = {
  'sidebar.layers': 'Layers',
  'sidebar.layer.command': 'Command',
  'sidebar.layer.dataflow': 'Dataflow',
  'sidebar.layer.sequence': 'Sequence',
  'sidebar.agents': 'Agents',
  'sidebar.projects': 'Projects',
  'sidebar.create': 'New Agent / Team',
  'sidebar.connected': 'Connected',
  'sidebar.reconnecting': 'Reconnecting…',
  'canvas.connecting': 'Connecting to Studio server...',
  'panel.tab.identity': 'Identity',
  'panel.tab.soul': 'Soul',
  'panel.tab.agents': 'Role',
  'panel.tab.tools': 'Tools',
  'panel.tab.heartbeat': 'Heartbeat',
  'panel.field.name': 'Name',
  'panel.field.model': 'Model',
  'panel.save': 'Save',
  'panel.saving': 'Saving...',
  'panel.saved': 'Saved',
  'panel.error': 'Error',
  'context.remove': '✕  Remove from canvas',
  'theme.claw': 'Claw',
  'theme.knot': 'Knot',
  'theme.dash': 'Dash',
  'theme.dark': 'Dark',
  'theme.light': 'Light',
};

const zhCN: Dict = {
  'sidebar.layers': '图层',
  'sidebar.layer.command': '指挥层',
  'sidebar.layer.dataflow': '数据流',
  'sidebar.layer.sequence': '执行序',
  'sidebar.agents': '智能体',
  'sidebar.projects': '项目',
  'sidebar.create': '新建 Agent / Team',
  'sidebar.connected': '已连接',
  'sidebar.reconnecting': '重连中…',
  'canvas.connecting': '正在连接 Studio 服务...',
  'panel.tab.identity': '身份',
  'panel.tab.soul': '灵魂',
  'panel.tab.agents': '职责',
  'panel.tab.tools': '工具',
  'panel.tab.heartbeat': '心跳',
  'panel.field.name': '显示名称',
  'panel.field.model': '模型',
  'panel.save': '保存',
  'panel.saving': '保存中...',
  'panel.saved': '已保存',
  'panel.error': '错误',
  'context.remove': '✕  从画布移除',
  'theme.claw': 'Claw',
  'theme.knot': 'Knot',
  'theme.dash': 'Dash',
  'theme.dark': '深色',
  'theme.light': '浅色',
};

const DICTS: Partial<Record<Locale, Dict>> = {
  en,
  'zh-CN': zhCN,
};

function normalizeLocale(raw: string | null | undefined): Locale {
  if (!raw) return 'en';
  if ((SUPPORTED as string[]).includes(raw)) return raw as Locale;
  const lower = raw.toLowerCase();
  if (lower.startsWith('zh-tw') || lower === 'zh-hant') return 'zh-TW';
  if (lower.startsWith('zh')) return 'zh-CN';
  if (lower.startsWith('ja')) return 'ja-JP';
  if (lower.startsWith('pt')) return 'pt-BR';
  const base = lower.split('-')[0];
  if ((SUPPORTED as string[]).includes(base)) return base as Locale;
  return 'en';
}

export function detectLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return normalizeLocale(stored);
  } catch { /* noop */ }
  if (typeof navigator !== 'undefined') return normalizeLocale(navigator.language);
  return 'en';
}

export function setLocale(locale: Locale) {
  try { localStorage.setItem(STORAGE_KEY, locale); } catch { /* noop */ }
  window.dispatchEvent(new CustomEvent('studio:locale-changed', { detail: locale }));
}

export function translate(locale: Locale, key: string): string {
  const dict = DICTS[locale] ?? DICTS.en!;
  return dict[key] ?? DICTS.en![key] ?? key;
}

export function useLocale() {
  const [locale, setLocaleState] = useState<Locale>(() => detectLocale());

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setLocaleState(normalizeLocale(e.newValue));
    };
    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent<Locale>).detail;
      if (detail) setLocaleState(detail);
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('studio:locale-changed', onCustom);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('studio:locale-changed', onCustom);
    };
  }, []);

  return {
    locale,
    setLocale: (l: Locale) => { setLocaleState(l); setLocale(l); },
    t: (key: string) => translate(locale, key),
  };
}

export const LOCALE_LABELS: Record<Locale, string> = {
  'en': 'English',
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  'ja-JP': '日本語',
  'ko': '한국어',
  'fr': 'Français',
  'de': 'Deutsch',
  'es': 'Español',
  'id': 'Bahasa Indonesia',
  'pt-BR': 'Português',
  'ru': 'Русский',
  'it': 'Italiano',
};
