import { useState, useEffect, useRef, useCallback } from 'react';

export interface AgentNode {
  id: string;
  name: string;
  emoji: string;
  role: string;
  model: string;
  workspace: string;
  status: 'online' | 'running' | 'waiting' | 'offline';
  isChief: boolean;
  allowedAgents: string[];
  tools: string[];
  toolsAlsoAllow: string[];
  skills: string[];
  skillsOverride: boolean;
  files: Record<string, string | undefined>;
}

export interface SymlinkInfo {
  name: string;
  target: string;
  targetAgent: string;
  resolvedPath: string;
}

export interface ProjectInfo {
  id: string;
  path: string;
  symlinks: SymlinkInfo[];
  task?: {
    status: string;
    phase: number;
    steps: Record<string, { status: string; agent: string; file?: string; dir?: string }>;
    createdAt: string;
    updatedAt: string;
  };
}

export interface TeamInfo {
  name: string;
  path: string;
  agentsDoc?: string;
  projects: ProjectInfo[];
  scripts: string[];
}

export interface EdgeInfo {
  id: string;
  source: string;
  target: string;
  layer: 'command' | 'dataflow' | 'sequence';
  label?: string;
  data?: {
    file?: string;
    step?: number;
    parallel?: boolean;
  };
}

export interface GraphModel {
  agents: AgentNode[];
  teams: TeamInfo[];
  edges: EdgeInfo[];
}

export function useGraph() {
  const [graph, setGraph] = useState<GraphModel | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = import.meta.env.DEV ? 'localhost:3777' : window.location.host;
    const wsUrl = `${protocol}//${wsHost}/ws`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      // Reconnect after 2 seconds
      setTimeout(connect, 2000);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'graph') {
          setGraph(msg.data);
        }
      } catch {
        // ignore parse errors
      }
    };

    wsRef.current = ws;
  }, []);

  useEffect(() => {
    connect();
    return () => wsRef.current?.close();
  }, [connect]);

  return { graph, connected };
}
