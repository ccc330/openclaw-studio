import fs from 'fs';
import { createRequire } from 'module';
import os from 'os';
import path from 'path';
import type {
  OpenClawConfig,
  AgentConfig,
  AgentNode,
  TeamInfo,
  ProjectInfo,
  SymlinkInfo,
  EdgeInfo,
  GraphModel,
  WorkspaceFiles,
  SkillInfo,
  GatewayInfo,
} from './types.js';

const require = createRequire(import.meta.url);

const OPENCLAW_DIR = path.join(os.homedir(), '.openclaw');

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

  if (!Array.isArray(config.agents?.list)) {
    console.warn('[scanner] openclaw.json missing agents.list; returning empty graph');
    return { agents: [], teams: [], edges: [] };
  }

  const defaultModel = config.agents.defaults?.model?.primary || 'unknown';
  const defaultWorkspace = config.agents.defaults?.workspace ?? path.join(OPENCLAW_DIR, 'workspace');

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

    const tools: string[] = agentCfg.tools?.allow ? [...agentCfg.tools.allow] : [];
    const toolsAlsoAllow: string[] = agentCfg.tools?.alsoAllow ? [...agentCfg.tools.alsoAllow] : [];

    const defaultSkills = config.agents.defaults?.skills || [];
    const skillsOverride = agentCfg.skills !== undefined;
    const skills = skillsOverride ? agentCfg.skills! : defaultSkills;

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
      toolsAlsoAllow,
      skills,
      skillsOverride,
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
  updates: {
    name?: string;
    model?: string;
    allowAgents?: string[];
    tools?: { allow?: string[] };
    skills?: string[] | null;
  },
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
  if (updates.tools !== undefined) {
    if (!agent.tools) agent.tools = {};
    if (updates.tools.allow !== undefined) agent.tools.allow = updates.tools.allow;
  }
  if (updates.skills !== undefined) {
    if (updates.skills === null) {
      delete agent.skills;
    } else {
      agent.skills = updates.skills;
    }
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

  if (!Array.isArray(config.agents?.list)) return paths;

  for (const agent of config.agents.list) {
    const ws = agent.workspace;
    if (ws && fs.existsSync(ws)) {
      paths.push(ws);
      const outputsDir = path.join(ws, 'outputs');
      if (fs.existsSync(outputsDir)) paths.push(outputsDir);
    }
  }

  // Watch shared-workspace projects for all teams
  const workspaceDir = config.agents.defaults?.workspace;
  if (!workspaceDir) return paths;
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

function parseSkillFrontmatter(content: string): {
  name?: string;
  description?: string;
  emoji?: string;
  homepage?: string;
} {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return {};
  const fm = fmMatch[1];

  // name: value (single-line)
  const name = fm.match(/^name:\s*(.+)$/m)?.[1]?.trim();

  // description: can be literal block (|) or single/multi-line
  let description: string | undefined;
  const descBlockMatch = fm.match(/^description:\s*\|\s*\n([\s\S]+?)(?=\n\S|$)/m);
  if (descBlockMatch) {
    description = descBlockMatch[1]
      .split('\n')
      .map((l) => l.replace(/^  /, ''))
      .join(' ')
      .trim();
  } else {
    const descLineMatch = fm.match(/^description:\s*(.+?)(?=\n\S|$)/ms);
    if (descLineMatch) description = descLineMatch[1].trim().replace(/\s+/g, ' ');
  }

  // emoji from metadata.openclaw.emoji or top-level emoji
  const emojiMatch = fm.match(/emoji:\s*(.+)/);
  const emoji = emojiMatch?.[1]?.trim().replace(/^["']|["']$/g, '');

  // homepage from metadata.openclaw.homepage or top-level homepage
  const homepageMatch = fm.match(/homepage:\s*(.+)/);
  const homepage = homepageMatch?.[1]?.trim().replace(/^["']|["']$/g, '');

  return { name, description, emoji, homepage };
}

function scanSkillDirs(
  dir: string,
  source: 'managed' | 'bundled' | 'workspace',
): Array<Omit<SkillInfo, 'enabled'>> {
  if (!fs.existsSync(dir)) return [];
  const out: Array<Omit<SkillInfo, 'enabled'>> = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skillDir = path.join(dir, entry.name);
      const skillFile = path.join(skillDir, 'SKILL.md');
      if (!fs.existsSync(skillFile)) continue;
      const content = readFileSafe(skillFile) || '';
      const fm = parseSkillFrontmatter(content);
      out.push({
        name: fm.name || entry.name,
        description: fm.description || '',
        emoji: fm.emoji || '🧩',
        homepage: fm.homepage,
        source,
        path: skillDir,
      });
    }
  } catch {
    // directory unreadable
  }
  return out;
}

function findBundledSkillsDir(): string | null {
  // 1. Node module resolution — works when openclaw is linked into the project
  try {
    const pkgJson = require.resolve('openclaw/package.json');
    const dir = path.join(path.dirname(pkgJson), 'skills');
    if (fs.existsSync(dir)) return dir;
  } catch {
    // not resolvable; fall through
  }

  // 2. Node binary's own prefix — covers nvm / fnm / volta on Unix where
  // process.execPath looks like ~/.nvm/versions/node/v22.0.0/bin/node
  const nodePrefix = path.dirname(path.dirname(process.execPath));
  const sibling = path.join(nodePrefix, 'lib', 'node_modules', 'openclaw', 'skills');
  if (fs.existsSync(sibling)) return sibling;

  // 3. Well-known global install locations
  const candidates = [
    path.join(os.homedir(), '.npm-global', 'lib', 'node_modules', 'openclaw', 'skills'),
    '/usr/local/lib/node_modules/openclaw/skills',
    '/opt/homebrew/lib/node_modules/openclaw/skills',
  ];
  if (process.platform === 'win32' && process.env.APPDATA) {
    candidates.push(path.join(process.env.APPDATA, 'npm', 'node_modules', 'openclaw', 'skills'));
  }
  for (const c of candidates) if (fs.existsSync(c)) return c;
  return null;
}

export function getAvailableSkills(agentId: string): SkillInfo[] {
  const config = readJsonSafe<OpenClawConfig>(path.join(OPENCLAW_DIR, 'openclaw.json'));
  if (!config) return [];

  const managed = scanSkillDirs(path.join(OPENCLAW_DIR, 'skills'), 'managed');
  const bundled = findBundledSkillsDir()
    ? scanSkillDirs(findBundledSkillsDir()!, 'bundled')
    : [];

  // Dedup by name (managed wins over bundled)
  const seen = new Set<string>();
  const all: Array<Omit<SkillInfo, 'enabled'>> = [];
  for (const s of [...managed, ...bundled]) {
    if (seen.has(s.name)) continue;
    seen.add(s.name);
    all.push(s);
  }

  const agentCfg = config.agents.list.find((a) => a.id === agentId);
  const enabledSet = new Set<string>(
    agentCfg?.skills !== undefined
      ? agentCfg.skills
      : config.agents.defaults?.skills || [],
  );

  // Apply entries-level disabled flag (globally disables the skill)
  const entries = config.skills?.entries || {};

  return all.map((s) => ({
    ...s,
    enabled: enabledSet.has(s.name) && entries[s.name]?.enabled !== false,
  }));
}

export function getGatewayInfo(): GatewayInfo | null {
  const config = readJsonSafe<OpenClawConfig>(path.join(OPENCLAW_DIR, 'openclaw.json'));
  if (!config?.gateway?.port) return null;
  const bind = config.gateway.bind;
  const host = bind === 'loopback' || bind === 'localhost' || !bind ? '127.0.0.1' : bind;
  return {
    host,
    port: config.gateway.port,
    token: config.gateway.auth?.token,
  };
}

export function getAvailableTools(): string[] {
  const config = readJsonSafe<OpenClawConfig>(path.join(OPENCLAW_DIR, 'openclaw.json'));
  if (!config) return [];

  const toolSet = new Set<string>();

  // Collect from all agents
  for (const agent of config.agents.list) {
    if (agent.tools?.allow) agent.tools.allow.forEach((t) => toolSet.add(t));
    if (agent.tools?.alsoAllow) agent.tools.alsoAllow.forEach((t) => toolSet.add(t));
  }

  // Add well-known OpenClaw tools as a baseline
  const wellKnown = [
    'read', 'write', 'edit', 'apply_patch', 'exec',
    'web_search', 'web_fetch', 'image', 'image_generate',
    'sessions_list', 'sessions_history', 'sessions_send', 'sessions_spawn',
    'sessions_yield', 'subagents', 'session_status',
    'memory_search', 'memory_get', 'browser', 'canvas',
    'message', 'cron', 'gateway', 'agents_list',
    'video_generate', 'tts', 'code_execution', 'process',
  ];
  wellKnown.forEach((t) => toolSet.add(t));

  return [...toolSet].sort();
}
