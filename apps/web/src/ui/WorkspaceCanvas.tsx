import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent
} from "react";
import type { Connection, NodeEntity, NodeType } from "../core/node-engine";
import {
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type TimerWidgetState,
  type Widget,
  type Workspace,
  type WorkspaceNode
} from "../workspace/workspace-engine";

interface WorkspaceCanvasProps {
  workspace: Workspace;
  nodes: NodeEntity[];
  connections: Connection[];
  selectedNodeId: string | null;
  pendingConnectionSourceId: string | null;
  lastCreatedNodeId: string | null;
  lastCreatedWidgetId: string | null;
  onNodeFocus: (nodeId: string) => void;
  onNodeSelect: (nodeId: string) => void;
  onNodeMove: (nodeId: string, x: number, y: number) => void;
  onNodeEdit: (nodeId: string, patch: { type?: NodeType; title?: string; content?: string; done?: boolean; checklistItems?: Array<{ id: string; text: string; checked: boolean }> }) => void;
  onNodeDelete: (nodeId: string) => void;
  onNodeToggleMinimized: (nodeId: string, isMinimized: boolean) => void;
  onStartConnection: (nodeId: string) => void;
  onWidgetFocus: (widgetId: string) => void;
  onWidgetMove: (widgetId: string, x: number, y: number) => void;
  onWidgetStateChange: (widgetId: string, patch: Partial<TimerWidgetState>) => void;
  onWidgetDelete: (widgetId: string) => void;
  onCanvasCreate: (payload: { kind: "note" | "todo" | "journal" | "timer"; x: number; y: number; title?: string; content?: string; checklistItems?: string[] }) => void;
  onCommandPreview: (input: string) => string;
  onCommandCreate: (input: string, centerX: number, centerY: number) => { ok: boolean; message: string };
}

interface PointerPanState {
  startClientX: number;
  startClientY: number;
  startPanX: number;
  startPanY: number;
}

interface DragNodeState {
  nodeId: string;
  offsetX: number;
  offsetY: number;
}

interface DragWidgetState {
  widgetId: string;
  offsetX: number;
  offsetY: number;
}

interface EmptyClickState {
  clientX: number;
  clientY: number;
  worldX: number;
  worldY: number;
  timeMs: number;
}

interface DraftState {
  kind: "note" | "todo" | "journal" | "timer";
  title: string;
  content: string;
  checklistInput: string;
  checklistItems: string[];
}

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2.5;

