import type { GraphModel } from '../hooks/useGraph';
import LobsterLogo from './LobsterLogo';
import ThemeSwitcher from './ThemeSwitcher';
import LocaleSwitcher from './LocaleSwitcher';
import { useLocale } from '../i18n';

const STATUS_COLORS: Record<string, string> = {
  online: 'var(--ok)',
  running: 'var(--warn)',
  waiting: 'var(--muted)',
  offline: 'var(--muted)',
};

interface SidebarProps {
  graph: GraphModel;
  connected: boolean;
  layers: { command: boolean; dataflow: boolean; sequence: boolean };
  onToggleLayer: (layer: 'command' | 'dataflow' | 'sequence') => void;
  onCreateNew: () => void;
  visibleProjects: Set<string>;
  onToggleProject: (projectId: string) => void;
}

export default function Sidebar({ graph, connected, layers, onToggleLayer, onCreateNew, visibleProjects, onToggleProject }: SidebarProps) {
  const { t } = useLocale();
  return (
    <div
      style={{
        width: 220,
        height: '100%',
        background: 'var(--bg-deep)',
        borderRight: '1px solid var(--border-dim)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {/* Header — mirrors Control UI .sidebar-header (12px 16px, panel bg, border-bottom)
          and .brand-title (13px). Brand naming follows `OpenClaw / <sub-app>` convention. */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--panel)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          zIndex: 10,
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <LobsterLogo size={20} />
          <div
            style={{
              fontSize: 13,
              fontFamily: 'var(--font-body)',
              letterSpacing: '-0.01em',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            <span style={{ color: 'var(--muted)', fontWeight: 500 }}>OpenClaw</span>
            <span style={{ color: 'var(--muted)', margin: '0 6px', opacity: 0.5 }}>/</span>
            <span style={{ color: 'var(--text-strong)', fontWeight: 600 }}>Studio</span>
          </div>
        </div>
        <div
          title={connected ? t('sidebar.connected') : t('sidebar.reconnecting')}
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: connected ? 'var(--ok)' : 'var(--danger)',
            boxShadow: connected ? '0 0 8px var(--ok-muted)' : 'none',
            animation: connected ? 'none' : 'pulse-glow 1.2s infinite',
            flexShrink: 0,
          }}
        />
      </div>

      {/* Layer toggles */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-dim)' }}>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--text-dim)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginBottom: 8,
          }}
        >
          {t('sidebar.layers')}
        </div>
        {([
          { key: 'command' as const, label: t('sidebar.layer.command'), color: 'var(--accent-command)' },
          { key: 'dataflow' as const, label: t('sidebar.layer.dataflow'), color: 'var(--accent-dataflow)' },
          { key: 'sequence' as const, label: t('sidebar.layer.sequence'), color: 'var(--accent-sequence)' },
        ]).map(({ key, label, color }) => (
          <button
            key={key}
            onClick={() => onToggleLayer(key)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '5px 8px',
              marginBottom: 3,
              background: layers[key] ? 'var(--bg-elevated)' : 'transparent',
              border: `1px solid ${layers[key] ? color : 'transparent'}`,
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              transition: 'all 0.2s',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: layers[key] ? color : 'var(--text-dim)',
              letterSpacing: '-0.01em',
            }}
          >
            <div
              style={{
                width: 12,
                height: 3,
                borderRadius: 2,
                background: layers[key] ? color : 'var(--border-subtle)',
                transition: 'background 0.2s',
              }}
            />
            {label}
          </button>
        ))}
      </div>

      {/* Agents */}
      <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px' }}>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--text-dim)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginBottom: 8,
          }}
        >
          {t('sidebar.agents')} ({graph.agents.length})
        </div>

        {graph.agents.map((agent) => (
          <div
            key={agent.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '7px 10px',
              marginBottom: 4,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-dim)',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-elevated)';
              e.currentTarget.style.borderColor = 'var(--border-active)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--bg-surface)';
              e.currentTarget.style.borderColor = 'var(--border-dim)';
            }}
          >
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: STATUS_COLORS[agent.status],
                boxShadow:
                  agent.status === 'online' || agent.status === 'running'
                    ? `0 0 6px ${STATUS_COLORS[agent.status]}`
                    : 'none',
                animation: agent.status === 'running' ? 'pulse-glow 1.8s infinite' : 'none',
                flexShrink: 0,
              }}
            />
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
                {agent.emoji} {agent.id.charAt(0).toUpperCase() + agent.id.slice(1)}
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  color: 'var(--text-dim)',
                }}
              >
                {agent.role}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Projects */}
      {graph.teams.flatMap((tm) => tm.projects).length > 0 && (
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-dim)', overflow: 'auto', maxHeight: 240 }}>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--text-dim)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: 8,
            }}
          >
            {t('sidebar.projects')} ({graph.teams.flatMap((tm) => tm.projects).length})
          </div>
          {graph.teams.flatMap((team) =>
            team.projects.map((project) => {
              const completed = project.task
                ? Object.values(project.task.steps).filter((s) => s.status === 'completed').length
                : 0;
              const total = project.task ? Object.keys(project.task.steps).length : 0;
              const isVisible = visibleProjects.has(project.id);

              return (
                <div
                  key={project.id}
                  onClick={() => onToggleProject(project.id)}
                  style={{
                    padding: '7px 10px',
                    marginBottom: 4,
                    background: isVisible ? 'var(--bg-elevated)' : 'var(--bg-surface)',
                    border: isVisible ? '1px solid var(--accent-dataflow)' : '1px solid var(--border-dim)',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    if (!isVisible) {
                      e.currentTarget.style.borderColor = 'var(--border-active)';
                      e.currentTarget.style.background = 'var(--bg-elevated)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isVisible) {
                      e.currentTarget.style.borderColor = 'var(--border-dim)';
                      e.currentTarget.style.background = 'var(--bg-surface)';
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 2,
                        background: isVisible ? 'var(--accent-dataflow)' : 'var(--border-subtle)',
                        flexShrink: 0,
                        transition: 'background 0.15s',
                      }}
                    />
                    <div
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 500,
                        fontSize: 11,
                        color: isVisible ? 'var(--accent-dataflow)' : 'var(--text-secondary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        flex: 1,
                      }}
                    >
                      {project.id}
                    </div>
                    {total > 0 && (
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 9,
                          color: completed === total ? 'var(--accent-chief)' : 'var(--text-dim)',
                          flexShrink: 0,
                        }}
                      >
                        {completed}/{total}
                      </span>
                    )}
                  </div>
                  {total > 0 && (
                    <div style={{ marginTop: 4, marginLeft: 12 }}>
                      <div
                        style={{
                          height: 2,
                          background: 'var(--bg-deep)',
                          borderRadius: 1,
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${(completed / total) * 100}%`,
                            background: completed === total ? 'var(--accent-chief)' : 'var(--accent-running)',
                            borderRadius: 1,
                            transition: 'width 0.3s ease',
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            }),
          )}
        </div>
      )}
      {/* Create button */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <button
          onClick={onCreateNew}
          style={{
            width: '100%',
            padding: '9px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-dim)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-secondary)',
            fontFamily: 'var(--font-display)',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s',
            letterSpacing: '-0.01em',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--accent-chief)';
            e.currentTarget.style.color = 'var(--bg-void)';
            e.currentTarget.style.borderColor = 'var(--accent-chief)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--bg-surface)';
            e.currentTarget.style.color = 'var(--text-secondary)';
            e.currentTarget.style.borderColor = 'var(--border-dim)';
          }}
        >
          <span style={{ fontSize: 15, lineHeight: 1 }}>+</span>
          {t('sidebar.create')}
        </button>
        <ThemeSwitcher />
        <LocaleSwitcher />
      </div>
    </div>
  );
}
