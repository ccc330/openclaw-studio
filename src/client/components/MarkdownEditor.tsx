import { useState, useRef, useEffect } from 'react';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function MarkdownEditor({ value, onChange, placeholder }: MarkdownEditorProps) {
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (mode === 'edit' && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [value, mode]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Mode toggle */}
      <div
        style={{
          display: 'flex',
          gap: 0,
          marginBottom: 8,
          background: 'var(--bg-deep)',
          borderRadius: 'var(--radius-sm)',
          padding: 2,
          width: 'fit-content',
        }}
      >
        {(['edit', 'preview'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            style={{
              padding: '4px 12px',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: mode === m ? 'var(--text-primary)' : 'var(--text-dim)',
              background: mode === m ? 'var(--bg-elevated)' : 'transparent',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              transition: 'all 0.15s',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            {m === 'edit' ? 'Edit' : 'Preview'}
          </button>
        ))}
      </div>

      {mode === 'edit' ? (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          spellCheck={false}
          style={{
            flex: 1,
            minHeight: 200,
            background: 'var(--bg-void)',
            border: '1px solid var(--border-dim)',
            borderRadius: 'var(--radius-sm)',
            padding: 12,
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            lineHeight: 1.7,
            resize: 'vertical',
            outline: 'none',
            transition: 'border-color 0.2s',
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent-info)')}
          onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border-dim)')}
        />
      ) : (
        <div
          style={{
            flex: 1,
            minHeight: 200,
            background: 'var(--bg-void)',
            border: '1px solid var(--border-dim)',
            borderRadius: 'var(--radius-sm)',
            padding: 12,
            fontFamily: 'var(--font-display)',
            fontSize: 13,
            lineHeight: 1.7,
            color: 'var(--text-primary)',
            overflowY: 'auto',
            whiteSpace: 'pre-wrap',
          }}
        >
          {renderMarkdown(value)}
        </div>
      )}
    </div>
  );
}

function renderMarkdown(text: string) {
  if (!text) return <span style={{ color: 'var(--text-dim)' }}>Empty</span>;

  return text.split('\n').map((line, i) => {
    if (line.startsWith('# ')) {
      return (
        <div key={i} style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: '16px 0 8px' }}>
          {line.slice(2)}
        </div>
      );
    }
    if (line.startsWith('## ')) {
      return (
        <div key={i} style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: '14px 0 6px' }}>
          {line.slice(3)}
        </div>
      );
    }
    if (line.startsWith('### ')) {
      return (
        <div key={i} style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-info)', margin: '10px 0 4px' }}>
          {line.slice(4)}
        </div>
      );
    }
    if (line.startsWith('- ')) {
      return (
        <div key={i} style={{ paddingLeft: 16, position: 'relative' }}>
          <span style={{ position: 'absolute', left: 4, color: 'var(--accent-dataflow)' }}>·</span>
          {formatInline(line.slice(2))}
        </div>
      );
    }
    if (line.startsWith('|')) {
      return (
        <div
          key={i}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--text-secondary)',
            padding: '2px 0',
            borderBottom: '1px solid var(--border-dim)',
          }}
        >
          {line}
        </div>
      );
    }
    if (line.trim() === '') {
      return <div key={i} style={{ height: 8 }} />;
    }
    return (
      <div key={i} style={{ color: 'var(--text-secondary)' }}>
        {formatInline(line)}
      </div>
    );
  });
}

function formatInline(text: string) {
  // Bold
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    // Inline code
    const codeParts = part.split(/(`.*?`)/g);
    return codeParts.map((cp, j) => {
      if (cp.startsWith('`') && cp.endsWith('`')) {
        return (
          <code
            key={`${i}-${j}`}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.9em',
              background: 'var(--bg-elevated)',
              padding: '1px 4px',
              borderRadius: 3,
              color: 'var(--accent-running)',
            }}
          >
            {cp.slice(1, -1)}
          </code>
        );
      }
      return <span key={`${i}-${j}`}>{cp}</span>;
    });
  });
}
