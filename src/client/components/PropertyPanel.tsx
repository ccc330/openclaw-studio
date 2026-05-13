import { useState, useEffect, useCallback } from 'react';
import MarkdownEditor from './MarkdownEditor';
import type { AgentNode } from '../hooks/useGraph';
import { useLocale } from '../i18n';

type TabKey = 'identity' | 'soul' | 'agents' | 'tools' | 'skills' | 'heartbeat';

const TAB_KEYS: { key: TabKey; fileType: string; i18n: string }[] = [
  { key: 'identity', fileType: 'identity', i18n: 'panel.tab.identity' },
  { key: 'soul', fileType: 'soul', i18n: 'panel.tab.soul' },
  { key: 'agents', fileType: 'agents', i18n: 'panel.tab.agents' },
  { key: 'tools', fileType: 'tools', i18n: 'panel.tab.tools' },
  { key: 'skills', fileType: '', i18n: 'panel.tab.skills' },
  { key: 'heartbeat', fileType: 'heartbeat', i18n: 'panel.tab.heartbeat' },
];

interface SkillRecord {
  name: string;
  description: string;
  emoji: string;
  homepage?: string;
  source: 'managed' | 'bundled' | 'workspace';
  enabled: boolean;
}

interface PropertyPanelProps {
  agent: AgentNode;
  onClose: () => void;
  allModels?: string[];
}

