import fs from 'fs';
import os from 'os';
import path from 'path';
import type { OpenClawConfig, AgentConfig } from './types.js';

const OPENCLAW_DIR = path.join(os.homedir(), '.openclaw');

const SAFE_ID_RE = /^[a-z][a-z0-9-]*$/;

function ensureWithinOpenClaw(targetPath: string): boolean {
  const resolved = path.resolve(targetPath);
  return resolved.startsWith(OPENCLAW_DIR + path.sep) || resolved === OPENCLAW_DIR;
}

function readConfig(): OpenClawConfig | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(OPENCLAW_DIR, 'openclaw.json'), 'utf-8'));
  } catch {
    return null;
  }
}

function writeConfig(config: OpenClawConfig) {
  fs.writeFileSync(path.join(OPENCLAW_DIR, 'openclaw.json'), JSON.stringify(config, null, 2), 'utf-8');
}

export interface CreateAgentInput {
  id: string;
  name: string;
  emoji: string;
  role: string;
  model?: string;
  soulDescription?: string;
  tools?: string[];
}

export interface CreateTeamInput {
  teamName: string;
  chiefId?: string;
  members: CreateAgentInput[];
  templates?: { name: string; file: string }[];
}

export interface CreateSymlinkInput {
  projectId: string;
  teamPath: string;
  sourceAgent: string;
  sourceFile: string;
  linkName: string;
}

function generateSoulMd(agent: CreateAgentInput): string {
  return `# SOUL.md - ${agent.name}

## Core Identity

**${agent.emoji} ${agent.name}**

${agent.soulDescription || `You are ${agent.role}, a member of the team.`}

## Your Role

${agent.role}

## Your Principles

### 1. Quality First
- Every output must meet the team's quality standards
- If unsure, ask rather than guess

### 2. Collaboration
- Read shared workspace files from other agents before starting work
- Write your outputs promptly so downstream agents can proceed

## Output Structure

Your output path:
\`\`\`
~/.openclaw/workspace-${agent.id}/outputs/{project-id}/
\`\`\`

## Memory

- **Daily notes:** \`memory/YYYY-MM-DD.md\`
- **Long-term:** \`MEMORY.md\`

---

_This file will grow as we work together._
`;
}

function generateIdentityMd(agent: CreateAgentInput): string {
  return `# IDENTITY.md - Who Am I?

- **Name:** ${agent.name.split(' - ')[0]}
- **Creature:** AI ${agent.role}
- **Vibe:** Professional, focused, collaborative
- **Emoji:** ${agent.emoji}
- **Role:** ${agent.role}

---

${agent.soulDescription || `I am ${agent.role}.`}
`;
}

function generateAgentsMd(agent: CreateAgentInput): string {
  return `# ${agent.name.split(' - ')[0]} Workspace

I am ${agent.name}.

## Session Startup

1. Read \`SOUL.md\`
2. Read \`USER.md\`
3. Read task instructions

## Responsibilities

- ${agent.role}

## Output Directory

- \`outputs/\` - organized by project ID

## Collaboration

- **Coordinator**: Chief — dispatches tasks via \`sessions_spawn\`
`;
}

function generateHeartbeatMd(): string {
  return `# HEARTBEAT.md

# Keep this file empty (or with only comments) to skip heartbeat API calls.

# Add tasks below when you want the agent to check something periodically.
`;
}

function generateTeamAgentsMd(teamName: string, members: CreateAgentInput[]): string {
  const memberList = members
    .map((m) => `### ${m.emoji} ${m.name}\n- **Role**: ${m.role}\n- **Workspace**: \`~/.openclaw/workspace-${m.id}/\``)
    .join('\n\n');

  return `# ${teamName} - Team Configuration

## Team Members

${memberList}

## Collaboration Flow

Chief dispatches tasks to agents via \`sessions_spawn\`.
Agents write outputs to their workspace, then sync to shared-workspace via symlinks.

## Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| \`init-project.sh\` | Initialize new project | \`./init-project.sh {project-id}\` |
| \`sync-output.sh\` | Sync agent output to shared folder | \`./sync-output.sh {agent} {project-id}\` |
| \`cleanup-project.sh\` | Archive old projects | \`./cleanup-project.sh\` |

## File System Collaboration

No APIs, no message queues. Just files.

---

_"Simplicity is the ultimate sophistication."_
`;
}

