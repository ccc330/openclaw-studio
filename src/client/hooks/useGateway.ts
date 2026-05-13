import { useCallback, useEffect, useRef, useState } from 'react';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  streaming: boolean;
  runId?: string;
  timestamp: number;
}

export interface ModelActivity {
  stream: string;
  label: string;
  since: number;
}

export type GatewayStatus = 'idle' | 'connecting' | 'ready' | 'disconnected' | 'unavailable' | 'error';

interface GatewayInfo {
  host: string;
  port: number;
  token?: string;
}

interface GatewayResponsePayload {
  runId?: string;
}

interface GatewayEnvelope {
  type?: string;
  event?: string;
  id?: string;
  ok?: boolean;
  payload?: unknown;
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
}

interface DeviceIdentity {
  deviceId: string;
  publicKey: string;
  privateKey: string;
}

const DEVICE_IDENTITY_STORAGE_KEY = 'openclaw-studio.device.identity.v1';
const CONTROL_UI_CLIENT_ID = 'openclaw-control-ui';
const CONTROL_UI_CLIENT_MODE = 'webchat';
const OPERATOR_SCOPES = [
  'operator.admin',
  'operator.read',
  'operator.write',
  'operator.approvals',
  'operator.pairing',
];

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value: string): Uint8Array {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return bytesToHex(new Uint8Array(digest));
}

async function getDeviceIdentity(): Promise<DeviceIdentity | null> {
  if (typeof window === 'undefined' || typeof crypto === 'undefined' || !crypto.subtle) return null;

  try {
    const stored = window.localStorage.getItem(DEVICE_IDENTITY_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as {
        version?: number;
        deviceId?: string;
        publicKey?: string;
        privateKey?: string;
      };
      if (
        parsed?.version === 1 &&
        typeof parsed.deviceId === 'string' &&
        typeof parsed.publicKey === 'string' &&
        typeof parsed.privateKey === 'string'
      ) {
        const computedDeviceId = await sha256Hex(base64UrlToBytes(parsed.publicKey));
        if (computedDeviceId !== parsed.deviceId) {
          const repaired: DeviceIdentity = {
            deviceId: computedDeviceId,
            publicKey: parsed.publicKey,
            privateKey: parsed.privateKey,
          };
          window.localStorage.setItem(
            DEVICE_IDENTITY_STORAGE_KEY,
            JSON.stringify({ version: 1, ...repaired, createdAtMs: Date.now() }),
          );
          return repaired;
        }
        return {
          deviceId: parsed.deviceId,
          publicKey: parsed.publicKey,
          privateKey: parsed.privateKey,
        };
      }
    }
  } catch {
    // Ignore corrupt local storage and regenerate.
  }

  const keyPair = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const publicKeyBytes = new Uint8Array(await crypto.subtle.exportKey('raw', keyPair.publicKey));
  const privateKeyBytes = new Uint8Array(await crypto.subtle.exportKey('pkcs8', keyPair.privateKey));
  const identity: DeviceIdentity = {
    deviceId: await sha256Hex(publicKeyBytes),
    publicKey: bytesToBase64Url(publicKeyBytes),
    privateKey: bytesToBase64Url(privateKeyBytes),
  };

  window.localStorage.setItem(
    DEVICE_IDENTITY_STORAGE_KEY,
    JSON.stringify({ version: 1, ...identity, createdAtMs: Date.now() }),
  );

  return identity;
}

function buildDeviceSignaturePayload(args: {
  deviceId: string;
  clientId: string;
  clientMode: string;
  role: string;
  scopes: string[];
  signedAtMs: number;
  token?: string;
  nonce: string;
}) {
  const scopeList = args.scopes.join(',');
  return [
    'v2',
    args.deviceId,
    args.clientId,
    args.clientMode,
    args.role,
    scopeList,
    String(args.signedAtMs),
    args.token ?? '',
    args.nonce,
  ].join('|');
}

async function signDevicePayload(identity: DeviceIdentity, payload: string): Promise<string> {
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    base64UrlToBytes(identity.privateKey),
    { name: 'Ed25519' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    { name: 'Ed25519' },
    privateKey,
    new TextEncoder().encode(payload),
  );
  return bytesToBase64Url(new Uint8Array(signature));
}