export default function PropertyPanel({ agent, onClose, allModels = [] }: PropertyPanelProps) {
  const { t } = useLocale();
  const [activeTab, setActiveTab] = useState<TabKey>('identity');
  const [editedFiles, setEditedFiles] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Config fields
  const [agentName, setAgentName] = useState(agent.name);
  const [agentModel, setAgentModel] = useState(agent.model);
  const [toolsAllow, setToolsAllow] = useState<string[]>(agent.tools);
  const [availableTools, setAvailableTools] = useState<string[]>([]);
  const [skills, setSkills] = useState<SkillRecord[]>([]);
  const [skillsOverride, setSkillsOverride] = useState<boolean>(agent.skillsOverride);
  const [skillsDirty, setSkillsDirty] = useState<boolean>(false);

  // Initialize edited files from agent data
  useEffect(() => {
    const files: Record<string, string> = {};
    for (const tab of TAB_KEYS) {
      const content = agent.files[tab.fileType as keyof typeof agent.files];
      if (content) files[tab.fileType] = content;
    }
    setEditedFiles(files);
    setAgentName(agent.name);
    setAgentModel(agent.model);
    setToolsAllow(agent.tools);
    setSkillsOverride(agent.skillsOverride);
    setSkillsDirty(false);
  }, [agent]);

  useEffect(() => {
    fetch('/api/tools')
      .then((res) => res.json())
      .then((data) => setAvailableTools(data.tools || []))
      .catch(() => setAvailableTools([]));
  }, []);

  useEffect(() => {
    fetch(`/api/agent/${agent.id}/skills`)
      .then((res) => res.json())
      .then((data) => setSkills(data.skills || []))
      .catch(() => setSkills([]));
  }, [agent.id]);

  const handleFileChange = useCallback((fileType: string, content: string) => {
    setEditedFiles((prev) => ({ ...prev, [fileType]: content }));
    setSaveStatus('idle');
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveStatus('idle');

    try {
      // Save current tab's file
      const tab = TAB_KEYS.find((t) => t.key === activeTab);
      if (tab && editedFiles[tab.fileType] !== undefined) {
        const res = await fetch(`/api/agent/${agent.id}/file/${tab.fileType}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: editedFiles[tab.fileType] }),
        });
        if (!res.ok) throw new Error('File save failed');
      }

      // Save config if identity tab
      if (activeTab === 'identity') {
        const res = await fetch(`/api/agent/${agent.id}/config`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: agentName, model: agentModel }),
        });
        if (!res.ok) throw new Error('Config save failed');
      }

      // Save tools config if tools tab
      if (activeTab === 'tools') {
        const res = await fetch(`/api/agent/${agent.id}/config`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tools: { allow: toolsAllow } }),
        });
        if (!res.ok) throw new Error('Tools save failed');
      }

      // Save skills config if skills tab (only if there's an override)
      if (activeTab === 'skills' && skillsDirty) {
        const body: { skills: string[] | null } = skillsOverride
          ? { skills: skills.filter((s) => s.enabled).map((s) => s.name) }
          : { skills: null };
        const res = await fetch(`/api/agent/${agent.id}/config`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error('Skills save failed');
        setSkillsDirty(false);
      }

      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  }, [activeTab, editedFiles, agent.id, agentName, agentModel, toolsAllow, skills, skillsOverride, skillsDirty]);

  const currentContent = editedFiles[TAB_KEYS.find((t) => t.key === activeTab)?.fileType || ''] || '';

  return (
    <div
      style={{
        width: 420,
        height: '100%',
        background: 'var(--bg-deep)',
        borderLeft: '1px solid var(--border-dim)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        animation: 'slideIn 0.25s ease-out',
      }}
    >
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(20px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>

      {/* Header */}
      <div
        style={{
          padding: '14px 16px',
          borderBottom: '1px solid var(--border-dim)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <span style={{ fontSize: 22 }}>{agent.emoji}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
            {agent.id.charAt(0).toUpperCase() + agent.id.slice(1)}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-dim)' }}>
            {agent.workspace}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            width: 28,
            height: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-dim)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-dim)',
            cursor: 'pointer',
            fontSize: 14,
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent-command)';
            e.currentTarget.style.color = 'var(--accent-command)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-dim)';
            e.currentTarget.style.color = 'var(--text-dim)';
          }}
        >
          ✕
        </button>
      </div>

      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          gap: 0,
          borderBottom: '1px solid var(--border-dim)',
          padding: '0 16px',
        }}
      >
        {TAB_KEYS.map((tab) => {
          const isActive = activeTab === tab.key;
          const hasContent = !!editedFiles[tab.fileType];
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '10px 14px',
                fontFamily: 'var(--font-display)',
                fontSize: 12,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? 'var(--accent-info)' : hasContent ? 'var(--text-secondary)' : 'var(--text-dim)',
                background: 'transparent',
                border: 'none',
                borderBottom: isActive ? '2px solid var(--accent-info)' : '2px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.15s',
                position: 'relative',
              }}
            >
              {t(tab.i18n)}
              {!hasContent && (
                <span
                  style={{
                    display: 'inline-block',
                    width: 4,
                    height: 4,
                    borderRadius: '50%',
                    background: 'var(--text-dim)',
                    marginLeft: 4,
                    verticalAlign: 'super',
                    opacity: 0.5,
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {activeTab === 'identity' ? (
          <IdentityTab
            agentName={agentName}
            agentModel={agentModel}
            agentId={agent.id}
            emoji={agent.emoji}
            workspace={agent.workspace}
            tools={agent.tools}
            modelOptions={[...new Set(allModels)].sort()}
            onNameChange={setAgentName}
            onModelChange={setAgentModel}
            identityContent={currentContent}
            onContentChange={(v) => handleFileChange('identity', v)}
          />
        ) : activeTab === 'tools' ? (
          <ToolsTab
            toolsAllow={toolsAllow}
            toolsAlsoAllow={agent.toolsAlsoAllow || []}
            availableTools={availableTools}
            onChange={setToolsAllow}
            content={currentContent}
            onContentChange={(v) => handleFileChange('tools', v)}
          />
        ) : activeTab === 'skills' ? (
          <SkillsTab
            skills={skills}
            override={skillsOverride}
            onToggleOverride={(v) => {
              setSkillsOverride(v);
              setSkillsDirty(true);
            }}
            onToggleSkill={(name) => {
              setSkills((prev) =>
                prev.map((s) => (s.name === name ? { ...s, enabled: !s.enabled } : s)),
              );
              setSkillsOverride(true);
              setSkillsDirty(true);
            }}
          />
        ) : (
          <MarkdownEditor
            value={currentContent}
            onChange={(v) => handleFileChange(TAB_KEYS.find((t) => t.key === activeTab)!.fileType, v)}
            placeholder={`No ${t(TAB_KEYS.find((x) => x.key === activeTab)?.i18n ?? '')} file found. Start writing to create one.`}
          />
        )}
      </div>

      {/* Footer: save bar */}
      <div
        style={{
          padding: '10px 16px',
          borderTop: '1px solid var(--border-dim)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-dim)' }}>
          {TAB_KEYS.find((t) => t.key === activeTab)?.fileType.toUpperCase()}.md
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {saveStatus === 'success' && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent-chief)' }}>{t('panel.saved')}</span>
          )}
          {saveStatus === 'error' && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent-command)' }}>{t('panel.error')}</span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '6px 16px',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              fontWeight: 600,
              color: 'white',
              background: saving ? 'var(--bg-elevated)' : 'var(--accent-info)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              cursor: saving ? 'default' : 'pointer',
              transition: 'all 0.15s',
              letterSpacing: '0.02em',
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? t('panel.saving') : t('panel.save')}
          </button>
        </div>
      </div>
    </div>
  );
}

/* Identity Tab — structured fields + IDENTITY.md editor */
function IdentityTab({
  agentName,
  agentModel,
  agentId,
  emoji,
  workspace,
  tools,
  modelOptions,
  onNameChange,
  onModelChange,
  identityContent,
  onContentChange,
}: {
  agentName: string;
  agentModel: string;
  agentId: string;
  emoji: string;
  workspace: string;
  tools: string[];
  modelOptions: string[];
  onNameChange: (v: string) => void;
  onModelChange: (v: string) => void;
  identityContent: string;
  onContentChange: (v: string) => void;
}) {
  const { t } = useLocale();
  const isKnownModel = modelOptions.includes(agentModel);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Structured fields */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Field label="Agent ID" value={agentId} disabled />
        <Field label="Emoji" value={emoji} disabled />
        <Field label={t('panel.field.name')} value={agentName} onChange={onNameChange} />
        {/* Model selector */}
        <div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--text-dim)',
              marginBottom: 3,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            {t('panel.field.model')}
          </div>
          <select
            value={isKnownModel ? agentModel : '__custom__'}
            onChange={(e) => {
              if (e.target.value !== '__custom__') onModelChange(e.target.value);
            }}
            style={{
              width: '100%',
              padding: '6px 8px',
              background: 'var(--bg-void)',
              border: '1px solid var(--border-dim)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              outline: 'none',
            }}
          >
            {modelOptions.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
            {!isKnownModel && (
              <option value="__custom__">{agentModel || '(custom)'}</option>
            )}
          </select>
          {!isKnownModel && (
            <input
              value={agentModel}
              onChange={(e) => onModelChange(e.target.value)}
              placeholder="custom model name"
              style={{
                width: '100%',
                padding: '6px 8px',
                marginTop: 4,
                background: 'var(--bg-void)',
                border: '1px solid var(--border-dim)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                outline: 'none',
              }}
            />
          )}
        </div>
      </div>

      <Field label="Workspace" value={workspace} disabled fullWidth />

      {/* Tools summary */}
      <div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-dim)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Tools ({tools.length})
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {tools.slice(0, 12).map((tool) => (
            <span
              key={tool}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                padding: '2px 6px',
                background: 'var(--bg-void)',
                border: '1px solid var(--border-dim)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-secondary)',
              }}
            >
              {tool}
            </span>
          ))}
          {tools.length > 12 && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-dim)', padding: '2px 4px' }}>
              +{tools.length - 12} more
            </span>
          )}
        </div>
      </div>

      {/* IDENTITY.md editor */}
      <div style={{ marginTop: 8 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-dim)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          IDENTITY.md
        </div>
        <MarkdownEditor value={identityContent} onChange={onContentChange} placeholder="No IDENTITY.md found" />
      </div>
    </div>
  );
}

/* Tools Tab — editable tool toggles + add/remove + TOOLS.md editor */
function ToolsTab({
  toolsAllow,
  toolsAlsoAllow,
  availableTools,
  onChange,
  content,
  onContentChange,
}: {
  toolsAllow: string[];
  toolsAlsoAllow: string[];
  availableTools: string[];
  onChange: (next: string[]) => void;
  content: string;
  onContentChange: (v: string) => void;
}) {
  const { t } = useLocale();
  const [newTool, setNewTool] = useState('');

  const toggle = (tool: string) => {
    if (toolsAllow.includes(tool)) {
      onChange(toolsAllow.filter((x) => x !== tool));
    } else {
      onChange([...toolsAllow, tool]);
    }
  };

  const remove = (tool: string) => onChange(toolsAllow.filter((x) => x !== tool));

  const addTool = () => {
    const trimmed = newTool.trim();
    if (!trimmed || toolsAllow.includes(trimmed)) return;
    onChange([...toolsAllow, trimmed]);
    setNewTool('');
  };

  const suggestions = availableTools.filter(
    (x) => !toolsAllow.includes(x) && !toolsAlsoAllow.includes(x),
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Allowed tools list with toggles */}
      <div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-dim)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {t('panel.tools.allow')} ({toolsAllow.length})
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            maxHeight: 180,
            overflowY: 'auto',
            padding: 6,
            background: 'var(--bg-void)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-dim)',
          }}
        >
          {toolsAllow.length === 0 && toolsAlsoAllow.length === 0 && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-dim)', padding: '8px 6px', textAlign: 'center' }}>
              {t('panel.tools.empty')}
            </div>
          )}
          {toolsAllow.map((tool) => (
            <ToolRow
              key={tool}
              name={tool}
              enabled
              onToggle={() => toggle(tool)}
              onRemove={() => remove(tool)}
            />
          ))}
          {toolsAlsoAllow.map((tool) => (
            <ToolRow
              key={`also-${tool}`}
              name={tool}
              enabled
              inherited
            />
          ))}
        </div>
      </div>

      {/* Add tool input */}
      <div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-dim)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {t('panel.tools.add')}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            list="tool-suggestions"
            value={newTool}
            onChange={(e) => setNewTool(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addTool();
              }
            }}
            placeholder={t('panel.tools.placeholder')}
            style={{
              flex: 1,
              padding: '6px 8px',
              background: 'var(--bg-void)',
              border: '1px solid var(--border-dim)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              outline: 'none',
            }}
          />
          <datalist id="tool-suggestions">
            {suggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <button
            onClick={addTool}
            disabled={!newTool.trim()}
            style={{
              padding: '6px 12px',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              fontWeight: 600,
              color: 'white',
              background: newTool.trim() ? 'var(--accent-info)' : 'var(--bg-elevated)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              cursor: newTool.trim() ? 'pointer' : 'default',
              opacity: newTool.trim() ? 1 : 0.5,
            }}
          >
            +
          </button>
        </div>
      </div>

      {/* TOOLS.md editor */}
      <div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-dim)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          TOOLS.md
        </div>
        <MarkdownEditor value={content} onChange={onContentChange} placeholder="No TOOLS.md found" />
      </div>
    </div>
  );
}

function ToolRow({
  name,
  enabled,
  inherited,
  onToggle,
  onRemove,
}: {
  name: string;
  enabled: boolean;
  inherited?: boolean;
  onToggle?: () => void;
  onRemove?: () => void;
}) {
  const { t } = useLocale();
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 6px',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        color: 'var(--text-secondary)',
        borderRadius: 'var(--radius-sm)',
        transition: 'background 0.15s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-elevated)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <button
        onClick={onToggle}
        disabled={!onToggle}
        style={{
          width: 26,
          height: 14,
          padding: 0,
          borderRadius: 7,
          background: enabled ? 'var(--accent-info)' : 'var(--bg-surface)',
          border: '1px solid var(--border-dim)',
          cursor: onToggle ? 'pointer' : 'default',
          position: 'relative',
          transition: 'background 0.15s',
          opacity: inherited ? 0.5 : 1,
          flexShrink: 0,
        }}
        aria-label={`toggle ${name}`}
      >
        <span
          style={{
            position: 'absolute',
            top: 1,
            left: enabled ? 13 : 1,
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: 'white',
            transition: 'left 0.15s',
          }}
        />
      </button>
      <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
      {inherited && (
        <span
          style={{
            fontSize: 9,
            padding: '1px 5px',
            background: 'var(--bg-surface)',
            color: 'var(--text-dim)',
            borderRadius: 'var(--radius-sm)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          {t('panel.tools.inherited')}
        </span>
      )}
      {onRemove && (
        <button
          onClick={onRemove}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-dim)',
            cursor: 'pointer',
            fontSize: 12,
            padding: 0,
            width: 18,
            height: 18,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-command)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-dim)')}
          aria-label={`remove ${name}`}
        >
          ✕
        </button>
      )}
    </div>
  );
}

/* Skills Tab — per-agent skill toggles + override management */
function SkillsTab({
  skills,
  override,
  onToggleOverride,
  onToggleSkill,
}: {
  skills: SkillRecord[];
  override: boolean;
  onToggleOverride: (next: boolean) => void;
  onToggleSkill: (name: string) => void;
}) {
  const { t } = useLocale();
  const [expanded, setExpanded] = useState<string | null>(null);

  if (skills.length === 0) {
    return (
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-dim)', padding: 12, textAlign: 'center' }}>
        {t('panel.skills.noSkills')}
      </div>
    );
  }

  const enabledCount = skills.filter((s) => s.enabled).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Override banner */}
      <div
        style={{
          padding: '8px 10px',
          background: override ? 'var(--bg-surface)' : 'var(--bg-void)',
          border: `1px solid ${override ? 'var(--accent-info)' : 'var(--border-dim)'}`,
          borderRadius: 'var(--radius-sm)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: override ? 'var(--accent-info)' : 'var(--text-dim)', lineHeight: 1.4 }}>
          {override ? t('panel.skills.override') : t('panel.skills.defaults')}
        </div>
        {override && (
          <button
            onClick={() => onToggleOverride(false)}
            style={{
              padding: '3px 8px',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--text-secondary)',
              background: 'var(--bg-void)',
              border: '1px solid var(--border-dim)',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {t('panel.skills.resetDefaults')}
          </button>
        )}
      </div>

      {/* Skills list */}
      <div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-dim)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {t('panel.skills.available')} ({enabledCount}/{skills.length})
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            padding: 6,
            background: 'var(--bg-void)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-dim)',
            maxHeight: 360,
            overflowY: 'auto',
          }}
        >
          {skills.map((skill) => {
            const isOpen = expanded === skill.name;
            return (
              <div
                key={skill.name}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '6px',
                  borderRadius: 'var(--radius-sm)',
                  transition: 'background 0.15s',
                  background: isOpen ? 'var(--bg-elevated)' : 'transparent',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    onClick={() => onToggleSkill(skill.name)}
                    style={{
                      width: 26,
                      height: 14,
                      padding: 0,
                      borderRadius: 7,
                      background: skill.enabled ? 'var(--accent-info)' : 'var(--bg-surface)',
                      border: '1px solid var(--border-dim)',
                      cursor: 'pointer',
                      position: 'relative',
                      transition: 'background 0.15s',
                      flexShrink: 0,
                    }}
                    aria-label={`toggle skill ${skill.name}`}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        top: 1,
                        left: skill.enabled ? 13 : 1,
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background: 'white',
                        transition: 'left 0.15s',
                      }}
                    />
                  </button>
                  <span style={{ fontSize: 14, flexShrink: 0 }}>{skill.emoji}</span>
                  <button
                    onClick={() => setExpanded(isOpen ? null : skill.name)}
                    style={{
                      flex: 1,
                      textAlign: 'left',
                      background: 'transparent',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      color: 'var(--text-primary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {skill.name}
                  </button>
                  <span
                    style={{
                      fontSize: 9,
                      padding: '1px 5px',
                      background: skill.source === 'bundled' ? 'var(--bg-surface)' : 'var(--bg-elevated)',
                      color: 'var(--text-dim)',
                      borderRadius: 'var(--radius-sm)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {t(`panel.skills.${skill.source}`)}
                  </span>
                </div>
                {isOpen && (
                  <div
                    style={{
                      marginTop: 6,
                      marginLeft: 34,
                      padding: '6px 8px',
                      background: 'var(--bg-void)',
                      borderRadius: 'var(--radius-sm)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      color: 'var(--text-secondary)',
                      lineHeight: 1.5,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                    }}
                  >
                    <div>{skill.description || '(no description)'}</div>
                    {skill.homepage && (
                      <a
                        href={skill.homepage}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'var(--accent-info)', textDecoration: 'none' }}
                      >
                        {t('panel.skills.homepage')} →
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* Reusable field component */
function Field({
  label,
  value,
  onChange,
  disabled,
  fullWidth,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  disabled?: boolean;
  fullWidth?: boolean;
}) {
  return (
    <div style={fullWidth ? { gridColumn: '1 / -1' } : undefined}>
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--text-dim)',
          marginBottom: 3,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}
      >
        {label}
      </div>
      <input
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        disabled={disabled}
        style={{
          width: '100%',
          padding: '6px 8px',
          background: disabled ? 'var(--bg-surface)' : 'var(--bg-void)',
          border: '1px solid var(--border-dim)',
          borderRadius: 'var(--radius-sm)',
          color: disabled ? 'var(--text-dim)' : 'var(--text-primary)',
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          outline: 'none',
          transition: 'border-color 0.2s',
        }}
        onFocus={(e) => !disabled && (e.currentTarget.style.borderColor = 'var(--accent-info)')}
        onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border-dim)')}
      />
    </div>
  );
}