function generateInitProjectSh(teamName: string, members: CreateAgentInput[]): string {
  const agentDirs = members
    .map((m) => `AGENT_${m.id.toUpperCase()}_DIR="$HOME/.openclaw/workspace-${m.id}/outputs"`)
    .join('\n');

  const mkdirs = members.map((m) => `mkdir -p "$AGENT_${m.id.toUpperCase()}_DIR/$PROJECT_ID"`).join('\n');

  const symlinks = members
    .map((m, i) => {
      const num = String(i + 1).padStart(2, '0');
      return `ln -s "$AGENT_${m.id.toUpperCase()}_DIR/$PROJECT_ID" "$PROJECT_DIR/${num}-${m.id}"
echo "  symlink: ${num}-${m.id} -> workspace-${m.id}"`;
    })
    .join('\n');

  const taskSteps: Record<string, unknown> = {};
  members.forEach((m, i) => {
    taskSteps[m.id] = { status: 'pending', agent: m.id, dir: `${String(i + 1).padStart(2, '0')}-${m.id}` };
  });

  return `#!/bin/bash
# Project initialization script for ${teamName}
# Usage: ./init-project.sh <project-id>

set -e

BASE_DIR="$HOME/.openclaw/workspace/${teamName}"
SHARED_DIR="$BASE_DIR/shared-workspace/projects"

${agentDirs}

if [ -z "$1" ]; then
    echo "Error: missing project ID"
    echo "Usage: $0 <project-id>"
    exit 1
fi

PROJECT_ID="$1"
PROJECT_DIR="$SHARED_DIR/$PROJECT_ID"

if [ -d "$PROJECT_DIR" ]; then
    echo "Error: project '$PROJECT_ID' already exists"
    exit 1
fi

echo "Creating project: $PROJECT_ID"
mkdir -p "$PROJECT_DIR"
${mkdirs}

# Create symlinks
${symlinks}

# Create TASK.json
cat > "$PROJECT_DIR/TASK.json" << EOF
{
  "projectId": "$PROJECT_ID",
  "status": "created",
  "phase": 0,
  "createdAt": "$(date -Iseconds)",
  "updatedAt": "$(date -Iseconds)",
  "steps": ${JSON.stringify(taskSteps, null, 4)}
}
EOF

echo "Project initialized: $PROJECT_DIR"
`;
}

function generateSyncOutputSh(teamName: string, members: CreateAgentInput[]): string {
  const cases = members
    .map((m, i) => {
      const num = String(i + 1).padStart(2, '0');
      return `    ${m.id})
        AGENT_DIR="$HOME/.openclaw/workspace-${m.id}/outputs"
        SHARED_FILE="${num}-${m.id}"
        ;;`;
    })
    .join('\n');

  return `#!/bin/bash
# Sync agent output to shared workspace
# Usage: ./sync-output.sh <agent-name> <project-id>

set -e

BASE_DIR="$HOME/.openclaw/workspace/${teamName}"
SHARED_DIR="$BASE_DIR/shared-workspace/projects"

if [ -z "$1" ] || [ -z "$2" ]; then
    echo "Usage: $0 <agent-name> <project-id>"
    exit 1
fi

AGENT_NAME="$1"
PROJECT_ID="$2"

case "$AGENT_NAME" in
${cases}
    *)
        echo "Unknown agent: $AGENT_NAME"
        exit 1
        ;;
esac

PROJECT_DIR="$SHARED_DIR/$PROJECT_ID"
SOURCE_DIR="$AGENT_DIR/$PROJECT_ID"
TARGET_LINK="$PROJECT_DIR/$SHARED_FILE"

if [ -L "$TARGET_LINK" ]; then rm "$TARGET_LINK"; fi
ln -s "$SOURCE_DIR" "$TARGET_LINK"
echo "Synced: $TARGET_LINK -> $SOURCE_DIR"
`;
}

