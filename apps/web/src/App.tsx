import { useEffect, useMemo, useState } from "react";
import type { NodeEntity } from "@rehilo/domain";
import { createNode, parseHybridInput } from "@rehilo/domain";
import FilterBar from "./components/FilterBar";
import CaptureDialog from "./components/CaptureDialog";
import CommandBar from "./components/CommandBar";
import ErrorBoundary from "./components/ErrorBoundary";
import GraphScene from "./components/GraphScene";
import CaptureHistoryPanel, { type CaptureHistoryItem } from "./components/CaptureHistoryPanel";
import ToastStack, { type ToastItem, type ToastTone } from "./components/ToastStack";
import ViewSwitcher from "./components/ViewSwitcher";
import DashboardView from "./components/dashboard/DashboardView";
import ListView from "./components/ListView";
import NodeDetailView from "./components/NodeDetailView";
import { demoNodes } from "./data/demoGraph";
import { buildGraphEdges, filterNodes, parseTagQuery } from "./lib/graph-utils";
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
type ViewMode = "dashboard" | "list" | "graph" | "node";

export default function App() {
  const [viewMode, setViewMode] = useState<ViewMode>("dashboard");
  const [nodes, setNodes] = useState<NodeEntity[]>([]);
  const [workspaceId, setWorkspaceId] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [tagQuery, setTagQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState(EMPTY_SELECTION);
  const [layoutState, setLayoutState] = useState<WorkspaceLayoutState>(() =>
    loadWorkspaceLayout("all")
  );
  const [captureOpen, setCaptureOpen] = useState(false);
  const [captureValue, setCaptureValue] = useState("");
  const [captureStatus, setCaptureStatus] = useState<string | null>(null);
  const [captureHistory, setCaptureHistory] = useState<CaptureHistoryItem[]>([]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [commandValue, setCommandValue] = useState("");
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
  const edges = useMemo(() => buildGraphEdges(filteredNodes), [filteredNodes]);

  const selectedNode = filteredNodes.find((node) => node.id === selectedNodeId) ?? null;
  const webglAvailable = useMemo(() => isWebGLAvailable(), []);

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
  };

  const handleCaptureSubmit = async () => {
    const value = captureValue.trim();
    if (!value) {
      setCaptureStatus("Capture is empty");
      pushToast("Capture is empty", "warning");
      return;
    }

    if (isProbablyUrl(value)) {
      await createLinkNode(value);
    } else {
      await createNoteNode(value);
    }

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

  const handleCommandSubmit = async () => {
    const value = commandValue.trim();
    if (!value) {
      pushToast("Command is empty", "warning");
      return;
    }

    const parsed = parseHybridInput(value, {
      workspaceId: resolveWorkspaceId(),
      defaultNaturalType: "note"
    });

    const createdNodes: NodeEntity[] = [];
    const primary = createNode(parsed.primary);
    createdNodes.push(primary);
    parsed.secondary.forEach((input) => createdNodes.push(createNode(input)));

    for (const node of createdNodes) {
      await repo.save(node);
    }

    await refreshNodes();

    const tone: ToastTone = parsed.mode === "structured" ? "success" : "info";
    pushToast(
      parsed.mode === "structured"
        ? `Command captured: ${primary.type}`
        : "Captured as note",
      tone
    );

    pushHistory({
      type: primary.type === "link" ? "link" : primary.type === "note" ? "note" : "note",
      title: primary.title,
      detail: parsed.secondary.length > 0 ? `+${parsed.secondary.length} linked` : undefined
    });

    setCommandValue("");
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
          <span className="brand-subtitle">3D workspace map</span>
        </div>
        <button type="button" className="capture-button" onClick={() => setCaptureOpen(true)}>
          Quick capture
        </button>
        <CommandBar value={commandValue} onChange={setCommandValue} onSubmit={handleCommandSubmit} />
        <ViewSwitcher value={viewMode} onChange={setViewMode} />
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

      <main className="main-grid">
        <section className="graph-panel">
          {viewMode === "dashboard" && (
            <DashboardView
              nodes={filteredNodes}
              workspaceId={workspaceId}
              layoutState={layoutState}
              onLayoutChange={handleLayoutChange}
              onSelectNode={setSelectedNodeId}
            />
          )}
          {viewMode === "list" && (
            <ListView nodes={filteredNodes} selectedNodeId={selectedNodeId} onSelectNode={setSelectedNodeId} />
          )}
          {viewMode === "graph" && (
            <ErrorBoundary
              fallback={
                <div className="empty-state">
                  <h3>Graph failed to load</h3>
                  <p>Check the browser console for details.</p>
                </div>
              }
            >
              {webglAvailable ? (
                <GraphScene
                  nodes={filteredNodes}
                  edges={edges}
                  selectedNodeId={selectedNodeId}
                  onSelectNode={setSelectedNodeId}
                />
              ) : (
                <div className="empty-state">
                  <h3>WebGL is not available</h3>
                  <p>Try a different browser or enable hardware acceleration.</p>
                </div>
              )}
            </ErrorBoundary>
          )}
          {viewMode === "node" && (
            <NodeDetailView node={selectedNode} nodes={filteredNodes} />
          )}
          {filteredNodes.length === 0 && viewMode !== "node" && (
            <div className="empty-state">
              <h3>No nodes match the current filters</h3>
              <p>Try relaxing the tag or date range filters.</p>
            </div>
          )}
        </section>

        <aside className="info-panel">
          <div className="panel-card">
            <h2>Selection</h2>
            {selectedNode ? (
              <div className="panel-content">
                <p className="title">{selectedNode.title}</p>
                <p className="meta">Type: {selectedNode.type}</p>
                <p className="meta">Workspace: {selectedNode.workspaceId}</p>
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
                <p className="meta">Created: {selectedNode.createdAt.slice(0, 10)}</p>
              </div>
            ) : (
              <p className="meta">Select a node to inspect details.</p>
            )}
          </div>

          <div className="panel-card legend">
            <h2>Legend</h2>
            <div className="legend-row">
              <span className="dot selected"></span>
              <span>Selected node</span>
            </div>
            <div className="legend-row">
              <span className="dot direct"></span>
              <span>Direct relations</span>
            </div>
            <div className="legend-row">
              <span className="dot depth"></span>
              <span>Depth connections</span>
            </div>
          </div>
          <CaptureHistoryPanel items={captureHistory} />
        </aside>
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

function isWebGLAvailable(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const canvas = document.createElement("canvas");
    const hasContext = !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
    return hasContext;
  } catch {
    return false;
  }
}
