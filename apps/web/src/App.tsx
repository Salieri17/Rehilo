import { useEffect, useMemo, useState } from "react";
import type { CreateNodeInput, NodeEntity } from "@rehilo/domain";
import { createNode, getNodeRelationIds, parseHybridInput } from "@rehilo/domain";
import FilterBar from "./components/FilterBar";
import CaptureDialog from "./components/CaptureDialog";
import ErrorBoundary from "./components/ErrorBoundary";
import GraphScene2D from "./components/GraphScene2D";
import CaptureHistoryPanel, { type CaptureHistoryItem } from "./components/CaptureHistoryPanel";
import ToastStack, { type ToastItem, type ToastTone } from "./components/ToastStack";
import DashboardView from "./components/dashboard/DashboardView";
import { demoNodes } from "./data/demoGraph";
import {
  buildGraphEdges,
  filterNodes,
  listUnlinkedNodes,
  parseTagQuery,
  suggestLinksForUnlinked
} from "./lib/graph-utils";
import {
  type WorkspaceLayoutState,
  loadWorkspaceLayout,
  saveWorkspaceLayout
} from "./lib/layout-store";
import { createOfflineNodeRepository } from "./lib/offline-repository";
import { startBackgroundSync } from "./lib/sync-service";
import { subscribeCaptureEvents } from "./lib/capture-events";
import { deriveTitleFromText, isProbablyUrl } from "./lib/capture-utils";

const EMPTY_SELECTION = "";
type ViewMode = "dashboard" | "graph";
type SelectionState = "none" | "tooltip" | "detail";

