import { useState, useEffect, useCallback } from 'react';
import MarkdownEditor from './MarkdownEditor';
import type { AgentNode } from '../hooks/useGraph';
import { useLocale } from '../i18n';

type TabKey = 'identity' | 'soul' | 'agents' | 'tools' | 'heartbeat';

const TAB_KEYS: { key: TabKey; fileType: string; i18n: string }[] = [
  { key: 'identity', fileType: 'identity', i18n: 'panel.tab.identity' },
  { key: 'soul', fileType: 'soul', i18n: 'panel.tab.soul' },
  { key: 'agents', fileType: 'agents', i18n: 'panel.tab.agents' },
  { key: 'tools', fileType: 'tools', i18n: 'panel.tab.tools' },
  { key: 'heartbeat', fileType: 'heartbeat', i18n: 'panel.tab.heartbeat' },
];

interface PropertyPanelProps {
  agent: AgentNode;
  onClose: () => void;
}

export default function PropertyPanel({ agent, onClose }: PropertyPanelProps) {
  const { t } = useLocale();
  const [activeTab, setActiveTab] = useState<TabKey>('identity');
  const [editedFiles, setEditedFiles] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Config fields
  const [agentName, setAgentName] = useState(agent.name);
  const [agentModel, setAgentModel] = useState(agent.model);

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
  }, [agent]);

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

      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  }, [activeTab, editedFiles, agent.id, agentName, agentModel]);

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
            onNameChange={setAgentName}
            onModelChange={setAgentModel}
            identityContent={currentContent}
            onContentChange={(v) => handleFileChange('identity', v)}
          />
        ) : activeTab === 'tools' ? (
          <ToolsTab tools={agent.tools} content={currentContent} onChange={(v) => handleFileChange('tools', v)} />
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
  onNameChange: (v: string) => void;
  onModelChange: (v: string) => void;
  identityContent: string;
  onContentChange: (v: string) => void;
}) {
  const { t } = useLocale();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Structured fields */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Field label="Agent ID" value={agentId} disabled />
        <Field label="Emoji" value={emoji} disabled />
        <Field label={t('panel.field.name')} value={agentName} onChange={onNameChange} />
        <Field label={t('panel.field.model')} value={agentModel} onChange={onModelChange} />
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

/* Tools Tab — tool list with toggle display + TOOLS.md editor */
function ToolsTab({
  tools,
  content,
  onChange,
}: {
  tools: string[];
  content: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-dim)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          openclaw.json → tools.allow ({tools.length})
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 4,
            maxHeight: 160,
            overflowY: 'auto',
            padding: 8,
            background: 'var(--bg-void)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-dim)',
          }}
        >
          {tools.map((tool) => (
            <div
              key={tool}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '3px 6px',
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'var(--text-secondary)',
              }}
            >
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 2,
                  background: 'var(--accent-chief)',
                  opacity: 0.6,
                  flexShrink: 0,
                }}
              />
              {tool}
            </div>
          ))}
        </div>
      </div>

      <div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-dim)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          TOOLS.md
        </div>
        <MarkdownEditor value={content} onChange={onChange} placeholder="No TOOLS.md found" />
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
