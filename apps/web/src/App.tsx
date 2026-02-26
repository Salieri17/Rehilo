import { useEffect, useMemo, useState } from "react";
import {
  connectNodes,
  createNode,
  deleteNode,
  listConnections,
  listNodes,
  type GraphState,
  type NodeType,
  updateNode
} from "./core/node-engine";
import { loadGraphState, saveGraphState } from "./core/node-store";
import WorkspaceCanvas from "./ui/WorkspaceCanvas";
import {
  addWidget,
  bringWidgetToFront,
  bringWorkspaceNodeToFront,
  createTimerWidget,
  createWorkspace,
  createWorkspaceNode,
  getNextZIndex,
  removeNodeFromWorkspaces,
  removeWidget,
  setWorkspaceNodeMinimized,
  tickTimerWidgets,
  updateWidgetPosition,
  updateWidgetState,
  updateWorkspaceNodePosition,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type Workspace,
  type Widget
} from "./workspace/workspace-engine";
import {
  loadActiveWorkspaceId,
  loadWorkspaces,
  saveActiveWorkspaceId,
  saveWorkspaces
} from "./workspace/workspace-store";

type CanvasCreateKind = "note" | "todo" | "journal" | "timer";

interface CanvasCreatePayload {
  kind: CanvasCreateKind;
  x: number;
  y: number;
  title?: string;
  content?: string;
  checklistItems?: string[];
}

interface CommandPlan {
  ok: boolean;
  error?: string;
  preview?: string;
  workspaceNumber?: number;
  kind?: CanvasCreateKind;
  title?: string;
  content?: string;
  checklistItems?: string[];
}

interface WorkspaceLogEntry {
  id: string;
  message: string;
  timestamp: string;
}

type WorkspaceLogMap = Record<string, WorkspaceLogEntry[]>;

const WORKSPACE_LOG_STORAGE_KEY = "rehilo.workspace-logs.v1";