function generateCleanupSh(): string {
  return `#!/bin/bash
# Cleanup shared workspace projects
# Archives completed projects

set -e

SHARED_DIR="$(dirname "$0")/shared-workspace/projects"
ARCHIVE_DIR="$(dirname "$0")/shared-workspace/archive"

if [ ! -d "$SHARED_DIR" ]; then
    echo "No projects directory found"
    exit 0
fi

mkdir -p "$ARCHIVE_DIR"

for project in "$SHARED_DIR"/*/; do
    if [ -d "$project" ]; then
        name=$(basename "$project")
        echo "Archiving: $name"
        mv "$project" "$ARCHIVE_DIR/$name"
    fi
done

echo "Cleanup complete"
`;
}

export function createAgent(input: CreateAgentInput): { ok: boolean; error?: string } {
  if (!SAFE_ID_RE.test(input.id)) {
    return { ok: false, error: 'Agent ID must match /^[a-z][a-z0-9-]*$/' };
  }

  const config = readConfig();
  if (!config) return { ok: false, error: 'openclaw.json not found' };

  if (config.agents.list.some((a) => a.id === input.id)) {
    return { ok: false, error: `Agent "${input.id}" already exists` };
  }

  const workspace = path.join(OPENCLAW_DIR, `workspace-${input.id}`);

  // Create workspace directory structure
  try {
    fs.mkdirSync(workspace, { recursive: true });
    fs.mkdirSync(path.join(workspace, 'outputs'), { recursive: true });
    fs.mkdirSync(path.join(workspace, 'memory'), { recursive: true });

    fs.writeFileSync(path.join(workspace, 'SOUL.md'), generateSoulMd(input));
    fs.writeFileSync(path.join(workspace, 'IDENTITY.md'), generateIdentityMd(input));
    fs.writeFileSync(path.join(workspace, 'AGENTS.md'), generateAgentsMd(input));
    fs.writeFileSync(path.join(workspace, 'HEARTBEAT.md'), generateHeartbeatMd());
  } catch (err) {
    return { ok: false, error: `Failed to create workspace: ${err}` };
  }

  // Register in openclaw.json
  const agentEntry: AgentConfig = {
    id: input.id,
    name: input.name,
    workspace,
    model: input.model || config.agents.defaults.model.primary,
    tools: {
      allow: input.tools || ['read', 'write', 'edit', 'exec', 'web_search', 'web_fetch', 'sessions_list', 'sessions_history', 'sessions_send', 'sessions_spawn'],
    },
  };

  config.agents.list.push(agentEntry);

  // Add to agentToAgent allow list
  if (config.tools.agentToAgent?.allow && !config.tools.agentToAgent.allow.includes(input.id)) {
    config.tools.agentToAgent.allow.push(input.id);
  }

  try {
    writeConfig(config);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: `Failed to update config: ${err}` };
  }
}

