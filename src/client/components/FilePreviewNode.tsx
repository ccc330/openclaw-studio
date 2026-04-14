import { memo, useState, useCallback, useEffect } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

interface FilePreviewData {
  type: string;
  fileName: string;
  filePath: string;
  targetAgent: string;
  content: string;
  onSave: (filePath: string, content: string) => Promise<boolean>;
  onClose: () => void;
}

function FilePreviewNodeComponent({ data }: NodeProps) {
  const file = data as unknown as FilePreviewData;
  const [content, setContent] = useState(file.content);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle');

  // Sync when external content changes (e.g., file reopened)
  useEffect(() => {
    setContent(file.content);
    setStatus('idle');
  }, [file.content, file.filePath]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setStatus('idle');
    try {
      const ok = await file.onSave(file.filePath, content);
      setStatus(ok ? 'saved' : 'error');
      if (ok) setTimeout(() => setStatus('idle'), 2000);
    } catch {
      setStatus('error');
    } finally {
      setSaving(false);
    }
  }, [content, file]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    },
    [handleSave],
  );

  return (
    <div
      style={{
        width: 400,
        maxHeight: 520,
        background: 'var(--bg-deep)',
        border: '1.5px solid var(--border-active)',
        borderRadius: 'var(--radius-lg)',
        display: 'flex',
        flexDirection: 'column',
        animation: 'node-enter 0.3s ease-out',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 0 1px rgba(139,170,255,0.3)',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '10px 14px',
          borderBottom: '1px solid var(--border-dim)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span style={{ fontSize: 14 }}>{'\u{1F4C4}'}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: 12,
              color: 'var(--text-primary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {file.fileName}
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              color: 'var(--text-dim)',
            }}
          >
            from {file.targetAgent}
          </div>
        </div>

        {/* Save status */}
        {status === 'saved' && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--accent-chief)' }}>
            Saved
          </span>
        )}
        {status === 'error' && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--accent-command)' }}>
            Error
          </span>
        )}

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '4px 10px',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            fontWeight: 600,
            color: '#fff',
            background: saving ? 'var(--bg-elevated)' : 'var(--accent-info)',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            cursor: saving ? 'default' : 'pointer',
            transition: 'all 0.15s',
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? '...' : 'Save'}
        </button>

        {/* Close button */}
        <button
          onClick={file.onClose}
          style={{
            width: 24,
            height: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-dim)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-dim)',
            cursor: 'pointer',
            fontSize: 12,
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
          {'\u2715'}
        </button>
      </div>

      {/* Editor */}
      <div style={{ flex: 1, overflow: 'hidden', padding: '0' }}>
        <textarea
          value={content}
          onChange={(e) => { setContent(e.target.value); setStatus('idle'); }}
          onKeyDown={handleKeyDown}
          className="nodrag nowheel"
          style={{
            width: '100%',
            height: 400,
            padding: '10px 14px',
            background: 'var(--bg-void)',
            border: 'none',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            lineHeight: 1.6,
            resize: 'none',
            outline: 'none',
          }}
        />
      </div>

      {/* Footer hint */}
      <div
        style={{
          padding: '6px 14px',
          borderTop: '1px solid var(--border-dim)',
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          color: 'var(--text-dim)',
          textAlign: 'right',
        }}
      >
        {'\u2318'}S to save
      </div>

      <Handle
        type="target"
        position={Position.Left}
        style={{
          width: 8,
          height: 8,
          background: 'rgba(139,170,255,0.3)',
          border: '2px solid var(--accent-info)',
          left: -4,
        }}
      />
    </div>
  );
}

export default memo(FilePreviewNodeComponent);
