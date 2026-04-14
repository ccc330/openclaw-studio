import { useEffect, useRef } from 'react';

interface ContextMenuProps {
  x: number;
  y: number;
  items: { label: string; onClick: () => void; color?: string }[];
  onClose: () => void;
}

export default function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        left: x,
        top: y,
        zIndex: 1000,
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-active)',
        borderRadius: 'var(--radius-sm)',
        padding: '4px 0',
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        minWidth: 140,
        animation: 'node-enter 0.15s ease-out',
      }}
    >
      {items.map((item, i) => (
        <button
          key={i}
          onClick={() => {
            item.onClick();
            onClose();
          }}
          style={{
            display: 'block',
            width: '100%',
            padding: '7px 14px',
            background: 'transparent',
            border: 'none',
            color: item.color || 'var(--text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            textAlign: 'left',
            cursor: 'pointer',
            transition: 'background 0.1s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--bg-hover)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
