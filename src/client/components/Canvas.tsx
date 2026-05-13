import { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  type Node,
  type Edge,
  type Connection,
  useNodesState,
  useEdgesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import AgentNode from './AgentNode';
import SharedWorkspaceNode from './SharedWorkspaceNode';
import FilePreviewNode from './FilePreviewNode';
import CustomEdge from './CustomEdge';
import Sidebar from './Sidebar';
import PropertyPanel from './PropertyPanel';
import ContextMenu from './ContextMenu';
import CreateWizard from './CreateWizard';
import SymlinkDialog from './SymlinkDialog';
import ChatPanel from './ChatPanel';
import { useGraph } from '../hooks/useGraph';
import { useLocale } from '../i18n';
import type { GraphModel, AgentNode as AgentNodeType } from '../hooks/useGraph';

const nodeTypes = {
  agent: AgentNode,
  sharedWorkspace: SharedWorkspaceNode,
  filePreview: FilePreviewNode,
};

const edgeTypes = {
  custom: CustomEdge,
};

interface OpenFile {
  projectId: string;
  fileName: string;
  filePath: string;
  targetAgent: string;
  content: string;
}

interface ContextMenuState {
  x: number;
  y: number;
  projectId: string;
}

function layoutGraph(
  graph: GraphModel,
  layers: Record<string, boolean>,
  visibleProjects: Set<string>,
  openFile: OpenFile | null,
  onFileClick: (projectId: string, fileName: string, filePath: string, targetAgent: string) => void,
  onFileSave: (filePath: string, content: string) => Promise<boolean>,
  onFileClose: () => void,
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Find chief
  const chief = graph.agents.find((a) => a.isChief);
  const subAgents = graph.agents.filter((a) => !a.isChief);
  const agentCount = subAgents.length;
  const spacing = 200;
  const startX = -(agentCount - 1) * spacing / 2;

  // Chief node at top center
  if (chief) {
    nodes.push({
      id: chief.id,
      type: 'agent',
      position: { x: 0, y: 0 },
      data: { ...chief, type: 'agent' },
    });
  }

  // Sub-agent nodes in a row
  subAgents.forEach((agent, i) => {
    nodes.push({
      id: agent.id,
      type: 'agent',
      position: { x: startX + i * spacing, y: 200 },
      data: { ...agent, type: 'agent' },
    });
  });

  // Only render visible projects
  let projectY = 420;
  for (const team of graph.teams) {
    for (const project of team.projects) {
      if (!visibleProjects.has(project.id)) continue;

      const projectNodeId = `project-${project.id}`;
      nodes.push({
        id: projectNodeId,
        type: 'sharedWorkspace',
        position: { x: 0, y: projectY },
        data: {
          ...project,
          type: 'sharedWorkspace',
          activeFileName: openFile?.projectId === project.id ? openFile.fileName : undefined,
          onFileClick: (fileName: string, filePath: string, targetAgent: string) => {
            onFileClick(project.id, fileName, filePath, targetAgent);
          },
        },
      });

      // If this project has an open file, add the file preview node
      if (openFile && openFile.projectId === project.id) {
        const fileNodeId = `file-${project.id}-${openFile.fileName}`;
        nodes.push({
          id: fileNodeId,
          type: 'filePreview',
          position: { x: 280, y: projectY - 20 },
          data: {
            type: 'filePreview',
            fileName: openFile.fileName,
            filePath: openFile.filePath,
            targetAgent: openFile.targetAgent,
            content: openFile.content,
            onSave: onFileSave,
            onClose: onFileClose,
          },
        });

        // Dashed edge from project to file preview
        edges.push({
          id: `edge-file-${project.id}`,
          source: projectNodeId,
          target: fileNodeId,
          type: 'default',
          style: { stroke: 'var(--accent-info)', strokeDasharray: '4 4', strokeWidth: 1.5, opacity: 0.5 },
          animated: false,
        });
      }

      projectY += 180;
    }
  }

  // Edges
  for (const edge of graph.edges) {
    if (!layers[edge.layer]) continue;

    edges.push({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: 'custom',
      label: edge.label,
      data: { layer: edge.layer, ...edge.data },
      animated: edge.layer === 'dataflow',
    });
  }

  return { nodes, edges };
}

// SVG marker defs for arrow heads
function EdgeMarkers() {
  return (
    <svg style={{ position: 'absolute', width: 0, height: 0 }}>
      <defs>
        <marker id="arrow-command" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--accent-command)" fillOpacity="0.7" />
        </marker>
        <marker id="arrow-dataflow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--accent-dataflow)" fillOpacity="0.7" />
        </marker>
        <marker id="arrow-sequence" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--accent-sequence)" fillOpacity="0.7" />
        </marker>
      </defs>
    </svg>
  );
}

