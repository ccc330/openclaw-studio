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
  'panel.tab.skills': 'Skills',
  'panel.tab.heartbeat': 'Heartbeat',
  'panel.field.name': 'Name',
  'panel.field.model': 'Model',
  'panel.save': 'Save',
  'panel.saving': 'Saving...',
  'panel.saved': 'Saved',
  'panel.error': 'Error',
  'panel.tools.allow': 'Allowed Tools',
  'panel.tools.inherited': 'inherited',
  'panel.tools.add': 'Add Tool',
  'panel.tools.placeholder': 'Type tool name...',
  'panel.tools.empty': 'No tools allowed',
  'panel.skills.available': 'Available Skills',
  'panel.skills.defaults': 'Using team defaults — toggle any skill to create a per-agent override',
  'panel.skills.override': 'Per-agent override active',
  'panel.skills.resetDefaults': 'Reset to defaults',
  'panel.skills.homepage': 'Homepage',
  'panel.skills.noSkills': 'No skills found. Install skills in your OpenClaw skills folder.',
  'panel.skills.bundled': 'bundled',
  'panel.skills.managed': 'managed',
  'chat.title': 'Chat',
  'chat.selectAgent': 'Select agent…',
  'chat.placeholder': 'Message the agent…',
  'chat.send': 'Send',
  'chat.connecting': 'Connecting to gateway…',
  'chat.ready': 'Ready',
  'chat.disconnected': 'Gateway disconnected',
  'chat.noGateway': 'Gateway not available',
  'chat.abort': 'Stop',
  'chat.empty': 'No messages yet. Pick an agent and say hi.',
  'chat.expand': 'Expand chat',
  'chat.collapse': 'Collapse chat',
  'chat.thinking': 'Thinking…',
  'chat.generating': 'Generating…',
  'chat.sending': 'Sending…',
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
  'panel.tab.skills': '技能',
  'panel.tab.heartbeat': '心跳',
  'panel.field.name': '显示名称',
  'panel.field.model': '模型',
  'panel.save': '保存',
  'panel.saving': '保存中...',
  'panel.saved': '已保存',
  'panel.error': '错误',
  'panel.tools.allow': '允许的工具',
  'panel.tools.inherited': '继承',
  'panel.tools.add': '添加工具',
  'panel.tools.placeholder': '输入工具名称...',
  'panel.tools.empty': '未允许任何工具',
  'panel.skills.available': '可用技能',
  'panel.skills.defaults': '当前使用团队默认值——开关任一技能即可创建专属配置',
  'panel.skills.override': '已启用专属配置',
  'panel.skills.resetDefaults': '恢复默认',
  'panel.skills.homepage': '主页',
  'panel.skills.noSkills': '未发现技能，可安装至 OpenClaw 技能目录。',
  'panel.skills.bundled': '内置',
  'panel.skills.managed': '已安装',
  'chat.title': '对话',
  'chat.selectAgent': '选择智能体…',
  'chat.placeholder': '向智能体发送消息…',
  'chat.send': '发送',
  'chat.connecting': '正在连接网关…',
  'chat.ready': '就绪',
  'chat.disconnected': '网关已断开',
  'chat.noGateway': '网关不可用',
  'chat.abort': '停止',
  'chat.empty': '还没有消息。选一个智能体开始对话吧。',
  'chat.expand': '展开对话框',
  'chat.collapse': '收起对话框',
  'chat.thinking': '思考中…',
  'chat.generating': '生成中…',
  'chat.sending': '发送中…',
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
