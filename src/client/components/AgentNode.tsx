import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { AgentNode as AgentNodeType } from '../hooks/useGraph';

const STATUS_CONFIG = {
  online: { color: 'var(--accent-chief)', label: 'ONLINE', glow: 'var(--glow-chief)' },
  running: { color: 'var(--accent-running)', label: 'RUNNING', glow: 'var(--glow-running)' },
  waiting: { color: 'var(--text-dim)', label: 'WAITING', glow: 'none' },
  offline: { color: 'var(--text-dim)', label: 'OFFLINE', glow: 'none' },
};

type AgentNodeData = AgentNodeType & { type: string };

function AgentNodeComponent({ data }: NodeProps) {
  const agent = data as unknown as AgentNodeData;
  const status = STATUS_CONFIG[agent.status] || STATUS_CONFIG.offline;
  const isActive = agent.status === 'online' || agent.status === 'running';
  const isRunning = agent.status === 'running';

  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: `1.5px solid ${isActive ? status.color : 'var(--border-subtle)'}`,
        borderRadius: 'var(--radius-lg)',
        padding: agent.isChief ? '14px 20px' : '10px 16px',
        minWidth: agent.isChief ? 170 : 140,
        textAlign: 'center',
        animation: 'node-enter 0.4s ease-out',
        boxShadow: isActive ? `0 0 20px ${status.glow}, 0 4px 12px rgba(0,0,0,0.3)` : '0 2px 8px rgba(0,0,0,0.2)',
        transition: 'all 0.3s ease',
        cursor: 'pointer',
        position: 'relative',
      }}
    >
      {/* Glow ring for chief */}
      {agent.isChief && (
        <div
          style={{
            position: 'absolute',
            inset: -3,
            borderRadius: 'calc(var(--radius-lg) + 3px)',
            border: `1px solid ${status.color}`,
            opacity: 0.3,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Emoji */}
      <div style={{ fontSize: agent.isChief ? 28 : 22, lineHeight: 1, marginBottom: 6 }}>
        {agent.emoji}
      </div>

      {/* Name */}
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
          fontSize: agent.isChief ? 14 : 12,
          color: 'var(--text-primary)',
          letterSpacing: '-0.01em',
        }}
      >
        {agent.id.charAt(0).toUpperCase() + agent.id.slice(1)}
      </div>

      {/* Role */}
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--text-secondary)',
          marginTop: 2,
          letterSpacing: '-0.02em',
        }}
      >
        {agent.role}
      </div>

      {/* Model tag */}
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          color: 'var(--text-dim)',
          marginTop: 4,
          padding: '1px 6px',
          background: 'var(--bg-deep)',
          borderRadius: 'var(--radius-sm)',
          display: 'inline-block',
        }}
      >
        {agent.model.split('/').pop()}
      </div>

      {/* Status badge */}
      <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: status.color,
            animation: isRunning ? 'pulse-glow 1.8s ease-in-out infinite' : 'none',
            boxShadow: isActive ? `0 0 6px ${status.color}` : 'none',
          }}
        />
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            fontWeight: 600,
            color: status.color,
            letterSpacing: '0.06em',
          }}
        >
          {status.label}
        </span>
      </div>

      {/* Handles */}
      <Handle
        type="target"
        position={Position.Top}
        style={{
          width: 8,
          height: 8,
          background: 'var(--bg-elevated)',
          border: '2px solid var(--border-active)',
          top: -4,
        }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          width: 8,
          height: 8,
          background: 'var(--bg-elevated)',
          border: '2px solid var(--border-active)',
          bottom: -4,
        }}
      />
    </div>
  );
}

export default memo(AgentNodeComponent);
