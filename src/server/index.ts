import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import {
  scanOpenClaw,
  updateAgentFile,
  updateAgentConfig,
  getAvailableTools,
  getAvailableSkills,
  getGatewayInfo,
} from './scanner.js';
import { createAgent, createTeam, createSymlink, deleteAgent } from './creator.js';
import { FileWatcher } from './watcher.js';
import type { WsMessage } from './types.js';

const PORT = 3777;
const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

app.use(express.json());

// REST API
app.get('/api/graph', (_req, res) => {
  const graph = scanOpenClaw();
  res.json(graph);
});

// P2: File update APIs
app.put('/api/agent/:agentId/file/:fileType', (req, res) => {
  const { agentId, fileType } = req.params;
  const { content } = req.body;
  if (typeof content !== 'string') {
    res.status(400).json({ error: 'content must be a string' });
    return;
  }
  const result = updateAgentFile(agentId, fileType, content);
  if (result.error) {
    res.status(404).json(result);
    return;
  }
  res.json(result);
});

app.put('/api/agent/:agentId/config', (req, res) => {
  const { agentId } = req.params;
  const updates = req.body;
  const result = updateAgentConfig(agentId, updates);
  if (result.error) {
    res.status(404).json(result);
    return;
  }
  res.json(result);
});

// Available tools list
app.get('/api/tools', (_req, res) => {
  const tools = getAvailableTools();
  res.json({ tools });
});

// Skills available to a specific agent (resolved enabled/disabled)
app.get('/api/agent/:agentId/skills', (req, res) => {
  const skills = getAvailableSkills(req.params.agentId);
  res.json({ skills });
});

// Gateway connection info (for client-side chat)
app.get('/api/gateway', (_req, res) => {
  const info = getGatewayInfo();
  if (!info) {
    res.status(404).json({ error: 'Gateway not configured' });
    return;
  }
  res.json(info);
});

// P3: Creation APIs
app.post('/api/agent', (req, res) => {
  const result = createAgent(req.body);
  res.status(result.ok ? 201 : 400).json(result);
});

app.post('/api/team', (req, res) => {
  const result = createTeam(req.body);
  res.status(result.ok ? 201 : 400).json(result);
});

app.post('/api/symlink', (req, res) => {
  const result = createSymlink(req.body);
  res.status(result.ok ? 201 : 400).json(result);
});

app.delete('/api/agent/:agentId', (req, res) => {
  const result = deleteAgent(req.params.agentId);
  res.status(result.ok ? 200 : 400).json(result);
});

// File read/write API (for project file preview)
import fs from 'fs';
import os from 'os';
import path from 'path';

const OPENCLAW_DIR = path.join(os.homedir(), '.openclaw');

function isWithinOpenClaw(filePath: string): boolean {
  const resolved = path.resolve(filePath);
  return resolved.startsWith(OPENCLAW_DIR + path.sep) || resolved === OPENCLAW_DIR;
}

app.get('/api/file', (req, res) => {
  const filePath = req.query.path as string;
  if (!filePath || !isWithinOpenClaw(filePath)) {
    res.status(400).json({ error: 'Invalid path: must be within ~/.openclaw/' });
    return;
  }
  try {
    // Resolve symlinks to read the actual file
    let realPath = filePath;
    try { realPath = fs.realpathSync(filePath); } catch { /* use as-is */ }
    const content = fs.readFileSync(realPath, 'utf-8');
    res.json({ content, realPath });
  } catch (err) {
    res.status(404).json({ error: `File not found: ${err}` });
  }
});

app.put('/api/file', (req, res) => {
  const { path: filePath, content } = req.body;
  if (!filePath || typeof content !== 'string') {
    res.status(400).json({ error: 'path and content are required' });
    return;
  }
  if (!isWithinOpenClaw(filePath)) {
    res.status(400).json({ error: 'Invalid path: must be within ~/.openclaw/' });
    return;
  }
  try {
    // Resolve symlinks to write to the actual file
    let realPath = filePath;
    try { realPath = fs.realpathSync(filePath); } catch { /* use as-is */ }
    if (!isWithinOpenClaw(realPath)) {
      res.status(400).json({ error: 'Resolved path outside ~/.openclaw/' });
      return;
    }
    fs.writeFileSync(realPath, content, 'utf-8');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: `Write failed: ${err}` });
  }
});

// WebSocket
const clients = new Set<WebSocket>();

wss.on('connection', (ws) => {
  clients.add(ws);
  const graph = scanOpenClaw();
  const msg: WsMessage = { type: 'graph', data: graph };
  ws.send(JSON.stringify(msg));

  ws.on('close', () => {
    clients.delete(ws);
  });
});

function broadcast(msg: WsMessage) {
  const data = JSON.stringify(msg);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

// File watcher
const watcher = new FileWatcher((filePath) => {
  console.log(`[watch] File changed: ${filePath}`);
  const graph = scanOpenClaw();
  broadcast({ type: 'graph', data: graph });
  // Refresh watch paths in case new agents/teams were created
  watcher.refresh();
});

watcher.start();

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  ❌ Port ${PORT} is already in use.`);
    console.error(`     Stop whatever is using it, or change PORT in src/server/index.ts.\n`);
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, () => {
  console.log(`\n  🦞 OpenClaw Studio server running at http://localhost:${PORT}`);
  console.log(`  📡 WebSocket at ws://localhost:${PORT}/ws`);
  console.log(`  🔍 Scanning ${OPENCLAW_DIR} for agents...\n`);

  const graph = scanOpenClaw();
  console.log(`  Found ${graph.agents.length} agents, ${graph.teams.length} teams, ${graph.edges.length} edges`);
  if (graph.agents.length === 0) {
    console.log(`  ℹ If ${OPENCLAW_DIR} doesn't exist, run \`openclaw init\` first.`);
  }
  console.log('');
});

process.on('SIGINT', () => {
  watcher.stop();
  server.close();
  process.exit(0);
});
