import fs from 'fs';
import path from 'path';
import type {
  OpenClawConfig,
  AgentNode,
  TeamInfo,
  ProjectInfo,
  SymlinkInfo,
  EdgeInfo,
  GraphModel,
  WorkspaceFiles,
} from './types.js';

const OPENCLAW_DIR = path.join(process.env.HOME || '~', '.openclaw');

function ensureWithinOpenClaw(targetPath: string): boolean {
  const resolved = path.resolve(targetPath);
  return resolved.startsWith(OPENCLAW_DIR + path.sep) || resolved === OPENCLAW_DIR;
}

function readJsonSafe<T>(filePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function readFileSafe(filePath: string): string | undefined {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return undefined;
  }
}

function parseIdentity(content: string): { emoji: string; role: string } {
  const emojiMatch = content.match(/\*\*Emoji:\*\*\s*(.+)/);
  const roleMatch = content.match(/\*\*Role:\*\*\s*(.+)/);
  return {
    emoji: emojiMatch?.[1]?.trim() || '',
    role: roleMatch?.[1]?.trim() || '',
  };
}

function extractEmojiFromName(name: string): string {
  const emojis: Record<string, string> = {
    chief: '🎯',
    researcher: '🔍',
    trendspotter: '🔥',
    copywriter: '✍️',
    designer: '🎨',
  };
  const lower = name.toLowerCase();
  for (const [key, emoji] of Object.entries(emojis)) {
    if (lower.includes(key)) return emoji;
  }
  return '🤖';
}

function scanWorkspaceFiles(workspace: string): WorkspaceFiles {
  return {
    soul: readFileSafe(path.join(workspace, 'SOUL.md')),
    identity: readFileSafe(path.join(workspace, 'IDENTITY.md')),
    agents: readFileSafe(path.join(workspace, 'AGENTS.md')),
    heartbeat: readFileSafe(path.join(workspace, 'HEARTBEAT.md')),
    tools: readFileSafe(path.join(workspace, 'TOOLS.md')),
    user: readFileSafe(path.join(workspace, 'USER.md')),
  };
}

function scanSymlinks(dirPath: string): SymlinkInfo[] {
  const symlinks: SymlinkInfo[] = [];
  try {
    const entries = fs.readdirSync(dirPath);
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry);
      try {
        const stats = fs.lstatSync(fullPath);
        if (stats.isSymbolicLink()) {
          const target = fs.readlinkSync(fullPath);
          const agentMatch = target.match(/workspace-(\w+)/);
          let resolvedPath = fullPath;
          try {
            resolvedPath = fs.realpathSync(fullPath);
          } catch {
            resolvedPath = path.resolve(path.dirname(fullPath), target);
          }
          symlinks.push({
            name: entry,
            target,
            targetAgent: agentMatch?.[1] || 'unknown',
            resolvedPath,
          });
        }
      } catch {
        // skip broken symlinks
      }
    }
  } catch {
    // directory doesn't exist
  }
  return symlinks;
}

function scanProjects(sharedWorkspacePath: string): ProjectInfo[] {
  const projectsDir = path.join(sharedWorkspacePath, 'projects');
  if (!fs.existsSync(projectsDir)) return [];

  const projects: ProjectInfo[] = [];
  try {
    const entries = fs.readdirSync(projectsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const projectPath = path.join(projectsDir, entry.name);
      const symlinks = scanSymlinks(projectPath);
      const task = readJsonSafe<ProjectInfo['task']>(path.join(projectPath, 'TASK.json'));

      projects.push({
        id: entry.name,
        path: projectPath,
        symlinks,
        task: task || undefined,
      });
    }
  } catch {
    // no projects directory
  }
  return projects;
}