function getRunId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `studio-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getMessageText(message: unknown): string {
  if (!message || typeof message !== 'object') return '';

  const row = message as {
    text?: unknown;
    content?: unknown;
  };

  if (typeof row.text === 'string') return row.text;

  if (!Array.isArray(row.content)) return '';

  return row.content
    .map((part) => {
      if (!part || typeof part !== 'object') return '';
      const typedPart = part as {
        type?: unknown;
        text?: unknown;
        content?: unknown;
      };
      if (typedPart.type === 'text' && typeof typedPart.text === 'string') return typedPart.text;
      if (typeof typedPart.content === 'string') return typedPart.content;
      return '';
    })
    .filter(Boolean)
    .join('\n');
}

function getMessageRole(message: unknown): ChatMessage['role'] | null {
  if (!message || typeof message !== 'object') return null;
  const role = (message as { role?: unknown }).role;
  if (role === 'user' || role === 'assistant' || role === 'system') return role;
  return null;
}

export function useGateway() {
  const [status, setStatus] = useState<GatewayStatus>('idle');
  const [messagesBySession, setMessagesBySession] = useState<Record<string, ChatMessage[]>>({});
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [activityBySession, setActivityBySession] = useState<Record<string, ModelActivity | null>>({});

  const wsRef = useRef<WebSocket | null>(null);
  const infoRef = useRef<GatewayInfo | null>(null);
  const reqCounterRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);
  const connectReqIdRef = useRef<string | null>(null);
  const connectNonceRef = useRef<string | null>(null);
  const connectInFlightRef = useRef(false);
  const manualCloseRef = useRef(false);
  const activeRunsRef = useRef<Map<string, { runId: string; startedAt: number }>>(new Map());
  const [mainSessionKey, setMainSessionKey] = useState('main');
  const chatSendReqRef = useRef<{ id: string; clientRunId: string; sessionKey: string } | null>(null);

  const sessionKeyByRunId = (runId: string): string | null => {
    for (const [key, entry] of activeRunsRef.current.entries()) {
      if (entry.runId === runId) return key;
    }
    return null;
  };

  const clearActivity = useCallback((sessionKey: string) => {
    setActivityBySession((prev) => ({ ...prev, [sessionKey]: null }));
  }, []);

  const nextReqId = () => `studio-${++reqCounterRef.current}`;

  const appendMessage = useCallback((sessionKey: string, msg: ChatMessage) => {
    setMessagesBySession((prev) => {
      const list = prev[sessionKey] || [];
      return { ...prev, [sessionKey]: [...list, msg] };
    });
  }, []);

  const setAssistantStream = useCallback(
    (sessionKey: string, runId: string, text: string, streaming: boolean) => {
      setMessagesBySession((prev) => {
        const list = prev[sessionKey] || [];
        let index = -1;
        for (let i = list.length - 1; i >= 0; i -= 1) {
          if (list[i].role === 'assistant' && list[i].runId === runId) {
            index = i;
            break;
          }
        }

        if (index === -1) {
          return {
            ...prev,
            [sessionKey]: [
              ...list,
              {
                id: `assistant-${runId}`,
                role: 'assistant',
                text,
                streaming,
                runId,
                timestamp: Date.now(),
              },
            ],
          };
        }

        const next = list.slice();
        next[index] = {
          ...next[index],
          text,
          streaming,
        };
        return { ...prev, [sessionKey]: next };
      });
    },
    [],
  );

  const finishAssistantStream = useCallback(
    (sessionKey: string, runId: string, fallbackText = '') => {
      setMessagesBySession((prev) => {
        const list = prev[sessionKey] || [];
        let index = -1;
        for (let i = list.length - 1; i >= 0; i -= 1) {
          if (list[i].role === 'assistant' && list[i].runId === runId) {
            index = i;
            break;
          }
        }

        if (index === -1) {
          if (!fallbackText.trim()) return prev;
          return {
            ...prev,
            [sessionKey]: [
              ...list,
              {
                id: `assistant-${runId}`,
                role: 'assistant',
                text: fallbackText,
                streaming: false,
                runId,
                timestamp: Date.now(),
              },
            ],
          };
        }

        const next = list.slice();
        const current = next[index];
        next[index] = {
          ...current,
          text: current.text || fallbackText,
          streaming: false,
        };
        return { ...prev, [sessionKey]: next };
      });
    },
    [],
  );

  const connect = useCallback(async () => {
    if (connectInFlightRef.current) return;
    connectInFlightRef.current = true;
    setStatus('connecting');
    setErrorDetail(null);

    try {
      const res = await fetch('/api/gateway');
      if (!res.ok) {
        setStatus('unavailable');
        return;
      }

      const info = (await res.json()) as GatewayInfo;
      infoRef.current = info;

      const wsUrl = `ws://${info.host}:${info.port}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      connectReqIdRef.current = null;
      connectNonceRef.current = null;

      ws.onmessage = (ev) => {
        let msg: GatewayEnvelope;
        try {
          msg = JSON.parse(ev.data);
        } catch {
          return;
        }

        if (msg.type === 'event' && msg.event === 'connect.challenge') {
          const payload = msg.payload as { nonce?: unknown } | undefined;
          const nonce = typeof payload?.nonce === 'string' ? payload.nonce : null;
          if (!nonce || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
          if (connectReqIdRef.current) return;

          connectNonceRef.current = nonce;

          void (async () => {
            try {
              const identity = await getDeviceIdentity();
              const signedAt = Date.now();
              const token = infoRef.current?.token;
              const device =
                identity && connectNonceRef.current
                  ? {
                      id: identity.deviceId,
                      publicKey: identity.publicKey,
                      signedAt,
                      nonce: connectNonceRef.current,
                      signature: await signDevicePayload(
                        identity,
                        buildDeviceSignaturePayload({
                          deviceId: identity.deviceId,
                          clientId: CONTROL_UI_CLIENT_ID,
                          clientMode: CONTROL_UI_CLIENT_MODE,
                          role: 'operator',
                          scopes: OPERATOR_SCOPES,
                          signedAtMs: signedAt,
                          token,
                          nonce: connectNonceRef.current,
                        }),
                      ),
                    }
                  : undefined;

              const connectReqId = nextReqId();
              connectReqIdRef.current = connectReqId;

              ws.send(
                JSON.stringify({
                  type: 'req',
                  id: connectReqId,
                  method: 'connect',
                  params: {
                    minProtocol: 3,
                    maxProtocol: 3,
                    client: {
                      id: CONTROL_UI_CLIENT_ID,
                      version: 'studio',
                      platform: navigator.platform || 'web',
                      mode: CONTROL_UI_CLIENT_MODE,
                      instanceId: getRunId(),
                    },
                    role: 'operator',
                    scopes: OPERATOR_SCOPES,
                    caps: ['tool-events'],
                    auth: token ? { token } : undefined,
                    userAgent: navigator.userAgent,
                    locale: navigator.language,
                    device,
                  },
                }),
              );
            } catch (error) {
              setStatus('error');
              setErrorDetail(String(error));
            }
          })();
          return;
        }

        if (msg.type === 'res' && msg.id === connectReqIdRef.current) {
          connectReqIdRef.current = null;
          if (msg.ok) {
            setStatus('ready');
            setErrorDetail(null);
            const helloPayload = msg.payload as
              | { snapshot?: { sessionDefaults?: { mainSessionKey?: unknown } } }
              | undefined;
            const msk = helloPayload?.snapshot?.sessionDefaults?.mainSessionKey;
            if (typeof msk === 'string' && msk) setMainSessionKey(msk);
          } else {
            setStatus('error');
            setErrorDetail(msg.error?.message || 'Gateway rejected connection');
          }
          return;
        }

        if (msg.type === 'event' && msg.event === 'chat') {
          const payload = msg.payload as
            | {
                sessionKey?: unknown;
                runId?: unknown;
                state?: unknown;
                message?: unknown;
                errorMessage?: unknown;
              }
            | undefined;

          const sessionKey = typeof payload?.sessionKey === 'string' ? payload.sessionKey : null;
          const runId = typeof payload?.runId === 'string' ? payload.runId : null;
          const state = typeof payload?.state === 'string' ? payload.state : null;

          if (!sessionKey || !state) return;

          if (state === 'delta' && runId) {
            const text = getMessageText(payload?.message);
            if (text.trim()) setAssistantStream(sessionKey, runId, text, true);
            setActivityBySession((prev) => {
              const current = prev[sessionKey];
              if (current && (current.stream === 'thinking' || current.stream === 'pending')) {
                return { ...prev, [sessionKey]: { stream: 'text', label: 'Generating…', since: current.since } };
              }
              return prev;
            });
            return;
          }

          if (state === 'final') {
            const role = getMessageRole(payload?.message);
            const text = getMessageText(payload?.message);

            if (runId) {
              activeRunsRef.current.delete(sessionKey);
              clearActivity(sessionKey);
            }

            if (role === 'assistant') {
              if (runId) {
                finishAssistantStream(sessionKey, runId, text);
              } else if (text.trim()) {
                appendMessage(sessionKey, {
                  id: `assistant-${Date.now()}`,
                  role: 'assistant',
                  text,
                  streaming: false,
                  timestamp: Date.now(),
                });
              }
            }
            return;
          }

          if (state === 'aborted') {
            if (runId) {
              activeRunsRef.current.delete(sessionKey);
              clearActivity(sessionKey);
              const text = getMessageText(payload?.message);
              finishAssistantStream(sessionKey, runId, text);
            }
            return;
          }

          if (state === 'error') {
            if (runId) {
              activeRunsRef.current.delete(sessionKey);
              clearActivity(sessionKey);
              finishAssistantStream(sessionKey, runId);
            }
            setErrorDetail(
              typeof payload?.errorMessage === 'string' ? payload.errorMessage : 'chat error',
            );
          }
          return;
        }

        if (msg.type === 'event' && msg.event === 'session.message') {
          const payload = msg.payload as
            | {
                sessionKey?: unknown;
                row?: unknown;
              }
            | undefined;
          const sessionKey = typeof payload?.sessionKey === 'string' ? payload.sessionKey : null;
          if (!sessionKey) return;
          const role = getMessageRole(payload.row);
          const text = getMessageText(payload.row);
          if (role === 'assistant' && text.trim()) {
            appendMessage(sessionKey, {
              id: `assistant-${Date.now()}`,
              role,
              text,
              streaming: false,
              timestamp: Date.now(),
            });
          }
          return;
        }

        // Agent events — model working status (thinking, tool_use, etc.)
        if (msg.type === 'event' && msg.event === 'agent') {
          const payload = msg.payload as
            | { runId?: unknown; stream?: unknown; data?: unknown }
            | undefined;
          const runId = typeof payload?.runId === 'string' ? payload.runId : null;
          const stream = typeof payload?.stream === 'string' ? payload.stream : null;
          if (!runId || !stream) return;

          const sk = sessionKeyByRunId(runId);
          if (!sk) return;

          let label = stream;
          if (stream === 'thinking') {
            label = 'Thinking…';
          } else if (stream === 'tool_use') {
            const data = payload?.data as Record<string, unknown> | undefined;
            const toolName = typeof data?.name === 'string' ? data.name : '';
            label = toolName ? `Using tool: ${toolName}` : 'Using tool…';
          }

          setActivityBySession((prev) => ({
            ...prev,
            [sk]: { stream, label, since: prev[sk]?.since ?? Date.now() },
          }));
          return;
        }

        // Handle chat.send success response — capture server-assigned runId
        if (msg.type === 'res' && msg.ok && chatSendReqRef.current && msg.id === chatSendReqRef.current.id) {
          const { clientRunId, sessionKey: sk } = chatSendReqRef.current;
          chatSendReqRef.current = null;
          const resPayload = msg.payload as { runId?: unknown } | undefined;
          const serverRunId = typeof resPayload?.runId === 'string' ? resPayload.runId : null;
          if (serverRunId && serverRunId !== clientRunId) {
            const entry = activeRunsRef.current.get(sk);
            if (entry && entry.runId === clientRunId) {
              activeRunsRef.current.set(sk, { ...entry, runId: serverRunId });
            }
          }
        }

        if (msg.type === 'res' && !msg.ok) {
          setErrorDetail(msg.error?.message || 'Gateway request failed');
        }
      };

      ws.onerror = () => {
        setStatus('error');
        setErrorDetail('WebSocket error');
      };

      ws.onclose = () => {
        wsRef.current = null;
        connectReqIdRef.current = null;
        connectNonceRef.current = null;
        if (manualCloseRef.current) return;
        setStatus('disconnected');
        if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = window.setTimeout(() => {
          void connect();
        }, 3000);
      };
    } catch (err) {
      setStatus('error');
      setErrorDetail(String(err));
    } finally {
      connectInFlightRef.current = false;
    }
  }, [appendMessage, finishAssistantStream, setAssistantStream]);

  useEffect(() => {
    manualCloseRef.current = false;
    void connect();
    return () => {
      manualCloseRef.current = true;
      if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const sendMessage = useCallback(
    (sessionKey: string, text: string) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN || status !== 'ready') return false;

      const trimmed = text.trim();
      if (!trimmed) return false;

      const runId = getRunId();
      activeRunsRef.current.set(sessionKey, { runId, startedAt: Date.now() });

      setActivityBySession((prev) => ({
        ...prev,
        [sessionKey]: { stream: 'pending', label: 'Sending…', since: Date.now() },
      }));

      appendMessage(sessionKey, {
        id: `user-${runId}`,
        role: 'user',
        text: trimmed,
        streaming: false,
        timestamp: Date.now(),
      });

      const sendReqId = nextReqId();
      chatSendReqRef.current = { id: sendReqId, clientRunId: runId, sessionKey };

      ws.send(
        JSON.stringify({
          type: 'req',
          id: sendReqId,
          method: 'chat.send',
          params: {
            sessionKey,
            message: trimmed,
            deliver: false,
            idempotencyKey: runId,
          },
        }),
      );
      return true;
    },
    [appendMessage, status],
  );

  const abort = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    let latest: { sessionKey: string; runId: string; startedAt: number } | null = null;
    for (const [sessionKey, entry] of activeRunsRef.current.entries()) {
      if (!latest || entry.startedAt > latest.startedAt) {
        latest = { sessionKey, runId: entry.runId, startedAt: entry.startedAt };
      }
    }
    if (!latest) return;

    ws.send(
      JSON.stringify({
        type: 'req',
        id: nextReqId(),
        method: 'chat.abort',
        params: {
          sessionKey: latest.sessionKey,
          runId: latest.runId,
        },
      }),
    );
  }, []);

  return {
    status,
    errorDetail,
    messagesBySession,
    activityBySession,
    mainSessionKey,
    sendMessage,
    abort,
  };
}
