import { useState, useCallback } from 'react';

type WizardMode = 'select' | 'single-agent' | 'team';

interface AgentDraft {
  id: string;
  name: string;
  emoji: string;
  role: string;
  model: string;
  soulDescription: string;
}

const DEFAULT_MODELS = ['zai/glm-5', 'zai/glm-4.7', 'openrouter/google/gemini-3.1-flash-preview'];

const EMOJI_OPTIONS = ['🔍', '🔥', '✍️', '🎨', '🧠', '📊', '🛠️', '📣', '🎯', '🤖', '💡', '📋', '🔬', '🎭', '📝'];

function emptyAgent(): AgentDraft {
  return { id: '', name: '', emoji: '🤖', role: '', model: 'zai/glm-5', soulDescription: '' };
}

interface CreateWizardProps {
  onClose: () => void;
  existingAgentIds: string[];
}

export default function CreateWizard({ onClose, existingAgentIds }: CreateWizardProps) {
  const [mode, setMode] = useState<WizardMode>('select');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  // Single agent state
  const [agent, setAgent] = useState<AgentDraft>(emptyAgent());

  // Team state
  const [teamName, setTeamName] = useState('');
  const [chiefId, setChiefId] = useState('main');
  const [members, setMembers] = useState<AgentDraft[]>([emptyAgent()]);

  const updateAgent = useCallback((field: keyof AgentDraft, value: string) => {
    setAgent((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === 'id' && !prev.name) {
        updated.name = `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
      }
      return updated;
    });
  }, []);

  const updateMember = useCallback((idx: number, field: keyof AgentDraft, value: string) => {
    setMembers((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      if (field === 'id' && !copy[idx].name) {
        copy[idx].name = `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
      }
      return copy;
    });
  }, []);

  const addMember = useCallback(() => setMembers((prev) => [...prev, emptyAgent()]), []);
  const removeMember = useCallback((idx: number) => setMembers((prev) => prev.filter((_, i) => i !== idx)), []);

  const validate = useCallback((): string | null => {
    if (mode === 'single-agent') {
      if (!agent.id.trim()) return 'Agent ID is required';
      if (!/^[a-z][a-z0-9-]*$/.test(agent.id)) return 'Agent ID must be lowercase letters, numbers, hyphens';
      if (existingAgentIds.includes(agent.id)) return `Agent "${agent.id}" already exists`;
      if (!agent.role.trim()) return 'Role is required';
    } else if (mode === 'team') {
      if (!teamName.trim()) return 'Team name is required';
      if (!/^[a-z][a-z0-9-]*$/.test(teamName)) return 'Team name must be lowercase letters, numbers, hyphens';
      for (const m of members) {
        if (!m.id.trim()) return 'All member IDs are required';
        if (!/^[a-z][a-z0-9-]*$/.test(m.id)) return `"${m.id}" is not a valid ID`;
        if (existingAgentIds.includes(m.id)) return `Agent "${m.id}" already exists`;
        if (!m.role.trim()) return `Role for "${m.id}" is required`;
      }
      // Check duplicate ids
      const ids = members.map((m) => m.id);
      if (new Set(ids).size !== ids.length) return 'Duplicate member IDs';
    }
    return null;
  }, [mode, agent, teamName, members, existingAgentIds]);

  const handleCreate = useCallback(async () => {
    const err = validate();
    if (err) { setError(err); return; }

    setCreating(true);
    setError('');

    try {
      if (mode === 'single-agent') {
        const res = await fetch('/api/agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: agent.id,
            name: agent.name ? `${agent.name} - ${agent.role}` : agent.role,
            emoji: agent.emoji,
            role: agent.role,
            model: agent.model,
            soulDescription: agent.soulDescription,
          }),
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error);
      } else if (mode === 'team') {
        const res = await fetch('/api/team', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            teamName,
            chiefId,
            members: members.map((m) => ({
              id: m.id,
              name: m.name ? `${m.name} - ${m.role}` : m.role,
              emoji: m.emoji,
              role: m.role,
              model: m.model,
              soulDescription: m.soulDescription,
            })),
          }),
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error);
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Creation failed');
    } finally {
      setCreating(false);
    }
  }, [mode, agent, teamName, chiefId, members, validate, onClose]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(5,8,13,0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(12px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>

      <div
        style={{
          width: mode === 'select' ? 480 : 560,
          maxHeight: '85vh',
          background: 'var(--bg-deep)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          animation: 'slideUp 0.25s ease-out',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(138,180,255,0.05)',
        }}
      >
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-dim)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>
              {mode === 'select' ? 'Create New' : mode === 'single-agent' ? 'New Agent' : 'New Team'}
            </div>
            {mode !== 'select' && (
              <button
                onClick={() => { setMode('select'); setError(''); }}
                style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent-info)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 2 }}
              >
                ← Back to selection
              </button>
            )}
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-surface)', border: '1px solid var(--border-dim)', borderRadius: 'var(--radius-sm)', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 14 }}>
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
          {mode === 'select' && <ModeSelector onSelect={setMode} />}
          {mode === 'single-agent' && <AgentForm agent={agent} onUpdate={updateAgent} />}
          {mode === 'team' && (
            <TeamForm
              teamName={teamName}
              onTeamNameChange={setTeamName}
              chiefId={chiefId}
              onChiefIdChange={setChiefId}
              existingAgentIds={existingAgentIds}
              members={members}
              onUpdateMember={updateMember}
              onAddMember={addMember}
              onRemoveMember={removeMember}
            />
          )}
        </div>

        {/* Footer */}
        {mode !== 'select' && (
          <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-dim)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent-command)', maxWidth: 300 }}>
              {error}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={onClose} style={{ padding: '7px 16px', fontFamily: 'var(--font-display)', fontSize: 12, color: 'var(--text-secondary)', background: 'var(--bg-surface)', border: '1px solid var(--border-dim)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                style={{
                  padding: '7px 20px',
                  fontFamily: 'var(--font-display)',
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'white',
                  background: creating ? 'var(--bg-elevated)' : 'var(--accent-chief)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  cursor: creating ? 'default' : 'pointer',
                  opacity: creating ? 0.6 : 1,
                }}
              >
                {creating ? 'Creating...' : mode === 'team' ? 'Create Team' : 'Create Agent'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ModeSelector({ onSelect }: { onSelect: (mode: WizardMode) => void }) {
  const options = [
    { mode: 'team' as const, icon: '🏗️', title: 'Create Team', desc: 'Create a new agent team with Chief + members, shared workspace, and collaboration scripts.' },
    { mode: 'single-agent' as const, icon: '👤', title: 'Single Agent', desc: 'Add one new agent with its own workspace. Can be added to an existing team later.' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {options.map(({ mode, icon, title, desc }) => (
        <button
          key={mode}
          onClick={() => onSelect(mode)}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            padding: '14px 16px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-dim)',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent-info)';
            e.currentTarget.style.background = 'var(--bg-elevated)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-dim)';
            e.currentTarget.style.background = 'var(--bg-surface)';
          }}
        >
          <span style={{ fontSize: 24 }}>{icon}</span>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{title}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.5 }}>{desc}</div>
          </div>
        </button>
      ))}
    </div>
  );
}