function scanTeams(workspacePath: string): TeamInfo[] {
  const teams: TeamInfo[] = [];
  try {
    const entries = fs.readdirSync(workspacePath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const teamPath = path.join(workspacePath, entry.name);

      // A team directory has AGENTS.md and shared-workspace/
      const agentsDoc = readFileSafe(path.join(teamPath, 'AGENTS.md'));
      const sharedWorkspace = path.join(teamPath, 'shared-workspace');
      if (!agentsDoc && !fs.existsSync(sharedWorkspace)) continue;

      const scripts: string[] = [];
      for (const f of ['init-project.sh', 'sync-output.sh', 'cleanup-project.sh']) {
        if (fs.existsSync(path.join(teamPath, f))) scripts.push(f);
      }

      teams.push({
        name: entry.name,
        path: teamPath,
        agentsDoc,
        projects: scanProjects(sharedWorkspace),
        scripts,
      });
    }
  } catch {
    // workspace doesn't exist
  }
  return teams;
}

function buildEdges(agents: AgentNode[], teams: TeamInfo[]): EdgeInfo[] {
  const edges: EdgeInfo[] = [];
  let edgeId = 0;

  // Command layer: Chief → allowed agents (sessions_spawn)
  for (const agent of agents) {
    if (agent.allowedAgents.length > 0) {
      for (const targetId of agent.allowedAgents) {
        edges.push({
          id: `edge-cmd-${edgeId++}`,
          source: agent.id,
          target: targetId,
          layer: 'command',
          label: 'sessions_spawn',
        });
      }
    }
  }

  // Data flow layer: from symlinks in projects
  for (const team of teams) {
    for (const project of team.projects) {
      for (const symlink of project.symlinks) {
        const sourceAgent = symlink.targetAgent;
        // Find downstream agents that read this file
        // Based on the step ordering in TASK.json
        if (project.task?.steps) {
          const steps = Object.entries(project.task.steps);
          const sourceIdx = steps.findIndex(([, s]) => s.agent === sourceAgent);

          for (let i = sourceIdx + 1; i < steps.length; i++) {
            const [, downstream] = steps[i];
            edges.push({
              id: `edge-data-${edgeId++}`,
              source: sourceAgent,
              target: downstream.agent,
              layer: 'dataflow',
              label: symlink.name,
              data: { file: symlink.name },
            });
          }
        }
      }
    }
  }

  // Sequence layer: from TASK.json step ordering
  for (const team of teams) {
    for (const project of team.projects) {
      if (!project.task?.steps) continue;
      const steps = Object.entries(project.task.steps);

      // Group by execution order: researcher+trendspotter are parallel (step 1)
      // Then copywriter (step 2), then designer (step 3)
      const agentsDoc = team.agentsDoc || '';
      const hasParallelHint = agentsDoc.includes('并行');

      let stepNum = 1;
      for (let i = 0; i < steps.length; i++) {
        const [, step] = steps[i];
        const nextStep = steps[i + 1];

        if (nextStep) {
          // Check if current and next are parallel
          const isParallel = i === 0 && hasParallelHint;

          if (!isParallel) {
            edges.push({
              id: `edge-seq-${edgeId++}`,
              source: step.agent,
              target: nextStep[1].agent,
              layer: 'sequence',
              label: `Step ${stepNum}`,
              data: { step: stepNum, parallel: false },
            });
            stepNum++;
          }
        }
      }
    }
  }

  // Deduplicate edges with same source+target+layer
  const seen = new Set<string>();
  return edges.filter((e) => {
    const key = `${e.source}-${e.target}-${e.layer}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function scanOpenClaw(): GraphModel {
  const config = readJsonSafe<OpenClawConfig>(path.join(OPENCLAW_DIR, 'openclaw.json'));
  if (!config) {
    return { agents: [], teams: [], edges: [] };
  }

  const defaultModel = config.agents?.defaults?.model?.primary || 'unknown';
  const defaultWorkspace = config.agents.defaults.workspace;

  const agents: AgentNode[] = config.agents.list.map((agentCfg) => {
    const workspace = agentCfg.workspace || defaultWorkspace;
    const files = scanWorkspaceFiles(workspace);

    let emoji = extractEmojiFromName(agentCfg.name || agentCfg.id);
    let role = '';

    if (files.identity) {
      const parsed = parseIdentity(files.identity);
      if (parsed.emoji) emoji = parsed.emoji;
      if (parsed.role) role = parsed.role;
    }

    if (!role) {
      const nameParts = agentCfg.name?.split(' - ');
      role = nameParts?.[1] || agentCfg.id;
    }

    const tools: string[] = [];
    if (agentCfg.tools?.allow) tools.push(...agentCfg.tools.allow);
    if (agentCfg.tools?.alsoAllow) tools.push(...agentCfg.tools.alsoAllow);

    return {
      id: agentCfg.id,
      name: agentCfg.name || agentCfg.id,
      emoji,
      role,
      model: agentCfg.model || defaultModel,
      workspace,
      status: 'offline' as const,
      isChief: agentCfg.default === true || agentCfg.id === 'main',
      allowedAgents: agentCfg.subagents?.allowAgents || [],
      tools,
      files,
    };
  });

  const teams = scanTeams(defaultWorkspace);
  const edges = buildEdges(agents, teams);

  return { agents, teams, edges };
}

const FILE_TYPE_MAP: Record<string, string> = {
  soul: 'SOUL.md',
  identity: 'IDENTITY.md',
  agents: 'AGENTS.md',
  heartbeat: 'HEARTBEAT.md',
  tools: 'TOOLS.md',
  user: 'USER.md',
};

export function updateAgentFile(
  agentId: string,
  fileType: string,
  content: string,
): { ok: boolean; error?: string } {
  const config = readJsonSafe<OpenClawConfig>(path.join(OPENCLAW_DIR, 'openclaw.json'));
  if (!config) return { ok: false, error: 'openclaw.json not found' };

  const agentCfg = config.agents.list.find((a) => a.id === agentId);
  if (!agentCfg) return { ok: false, error: `Agent "${agentId}" not found` };

  const fileName = FILE_TYPE_MAP[fileType];
  if (!fileName) return { ok: false, error: `Unknown file type "${fileType}"` };

  const workspace = agentCfg.workspace || config.agents.defaults.workspace;
  const filePath = path.join(workspace, fileName);

  if (!ensureWithinOpenClaw(filePath)) {
    return { ok: false, error: 'Invalid path: must be within ~/.openclaw/' };
  }

  try {
    fs.writeFileSync(filePath, content, 'utf-8');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: `Write failed: ${err}` };
  }
}

export function updateAgentConfig(
  agentId: string,
  updates: { name?: string; model?: string; allowAgents?: string[] },
): { ok: boolean; error?: string } {
  const configPath = path.join(OPENCLAW_DIR, 'openclaw.json');
  const config = readJsonSafe<OpenClawConfig>(configPath);
  if (!config) return { ok: false, error: 'openclaw.json not found' };

  const agentIdx = config.agents.list.findIndex((a) => a.id === agentId);
  if (agentIdx === -1) return { ok: false, error: `Agent "${agentId}" not found` };

  const agent = config.agents.list[agentIdx];
  if (updates.name !== undefined) agent.name = updates.name;
  if (updates.model !== undefined) agent.model = updates.model;
  if (updates.allowAgents !== undefined) {
    if (!agent.subagents) agent.subagents = {};
    agent.subagents.allowAgents = updates.allowAgents;
  }

  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: `Write failed: ${err}` };
  }
}

export function getWatchPaths(): string[] {
  const config = readJsonSafe<OpenClawConfig>(path.join(OPENCLAW_DIR, 'openclaw.json'));
  if (!config) return [];

  const paths = [path.join(OPENCLAW_DIR, 'openclaw.json')];

  for (const agent of config.agents.list) {
    const ws = agent.workspace;
    if (ws && fs.existsSync(ws)) {
      paths.push(ws);
      const outputsDir = path.join(ws, 'outputs');
      if (fs.existsSync(outputsDir)) paths.push(outputsDir);
    }
  }

  // Watch shared-workspace projects for all teams
  const workspaceDir = config.agents.defaults.workspace;
  try {
    const entries = fs.readdirSync(workspaceDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const sharedDir = path.join(workspaceDir, entry.name, 'shared-workspace', 'projects');
      if (fs.existsSync(sharedDir)) paths.push(sharedDir);
    }
  } catch {
    // workspace doesn't exist
  }

  return paths;
}