export default function Canvas() {
  const { graph, connected } = useGraph();
  const { t } = useLocale();
  const [layers, setLayers] = useState({
    command: true,
    dataflow: true,
    sequence: true,
  });
  const [selectedAgent, setSelectedAgent] = useState<AgentNodeType | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [symlinkDraft, setSymlinkDraft] = useState<{ agentId: string; projectId: string; teamPath: string } | null>(null);

  // Project visibility
  const [visibleProjects, setVisibleProjects] = useState<Set<string>>(new Set());

  // File preview
  const [openFile, setOpenFile] = useState<OpenFile | null>(null);

  // Context menu
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const toggleLayer = useCallback((layer: 'command' | 'dataflow' | 'sequence') => {
    setLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
  }, []);

  const toggleProject = useCallback((projectId: string) => {
    setVisibleProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
        // Close file preview if it belongs to this project
        setOpenFile((f) => f?.projectId === projectId ? null : f);
      } else {
        next.add(projectId);
      }
      return next;
    });
  }, []);

  const removeProject = useCallback((projectId: string) => {
    setVisibleProjects((prev) => {
      const next = new Set(prev);
      next.delete(projectId);
      return next;
    });
    setOpenFile((f) => f?.projectId === projectId ? null : f);
  }, []);

  const handleFileClick = useCallback(
    async (projectId: string, fileName: string, filePath: string, targetAgent: string) => {
      // Toggle: if same file clicked again, close it
      if (openFile?.projectId === projectId && openFile?.fileName === fileName) {
        setOpenFile(null);
        return;
      }

      try {
        const res = await fetch(`/api/file?path=${encodeURIComponent(filePath)}`);
        if (!res.ok) throw new Error('Failed to read file');
        const { content } = await res.json();
        setOpenFile({ projectId, fileName, filePath, targetAgent, content });
      } catch {
        // Could not read file (e.g., symlink points to directory)
        setOpenFile({ projectId, fileName, filePath, targetAgent, content: '(Unable to read file content)' });
      }
    },
    [openFile],
  );

  const handleFileSave = useCallback(async (filePath: string, content: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/file', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath, content }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }, []);

  const handleFileClose = useCallback(() => {
    setOpenFile(null);
  }, []);

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (node.type === 'agent' && graph) {
        const agent = graph.agents.find((a) => a.id === node.id);
        if (agent) setSelectedAgent(agent);
      }
    },
    [graph],
  );

  const handlePaneClick = useCallback(() => {
    setSelectedAgent(null);
    setContextMenu(null);
  }, []);

  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (node.type === 'sharedWorkspace') {
        event.preventDefault();
        const projectId = node.id.replace('project-', '');
        setContextMenu({ x: event.clientX, y: event.clientY, projectId });
      }
    },
    [],
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!graph || !connection.source || !connection.target) return;

      const sourceAgent = graph.agents.find((a) => a.id === connection.source);
      const targetProjectId = connection.target?.startsWith('project-')
        ? connection.target.slice('project-'.length)
        : null;

      if (!sourceAgent || !targetProjectId) return;

      const team = graph.teams.find((t) => t.projects.some((p) => p.id === targetProjectId));
      if (!team) return;

      setSymlinkDraft({
        agentId: sourceAgent.id,
        projectId: targetProjectId,
        teamPath: team.path,
      });
    },
    [graph],
  );

  const layout = useMemo(() => {
    if (!graph) return { nodes: [], edges: [] };
    return layoutGraph(graph, layers, visibleProjects, openFile, handleFileClick, handleFileSave, handleFileClose);
  }, [graph, layers, visibleProjects, openFile, handleFileClick, handleFileSave, handleFileClose]);

  const [nodes, setNodes, onNodesChange] = useNodesState(layout.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layout.edges);
  const userPositions = useRef<Record<string, { x: number; y: number }>>({});

  // Track user drag positions
  const handleNodesChange: typeof onNodesChange = useCallback(
    (changes) => {
      onNodesChange(changes);
      for (const change of changes) {
        if (change.type === 'position' && change.position && change.dragging) {
          userPositions.current[change.id] = change.position;
        }
      }
    },
    [onNodesChange],
  );

  // Update nodes/edges when graph changes, preserving user-dragged positions
  useEffect(() => {
    setNodes(
      layout.nodes.map((node) => {
        const saved = userPositions.current[node.id];
        return saved ? { ...node, position: saved } : node;
      }),
    );
    setEdges(layout.edges);
  }, [layout, setNodes, setEdges]);

  if (!graph) {
    return (
      <div
        style={{
          display: 'flex',
          height: '100%',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-dim)',
          fontSize: 13,
          gap: 8,
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: 'var(--accent-running)',
            animation: 'pulse-glow 1.5s infinite',
          }}
        />
        {t('canvas.connecting')}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%' }}>
      <Sidebar
        graph={graph}
        connected={connected}
        layers={layers}
        onToggleLayer={toggleLayer}
        onCreateNew={() => setShowWizard(true)}
        visibleProjects={visibleProjects}
        onToggleProject={toggleProject}
      />

      <div style={{ flex: 1, position: 'relative' }}>
        <EdgeMarkers />
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={handleConnect}
          onNodeClick={handleNodeClick}
          onNodeContextMenu={handleNodeContextMenu}
          onPaneClick={handlePaneClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.3, maxZoom: 1.2 }}
          minZoom={0.2}
          maxZoom={2}
          defaultEdgeOptions={{ type: 'custom' }}
          proOptions={{ hideAttribution: true }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={24}
            size={1}
            color="var(--border-dim)"
          />
          <Controls
            position="bottom-right"
            showInteractive={false}
          />
          <MiniMap
            position="bottom-left"
            nodeColor={(node) => {
              if (node.type === 'filePreview') return 'rgba(139,170,255,0.4)';
              if (node.type === 'sharedWorkspace') return 'rgba(90,245,197,0.4)';
              const agent = graph.agents.find((a) => a.id === node.id);
              if (agent?.isChief) return 'rgba(80,250,123,0.6)';
              if (agent?.status === 'running') return 'rgba(241,161,53,0.6)';
              return 'rgba(122,141,164,0.3)';
            }}
            maskColor="rgba(5,8,13,0.8)"
            style={{ height: 80, width: 120 }}
          />
        </ReactFlow>

        {/* Noise overlay */}
        <div className="noise-overlay" />

        {/* Chat panel — docked bottom-center */}
        <ChatPanel agents={graph.agents} />

        {/* Context menu */}
        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            items={[
              {
                label: t('context.remove'),
                onClick: () => removeProject(contextMenu.projectId),
                color: 'var(--accent-command)',
              },
            ]}
            onClose={() => setContextMenu(null)}
          />
        )}
      </div>

      {/* Property panel */}
      {selectedAgent && (
        <PropertyPanel agent={selectedAgent} onClose={() => setSelectedAgent(null)} allModels={graph.agents.map(a => a.model).filter(Boolean)} />
      )}

      {/* Symlink dialog */}
      {symlinkDraft && (
        <SymlinkDialog
          agentId={symlinkDraft.agentId}
          projectId={symlinkDraft.projectId}
          teamPath={symlinkDraft.teamPath}
          onClose={() => setSymlinkDraft(null)}
        />
      )}

      {/* Create wizard */}
      {showWizard && (
        <CreateWizard
          existingAgentIds={graph.agents.map((a) => a.id)}
          onClose={() => setShowWizard(false)}
        />
      )}
    </div>
  );
}