function AgentForm({ agent, onUpdate }: { agent: AgentDraft; onUpdate: (field: keyof AgentDraft, value: string) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
        <WizField label="Agent ID *" placeholder="e.g. analyst" value={agent.id} onChange={(v) => onUpdate('id', v)} mono />
        <div>
          <WizLabel>Emoji</WizLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {EMOJI_OPTIONS.map((e) => (
              <button
                key={e}
                onClick={() => onUpdate('emoji', e)}
                style={{
                  width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: agent.emoji === e ? 'var(--bg-elevated)' : 'transparent',
                  border: `1px solid ${agent.emoji === e ? 'var(--accent-info)' : 'var(--border-dim)'}`,
                  borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 14,
                }}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <WizField label="Display Name" placeholder="e.g. Analyst" value={agent.name} onChange={(v) => onUpdate('name', v)} />
        <WizField label="Role *" placeholder="e.g. Data Analyst" value={agent.role} onChange={(v) => onUpdate('role', v)} />
      </div>
      <div>
        <WizLabel>Model</WizLabel>
        <select
          value={agent.model}
          onChange={(e) => onUpdate('model', e.target.value)}
          style={{
            width: '100%', padding: '7px 8px', background: 'var(--bg-void)', border: '1px solid var(--border-dim)',
            borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 12, outline: 'none',
          }}
        >
          {DEFAULT_MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
      <div>
        <WizLabel>Soul Description</WizLabel>
        <textarea
          value={agent.soulDescription}
          onChange={(e) => onUpdate('soulDescription', e.target.value)}
          placeholder="Describe this agent's personality, principles, and approach..."
          rows={4}
          style={{
            width: '100%', padding: '8px', background: 'var(--bg-void)', border: '1px solid var(--border-dim)',
            borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontFamily: 'var(--font-display)', fontSize: 12,
            lineHeight: 1.6, resize: 'vertical', outline: 'none',
          }}
        />
      </div>
    </div>
  );
}

function TeamForm({
  teamName, onTeamNameChange, chiefId, onChiefIdChange, existingAgentIds,
  members, onUpdateMember, onAddMember, onRemoveMember,
}: {
  teamName: string; onTeamNameChange: (v: string) => void;
  chiefId: string; onChiefIdChange: (v: string) => void;
  existingAgentIds: string[];
  members: AgentDraft[];
  onUpdateMember: (idx: number, field: keyof AgentDraft, value: string) => void;
  onAddMember: () => void; onRemoveMember: (idx: number) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <WizField label="Team Name *" placeholder="e.g. research-team" value={teamName} onChange={onTeamNameChange} mono />
        <div>
          <WizLabel>Chief Agent</WizLabel>
          <select
            value={chiefId}
            onChange={(e) => onChiefIdChange(e.target.value)}
            style={{
              width: '100%', padding: '7px 8px', background: 'var(--bg-void)', border: '1px solid var(--border-dim)',
              borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 12, outline: 'none',
            }}
          >
            {existingAgentIds.map((id) => <option key={id} value={id}>{id}</option>)}
          </select>
        </div>
      </div>

      <div>
        <WizLabel>Team Members</WizLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {members.map((m, i) => (
            <div key={i} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-dim)', borderRadius: 'var(--radius-md)', padding: '10px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-dim)' }}>Member {i + 1}</span>
                {members.length > 1 && (
                  <button onClick={() => onRemoveMember(i)} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent-command)', background: 'none', border: 'none', cursor: 'pointer' }}>
                    Remove
                  </button>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr', gap: 8 }}>
                <div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                    {EMOJI_OPTIONS.slice(0, 6).map((e) => (
                      <button
                        key={e} onClick={() => onUpdateMember(i, 'emoji', e)}
                        style={{
                          width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12,
                          background: m.emoji === e ? 'var(--bg-elevated)' : 'transparent',
                          border: `1px solid ${m.emoji === e ? 'var(--accent-info)' : 'transparent'}`,
                          borderRadius: 3, cursor: 'pointer',
                        }}
                      >{e}</button>
                    ))}
                  </div>
                </div>
                <WizField label="ID *" placeholder="agent-id" value={m.id} onChange={(v) => onUpdateMember(i, 'id', v)} mono small />
                <WizField label="Role *" placeholder="Role name" value={m.role} onChange={(v) => onUpdateMember(i, 'role', v)} small />
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={onAddMember}
          style={{
            width: '100%', marginTop: 8, padding: '8px', fontFamily: 'var(--font-mono)', fontSize: 11,
            color: 'var(--accent-info)', background: 'transparent',
            border: '1px dashed var(--border-subtle)', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
          }}
        >
          + Add member
        </button>
      </div>
    </div>
  );
}

function WizField({ label, placeholder, value, onChange, mono, small }: {
  label: string; placeholder?: string; value: string; onChange: (v: string) => void; mono?: boolean; small?: boolean;
}) {
  return (
    <div>
      <WizLabel>{label}</WizLabel>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', padding: small ? '5px 7px' : '7px 8px',
          background: 'var(--bg-void)', border: '1px solid var(--border-dim)', borderRadius: 'var(--radius-sm)',
          color: 'var(--text-primary)', fontFamily: mono ? 'var(--font-mono)' : 'var(--font-display)',
          fontSize: small ? 11 : 12, outline: 'none',
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent-info)')}
        onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border-dim)')}
      />
    </div>
  );
}

function WizLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-dim)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
      {children}
    </div>
  );
}