export default function App() {
  const [viewMode, setViewMode] = useState<ViewMode>("dashboard");
  const [dashboardCollapsed, setDashboardCollapsed] = useState(false);
  const [selectionState, setSelectionState] = useState<SelectionState>("none");
  const [nodes, setNodes] = useState<NodeEntity[]>([]);
  const [workspaceId, setWorkspaceId] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [tagQuery, setTagQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showUnlinkedOnly, setShowUnlinkedOnly] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState(EMPTY_SELECTION);
  const [layoutState, setLayoutState] = useState<WorkspaceLayoutState>(() =>
    loadWorkspaceLayout("all")
  );
  const [captureOpen, setCaptureOpen] = useState(false);
  const [captureValue, setCaptureValue] = useState("");
  const [captureStatus, setCaptureStatus] = useState<string | null>(null);
  const [captureHistory, setCaptureHistory] = useState<CaptureHistoryItem[]>([]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const repo = useMemo(() => createOfflineNodeRepository(), []);

  const workspaces = useMemo(() => {
    const unique = Array.from(new Set(nodes.map((node) => node.workspaceId)));
    return unique;
  }, [nodes]);

  const types = useMemo(() => {
    const unique = Array.from(new Set(nodes.map((node) => node.type)));
    return unique;
  }, [nodes]);

  const tags = useMemo(() => {
    const unique = new Set<string>();
    nodes.forEach((node) => node.tags.forEach((tag) => unique.add(tag)));
    return Array.from(unique);
  }, [nodes]);

  const filters = useMemo(
    () => ({
      workspaceId,
      type: typeFilter,
      tags: parseTagQuery(tagQuery),
      dateFrom,
      dateTo
    }),
    [workspaceId, typeFilter, tagQuery, dateFrom, dateTo]
  );

  const filteredNodes = useMemo<NodeEntity[]>(() => filterNodes(nodes, filters), [filters, nodes]);
  const workspaceScopedNodes = useMemo(
    () => (workspaceId === "all" ? nodes : nodes.filter((node) => node.workspaceId === workspaceId)),
    [nodes, workspaceId]
  );
  const unlinkedNodes = useMemo(() => listUnlinkedNodes(workspaceScopedNodes), [workspaceScopedNodes]);
  const unlinkedNodeIds = useMemo(() => new Set(unlinkedNodes.map((node) => node.id)), [unlinkedNodes]);
  const visibleNodes = useMemo(
    () => (showUnlinkedOnly ? filteredNodes.filter((node) => unlinkedNodeIds.has(node.id)) : filteredNodes),
    [filteredNodes, showUnlinkedOnly, unlinkedNodeIds]
  );
  const edges = useMemo(() => buildGraphEdges(visibleNodes), [visibleNodes]);

  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? null;
  const selectedNodeSuggestions = useMemo(() => {
    if (!selectedNode || !unlinkedNodeIds.has(selectedNode.id)) {
      return [];
    }
    return suggestLinksForUnlinked(selectedNode, workspaceScopedNodes, 5);
  }, [selectedNode, unlinkedNodeIds, workspaceScopedNodes]);

  useEffect(() => {
    setLayoutState(loadWorkspaceLayout(workspaceId));
  }, [workspaceId]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const seeded = await repo.seedIfEmpty(demoNodes);
      if (!cancelled) {
        setNodes(seeded);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [repo]);

  useEffect(() => {
    if (nodes.length === 0) {
      return;
    }
    const uniqueWorkspaces = Array.from(new Set(nodes.map((node) => node.workspaceId)));
    const stop = startBackgroundSync(repo, uniqueWorkspaces);
    return stop;
  }, [nodes, repo]);

  const handleLayoutChange = (next: WorkspaceLayoutState) => {
    setLayoutState(next);
    saveWorkspaceLayout(workspaceId, next);
  };

  const handleSelectNode = (id: string) => {
    // First click: show tooltip
    if (selectedNodeId !== id) {
      setSelectedNodeId(id);
      setSelectionState("tooltip");
    } else if (selectionState === "tooltip") {
      // Second click on same node: show detail panel
      setSelectionState("detail");
    } else {
      // Already showing detail, clicking another node shows its tooltip
      setSelectedNodeId(id);
      setSelectionState("tooltip");
    }
  };

  const refreshNodes = async () => {
    const next = await repo.listAll();
    setNodes(next);
  };

  const pushToast = (message: string, tone: ToastTone = "info") => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 3200);
  };

  const pushHistory = (item: Omit<CaptureHistoryItem, "id" | "timestamp">) => {
    const nextItem: CaptureHistoryItem = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...item
    };
    setCaptureHistory((prev) => [nextItem, ...prev].slice(0, 8));
  };

  const resolveWorkspaceId = () => {
    if (workspaceId !== "all") {
      return workspaceId;
    }
    return nodes[0]?.workspaceId ?? "ws-default";
  };

  const createLinkNode = async (url: string) => {
    const node = createNode({
      workspaceId: resolveWorkspaceId(),
      type: "link",
      title: url,
      content: "",
      metadata: { url }
    });
    await repo.save(node);
    await refreshNodes();
    setCaptureStatus(`Captured link: ${url}`);
    pushToast("Link captured", "success");
    pushHistory({ type: "link", title: url });
    return node;
  };

  const createNoteNode = async (text: string, title?: string) => {
    const resolvedTitle = title ?? deriveTitleFromText(text);
    const node = createNode({
      workspaceId: resolveWorkspaceId(),
      type: "note",
      title: resolvedTitle,
      content: text
    });
    await repo.save(node);
    await refreshNodes();
    setCaptureStatus("Captured note");
    pushToast("Note captured", "success");
    pushHistory({ type: title ? "file" : "note", title: resolvedTitle, detail: title ? "Imported file" : undefined });
    return node;
  };

  const handleCaptureSubmit = async () => {
    const value = captureValue.trim();
    if (!value) {
      setCaptureStatus("Capture is empty");
      pushToast("Capture is empty", "warning");
      return;
    }

    // Try to parse as hybrid input (structured command)
    const parsed = parseHybridInput(value, {
      workspaceId: resolveWorkspaceId(),
      defaultNaturalType: "note"
    });

    const createdNodes: NodeEntity[] = [];
    let primary: NodeEntity;

    // If it's a structured command (hierarchy), process it
    if (parsed.mode === "structured" && parsed.structured.ok && parsed.structured.pathSegments.length > 1) {
      const hierarchyResult = await captureHierarchicalPath(
        parsed.structured.pathSegments,
        parsed.primary,
        parsed.secondary
      );
      primary = hierarchyResult.primary;
      createdNodes.push(...hierarchyResult.created);

      await refreshNodes();

      pushToast(
        `Command captured: ${primary.type}`,
        "success"
      );
    } else if (isProbablyUrl(value)) {
      // It's a URL
      primary = await createLinkNode(value);
      createdNodes.push(primary);
      pushToast("Link captured", "info");
    } else {
      // It's a plain note
      primary = await createNoteNode(value);
      createdNodes.push(primary);
      pushToast("Note captured", "info");
    }

    pushHistory({
      type: (primary.type === "link" ? "link" : primary.type === "note" ? "note" : "file") as "link" | "note" | "file",
      title: primary.title,
      detail: createdNodes.length > 1 ? `+${createdNodes.length - 1} linked` : undefined
    });

    setCaptureValue("");
    setCaptureOpen(false);
  };

  const handleImportFiles = async (files: FileList) => {
    const file = files[0];
    if (!file) {
      return;
    }
    const text = await file.text();
    await createNoteNode(text, file.name.replace(/\.txt$/i, ""));
    setCaptureOpen(false);
  };

  const handleConnectNodes = async (
    sourceId: string,
    targetId: string,
    mode: "relation" | "hierarchy"
  ) => {
    if (sourceId === targetId) {
      return;
    }

    const sourceNode = nodes.find((node) => node.id === sourceId);
    const targetNode = nodes.find((node) => node.id === targetId);
    if (!sourceNode || !targetNode) {
      return;
    }

    const workspaceId = resolveWorkspaceId();

    if (mode === "hierarchy") {
      await repo.update(workspaceId, sourceId, { parentId: targetId });
      pushToast("Hierarchy connected", "success");
    } else {
      const sourceRelations = new Set(getNodeRelationIds(sourceNode));
      const targetRelations = new Set(getNodeRelationIds(targetNode));
      sourceRelations.add(targetId);
      targetRelations.add(sourceId);

      await repo.update(workspaceId, sourceId, { relationIds: Array.from(sourceRelations) });
      await repo.update(workspaceId, targetId, { relationIds: Array.from(targetRelations) });
      pushToast("Relation connected", "success");
    }

    await refreshNodes();
  };

  const captureHierarchicalPath = async (
    pathSegments: string[],
    primaryInput: CreateNodeInput,
    parentInputs: CreateNodeInput[]
  ) => {
    const workspace = resolveWorkspaceId();
    const workspaceNodes = await repo.listByWorkspace(workspace);
    const created: NodeEntity[] = [];

    let currentParentId: string | null = null;
    let primary: NodeEntity | null = null;

    for (let index = 0; index < pathSegments.length; index += 1) {
      const title = pathSegments[index]?.trim();
      if (!title) {
        continue;
      }

      const isLeaf = index === pathSegments.length - 1;
      const existing = workspaceNodes.find(
        (node) => node.parentId === currentParentId && node.title.trim().toLowerCase() === title.toLowerCase()
      );

      if (existing) {
        if (isLeaf) {
          primary = existing;
        }
        currentParentId = existing.id;
        continue;
      }

      const sourceInput = isLeaf
        ? primaryInput
        : parentInputs[index] ?? {
            workspaceId: workspace,
            type: "project",
            title,
            content: "",
            metadata: { autoGeneratedParent: true }
          };

      const node = createNode({
        ...sourceInput,
        workspaceId: workspace,
        title,
        parentId: currentParentId
      });

      await repo.save(node);
      workspaceNodes.push(node);
      created.push(node);

      if (isLeaf) {
        primary = node;
      }

      currentParentId = node.id;
    }

    if (!primary) {
      primary = createNode({
        ...primaryInput,
        workspaceId: workspace,
        title: primaryInput.title,
        parentId: currentParentId
      });
      await repo.save(primary);
      created.push(primary);
    }

    return { primary, created };
  };

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCaptureOpen(true);
      }
    };

    const handlePaste = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      const text = event.clipboardData?.getData("text") ?? "";
      if (text && isProbablyUrl(text)) {
        createLinkNode(text).catch(() => undefined);
      }
    };

    const unsubscribe = subscribeCaptureEvents((payload) => {
      if (payload.type === "url" && payload.value) {
        createLinkNode(payload.value).catch(() => undefined);
      }
      if (payload.type === "text" && payload.value) {
        createNoteNode(payload.value).catch(() => undefined);
      }
      if (payload.type === "file" && payload.value) {
        createNoteNode(payload.value, payload.filename ?? "Imported file").catch(() => undefined);
      }
    });

    window.addEventListener("keydown", handleKeydown);
    window.addEventListener("paste", handlePaste);
    return () => {
      window.removeEventListener("keydown", handleKeydown);
      window.removeEventListener("paste", handlePaste);
      unsubscribe();
    };
  }, [nodes, workspaceId]);

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="brand">
          <span className="brand-title">Rehilo Graph</span>
          <span className="brand-subtitle">Spatial knowledge map</span>
        </div>
        <button type="button" className="capture-button" onClick={() => setCaptureOpen(true)}>
          Quick capture
        </button>
        <button
          type="button"
          className="capture-button"
          onClick={() => {
            setShowUnlinkedOnly((prev) => !prev);
          }}
        >
          Unlinked ({unlinkedNodes.length})
        </button>
        <FilterBar
          workspaces={workspaces}
          types={types}
          tags={tags}
          workspaceId={workspaceId}
          typeFilter={typeFilter}
          tagQuery={tagQuery}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onWorkspaceChange={setWorkspaceId}
          onTypeChange={setTypeFilter}
          onTagQueryChange={setTagQuery}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
        />
      </header>

      <main className="main-grid-new">
        {/* Tab Headers */}
        <div className="tab-headers">
          <button
            className={`tab-button ${viewMode === "dashboard" ? "active" : ""}`}
            onClick={() => setViewMode("dashboard")}
          >
            Dashboard
          </button>
          <button
            className={`tab-button ${viewMode === "graph" ? "active" : ""}`}
            onClick={() => setViewMode("graph")}
          >
            Graph Map
          </button>
          {!dashboardCollapsed && (
            <button
              className="tab-collapse"
              onClick={() => setDashboardCollapsed(true)}
              title="Collapse dashboard to expand graph"
            >
              ◀
            </button>
          )}
        </div>

        {/* Main Content Area */}
        <div className="main-content">
          {/* Left Panel: Dashboard (collapsible) - Always present unless collapsed */}
          {!dashboardCollapsed && (
            <div className="dashboard-panel">
              <DashboardView
                nodes={visibleNodes}
                workspaceId={workspaceId}
                layoutState={layoutState}
                onLayoutChange={handleLayoutChange}
                onSelectNode={handleSelectNode}
              />
            </div>
          )}

          {/* Center: Graph - Always present */}
          <section className={`graph-panel ${dashboardCollapsed ? "expanded" : ""}`}>
            <ErrorBoundary
              fallback={
                <div className="empty-state">
                  <h3>Graph failed to load</h3>
                  <p>Check the browser console for details.</p>
                </div>
              }
            >
              <GraphScene2D
                nodes={visibleNodes}
                edges={edges}
                selectedNodeId={selectedNodeId}
                onSelectNode={handleSelectNode}
                onConnectNodes={handleConnectNodes}
                selectedNodeTooltip={selectionState === "tooltip" ? selectedNode?.title : undefined}
              />
            </ErrorBoundary>
            {visibleNodes.length === 0 && (
              <div className="empty-state">
                <h3>No nodes match the current filters</h3>
                <p>{showUnlinkedOnly ? "No unlinked nodes in this scope." : "Try relaxing the filters."}</p>
              </div>
            )}
          </section>

          {/* Right Panel: Node Details (appears on second click) */}
          {selectionState === "detail" && selectedNode && (
            <aside className="info-panel">
              <button
                className="close-panel"
                onClick={() => setSelectionState("tooltip")}
                title="Close details"
              >
                ✕
              </button>
              <div className="panel-card">
                <h2>{selectedNode.title}</h2>
                <div className="panel-content">
                  <p className="meta">Type: <strong>{selectedNode.type}</strong></p>
                  <p className="meta">Workspace: <strong>{selectedNode.workspaceId}</strong></p>
                  <div className="tag-list">
                    {selectedNode.tags.length > 0 ? (
                      selectedNode.tags.map((tag) => (
                        <span className="tag" key={tag}>
                          #{tag}
                        </span>
                      ))
                    ) : (
                      <span className="tag muted">No tags</span>
                    )}
                  </div>
                  <p className="meta">Created: <strong>{selectedNode.createdAt.slice(0, 10)}</strong></p>
                </div>
              </div>

              {selectedNode && unlinkedNodeIds.has(selectedNode.id) && (
                <div className="panel-card">
                  <h3>Unlinked suggestions</h3>
                  {selectedNodeSuggestions.length === 0 ? (
                    <p className="meta muted">No suggestions by title/tag similarity.</p>
                  ) : (
                    <div className="panel-content">
                      {selectedNodeSuggestions.map((suggestion) => (
                        <p key={suggestion.target.id} className="meta">
                          {suggestion.target.title}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="panel-card legend">
                <h3>Legend</h3>
                <div className="legend-row">
                  <span className="dot selected"></span>
                  <span>Selected node</span>
                </div>
                <div className="legend-row">
                  <span className="dot direct"></span>
                  <span>Direct relations</span>
                </div>
              </div>
              <CaptureHistoryPanel items={captureHistory} />
            </aside>
          )}
        </div>
      </main>

      <CaptureDialog
        open={captureOpen}
        value={captureValue}
        status={captureStatus}
        onChange={setCaptureValue}
        onClose={() => setCaptureOpen(false)}
        onSubmit={handleCaptureSubmit}
        onImport={handleImportFiles}
      />
      <ToastStack items={toasts} />
    </div>
  );
}
