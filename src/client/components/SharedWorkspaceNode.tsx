import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { ProjectInfo } from '../hooks/useGraph';

type SharedWorkspaceData = ProjectInfo & {
  type: string;
  onFileClick?: (fileName: string, filePath: string, targetAgent: string) => void;
  activeFileName?: string;
};

function SharedWorkspaceNodeComponent({ data }: NodeProps) {
  const project = data as unknown as SharedWorkspaceData;
  const completedSteps = project.task
    ? Object.values(project.task.steps).filter((s) => s.status === 'completed').length
    : 0;
  const totalSteps = project.task ? Object.keys(project.task.steps).length : 0;
  const progressDone = totalSteps > 0 && completedSteps === totalSteps;

  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: '1.5px solid var(--accent-dataflow)',
        borderRadius: 'var(--radius-lg)',
        padding: '14px 16px 12px',
        minWidth: 240,
        animation: 'node-enter 0.4s ease-out',
        boxShadow: '0 0 20px rgba(90,245,197,0.08), 0 4px 12px rgba(0,0,0,0.22)',
        transition: 'all 0.3s ease',
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: -3,
          borderRadius: 'calc(var(--radius-lg) + 3px)',
          border: '1px solid rgba(90,245,197,0.26)',
          opacity: 0.6,
          pointerEvents: 'none',
        }}
      />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 'var(--radius-sm)',
            background: 'rgba(90,245,197,0.12)',
            border: '1px solid rgba(90,245,197,0.18)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            fontSize: 14,
          }}
        >
          {'\u{1F4C1}'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: 12,
              color: 'var(--accent-dataflow)',
              letterSpacing: '-0.01em',
            }}
          >
            shared-workspace
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              color: 'var(--text-dim)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              marginTop: 2,
            }}
          >
            {project.id}
          </div>
        </div>

        {/* Progress */}
        {totalSteps > 0 && (
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              fontWeight: 600,
              color: progressDone ? 'var(--accent-chief)' : 'var(--accent-running)',
              background: progressDone ? 'rgba(80,250,123,0.10)' : 'rgba(241,161,53,0.10)',
              border: `1px solid ${progressDone ? 'rgba(80,250,123,0.24)' : 'rgba(241,161,53,0.24)'}`,
              borderRadius: '999px',
              padding: '3px 7px',
              lineHeight: 1.1,
              flexShrink: 0,
            }}
          >
            {completedSteps}/{totalSteps}
          </div>
        )}
      </div>

      {totalSteps > 0 && (
        <div
          style={{
            height: 4,
            background: 'var(--bg-deep)',
            borderRadius: 999,
            overflow: 'hidden',
            marginBottom: 10,
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${(completedSteps / totalSteps) * 100}%`,
              background: progressDone ? 'var(--accent-chief)' : 'var(--accent-dataflow)',
              borderRadius: 999,
              transition: 'width 0.25s ease',
            }}
          />
        </div>
      )}

      {/* Symlinks */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {project.symlinks.map((sl) => {
          const stepStatus = project.task?.steps
            ? Object.values(project.task.steps).find((s) => s.file === sl.name || s.dir === sl.name)?.status
            : undefined;
          const isActive = project.activeFileName === sl.name;

          return (
            <div
              key={sl.name}
              onClick={(e) => {
                e.stopPropagation();
                project.onFileClick?.(sl.name, sl.resolvedPath, sl.targetAgent);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '7px 9px',
                background: isActive ? 'rgba(139,170,255,0.10)' : 'var(--bg-deep)',
                border: isActive ? '1px solid rgba(139,170,255,0.32)' : '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'var(--bg-elevated)';
                  e.currentTarget.style.borderColor = 'rgba(90,245,197,0.24)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'var(--bg-deep)';
                  e.currentTarget.style.borderColor = 'var(--border-subtle)';
                }
              }}
            >
              <span
                style={{
                  width: 16,
                  height: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isActive ? 'var(--accent-info)' : 'var(--text-dim)',
                  flexShrink: 0,
                  fontSize: 10,
                }}
              >
                {'\u2192'}
              </span>
              <span
                style={{
                  color: isActive ? 'var(--accent-info)' : 'var(--text-primary)',
                  flex: 1,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {sl.name}
              </span>
              <span
                style={{
                  color: 'var(--text-dim)',
                  fontSize: 9,
                  padding: '2px 6px',
                  background: 'var(--bg-surface)',
                  borderRadius: '999px',
                  flexShrink: 0,
                }}
              >
                {sl.targetAgent}
              </span>
              {stepStatus && (
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background:
                      stepStatus === 'completed'
                        ? 'var(--accent-chief)'
                        : stepStatus === 'pending'
                          ? 'var(--text-dim)'
                          : 'var(--accent-running)',
                    boxShadow:
                      stepStatus === 'completed' || stepStatus === 'running'
                        ? '0 0 6px currentColor'
                        : 'none',
                    color:
                      stepStatus === 'completed'
                        ? 'var(--accent-chief)'
                        : stepStatus === 'running'
                          ? 'var(--accent-running)'
                          : 'var(--text-dim)',
                    flexShrink: 0,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      <Handle
        type="target"
        position={Position.Top}
        style={{
          width: 8,
          height: 8,
          background: 'rgba(90,245,197,0.3)',
          border: '2px solid var(--accent-dataflow)',
          top: -4,
        }}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={{
          width: 8,
          height: 8,
          background: 'rgba(139,170,255,0.3)',
          border: '2px solid var(--accent-info)',
          right: -4,
        }}
      />
    </div>
  );
}

export default memo(SharedWorkspaceNodeComponent);