const WorkspaceCanvas = memo(function WorkspaceCanvas(props: WorkspaceCanvasProps) {
  const {
    workspace,
    nodes,
    connections,
    selectedNodeId,
    pendingConnectionSourceId,
    lastCreatedNodeId,
    lastCreatedWidgetId,
    onNodeFocus,
    onNodeSelect,
    onNodeMove,
    onNodeEdit,
    onNodeDelete,
    onNodeToggleMinimized,
    onStartConnection,
    onWidgetFocus,
    onWidgetMove,
    onWidgetStateChange,
    onWidgetDelete,
    onCanvasCreate,
    onCommandPreview,
    onCommandCreate
  } = props;

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const worldRef = useRef<HTMLDivElement | null>(null);
  const quickInputRef = useRef<HTMLInputElement | null>(null);

  const panStateRef = useRef<PointerPanState | null>(null);
  const dragNodeRef = useRef<DragNodeState | null>(null);
  const dragWidgetRef = useRef<DragWidgetState | null>(null);
  const emptyClickRef = useRef<EmptyClickState | null>(null);
  const lastEmptyClickAtRef = useRef<number>(0);
  const previousBodyUserSelectRef = useRef<string | null>(null);

  const panRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const rafRef = useRef<number | null>(null);

  const [isPanning, setIsPanning] = useState(false);
  const [creationAnchor, setCreationAnchor] = useState<{ clientX: number; clientY: number; worldX: number; worldY: number } | null>(null);
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [quickInputOpen, setQuickInputOpen] = useState(false);
  const [quickInputValue, setQuickInputValue] = useState("");
  const [quickMessage, setQuickMessage] = useState("");
  const [animatedNodeIds, setAnimatedNodeIds] = useState<Set<string>>(new Set());
  const [animatedWidgetIds, setAnimatedWidgetIds] = useState<Set<string>>(new Set());

  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);

  const workspaceNodes = useMemo(
    () => workspace.nodes.filter((workspaceNode) => nodeById.has(workspaceNode.nodeId)).sort((a, b) => a.zIndex - b.zIndex),
    [workspace.nodes, nodeById]
  );

  const nodePositionById = useMemo(
    () => new Map(workspaceNodes.map((workspaceNode) => [workspaceNode.nodeId, workspaceNode])),
    [workspaceNodes]
  );

  const renderedConnections = useMemo(() => {
    return connections
      .filter((connection) => nodePositionById.has(connection.fromId) && nodePositionById.has(connection.toId))
      .map((connection) => {
        const from = nodePositionById.get(connection.fromId)!;
        const to = nodePositionById.get(connection.toId)!;

        const isDirect = selectedNodeId
          ? connection.fromId === selectedNodeId || connection.toId === selectedNodeId
          : false;

        return {
          ...connection,
          x1: from.x + from.width / 2,
          y1: from.y + from.height / 2,
          x2: to.x + to.width / 2,
          y2: to.y + to.height / 2,
          opacity: selectedNodeId ? (isDirect ? 0.95 : 0.3) : 0.3,
          strokeWidth: selectedNodeId && isDirect ? 1.4 : 0.9
        };
      });
  }, [connections, nodePositionById, selectedNodeId]);

  const scheduleViewportTransform = () => {
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
    }

    rafRef.current = window.requestAnimationFrame(() => {
      applyViewportTransform(worldRef.current, panRef.current.x, panRef.current.y, zoomRef.current);
    });
  };

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || panRef.current.x !== 0 || panRef.current.y !== 0) {
      return;
    }

    const viewportRect = viewport.getBoundingClientRect();
    panRef.current = {
      x: Math.floor((viewportRect.width - WORLD_WIDTH) / 2),
      y: Math.floor((viewportRect.height - WORLD_HEIGHT) / 2)
    };

    applyViewportTransform(worldRef.current, panRef.current.x, panRef.current.y, zoomRef.current);
  }, []);

  useEffect(() => {
    if (!lastCreatedNodeId) {
      return;
    }

    setAnimatedNodeIds((previous) => new Set(previous).add(lastCreatedNodeId));
    const timeoutId = window.setTimeout(() => {
      setAnimatedNodeIds((previous) => {
        const next = new Set(previous);
        next.delete(lastCreatedNodeId);
        return next;
      });
    }, 320);

    return () => window.clearTimeout(timeoutId);
  }, [lastCreatedNodeId]);

  useEffect(() => {
    if (!lastCreatedWidgetId) {
      return;
    }

    setAnimatedWidgetIds((previous) => new Set(previous).add(lastCreatedWidgetId));
    const timeoutId = window.setTimeout(() => {
      setAnimatedWidgetIds((previous) => {
        const next = new Set(previous);
        next.delete(lastCreatedWidgetId);
        return next;
      });
    }, 320);

    return () => window.clearTimeout(timeoutId);
  }, [lastCreatedWidgetId]);

  useEffect(() => {
    if (!quickInputOpen) {
      return;
    }

    window.setTimeout(() => {
      quickInputRef.current?.focus();
      quickInputRef.current?.select();
    }, 0);
  }, [quickInputOpen]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const viewport = viewportRef.current;
      if (!viewport) {
        return;
      }

      const viewportRect = viewport.getBoundingClientRect();

      if (panStateRef.current) {
        const deltaX = event.clientX - panStateRef.current.startClientX;
        const deltaY = event.clientY - panStateRef.current.startClientY;

        panRef.current = {
          x: panStateRef.current.startPanX + deltaX,
          y: panStateRef.current.startPanY + deltaY
        };

        scheduleViewportTransform();
      }

      if (dragNodeRef.current) {
        const worldX = (event.clientX - viewportRect.left - panRef.current.x) / zoomRef.current;
        const worldY = (event.clientY - viewportRect.top - panRef.current.y) / zoomRef.current;

        onNodeMove(dragNodeRef.current.nodeId, worldX - dragNodeRef.current.offsetX, worldY - dragNodeRef.current.offsetY);
      }

      if (dragWidgetRef.current) {
        const worldX = (event.clientX - viewportRect.left - panRef.current.x) / zoomRef.current;
        const worldY = (event.clientY - viewportRect.top - panRef.current.y) / zoomRef.current;

        onWidgetMove(
          dragWidgetRef.current.widgetId,
          worldX - dragWidgetRef.current.offsetX,
          worldY - dragWidgetRef.current.offsetY
        );
      }
    };

    const handlePointerUp = (event: PointerEvent) => {
      const emptyClick = emptyClickRef.current;
      if (emptyClick && viewportRef.current) {
        const dx = Math.abs(event.clientX - emptyClick.clientX);
        const dy = Math.abs(event.clientY - emptyClick.clientY);
        const elapsed = Date.now() - emptyClick.timeMs;

        if (dx < 4 && dy < 4 && elapsed < 250) {
          setCreationAnchor({
            clientX: emptyClick.clientX,
            clientY: emptyClick.clientY,
            worldX: emptyClick.worldX,
            worldY: emptyClick.worldY
          });
          setDraft(null);

          const now = Date.now();
          if (now - lastEmptyClickAtRef.current < 320) {
            setQuickInputOpen(true);
            setQuickMessage("Type command and press Enter");
          }
          lastEmptyClickAtRef.current = now;
        }
      }

      panStateRef.current = null;
      dragNodeRef.current = null;
      dragWidgetRef.current = null;
      emptyClickRef.current = null;
      setIsPanning(false);

      if (previousBodyUserSelectRef.current !== null) {
        document.body.style.userSelect = previousBodyUserSelectRef.current;
        previousBodyUserSelectRef.current = null;
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }
    };
  }, [onNodeMove, onWidgetMove]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTypingContext =
        target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

      if (event.key === "Escape") {
        if (quickInputOpen) {
          setQuickInputOpen(false);
          setQuickMessage("Cancelled");
          return;
        }
        if (creationAnchor || draft) {
          setCreationAnchor(null);
          setDraft(null);
          setQuickMessage("Cancelled");
        }
        return;
      }

      if (isTypingContext) {
        return;
      }

      if (event.key === "/") {
        event.preventDefault();
        setQuickInputOpen(true);
        setQuickMessage("Type command and press Enter");
        return;
      }

      if (event.ctrlKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setQuickInputOpen(true);
        setQuickMessage("Quick creation engine open");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [creationAnchor, draft, quickInputOpen]);

  const handleViewportPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;

    if (target.closest(".node-card") || target.closest(".widget-card") || target.closest(".creation-popover") || target.closest(".quick-command")) {
      return;
    }

    if (creationAnchor || draft) {
      setCreationAnchor(null);
      setDraft(null);
      return;
    }

    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    event.preventDefault();

    const viewportRect = viewport.getBoundingClientRect();
    const worldX = (event.clientX - viewportRect.left - panRef.current.x) / zoomRef.current;
    const worldY = (event.clientY - viewportRect.top - panRef.current.y) / zoomRef.current;

    panStateRef.current = {
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPanX: panRef.current.x,
      startPanY: panRef.current.y
    };

    emptyClickRef.current = {
      clientX: event.clientX,
      clientY: event.clientY,
      worldX,
      worldY,
      timeMs: Date.now()
    };

    setIsPanning(true);
  };

  const handleViewportWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();

    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    const viewportRect = viewport.getBoundingClientRect();
    const cursorX = event.clientX - viewportRect.left;
    const cursorY = event.clientY - viewportRect.top;

    const currentZoom = zoomRef.current;
    const zoomIntensity = event.ctrlKey ? 0.003 : 0.0018;
    const rawZoom = currentZoom * Math.exp(-event.deltaY * zoomIntensity);
    const nextZoom = clamp(rawZoom, MIN_ZOOM, MAX_ZOOM);

    if (nextZoom === currentZoom) {
      return;
    }

    const worldXAtCursor = (cursorX - panRef.current.x) / currentZoom;
    const worldYAtCursor = (cursorY - panRef.current.y) / currentZoom;

    panRef.current = {
      x: cursorX - worldXAtCursor * nextZoom,
      y: cursorY - worldYAtCursor * nextZoom
    };

    zoomRef.current = nextZoom;
    scheduleViewportTransform();
  };

  const handleNodeDragStart = (event: ReactPointerEvent<HTMLElement>, workspaceNode: WorkspaceNode) => {
    event.preventDefault();
    event.stopPropagation();

    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    const viewportRect = viewport.getBoundingClientRect();
    const pointerWorldX = (event.clientX - viewportRect.left - panRef.current.x) / zoomRef.current;
    const pointerWorldY = (event.clientY - viewportRect.top - panRef.current.y) / zoomRef.current;

    dragNodeRef.current = {
      nodeId: workspaceNode.nodeId,
      offsetX: pointerWorldX - workspaceNode.x,
      offsetY: pointerWorldY - workspaceNode.y
    };

    if (previousBodyUserSelectRef.current === null) {
      previousBodyUserSelectRef.current = document.body.style.userSelect;
    }
    document.body.style.userSelect = "none";

    onNodeFocus(workspaceNode.nodeId);
  };

  const handleWidgetDragStart = (event: ReactPointerEvent<HTMLElement>, widget: Widget) => {
    event.preventDefault();
    event.stopPropagation();

    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    const viewportRect = viewport.getBoundingClientRect();
    const pointerWorldX = (event.clientX - viewportRect.left - panRef.current.x) / zoomRef.current;
    const pointerWorldY = (event.clientY - viewportRect.top - panRef.current.y) / zoomRef.current;

    dragWidgetRef.current = {
      widgetId: widget.id,
      offsetX: pointerWorldX - widget.x,
      offsetY: pointerWorldY - widget.y
    };

    if (previousBodyUserSelectRef.current === null) {
      previousBodyUserSelectRef.current = document.body.style.userSelect;
    }
    document.body.style.userSelect = "none";

    onWidgetFocus(widget.id);
  };

  const openDraftFor = (kind: DraftState["kind"]) => {
    setDraft({
      kind,
      title: "",
      content: "",
      checklistInput: "",
      checklistItems: []
    });
  };

  const confirmDraftCreation = () => {
    if (!creationAnchor || !draft) {
      return;
    }

    onCanvasCreate({
      kind: draft.kind,
      x: creationAnchor.worldX,
      y: creationAnchor.worldY,
      title: draft.title,
      content: draft.content,
      checklistItems: draft.kind === "todo" ? draft.checklistItems : undefined
    });

    setCreationAnchor(null);
    setDraft(null);
    setQuickMessage("Created");
  };

  const addChecklistItem = () => {
    if (!draft || draft.kind !== "todo") {
      return;
    }

    const value = draft.checklistInput.trim();
    if (!value) {
      return;
    }

    setDraft({
      ...draft,
      checklistItems: [...draft.checklistItems, value],
      checklistInput: ""
    });
  };

  const removeChecklistItem = (index: number) => {
    if (!draft || draft.kind !== "todo") {
      return;
    }

    setDraft({
      ...draft,
      checklistItems: draft.checklistItems.filter((_, itemIndex) => itemIndex !== index)
    });
  };

  const submitQuickCommand = () => {
    const centerWorld = getViewportCenterWorld(viewportRef.current, panRef.current.x, panRef.current.y, zoomRef.current);
    const result = onCommandCreate(quickInputValue, centerWorld.x, centerWorld.y);
    setQuickMessage(result.message);

    if (result.ok) {
      setQuickInputValue("");
      setQuickInputOpen(false);
    }
  };

  const quickPreview = quickInputValue ? onCommandPreview(quickInputValue) : "Use: 1/N/Title or T/Title/item1/item2";

  const directConnectionCount = renderedConnections.filter((connection) => connection.opacity > 0.9).length;

  const viewportClassName = `workspace-viewport${isPanning ? " panning" : ""}${
    pendingConnectionSourceId ? " link-mode" : ""
  }`;

  return (
    <section className="investigator-shell">
      <div
        className={viewportClassName}
        ref={viewportRef}
        onPointerDown={handleViewportPointerDown}
        onWheel={handleViewportWheel}
      >
        <div className="workspace-world" ref={worldRef} style={{ width: `${WORLD_WIDTH}px`, height: `${WORLD_HEIGHT}px` }}>
          <svg className="workspace-connections" width={WORLD_WIDTH} height={WORLD_HEIGHT}>
            {renderedConnections.map((connection) => (
              <line
                key={connection.id}
                x1={connection.x1}
                y1={connection.y1}
                x2={connection.x2}
                y2={connection.y2}
                stroke="currentColor"
                strokeOpacity={connection.opacity}
                strokeWidth={connection.strokeWidth}
              />
            ))}
          </svg>

          {workspaceNodes.map((workspaceNode) => {
            const node = nodeById.get(workspaceNode.nodeId);
            if (!node) {
              return null;
            }

            const isNew = animatedNodeIds.has(node.id);

            return (
              <NodeCard
                key={workspaceNode.id}
                node={node}
                workspaceNode={workspaceNode}
                isSelected={selectedNodeId === node.id}
                isPendingSource={pendingConnectionSourceId === node.id}
                isNew={isNew}
                onFocus={onNodeFocus}
                onSelect={onNodeSelect}
                onPointerDownForDrag={handleNodeDragStart}
                onEdit={onNodeEdit}
                onDelete={onNodeDelete}
                onToggleMinimized={onNodeToggleMinimized}
                onStartConnection={onStartConnection}
              />
            );
          })}

          {workspace.widgets.map((widget) => (
            <TimerWidgetCard
              key={widget.id}
              widget={widget}
              isNew={animatedWidgetIds.has(widget.id)}
              onFocus={onWidgetFocus}
              onPointerDownForDrag={handleWidgetDragStart}
              onStateChange={onWidgetStateChange}
              onDelete={onWidgetDelete}
            />
          ))}
        </div>

        {creationAnchor && (
          <div
            className="creation-popover"
            style={{ left: `${creationAnchor.clientX}px`, top: `${creationAnchor.clientY}px` }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            {!draft ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setQuickInputOpen(true);
                    setQuickMessage("Type command and press Enter");
                    setCreationAnchor(null);
                    setDraft(null);
                  }}
                >
                  Comando rápido
                </button>
                <button type="button" onClick={() => openDraftFor("note")}>Note</button>
                <button type="button" onClick={() => openDraftFor("todo")}>To-Do</button>
                <button type="button" onClick={() => openDraftFor("journal")}>Journal</button>
                <button
                  type="button"
                  onClick={() => {
                    onCanvasCreate({ kind: "timer", x: creationAnchor.worldX, y: creationAnchor.worldY });
                    setCreationAnchor(null);
                    setQuickMessage("Timer created");
                  }}
                >
                  Timer
                </button>
                <div className="creation-section-title">Future widgets</div>
                <button type="button" disabled>
                  More widgets soon
                </button>
              </>
            ) : (
              <div className="creation-draft">
                <strong>{draft.kind.toUpperCase()}</strong>
                <input
                  value={draft.title}
                  onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                  placeholder="Title"
                />
                {(draft.kind === "note" || draft.kind === "journal") && (
                  <textarea
                    value={draft.content}
                    onChange={(event) => setDraft({ ...draft, content: event.target.value })}
                    placeholder="Optional content"
                  />
                )}
                {draft.kind === "todo" && (
                  <>
                    <div className="todo-inline-row">
                      <input
                        value={draft.checklistInput}
                        onChange={(event) => setDraft({ ...draft, checklistInput: event.target.value })}
                        placeholder="Checklist item"
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            addChecklistItem();
                          }
                        }}
                      />
                      <button type="button" onClick={addChecklistItem}>+
                      </button>
                    </div>
                    {draft.checklistItems.length > 0 && (
                      <ul className="todo-inline-list">
                        {draft.checklistItems.map((item, index) => (
                          <li key={`${item}-${index}`}>
                            <span>{item}</span>
                            <button type="button" onClick={() => removeChecklistItem(index)}>x</button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
                <div className="creation-draft-actions">
                  <button type="button" onClick={confirmDraftCreation}>Create</button>
                  <button
                    type="button"
                    onClick={() => {
                      setDraft(null);
                    }}
                  >
                    Back
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {quickInputOpen && (
          <div className="quick-command" onPointerDown={(event) => event.stopPropagation()}>
            <input
              ref={quickInputRef}
              value={quickInputValue}
              onChange={(event) => setQuickInputValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  submitQuickCommand();
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  setQuickInputOpen(false);
                  setQuickMessage("Cancelled");
                }
              }}
              placeholder="e.g. 1/N/COMPRAR LECHE or T/Compras/leche/huevos"
            />
            <div className="quick-preview">{quickPreview}</div>
          </div>
        )}
      </div>

      <div className="workspace-summary">
        <span>Nodes: {workspaceNodes.length}</span>
        <span>Connections: {renderedConnections.length}</span>
        <span>Direct highlighted: {selectedNodeId ? directConnectionCount : 0}</span>
        <span>Widgets: {workspace.widgets.length}</span>
        {quickMessage && <span>{quickMessage}</span>}
      </div>
    </section>
  );
});

interface NodeCardProps {
  node: NodeEntity;
  workspaceNode: WorkspaceNode;
  isSelected: boolean;
  isPendingSource: boolean;
  isNew: boolean;
  onFocus: (nodeId: string) => void;
  onSelect: (nodeId: string) => void;
  onPointerDownForDrag: (event: ReactPointerEvent<HTMLElement>, workspaceNode: WorkspaceNode) => void;
  onEdit: (nodeId: string, patch: { title?: string; content?: string; done?: boolean; checklistItems?: Array<{ id: string; text: string; checked: boolean }> }) => void;
  onDelete: (nodeId: string) => void;
  onToggleMinimized: (nodeId: string, isMinimized: boolean) => void;
  onStartConnection: (nodeId: string) => void;
}

const NodeCard = memo(function NodeCard(props: NodeCardProps) {
  const {
    node,
    workspaceNode,
    isSelected,
    isPendingSource,
    isNew,
    onFocus,
    onSelect,
    onPointerDownForDrag,
    onEdit,
    onDelete,
    onToggleMinimized,
    onStartConnection
  } = props;

  const icon = node.type === "todo" ? "☑" : node.type === "journal" ? "📓" : "📝";

  return (
    <article
      className={`node-card${workspaceNode.isMinimized ? " minimized" : " expanded"}${isSelected ? " selected" : ""}${
        isPendingSource ? " pending" : ""
      }${isNew ? " entry" : ""}`}
      style={{
        width: `${workspaceNode.width}px`,
        height: `${workspaceNode.height}px`,
        left: `${workspaceNode.x}px`,
        top: `${workspaceNode.y}px`,
        zIndex: workspaceNode.zIndex
      }}
      onPointerDown={(event) => {
        onFocus(node.id);
        const target = event.target as HTMLElement;
        const isInteractive = Boolean(target.closest("input, textarea, select, button, label, a"));
        if (isInteractive) {
          return;
        }
        onPointerDownForDrag(event, workspaceNode);
      }}
      onClick={() => onSelect(node.id)}
      onDoubleClick={() => {
        if (workspaceNode.isMinimized) {
          onToggleMinimized(node.id, false);
        }
      }}
    >
      <header className="node-header">
        <span className="node-icon">{icon}</span>
        <strong className="node-title-text">{node.data.title || "Untitled"}</strong>
        {!workspaceNode.isMinimized && <span className="node-type-chip">{node.type}</span>}
      </header>

      {!workspaceNode.isMinimized && (
        <div
          className="node-expanded-body"
          onClick={(event) => {
            event.stopPropagation();
          }}
        >
          {(node.type === "note" || node.type === "journal") && (
            <textarea
              value={node.data.content}
              onChange={(event) => onEdit(node.id, { content: event.target.value })}
              placeholder="Content"
            />
          )}

          {node.type === "todo" && (
            <div className="todo-inline-block">
              {(node.data.checklistItems ?? []).map((item) => (
                <label key={item.id} className="todo-check">
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={(event) => {
                      const next = (node.data.checklistItems ?? []).map((entry) =>
                        entry.id === item.id ? { ...entry, checked: event.target.checked } : entry
                      );
                      onEdit(node.id, { checklistItems: next });
                    }}
                  />
                  {item.text}
                </label>
              ))}
            </div>
          )}

          <div className="node-expanded-actions">
            <button type="button" onClick={() => onToggleMinimized(node.id, true)}>
              View
            </button>
            <button type="button" onClick={() => onStartConnection(node.id)}>
              Link
            </button>
            <button type="button" onClick={() => onDelete(node.id)}>
              Delete
            </button>
          </div>
        </div>
      )}
    </article>
  );
});

interface TimerWidgetCardProps {
  widget: Widget;
  isNew: boolean;
  onFocus: (widgetId: string) => void;
  onPointerDownForDrag: (event: ReactPointerEvent<HTMLElement>, widget: Widget) => void;
  onStateChange: (widgetId: string, patch: Partial<TimerWidgetState>) => void;
  onDelete: (widgetId: string) => void;
}

const TimerWidgetCard = memo(function TimerWidgetCard(props: TimerWidgetCardProps) {
  const { widget, isNew, onFocus, onPointerDownForDrag, onStateChange, onDelete } = props;

  const minutes = Math.floor(widget.state.remainingSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (widget.state.remainingSeconds % 60).toString().padStart(2, "0");

  return (
    <aside
      className={`widget-card${isNew ? " entry" : ""}`}
      style={{
        width: `${widget.width}px`,
        height: `${widget.height}px`,
        left: `${widget.x}px`,
        top: `${widget.y}px`,
        zIndex: widget.zIndex
      }}
      onPointerDown={(event) => {
        onPointerDownForDrag(event, widget);
        onFocus(widget.id);
      }}
    >
      <header className="widget-header">
        <strong>Pomodoro</strong>
      </header>

      <div className="timer-value">
        {minutes}:{seconds}
      </div>

      <div className="widget-actions">
        <button
          type="button"
          onClick={() =>
            onStateChange(widget.id, {
              isRunning: !widget.state.isRunning,
              lastTickAt: !widget.state.isRunning ? new Date().toISOString() : null
            })
          }
        >
          {widget.state.isRunning ? "Pause" : "Start"}
        </button>
        <button
          type="button"
          onClick={() =>
            onStateChange(widget.id, {
              isRunning: false,
              remainingSeconds: widget.state.durationSeconds,
              lastTickAt: null
            })
          }
        >
          Reset
        </button>
        <button type="button" onClick={() => onDelete(widget.id)}>
          Remove
        </button>
      </div>
    </aside>
  );
});

function applyViewportTransform(world: HTMLDivElement | null, panX: number, panY: number, zoom: number) {
  if (!world) {
    return;
  }

  world.style.transform = `translate3d(${panX}px, ${panY}px, 0) scale(${zoom})`;
}

function getViewportCenterWorld(
  viewport: HTMLDivElement | null,
  panX: number,
  panY: number,
  zoom: number
): { x: number; y: number } {
  if (!viewport) {
    return { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 };
  }

  const rect = viewport.getBoundingClientRect();
  return {
    x: (rect.width / 2 - panX) / zoom,
    y: (rect.height / 2 - panY) / zoom
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export default WorkspaceCanvas;