export function createTeam(input: CreateTeamInput): { ok: boolean; error?: string } {
  if (!SAFE_ID_RE.test(input.teamName)) {
    return { ok: false, error: 'Team name must match /^[a-z][a-z0-9-]*$/' };
  }

  const config = readConfig();
  if (!config) return { ok: false, error: 'openclaw.json not found' };

  const defaultWorkspace = config.agents.defaults.workspace;
  const teamDir = path.join(defaultWorkspace, input.teamName);

  if (fs.existsSync(teamDir)) {
    return { ok: false, error: `Team directory "${input.teamName}" already exists` };
  }

  // Create each agent
  for (const member of input.members) {
    const result = createAgent(member);
    if (!result.ok) return result;
  }

  // If chiefId specified, add allowAgents to chief
  const freshConfig = readConfig();
  if (freshConfig && input.chiefId) {
    const chief = freshConfig.agents.list.find((a) => a.id === input.chiefId);
    if (chief) {
      if (!chief.subagents) chief.subagents = {};
      const existing = chief.subagents.allowAgents || [];
      const newIds = input.members.map((m) => m.id).filter((id) => !existing.includes(id));
      chief.subagents.allowAgents = [...existing, ...newIds];
      writeConfig(freshConfig);
    }
  }

  // Create team directory structure
  try {
    fs.mkdirSync(teamDir, { recursive: true });
    fs.mkdirSync(path.join(teamDir, 'shared-workspace', 'projects'), { recursive: true });
    fs.mkdirSync(path.join(teamDir, 'shared-workspace', 'templates'), { recursive: true });

    fs.writeFileSync(path.join(teamDir, 'AGENTS.md'), generateTeamAgentsMd(input.teamName, input.members));

    const initSh = generateInitProjectSh(input.teamName, input.members);
    fs.writeFileSync(path.join(teamDir, 'init-project.sh'), initSh, { mode: 0o755 });

    const syncSh = generateSyncOutputSh(input.teamName, input.members);
    fs.writeFileSync(path.join(teamDir, 'sync-output.sh'), syncSh, { mode: 0o755 });

    const cleanupSh = generateCleanupSh();
    fs.writeFileSync(path.join(teamDir, 'cleanup-project.sh'), cleanupSh, { mode: 0o755 });
  } catch (err) {
    return { ok: false, error: `Failed to create team directory: ${err}` };
  }

  return { ok: true };
}

export function createSymlink(input: CreateSymlinkInput): { ok: boolean; error?: string } {
  const config = readConfig();
  if (!config) return { ok: false, error: 'openclaw.json not found' };

  const agent = config.agents.list.find((a) => a.id === input.sourceAgent);
  if (!agent) return { ok: false, error: `Agent "${input.sourceAgent}" not found` };

  const agentOutputDir = path.join(agent.workspace, 'outputs', input.projectId);
  const sourcePath = path.join(agentOutputDir, input.sourceFile);
  const linkPath = path.join(input.teamPath, 'shared-workspace', 'projects', input.projectId, input.linkName);

  // Path traversal protection
  if (!ensureWithinOpenClaw(sourcePath) || !ensureWithinOpenClaw(linkPath)) {
    return { ok: false, error: 'Invalid path: must be within ~/.openclaw/' };
  }

  // Ensure directories exist
  try {
    fs.mkdirSync(agentOutputDir, { recursive: true });
    fs.mkdirSync(path.dirname(linkPath), { recursive: true });

    // Create source file if it doesn't exist
    if (!fs.existsSync(sourcePath)) {
      fs.writeFileSync(sourcePath, '', 'utf-8');
    }

    // Remove existing symlink if present
    try {
      const stats = fs.lstatSync(linkPath);
      if (stats.isSymbolicLink()) fs.unlinkSync(linkPath);
    } catch {
      // doesn't exist, fine
    }

    fs.symlinkSync(sourcePath, linkPath);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: `Failed to create symlink: ${err}` };
  }
}

export function deleteAgent(agentId: string): { ok: boolean; error?: string } {
  const config = readConfig();
  if (!config) return { ok: false, error: 'openclaw.json not found' };

  const idx = config.agents.list.findIndex((a) => a.id === agentId);
  if (idx === -1) return { ok: false, error: `Agent "${agentId}" not found` };

  // Don't allow deleting the default/chief agent
  if (config.agents.list[idx].default) {
    return { ok: false, error: 'Cannot delete the default (chief) agent' };
  }

  // Remove from agents list
  config.agents.list.splice(idx, 1);

  // Remove from agentToAgent allow list
  if (config.tools.agentToAgent?.allow) {
    config.tools.agentToAgent.allow = config.tools.agentToAgent.allow.filter((id) => id !== agentId);
  }

  // Remove from any chief's allowAgents
  for (const a of config.agents.list) {
    if (a.subagents?.allowAgents) {
      a.subagents.allowAgents = a.subagents.allowAgents.filter((id) => id !== agentId);
    }
  }

  try {
    writeConfig(config);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: `Failed to update config: ${err}` };
  }
}
