# OpenClaw Studio

> A visual canvas for OpenClaw multi-agent teams — **configure, orchestrate, and debug** on one screen.

Studio reads `~/.openclaw/` and renders your agents, delegate permissions, workspace symlinks, and TASK.json execution state as an interactive graph. Click an agent to edit its five config files (`IDENTITY.md` / `SOUL.md` / `AGENTS.md` / `TOOLS.md` / `HEARTBEAT.md`) in a side panel — Cmd+S writes straight to disk, the FileWatcher picks it up, the canvas refreshes.

Closest analogy: n8n / Node-RED / Blueprint-class tools, but for agent teams instead of workflow nodes.

This is a **standalone prototype** I built for my own multi-agent setup. The goal is to land a minimum-viable subset of it as a native `Studio` tab in [OpenClaw Control UI](https://github.com/openclaw/openclaw) via upstream PR.

## Status

Prototype. Works on my machine. Early days — feedback welcome.

## Why

Running a multi-agent OpenClaw team today means cross-referencing 5–10 files across 5 workspaces every time you tune a chief, trace a delegate decision, or debug a dataflow. The data is correctly isolated for runtime, but configuring + orchestrating + debugging a team are three workflows that all need the same cross-file mental model. Studio collapses that into one canvas.

## Quick start

Requires Node 20+, an existing `~/.openclaw/` directory with at least one agent.

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173` (Vite dev server) with the backend on `http://localhost:3777` (Express + WS, auto-proxied).

## Architecture

- **Backend** (`src/server/`) — Express + WebSocket on port 3777. `scanner.ts` reads `~/.openclaw/`, walks workspaces and team directories, follows symlinks. `watcher.ts` debounces `fs.watch` events and re-broadcasts the graph.
- **Frontend** (`src/client/`) — React 19 + [`@xyflow/react`](https://reactflow.dev/) canvas. `useGraph` hook subscribes to the WebSocket; `Canvas.tsx` lays out chief/subagents/projects; `PropertyPanel.tsx` edits the 5 config files per agent.
- **Design tokens** — Mirrors OpenClaw Control UI's theme system (`claw` / `knot` / `dash`, light + dark). Theme and locale choices share `localStorage` keys with Control UI, so switching in either surface propagates on the same machine.

## Three edge types

1. **Command** (red, solid) — `sessions_spawn` permissions derived from `allowAgents`
2. **Dataflow** (green, dashed + animated) — symlinks under `shared-workspace/projects/`
3. **Sequence** (blue, dotted) — execution order from `TASK.json` steps

## Upstream proposal

The long-term goal is to land a minimum-viable subset of Studio as a native tab in OpenClaw Control UI. Draft RFC and Discussion posts are being prepared. The prototype's scope (drag-to-connect symlink creation, agent create/delete, full mutation surface) is deliberately larger than what will be proposed upstream — the upstream v1 will be read-only graph + config-file editing only, to keep PR review surface small.

## License

MIT — see [LICENSE](./LICENSE).
