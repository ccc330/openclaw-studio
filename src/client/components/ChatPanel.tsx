import { useEffect, useMemo, useRef, useState } from 'react';
import { useGateway, type ChatMessage, type ModelActivity } from '../hooks/useGateway';
import { useLocale } from '../i18n';
import type { AgentNode } from '../hooks/useGraph';

interface ChatPanelProps {
  agents: AgentNode[];
}

/*
 * Agent chat panel — docked to the bottom-center of the canvas.
 * Uses one gateway session per agent (sessionKey = `main` for chief,
 * otherwise `agent:<id>`) so each conversation stays isolated.
 */
export default function ChatPanel({ agents }: ChatPanelProps) {
  const { t } = useLocale();
  const { status, errorDetail, messagesBySession, activityBySession, mainSessionKey, sendMessage, abort } = useGateway();

  const [expanded, setExpanded] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Default to chief agent once graph is loaded
  useEffect(() => {
    if (!selectedAgentId && agents.length > 0) {
      const chief = agents.find((a) => a.isChief) || agents[0];
      setSelectedAgentId(chief.id);
    }
  }, [agents, selectedAgentId]);

  const sessionKey = useMemo(() => {
    if (!selectedAgentId) return mainSessionKey;
    const agent = agents.find((a) => a.id === selectedAgentId);
    return agent?.isChief ? mainSessionKey : `agent:${selectedAgentId}:main`;
  }, [selectedAgentId, agents, mainSessionKey]);

  const messages: ChatMessage[] = messagesBySession[sessionKey] || [];
  const activity: ModelActivity | null = activityBySession[sessionKey] || null;

  // Tick elapsed time display
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!activity) { setElapsed(0); return; }
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - activity.since) / 1000)), 1000);
    return () => clearInterval(id);
  }, [activity]);
  const elapsedLabel = activity && elapsed >= 2 ? ` (${elapsed}s)` : '';

  // Auto-scroll on new message
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const handleSend = () => {
    const text = draft.trim();
    if (!text || status !== 'ready') return;
    if (sendMessage(sessionKey, text)) setDraft('');
  };

  const selectedAgent = agents.find((a) => a.id === selectedAgentId);

  const statusColor =
    activity
      ? 'var(--accent-running)'
      : status === 'ready'
        ? 'var(--accent-chief)'
        : status === 'connecting'
          ? 'var(--accent-info)'
          : status === 'unavailable'
            ? 'var(--text-dim)'
            : 'var(--accent-command)';

  const statusLabel = activity
    ? `${activity.label}${elapsedLabel}`
    : status === 'ready'
      ? t('chat.ready')
      : status === 'connecting'
      ? t('chat.connecting')
      : status === 'unavailable'
      ? t('chat.noGateway')
      : t('chat.disconnected');

  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        bottom: 12,
        transform: 'translateX(-50%)',
        width: expanded ? 580 : 360,
        maxWidth: 'calc(100% - 180px)',
        height: expanded ? 380 : 38,
        background: 'var(--bg-deep)',
        border: '1px solid var(--border-dim)',
        borderRadius: 'var(--radius-md, 8px)',
        boxShadow: 'var(--shadow-lg, 0 10px 28px rgba(0,0,0,0.35))',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        zIndex: 5,
        transition: 'width 0.2s ease, height 0.2s ease',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '0 10px',
          height: 38,
          flexShrink: 0,
          borderBottom: expanded ? '1px solid var(--border-dim)' : 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'var(--bg-surface)',
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: statusColor,
            flexShrink: 0,
            boxShadow: `0 0 6px ${statusColor}`,
          }}
        />
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--text-primary)',
            letterSpacing: '0.02em',
          }}
        >
          {t('chat.title')}
        </span>

        <select
          value={selectedAgentId}
          onChange={(e) => setSelectedAgentId(e.target.value)}
          style={{
            flex: 1,
            maxWidth: 220,
            padding: '4px 6px',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            background: 'var(--bg-void)',
            border: '1px solid var(--border-dim)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-primary)',
            outline: 'none',
          }}
        >
          {agents.length === 0 && <option value="">{t('chat.selectAgent')}</option>}
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.emoji} {a.id}
            </option>
          ))}
        </select>

        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--text-dim)',
            whiteSpace: 'nowrap',
          }}
        >
          {statusLabel}
        </span>

        <button
          onClick={() => setExpanded((e) => !e)}
          aria-label={expanded ? t('chat.collapse') : t('chat.expand')}
          style={{
            marginLeft: 'auto',
            width: 24,
            height: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-void)',
            border: '1px solid var(--border-dim)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: 12,
            lineHeight: 1,
          }}
        >
          {expanded ? '▾' : '▴'}
        </button>
      </div>

      {expanded && (
        <>
          {/* Message area */}
          <div
            ref={scrollRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              background: 'var(--bg-void)',
            }}
          >
            {messages.length === 0 && (
              <div
                style={{
                  margin: 'auto',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  color: 'var(--text-dim)',
                  textAlign: 'center',
                  padding: 20,
                }}
              >
                {errorDetail ? errorDetail : t('chat.empty')}
              </div>
            )}

            {messages.map((m) => (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: m.role === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                <div
                  style={{
                    maxWidth: '80%',
                    padding: '6px 10px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    lineHeight: 1.5,
                    color: m.role === 'user' ? 'white' : 'var(--text-primary)',
                    background:
                      m.role === 'user' ? 'var(--accent-info)' : 'var(--bg-surface)',
                    border:
                      m.role === 'user'
                        ? 'none'
                        : '1px solid var(--border-dim)',
                    borderRadius: 'var(--radius-sm)',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {m.text}
                  {m.streaming && (
                    <span
                      style={{
                        display: 'inline-block',
                        marginLeft: 4,
                        opacity: 0.6,
                        animation: 'pulse-glow 1.2s infinite',
                      }}
                    >
                      ▋
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 9,
                    color: 'var(--text-dim)',
                    marginTop: 2,
                  }}
                >
                  {m.role === 'user' ? 'you' : selectedAgent?.id || 'agent'}
                </div>
              </div>
            ))}

            {/* Model activity indicator */}
            {activity && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                }}
              >
                <div
                  style={{
                    maxWidth: '80%',
                    padding: '6px 10px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    lineHeight: 1.5,
                    color: 'var(--text-dim)',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-dim)',
                    borderRadius: 'var(--radius-sm)',
                    opacity: 0.85,
                  }}
                >
                  <span style={{ animation: 'pulse-glow 1.2s infinite', display: 'inline-block' }}>
                    ●
                  </span>
                  {' '}
                  {activity.label}{elapsedLabel}
                </div>
              </div>
            )}
          </div>

          {/* Input area */}
          <div
            style={{
              padding: 8,
              borderTop: '1px solid var(--border-dim)',
              display: 'flex',
              gap: 6,
              background: 'var(--bg-surface)',
              flexShrink: 0,
            }}
          >
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={t('chat.placeholder')}
              rows={2}
              disabled={status !== 'ready'}
              style={{
                flex: 1,
                resize: 'none',
                padding: '6px 8px',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                lineHeight: 1.4,
                background: 'var(--bg-void)',
                border: '1px solid var(--border-dim)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                outline: 'none',
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <button
                onClick={handleSend}
                disabled={!draft.trim() || status !== 'ready'}
                style={{
                  padding: '4px 12px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'white',
                  background:
                    draft.trim() && status === 'ready'
                      ? 'var(--accent-info)'
                      : 'var(--bg-elevated)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  cursor: draft.trim() && status === 'ready' ? 'pointer' : 'default',
                  opacity: draft.trim() && status === 'ready' ? 1 : 0.5,
                }}
              >
                {t('chat.send')}
              </button>
              <button
                onClick={abort}
                style={{
                  padding: '4px 12px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  color: 'var(--text-dim)',
                  background: 'var(--bg-void)',
                  border: '1px solid var(--border-dim)',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                }}
              >
                {t('chat.abort')}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
