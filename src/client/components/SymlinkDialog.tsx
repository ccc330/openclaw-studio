import { useState, useCallback } from 'react';

interface SymlinkDialogProps {
  agentId: string;
  projectId: string;
  teamPath: string;
  onClose: () => void;
}

export default function SymlinkDialog({ agentId, projectId, teamPath, onClose }: SymlinkDialogProps) {
  const [sourceFile, setSourceFile] = useState('output.md');
  const [linkName, setLinkName] = useState(`${agentId}-output.md`);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = useCallback(async () => {
    if (!sourceFile.trim() || !linkName.trim()) {
      setError('All fields are required');
      return;
    }

    setCreating(true);
    setError('');

    try {
      const res = await fetch('/api/symlink', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          teamPath,
          sourceAgent: agentId,
          sourceFile: sourceFile.trim(),
          linkName: linkName.trim(),
        }),
      });

      const data = await res.json();
      if (!data.ok) {
        setError(data.error || 'Failed to create symlink');
        return;
      }

      onClose();
    } catch {
      setError('Network error');
    } finally {
      setCreating(false);
    }
  }, [sourceFile, linkName, projectId, teamPath, agentId, onClose]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(5,8,13,0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 380,
          background: 'var(--bg-deep)',
          border: '1px solid var(--border-dim)',
          borderRadius: 'var(--radius-lg)',
          padding: 24,
          boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
          animation: 'node-enter 0.25s ease-out',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(90,245,197,0.1)',
              border: '1px solid rgba(90,245,197,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
            }}
          >
            🔗
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
              Create Symlink
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-dim)' }}>
              {agentId} → {projectId}
            </div>
          </div>
        </div>

        {/* Source file */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-dim)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Source File (in agent outputs)
          </div>
          <input
            value={sourceFile}
            onChange={(e) => setSourceFile(e.target.value)}
            placeholder="e.g. output.md"
            style={{
              width: '100%',
              padding: '8px 10px',
              background: 'var(--bg-void)',
              border: '1px solid var(--border-dim)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              outline: 'none',
              transition: 'border-color 0.2s',
              boxSizing: 'border-box',
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent-dataflow)')}
            onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border-dim)')}
          />
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-dim)', marginTop: 3 }}>
            ~/.openclaw/workspace-{agentId}/outputs/{projectId}/{sourceFile || '...'}
          </div>
        </div>

        {/* Link name */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-dim)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Link Name (in shared workspace)
          </div>
          <input
            value={linkName}
            onChange={(e) => setLinkName(e.target.value)}
            placeholder="e.g. 01-researcher"
            style={{
              width: '100%',
              padding: '8px 10px',
              background: 'var(--bg-void)',
              border: '1px solid var(--border-dim)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              outline: 'none',
              transition: 'border-color 0.2s',
              boxSizing: 'border-box',
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent-dataflow)')}
            onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border-dim)')}
          />
        </div>

        {/* Error */}
        {error && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent-command)', marginBottom: 12 }}>
            {error}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '7px 16px',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--text-secondary)',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-dim)',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={creating}
            style={{
              padding: '7px 16px',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              fontWeight: 600,
              color: 'white',
              background: creating ? 'var(--bg-elevated)' : 'var(--accent-dataflow)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              cursor: creating ? 'default' : 'pointer',
              transition: 'all 0.15s',
              opacity: creating ? 0.6 : 1,
            }}
          >
            {creating ? 'Creating...' : 'Create Symlink'}
          </button>
        </div>
      </div>
    </div>
  );
}
