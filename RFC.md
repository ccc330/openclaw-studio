# RFC: A "Studio" tab in Control UI — configure, orchestrate, and debug multi-agent teams on one canvas

**Author:** @ccc330
**Status:** Draft — seeking direction before implementation
**Target repo:** [`openclaw/openclaw`](https://github.com/openclaw/openclaw)
**Target surface:** Control UI (`dist/control-ui/`, Lit-based)
**Proposed delivery channel:** GitHub Discussions (per [`CONTRIBUTING.md`](../CONTRIBUTING.md) §"How to Contribute", item 2)
**Related docs:**
- `docs/concepts/multi-agent.md`
- `docs/concepts/delegate-architecture.md`
- `docs/concepts/agent-workspace.md`
- `docs/concepts/session.md`
- `docs/automation/taskflow.md`
- `docs/platforms/mac/canvas.md`

---

## TL;DR

I'd like to propose a new **Studio** tab in Control UI: **one canvas to configure, orchestrate, and debug a multi-agent team**. The relationship graph is on the left (delegate edges, dataflow symlinks, TASK.json sequence, live session status). The agent's five config files (`IDENTITY.md` / `SOUL.md` / `AGENTS.md` / `TOOLS.md` / `HEARTBEAT.md`) are editable in a side panel on the right. It sits alongside the existing `agents` / `sessions` / `channels` / `skills` / `logs` tabs.

Three verbs are load-bearing — Studio is not just a viewer:

- **Configure** — click an agent → edit its 5 config files in place, Cmd+S writes to disk, FileWatcher picks it up
- **Orchestrate** — the graph visualizes `sessions_spawn` permissions, symlink dataflow, and TASK.json execution order in one canvas
- **Debug** — per-session status badges on nodes; edge-click reveals the underlying record (the `allowAgents` entry or symlink target)

The closest analogy is n8n / Node-RED / Blueprint-class tools: visual editing + orchestration + runtime observation unified. Before writing any Control UI code, I want to hear whether this direction is welcome and how maintainers want it shaped.

I am posting this as a Discussion rather than a PR, per `CONTRIBUTING.md`.

---

## Motivation

OpenClaw's per-agent isolation (one workspace, five markdown files, JSON config) is correct for runtime but creates a **multi-surface cliff** the moment a team has more than two or three members. The cliff hits all three core workflows — configuring, orchestrating, and debugging — because each of them requires the user to hold a cross-file mental model that the filesystem layout refuses to surface.

Concrete scenario (debug): a chief delegates to the wrong subagent. To diagnose this today, the user has to:

1. Open `~/.openclaw/openclaw.json` to see `allowAgents`
2. Open the chief's `AGENTS.md` to see how subagents are described
3. Open each candidate subagent's `IDENTITY.md` + `SOUL.md` to see why one was preferred
4. Open `TOOLS.md` for each to confirm capability overlap
5. Walk symlinks under `shared-workspace/projects/{id}/` to see what the chief actually wrote
6. Open `TASK.json` to see step ordering

That's **5–10 files across 5 directories** for a single delegate decision. The information is all there, correctly isolated — but the cost of cross-referencing it scales superlinearly with team size, and the cliff hits exactly the users who most need help: those graduating from one agent to a team.

| Workflow | Today | With Studio |
|---|---|---|
| Who can `sessions_spawn` whom? | `grep allowAgents` in `openclaw.json` | Hover an agent → see outgoing command edges |
| Why did chief pick subagent X? | Open 5 files across 5 workspaces | Click chief → side panel shows all 5 docs; click candidate → swap |
| Where does agent A's output go? | Follow symlinks under `shared-workspace/projects/` | Dataflow edges visible directly on canvas |
| What's the status of a running team task? | Open `TASK.json` manually | Sequence edges + step status inline |
| Edit `IDENTITY.md` and re-test | `cd` into workspace, open editor, save, re-run | Edit in side panel, Cmd+S, watcher picks it up |

Studio treats **configuring, orchestrating, and debugging a multi-agent team as one unified workflow** rather than three separate file-system spelunking exercises. The graph is the entry point; the editable config docs on the side panel are the working surface; the status overlay closes the loop.

This fits the **UX** axis of the current roadmap in `CONTRIBUTING.md` ("Improving the onboarding wizard and error messages") — Studio is the onboarding cliff for users graduating from a single agent to a team, and a daily debugging tool for users who already have one.

---

## Relationship to existing concepts

To avoid confusion with existing OpenClaw concepts, this RFC uses the name **Studio**, not **Flow**:

- **TaskFlow** (`docs/automation/taskflow.md`) is a **backend** orchestration engine for durable, revision-tracked multi-step task execution, driven by CLI (`openclaw tasks flow list/show/cancel`). It has no UI. Studio is a **read-only visualization layer**. The two are complementary — Studio can render a running TaskFlow's step graph as one of its views, but it does not replace, duplicate, or own any TaskFlow state.
- **Canvas** (`docs/platforms/mac/canvas.md`) is a macOS-specific `WKWebView` rendering surface for agent-generated HTML/CSS/JS and A2UI. It is a target for agents to display things into. Studio lives inside Control UI, is cross-platform, and visualizes the agent system itself. No overlap.

**Studio's scope is:** *one canvas to configure (edit the 5 markdown files per agent), orchestrate (see and reason about delegate/dataflow/sequence edges), and debug (live session status, edge-click for the underlying record) a multi-agent team.* Graph is read-only in v1; config file editing is the one write surface.

---

## Prior art (from the author) — prototype today vs upstream v1

I've been running a standalone prototype (Studio) for several months on my own machine: a React + React Flow canvas that reads `~/.openclaw/`, watches it via `fs.watch`, and renders three edge types (command = `sessions_spawn`, dataflow = symlinks, sequence = `TASK.json` order). Prototype repo: *(author to link when opening the Discussion)*.

**The prototype's scope is deliberately larger than what this RFC proposes landing in Control UI.** Keeping them separate is important — the RFC is a minimum-viable upstream slice, not a port of everything the author happens to have built.

| Capability | Prototype today | Proposed upstream v1 |
|---|---|---|
| Render delegate / dataflow / sequence edges | ✅ | ✅ |
| Per-session status badges | ✅ | ✅ |
| Edit the 5 config files per agent in a side panel | ✅ | ✅ |
| Drag-to-connect on canvas → create symlink via dialog | ✅ | ❌ (follow-up RFC) |
| Create agent / team from the canvas | ✅ | ❌ (follow-up RFC) |
| Delete agent from the canvas | ✅ | ❌ (follow-up RFC) |
| Embedded Claude Code chat panel | ✅ (on author's `main` branch only) | ❌ (never upstream) |
| Runs its own Express + WS server | ✅ | ❌ (folds into the existing gateway HTTP surface) |
| Built in React + React Flow | ✅ | ❌ (rewritten in Lit with legacy decorators) |

Everything in the "Prototype today" column exists as running code so the author can de-risk the direction; it is not what is being proposed for upstream. The "Proposed upstream v1" column is what this RFC asks maintainers to review.

---

## Proposed approach

Ship as a native tab in Control UI, matching the existing Lit stack and design token system.

### 1. UI layer

- New tab: `Studio`, positioned near `agents` / `sessions` in the existing nav.
- Implemented as Lit web components using the existing theme system (`--bg`, `--accent`, `--radius-*`, `data-theme` switching between `claw` / `knot` / `dash`, each with light/dark). **No new design tokens, no new fonts, no new color primitives.**
- Decorator style follows `CONTRIBUTING.md` §"Control UI Decorators": legacy decorators only (`@state() foo = "bar";`), no standard-decorator `accessor` fields.
- Internationalization: source strings in American English, registered in Control UI's existing i18n catalog. The prototype today ships only `en` and `zh-CN` dictionaries and falls back to `en` for the other ten locales; on landing in Control UI, existing community translators can fill in the remaining languages.
- American English in all source strings, per `CONTRIBUTING.md` §"Before You PR".

### 2. Graph rendering — **open question for maintainers**

This is the main technical decision I want input on before writing code. Options I see:

| Option | Pros | Cons |
|---|---|---|
| **A. Hand-rolled SVG + Lit** | Zero new deps; fits Control UI style; small bundle | Non-trivial engineering (layout, panning, edge routing); risk of reinventing half of a graph library |
| **B. Framework-agnostic library** (`cytoscape.js`, `@antv/g6`, `elkjs` for layout) | Mature layout algorithms; keeps Lit as the outer shell | Adds a significant dep to Control UI bundle |
| **C. Isolated React island** just for the canvas component, embedded in a Lit host | Reuses the prototype's React Flow work | Introduces React to a Lit codebase purely for one component; long-term maintenance cost |

My tentative preference is **A** for a minimal v1 (read-only topology with ≤100 nodes is well within hand-rolled SVG range) and revisit **B** if/when node counts or layout complexity demand it. But I will defer to Control UI maintainers.

### 3. Data layer

Extend the existing gateway HTTP surface rather than add a second process:

- `GET /api/topology` — returns the full graph (agents, delegate edges, workspace symlinks, TASK.json status) as JSON.
- Live updates reuse the existing Control UI WebSocket channel; a new event type `topology.updated` is emitted when the scanner detects a change under `~/.openclaw/`.

No new ports. No new long-running process. No new auth surface.

### 4. Scope of v1 — **read-only graph + editable config side panel**

- **Orchestrate view:** render agents, delegate edges (command / `sessions_spawn`), dataflow edges (symlinks), sequence edges (TASK.json order).
- **Debug view:** per-session status badge on each node (running / idle / error); edge-click opens the underlying record (the `allowAgents` entry or the symlink target) in a side panel.
- **Configure view:** click a node → side panel with tabs for the agent's 5 config files (`IDENTITY.md` / `SOUL.md` / `AGENTS.md` / `TOOLS.md` / `HEARTBEAT.md`); edit in place; Cmd+S writes through the gateway HTTP API; FileWatcher re-emits `topology.updated` so the canvas refreshes.

### 5. Explicitly out of v1

These are **all present in the standalone prototype** (see §"Prior art") and **intentionally left out** of the upstream v1 proposal to keep review surface small:

- Agent or team creation from the canvas (prototype has `CreateWizard` → `POST /api/agent`).
- Agent deletion from the canvas (prototype has context-menu delete → `POST /api/agent/delete`).
- Drag-to-connect to create symlinks (prototype has `SymlinkDialog` → `POST /api/symlink`).
- `allowAgents` mutation from the canvas.
- Embedded chat or LLM interaction.
- Integration with `Canvas` (the macOS WKWebView).
- Any writing to TaskFlow state.

Each of these can be proposed in a follow-up RFC once the read-only view + config-file editing is accepted.

---

## Delivery plan

Per `CONTRIBUTING.md` ("Keep PRs focused; one thing per PR") and the 10-open-PR cap, I would deliver in small, independently reviewable PRs:

| # | PR | Estimated diff |
|---|---|---|
| 1 | Gateway: `GET /api/topology` endpoint + scanner for `~/.openclaw/` | ~300 LOC |
| 2 | Gateway: `topology.updated` WebSocket event + debounced file watcher | ~200 LOC |
| 3 | Control UI: empty `Studio` tab, wired to the endpoint, JSON dump view | ~200 LOC |
| 4 | Control UI: graph rendering (nodes + edges, theme-aware, legacy decorators) | ~600 LOC |
| 5 | Control UI: session status overlay + edge-click side panel | ~300 LOC |
| 6 | Docs: `docs/concepts/topology.md` + screenshots (before/after per `CONTRIBUTING.md`) | ~100 LOC |

Each PR is independently revertible. Each will include:

- American English source strings and docs
- Before/after screenshots where visual
- `AI-assisted` marker in title + degree-of-testing note (per `CONTRIBUTING.md` §"AI/Vibe-Coded PRs Welcome!")
- Whatever the Control UI repo uses for local verification before requesting review (I will follow the repo's `CONTRIBUTING.md` rather than hardcode a command here — my prototype runs a plain `npm run build`, which is not what Control UI uses)
- Resolution of bot review conversations before re-requesting review

I will not open PR #2 until PR #1 merges, and so on. No overlapping review load for maintainers.

---

## Non-goals and anti-patterns I want to avoid

- **Not a refactor PR.** Per `CONTRIBUTING.md`, refactor-only PRs are not accepted. Every PR in the plan above adds a concrete user-visible capability.
- **Not a `CODEOWNERS`-triggering change** unless explicitly invited. I will read `CODEOWNERS` before each PR and stay out of security-ownership paths.
- **Not a test/CI-only PR** for known `main` failures.
- **Not a "drop my existing React app into `packages/`"** PR. The prototype exists to de-risk the direction; the production code will be written fresh in Lit.

---

## Open questions for maintainers

I would genuinely value input on any of these before writing code:

1. **Is this direction welcome at all?** If Control UI is meant to stay narrowly "gateway control plane" and topology visualization belongs elsewhere (docs site? separate tool? community repo under `openclaw/*`?), I'd like to know before investing further.
2. **Graph rendering choice** — A / B / C in §"Proposed approach · 2"? Or something else you'd prefer?
3. **Tab placement and naming** — `Studio` is my proposal. Is there a better name that fits existing Control UI tab conventions? Should it live behind a feature flag in v1?
4. **API shape** — should the endpoint live under an existing namespace (e.g. `/api/agents/topology`) or a new one (`/api/topology`)?
5. **Scope of v1 edges** — all three (command / dataflow / sequence), or should I ship only command edges first and add the other two in follow-ups?
6. **Is there a Control UI maintainer** (I see @BunsDev, @velvet-shark listed for UI/UX and Control UI in `CONTRIBUTING.md`) who would prefer to review this proposal before it progresses to code?

---

## About the author

I'm a long-time OpenClaw user running a multi-agent team on my own machine. My prototype was the way I learned the multi-agent and delegate architectures by building a mirror of them. I'm happy to iterate the proposal, drop it, or hand off the idea to someone better placed to build it — my goal is to contribute something the project actually wants, not to land a PR at any cost.

Thanks for reading.

---

## Appendix A — Compliance checklist against `CONTRIBUTING.md`

| Requirement | Status in this RFC |
|---|---|
| New-feature proposals start as a Discussion | ✅ This document is explicitly a Discussion draft |
| Refactor-only PRs not accepted | ✅ Every planned PR adds user-visible capability |
| Test/CI-only PRs for known failures not accepted | ✅ None planned |
| American English | ✅ Throughout |
| Keep PRs focused (one thing per PR) | ✅ 6-PR plan, one concern each |
| Before/after screenshots for UI changes | ✅ Committed for PRs #4, #5, #6 |
| Control UI legacy decorators (`@state()` / `@property()`, no `accessor`) | ✅ Called out in §"Proposed approach · 1" |
| `CODEOWNERS` respect | ✅ Called out in §"Non-goals" |
| AI-assisted PRs marked with degree-of-testing | ✅ Committed for all planned PRs |
| Author-owned bot review resolution | ✅ Committed |
| Local verification per repo `CONTRIBUTING.md` before review | ✅ Committed (deferring to whatever Control UI's verify command is) |
| 10-open-PR cap | ✅ Sequential delivery, never more than 1 open at a time |
