export interface AgentConfig {
  id: string;
  name: string;
  default?: boolean;
  workspace: string;
  model?: string;
  subagents?: {
    allowAgents?: string[];
  };
  tools?: {
    profile?: string;
    allow?: string[];
    alsoAllow?: string[];
    deny?: string[];
  };
}

export interface OpenClawConfig {
  agents: {
    defaults: {
      model: { primary: string; fallbacks?: string[] };
      workspace: string;
      maxConcurrent: number;
      subagents: { maxConcurrent: number; archiveAfterMinutes: number };
    };
    list: AgentConfig[];
  };
  tools: {
    agentToAgent?: {
      enabled: boolean;
      allow: string[];
    };
  };
}

export interface WorkspaceFiles {
  soul?: string;
  identity?: string;
  agents?: string;
  heartbeat?: string;
  tools?: string;
  user?: string;
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
  files: WorkspaceFiles;
}

export interface GraphModel {
  agents: AgentNode[];
  teams: TeamInfo[];
  edges: EdgeInfo[];
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

export type WsMessage =
  | { type: 'graph'; data: GraphModel }
  | { type: 'agent-status'; agentId: string; status: AgentNode['status'] }
  | { type: 'file-changed'; path: string; agent: string }
  | { type: 'task-updated'; projectId: string; task: ProjectInfo['task'] };
