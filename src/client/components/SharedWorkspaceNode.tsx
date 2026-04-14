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

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, rgba(90,245,197,0.06) 0%, rgba(10,15,24,0.95) 100%)',
        border: '1.5px solid rgba(90,245,197,0.25)',
        borderRadius: 'var(--radius-lg)',
        padding: '12px 16px',
        minWidth: 200,
        animation: 'node-enter 0.5s ease-out',
        boxShadow: '0 0 24px rgba(90,245,197,0.06), 0 4px 12px rgba(0,0,0,0.2)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 16 }}>{'\u{1F4C1}'}</span>
        <div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: 12,
              color: 'var(--accent-dataflow)',
            }}
          >
            shared-workspace
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-dim)' }}>
            {project.id}
          </div>
        </div>

        {/* Progress */}
        {totalSteps > 0 && (
          <div
            style={{
              marginLeft: 'auto',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: completedSteps === totalSteps ? 'var(--accent-chief)' : 'var(--accent-running)',
            }}
          >
            {completedSteps}/{totalSteps}
          </div>
        )}
      </div>

      {/* Symlinks */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
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
                gap: 6,
                padding: '3px 8px',
                background: isActive ? 'var(--bg-elevated)' : 'var(--bg-deep)',
                border: isActive ? '1px solid var(--accent-info)' : '1px solid transparent',
                borderRadius: 'var(--radius-sm)',
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'var(--bg-elevated)';
                  e.currentTarget.style.borderColor = 'var(--border-active)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'var(--bg-deep)';
                  e.currentTarget.style.borderColor = 'transparent';
                }
              }}
            >
              <span style={{ color: 'var(--text-dim)' }}>{'\u2192'}</span>
              <span style={{ color: isActive ? 'var(--accent-info)' : 'var(--text-primary)', flex: 1 }}>{sl.name}</span>
              <span style={{ color: 'var(--text-dim)', fontSize: 9 }}>{sl.targetAgent}</span>
              {stepStatus && (
                <div
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background:
                      stepStatus === 'completed'
                        ? 'var(--accent-chief)'
                        : stepStatus === 'pending'
                          ? 'var(--text-dim)'
                          : 'var(--accent-running)',
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
