import { useMemo, useState } from "react";
import type { NodeEntity } from "@rehilo/domain";
import type { DashboardWidgetLayout, WorkspaceLayoutState } from "../../lib/layout-store";
import { reorderWidgets, toggleWidgetSpan } from "../../lib/layout-store";
import "./dashboard.css";

interface DashboardViewProps {
  nodes: NodeEntity[];
  workspaceId: string;
  layoutState: WorkspaceLayoutState;
  onLayoutChange: (state: WorkspaceLayoutState) => void;
  onSelectNode: (id: string) => void;
}

export default function DashboardView({
  nodes,
  workspaceId,
  layoutState,
  onLayoutChange,
  onSelectNode
}: DashboardViewProps) {
  const [editMode, setEditMode] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  const widgets = useMemo(() => {
    return [...layoutState.widgets].sort((left, right) => left.order - right.order);
  }, [layoutState.widgets]);

  const pendingTodos = useMemo(() => nodes.filter((node) => node.type === "todo" && node.status === "pending"), [nodes]);
  const recentNodes = useMemo(
    () => [...nodes].sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt)).slice(0, 5),
    [nodes]
  );
  const tagStats = useMemo(() => {
    const counts = new Map<string, number>();
    nodes.forEach((node) => node.tags.forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1)));
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [nodes]);

  const handleDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) {
      return;
    }
    const next = reorderWidgets(layoutState, dragId, targetId);
    onLayoutChange(next);
    setDragId(null);
  };

  const handleToggleSpan = (widget: DashboardWidgetLayout) => {
    const next = toggleWidgetSpan(layoutState, widget.id);
    onLayoutChange(next);
  };

  return (
    <div className="dashboard">
      <div className="dashboard-toolbar">
        <div>
          <h2>Dashboard</h2>
          <p className="muted">Workspace: {workspaceId}</p>
        </div>
        <button type="button" className="edit-toggle" onClick={() => setEditMode((prev) => !prev)}>
          {editMode ? "Stop editing" : "Edit layout"}
        </button>
      </div>

      <div className="dashboard-grid">
        {widgets.map((widget) => (
          <div
            key={widget.id}
            className={`widget-card span-${widget.span}`}
            draggable={editMode}
            onDragStart={() => setDragId(widget.id)}
            onDragOver={(event) => {
              if (editMode) {
                event.preventDefault();
              }
            }}
            onDrop={() => handleDrop(widget.id)}
          >
            <div className="widget-header">
              <div>
                <h3>{widget.title}</h3>
                <span className="muted">{widget.kind}</span>
              </div>
              {editMode && (
                <button type="button" className="span-toggle" onClick={() => handleToggleSpan(widget)}>
                  {widget.span === 1 ? "Expand" : "Compact"}
                </button>
              )}
            </div>

            {widget.kind === "overview" && (
              <div className="widget-body grid-metrics">
                <div>
                  <strong>{nodes.length}</strong>
                  <span>Total nodes</span>
                </div>
                <div>
                  <strong>{pendingTodos.length}</strong>
                  <span>Pending todos</span>
                </div>
                <div>
                  <strong>{new Set(nodes.map((node) => node.type)).size}</strong>
                  <span>Node types</span>
                </div>
              </div>
            )}

            {widget.kind === "pending" && (
              <div className="widget-body">
                {pendingTodos.length === 0 ? (
                  <p className="muted">No pending todos.</p>
                ) : (
                  <ul>
                    {pendingTodos.slice(0, 5).map((todo) => (
                      <li key={todo.id} onClick={() => onSelectNode(todo.id)}>
                        {todo.title}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {widget.kind === "recent" && (
              <div className="widget-body">
                <ul>
                  {recentNodes.map((node) => (
                    <li key={node.id} onClick={() => onSelectNode(node.id)}>
                      {node.title}
                      <span className="muted">{node.updatedAt.slice(0, 10)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {widget.kind === "tags" && (
              <div className="widget-body tag-grid">
                {tagStats.length === 0 ? (
                  <p className="muted">No tags yet.</p>
                ) : (
                  tagStats.map(([tag, count]) => (
                    <span key={tag} className="tag-pill">
                      #{tag} <strong>{count}</strong>
                    </span>
                  ))
                )}
              </div>
            )}

            {widget.kind === "workspaces" && (
              <div className="widget-body">
                <p className="muted">Active workspace: {workspaceId}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