export default function App() {
  const [graphState, setGraphState] = useState<GraphState>(() => loadGraphState());
  const [workspaces, setWorkspaces] = useState<Workspace[]>(() => loadWorkspaces());
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>(() => loadActiveWorkspaceId());

  const [newNodeTitle, setNewNodeTitle] = useState("");
  const [newNodeType, setNewNodeType] = useState<NodeType>("note");

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [pendingConnectionSourceId, setPendingConnectionSourceId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("Ready");
  const [workspaceLogs, setWorkspaceLogs] = useState<WorkspaceLogMap>(() => loadWorkspaceLogs());
  const [isWorkspaceConfigOpen, setIsWorkspaceConfigOpen] = useState(false);
  const [isWorkspaceLogOpen, setIsWorkspaceLogOpen] = useState(false);
  const [workspaceNameDraft, setWorkspaceNameDraft] = useState("");

  const [lastCreatedNodeId, setLastCreatedNodeId] = useState<string | null>(null);
  const [lastCreatedWidgetId, setLastCreatedWidgetId] = useState<string | null>(null);

  const nodes = useMemo(() => listNodes(graphState), [graphState]);
  const connections = useMemo(() => listConnections(graphState), [graphState]);

  const activeWorkspace = useMemo(() => {
    return workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? null;
  }, [workspaces, activeWorkspaceId]);

  const activeWorkspaceLogs = useMemo(() => {
    return workspaceLogs[activeWorkspaceId] ?? [];
  }, [workspaceLogs, activeWorkspaceId]);

  useEffect(() => {
    saveGraphState(graphState);
  }, [graphState]);

  useEffect(() => {
    saveWorkspaces(workspaces);
  }, [workspaces]);

  useEffect(() => {
    saveActiveWorkspaceId(activeWorkspaceId);
  }, [activeWorkspaceId]);

  useEffect(() => {
    saveWorkspaceLogs(workspaceLogs);
  }, [workspaceLogs]);

  useEffect(() => {
    setWorkspaceNameDraft(activeWorkspace?.name ?? "");
  }, [activeWorkspace?.id, activeWorkspace?.name]);

  useEffect(() => {
    if (workspaces.length === 0) {
      const firstWorkspace = createWorkspace("Workspace 1", 0);
      setWorkspaces([firstWorkspace]);
      setActiveWorkspaceId(firstWorkspace.id);
      setStatusMessage("First workspace created");
      appendWorkspaceLog(firstWorkspace.id, "First workspace created");
      return;
    }

    if (!workspaces.some((workspace) => workspace.id === activeWorkspaceId)) {
      setActiveWorkspaceId(workspaces[0].id);
    }
  }, [workspaces, activeWorkspaceId]);

  const appendWorkspaceLog = (workspaceId: string, message: string) => {
    const entry: WorkspaceLogEntry = {
      id: crypto.randomUUID(),
      message,
      timestamp: new Date().toISOString()
    };

    setWorkspaceLogs((previous) => {
      const existing = previous[workspaceId] ?? [];
      return {
        ...previous,
        [workspaceId]: [...existing, entry].slice(-200)
      };
    });
  };

  const reportAction = (message: string, workspaceId?: string) => {
    setStatusMessage(message);
    const targetWorkspaceId = workspaceId ?? activeWorkspaceId;
    if (targetWorkspaceId) {
      appendWorkspaceLog(targetWorkspaceId, message);
    }
  };

  useEffect(() => {
    const hasRunningTimer = workspaces.some((workspace) =>
      workspace.widgets.some((widget) => widget.type === "timer" && widget.state.isRunning)
    );

    if (!hasRunningTimer) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setWorkspaces((previous) => tickTimerWidgets(previous));
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [workspaces]);

  const handleCreateNode = () => {
    if (!activeWorkspace) {
      return;
    }

    createAtPosition(
      {
        kind: newNodeType,
        title: newNodeTitle || "Untitled",
        content: "",
        x: WORLD_WIDTH / 2,
        y: WORLD_HEIGHT / 2
      },
      undefined
    );

    setNewNodeTitle("");
  };

  const handleDeleteNode = (nodeId: string) => {
    setGraphState((previous) => deleteNode(previous, nodeId));
    setWorkspaces((previous) => removeNodeFromWorkspaces(previous, nodeId));

    if (selectedNodeId === nodeId) {
      setSelectedNodeId(null);
    }
    if (pendingConnectionSourceId === nodeId) {
      setPendingConnectionSourceId(null);
    }

    reportAction("Node deleted and connections removed");
  };

  const handleNodeFocus = (nodeId: string) => {
    if (!activeWorkspace) {
      return;
    }

    setWorkspaces((previous) => bringWorkspaceNodeToFront(previous, activeWorkspace.id, nodeId));
  };

  const handleNodeSelect = (nodeId: string) => {
    handleNodeFocus(nodeId);
    setSelectedNodeId(nodeId);

    if (!pendingConnectionSourceId) {
      return;
    }

    if (pendingConnectionSourceId === nodeId) {
      setPendingConnectionSourceId(null);
      reportAction("Connection cancelled");
      return;
    }

    const result = connectNodes(graphState, pendingConnectionSourceId, nodeId);
    if (result.connected) {
      setGraphState(result.state);
      reportAction("Connection created");
    } else {
      reportAction("Connection already exists or is invalid");
    }

    setPendingConnectionSourceId(null);
  };

  const handleStartConnection = (nodeId: string) => {
    handleNodeFocus(nodeId);
    setPendingConnectionSourceId(nodeId);
    setSelectedNodeId(nodeId);
    reportAction("Select another node to connect");
  };

  const handleNodeMove = (nodeId: string, x: number, y: number) => {
    if (!activeWorkspace) {
      return;
    }

    setWorkspaces((previous) => updateWorkspaceNodePosition(previous, activeWorkspace.id, nodeId, x, y));
  };

  const handleNodeEdit = (nodeId: string, patch: { type?: NodeType; title?: string; content?: string; done?: boolean; checklistItems?: Array<{ id: string; text: string; checked: boolean }> }) => {
    setGraphState((previous) =>
      updateNode(previous, nodeId, {
        type: patch.type,
        data: {
          title: patch.title,
          content: patch.content,
          done: patch.done,
          checklistItems: patch.checklistItems
        }
      })
    );
  };

  const handleToggleNodeMinimized = (nodeId: string, isMinimized: boolean) => {
    if (!activeWorkspace) {
      return;
    }

    setWorkspaces((previous) => setWorkspaceNodeMinimized(previous, activeWorkspace.id, nodeId, isMinimized));
  };

  const handleCreateWorkspace = () => {
    const suggestedName = `Workspace ${workspaces.length + 1}`;
    const providedName = window.prompt("Workspace name", suggestedName);
    if (providedName === null) {
      return;
    }

    const next = createWorkspace(providedName.trim() || suggestedName, workspaces.length);
    setWorkspaces((previous) => [...previous, next]);
    setActiveWorkspaceId(next.id);
    setSelectedNodeId(null);
    setPendingConnectionSourceId(null);
    reportAction(`Workspace created: ${next.name}`, next.id);
  };

  const handleSaveWorkspaceName = () => {
    if (!activeWorkspace) {
      return;
    }

    const nextName = workspaceNameDraft.trim();
    if (!nextName) {
      setStatusMessage("Workspace name cannot be empty");
      return;
    }

    if (nextName === activeWorkspace.name) {
      setIsWorkspaceConfigOpen(false);
      return;
    }

    setWorkspaces((previous) =>
      previous.map((workspace) =>
        workspace.id === activeWorkspace.id ? { ...workspace, name: nextName } : workspace
      )
    );
    reportAction(`Workspace renamed to: ${nextName}`, activeWorkspace.id);
    setIsWorkspaceConfigOpen(false);
  };

  const handleDeleteWorkspace = () => {
    if (!activeWorkspace) {
      return;
    }

    if (workspaces.length <= 1) {
      setStatusMessage("At least one workspace is required");
      return;
    }

    const confirmed = window.confirm(`Delete workspace \"${activeWorkspace.name}\"?`);
    if (!confirmed) {
      return;
    }

    const remaining = workspaces
      .filter((workspace) => workspace.id !== activeWorkspace.id)
      .map((workspace, index) => ({ ...workspace, orderIndex: index }));

    setWorkspaces(remaining);
    setActiveWorkspaceId(remaining[0]?.id ?? "");
    setSelectedNodeId(null);
    setPendingConnectionSourceId(null);
    setWorkspaceLogs((previous) => {
      const next = { ...previous };
      delete next[activeWorkspace.id];
      return next;
    });
    setIsWorkspaceConfigOpen(false);
    setIsWorkspaceLogOpen(false);
    setStatusMessage(`Workspace deleted: ${activeWorkspace.name}`);
  };

  const handleAddTimerWidget = () => {
    if (!activeWorkspace) {
      return;
    }

    const nextZIndex = getNextZIndex(activeWorkspace);
    const widget = createTimerWidget(WORLD_WIDTH / 2 + 260, WORLD_HEIGHT / 2 - 90, nextZIndex);

    setWorkspaces((previous) => addWidget(previous, activeWorkspace.id, widget));
    setLastCreatedWidgetId(widget.id);
    setLastCreatedNodeId(null);
    reportAction("Timer widget created");
  };

  const handleWidgetFocus = (widgetId: string) => {
    if (!activeWorkspace) {
      return;
    }

    setWorkspaces((previous) => bringWidgetToFront(previous, activeWorkspace.id, widgetId));
  };

  const handleWidgetMove = (widgetId: string, x: number, y: number) => {
    if (!activeWorkspace) {
      return;
    }

    setWorkspaces((previous) => updateWidgetPosition(previous, activeWorkspace.id, widgetId, x, y));
  };

  const handleWidgetState = (widgetId: string, patch: Partial<Widget["state"]>) => {
    if (!activeWorkspace) {
      return;
    }

    setWorkspaces((previous) => updateWidgetState(previous, activeWorkspace.id, widgetId, patch));
  };

  const handleWidgetDelete = (widgetId: string) => {
    if (!activeWorkspace) {
      return;
    }

    setWorkspaces((previous) => removeWidget(previous, activeWorkspace.id, widgetId));
    reportAction("Widget removed");
  };

  const handleCanvasCreate = (payload: CanvasCreatePayload) => {
    createAtPosition(payload, undefined);
  };

  const handleCommandPreview = (input: string): string => {
    const plan = parseCommandInput(input);
    if (!plan.ok) {
      return plan.error ?? "Invalid command";
    }
    return plan.preview ?? "Ready";
  };

  const handleCommandCreate = (input: string, centerX: number, centerY: number): { ok: boolean; message: string } => {
    const plan = parseCommandInput(input);
    if (!plan.ok || !plan.kind) {
      return { ok: false, message: plan.error ?? "Invalid command" };
    }

    createAtPosition(
      {
        kind: plan.kind,
        x: centerX,
        y: centerY,
        title: plan.title,
        content: plan.content,
        checklistItems: plan.checklistItems
      },
      plan.workspaceNumber
    );

    return { ok: true, message: plan.preview ?? "Created" };
  };

  const createAtPosition = (payload: CanvasCreatePayload, workspaceNumber?: number) => {
    const expandedWorkspaces = ensureWorkspaceCount(workspaces, workspaceNumber);
    const workspaceIdToUse = resolveWorkspaceId(expandedWorkspaces, activeWorkspaceId, workspaceNumber);
    if (!workspaceIdToUse) {
      return;
    }

    if (workspaceNumber && workspaceNumber > 0) {
      setActiveWorkspaceId(workspaceIdToUse);
    }

    if (payload.kind === "timer") {
      const targetWorkspace = expandedWorkspaces.find((workspace) => workspace.id === workspaceIdToUse);
      if (!targetWorkspace) {
        return;
      }

      const nextZIndex = getNextZIndex(targetWorkspace);
      const widget = createTimerWidget(payload.x, payload.y, nextZIndex);

      setWorkspaces(addWidget(expandedWorkspaces, workspaceIdToUse, widget));
      setLastCreatedWidgetId(widget.id);
      setLastCreatedNodeId(null);
      reportAction("Timer widget created", workspaceIdToUse);
      return;
    }

    const created = createNode(graphState, {
      type: payload.kind,
      data: {
        title: payload.title?.trim() || "Untitled",
        content: payload.content ?? "",
        done: false,
        checklistItems: (payload.checklistItems ?? [])
          .map((text) => text.trim())
          .filter(Boolean)
          .map((text) => ({ id: crypto.randomUUID(), text, checked: false }))
      }
    });

    setGraphState(created.state);

    const targetWorkspace = expandedWorkspaces.find((workspace) => workspace.id === workspaceIdToUse);
    if (!targetWorkspace) {
      return;
    }

    const nextZIndex = getNextZIndex(targetWorkspace);
    const workspaceNode = createWorkspaceNode(created.node.id, payload.x, payload.y, nextZIndex);

    setWorkspaces(
      expandedWorkspaces.map((workspace) =>
        workspace.id === workspaceIdToUse ? { ...workspace, nodes: [...workspace.nodes, workspaceNode] } : workspace
      )
    );

    setLastCreatedNodeId(created.node.id);
    setLastCreatedWidgetId(null);
    reportAction(`Node created (${created.node.type})`, workspaceIdToUse);
  };

  if (!activeWorkspace) {
    return <main className="app-shell">Initializing workspace...</main>;
  }

  return (
    <main className="app-shell">
      <header className="control-bar">
        <div className="control-group workspace-right-controls">
          <select value={newNodeType} onChange={(event) => setNewNodeType(event.target.value as NodeType)}>
            <option value="note">note</option>
            <option value="todo">todo</option>
            <option value="journal">journal</option>
          </select>
          <input
            value={newNodeTitle}
            onChange={(event) => setNewNodeTitle(event.target.value)}
            placeholder="Node title"
          />
          <button type="button" onClick={handleCreateNode}>
            Add Node
          </button>
          <button type="button" onClick={handleAddTimerWidget}>
            Add Widget
          </button>
        </div>

        <div className="control-group">
          <button type="button" onClick={handleCreateWorkspace}>
            New Workspace
          </button>
          <label htmlFor="workspace-select">Workspace</label>
          <select
            id="workspace-select"
            value={activeWorkspace.id}
            onChange={(event) => {
              const nextWorkspaceId = event.target.value;
              const targetWorkspace = workspaces.find((workspace) => workspace.id === nextWorkspaceId);
              setActiveWorkspaceId(nextWorkspaceId);
              setSelectedNodeId(null);
              setPendingConnectionSourceId(null);
              if (targetWorkspace) {
                reportAction(`Workspace selected: ${targetWorkspace.name}`, targetWorkspace.id);
              }
            }}
          >
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              setIsWorkspaceConfigOpen((previous) => !previous);
              setIsWorkspaceLogOpen(false);
            }}
          >
            Settings
          </button>
          <button
            type="button"
            onClick={() => {
              setIsWorkspaceLogOpen((previous) => !previous);
              setIsWorkspaceConfigOpen(false);
            }}
          >
            Log
          </button>
          <span className="status-text bubble-status">{statusMessage}</span>
        </div>

        <div className="workspace-right-panels">
          {isWorkspaceConfigOpen && (
            <section className="workspace-panel" role="dialog" aria-label="Workspace settings">
              <strong>Workspace settings</strong>
              <label htmlFor="workspace-name-input">Name</label>
              <input
                id="workspace-name-input"
                value={workspaceNameDraft}
                onChange={(event) => setWorkspaceNameDraft(event.target.value)}
                placeholder="Workspace name"
              />
              <div className="workspace-panel-actions">
                <button type="button" onClick={handleSaveWorkspaceName}>
                  Save
                </button>
                <button type="button" onClick={handleDeleteWorkspace}>
                  Delete
                </button>
              </div>
            </section>
          )}

          {isWorkspaceLogOpen && (
            <section className="workspace-panel" role="dialog" aria-label="Workspace log">
              <strong>Workspace log</strong>
              {activeWorkspaceLogs.length === 0 ? (
                <p className="workspace-log-empty">No actions yet</p>
              ) : (
                <ul className="workspace-log-list">
                  {[...activeWorkspaceLogs].reverse().map((entry) => (
                    <li key={entry.id}>
                      <span>{entry.message}</span>
                      <time>{new Date(entry.timestamp).toLocaleString()}</time>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      </header>

      <WorkspaceCanvas
        workspace={activeWorkspace}
        nodes={nodes}
        connections={connections}
        selectedNodeId={selectedNodeId}
        pendingConnectionSourceId={pendingConnectionSourceId}
        lastCreatedNodeId={lastCreatedNodeId}
        lastCreatedWidgetId={lastCreatedWidgetId}
        onNodeFocus={handleNodeFocus}
        onNodeSelect={handleNodeSelect}
        onNodeMove={handleNodeMove}
        onNodeEdit={handleNodeEdit}
        onNodeDelete={handleDeleteNode}
        onNodeToggleMinimized={handleToggleNodeMinimized}
        onStartConnection={handleStartConnection}
        onWidgetFocus={handleWidgetFocus}
        onWidgetMove={handleWidgetMove}
        onWidgetStateChange={handleWidgetState}
        onWidgetDelete={handleWidgetDelete}
        onCanvasCreate={handleCanvasCreate}
        onCommandPreview={handleCommandPreview}
        onCommandCreate={handleCommandCreate}
      />
    </main>
  );
}

function ensureWorkspaceCount(workspaces: Workspace[], workspaceNumber?: number): Workspace[] {
  if (!workspaceNumber || workspaceNumber <= 0) {
    return workspaces;
  }

  let next = [...workspaces];
  while (next.length < workspaceNumber) {
    next = [...next, createWorkspace(`Workspace ${next.length + 1}`, next.length)];
  }
  return next;
}

function resolveWorkspaceId(
  workspaces: Workspace[],
  activeWorkspaceId: string,
  workspaceNumber?: number
): string | null {
  const expanded = ensureWorkspaceCount(workspaces, workspaceNumber);
  if (workspaceNumber && workspaceNumber > 0) {
    return expanded[workspaceNumber - 1]?.id ?? null;
  }

  if (expanded.some((workspace) => workspace.id === activeWorkspaceId)) {
    return activeWorkspaceId;
  }

  return expanded[0]?.id ?? null;
}

function parseCommandInput(rawInput: string): CommandPlan {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { ok: false, error: "Write a command first" };
  }

  const tokens = trimmed
    .split("/")
    .map((token) => token.trim())
    .filter(Boolean);

  if (tokens.length === 0) {
    return { ok: false, error: "Invalid syntax" };
  }

  let cursor = 0;
  let workspaceNumber: number | undefined;

  if (/^\d+$/.test(tokens[cursor])) {
    workspaceNumber = Number(tokens[cursor]);
    cursor += 1;
  }

  const typeToken = tokens[cursor]?.toUpperCase();
  if (!typeToken) {
    return { ok: false, error: "Missing node type" };
  }
  cursor += 1;

  if (typeToken === "N") {
    const title = tokens[cursor] ?? "Untitled";
    return {
      ok: true,
      kind: "note",
      workspaceNumber,
      title,
      preview: `${workspaceNumber ? `WS ${workspaceNumber} · ` : ""}Create Note: ${title}`
    };
  }

  if (typeToken === "J") {
    const title = tokens[cursor] ?? "Untitled";
    return {
      ok: true,
      kind: "journal",
      workspaceNumber,
      title,
      preview: `${workspaceNumber ? `WS ${workspaceNumber} · ` : ""}Create Journal: ${title}`
    };
  }

  if (typeToken === "T") {
    const title = tokens[cursor] ?? "Untitled";
    const checklistItems = tokens.slice(cursor + 1).map((token) => token.trim()).filter(Boolean);
    return {
      ok: true,
      kind: "todo",
      workspaceNumber,
      title,
      checklistItems,
      preview: `${workspaceNumber ? `WS ${workspaceNumber} · ` : ""}Create To-Do: ${title}${
        checklistItems.length > 0 ? ` (${checklistItems.length} items)` : ""
      }`
    };
  }

  if (typeToken === "W") {
    return {
      ok: true,
      kind: "timer",
      workspaceNumber,
      preview: `${workspaceNumber ? `WS ${workspaceNumber} · ` : ""}Create Timer Widget`
    };
  }

  return { ok: false, error: "Unknown type. Use N, T, J or W" };
}

function loadWorkspaceLogs(): WorkspaceLogMap {
  if (typeof window === "undefined") {
    return {};
  }

  const raw = window.localStorage.getItem(WORKSPACE_LOG_STORAGE_KEY);
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as WorkspaceLogMap;
    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    const normalized: WorkspaceLogMap = {};
    for (const [workspaceId, entries] of Object.entries(parsed)) {
      if (!Array.isArray(entries)) {
        continue;
      }

      normalized[workspaceId] = entries
        .filter((entry) => entry && typeof entry.message === "string" && typeof entry.timestamp === "string")
        .map((entry) => ({
          id: typeof entry.id === "string" ? entry.id : crypto.randomUUID(),
          message: entry.message,
          timestamp: entry.timestamp
        }));
    }

    return normalized;
  } catch {
    return {};
  }
}

function saveWorkspaceLogs(logs: WorkspaceLogMap): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(WORKSPACE_LOG_STORAGE_KEY, JSON.stringify(logs));
}
