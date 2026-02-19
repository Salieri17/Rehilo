export type DashboardWidgetKind = "overview" | "pending" | "recent" | "tags" | "workspaces";

export interface DashboardWidgetLayout {
  id: string;
  title: string;
  kind: DashboardWidgetKind;
  span: 1 | 2;
  order: number;
}

export interface WorkspaceLayoutState {
  widgets: DashboardWidgetLayout[];
  updatedAt: string;
}

const STORAGE_PREFIX = "rehilo:layout:";

const DEFAULT_WIDGETS: DashboardWidgetLayout[] = [
  { id: "overview", title: "Overview", kind: "overview", span: 2, order: 1 },
  { id: "pending", title: "Pending", kind: "pending", span: 1, order: 2 },
  { id: "recent", title: "Recent", kind: "recent", span: 1, order: 3 },
  { id: "tags", title: "Tags", kind: "tags", span: 2, order: 4 },
  { id: "workspaces", title: "Workspace", kind: "workspaces", span: 1, order: 5 }
];

export function loadWorkspaceLayout(workspaceId: string): WorkspaceLayoutState {
  if (typeof window === "undefined") {
    return defaultLayout();
  }

  const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${workspaceId}`);
  if (!raw) {
    return defaultLayout();
  }

  try {
    const parsed = JSON.parse(raw) as WorkspaceLayoutState;
    if (!parsed.widgets || parsed.widgets.length === 0) {
      return defaultLayout();
    }
    return parsed;
  } catch {
    return defaultLayout();
  }
}

export function saveWorkspaceLayout(workspaceId: string, state: WorkspaceLayoutState) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(`${STORAGE_PREFIX}${workspaceId}`, JSON.stringify(state));
}

export function reorderWidgets(state: WorkspaceLayoutState, sourceId: string, targetId: string): WorkspaceLayoutState {
  const widgets = [...state.widgets].sort((left, right) => left.order - right.order);
  const sourceIndex = widgets.findIndex((widget) => widget.id === sourceId);
  const targetIndex = widgets.findIndex((widget) => widget.id === targetId);
  if (sourceIndex === -1 || targetIndex === -1) {
    return state;
  }

  const [moved] = widgets.splice(sourceIndex, 1);
  widgets.splice(targetIndex, 0, moved);

  return {
    widgets: widgets.map((widget, index) => ({ ...widget, order: index + 1 })),
    updatedAt: new Date().toISOString()
  };
}

export function toggleWidgetSpan(state: WorkspaceLayoutState, widgetId: string): WorkspaceLayoutState {
  return {
    widgets: state.widgets.map((widget) =>
      widget.id === widgetId ? { ...widget, span: widget.span === 1 ? 2 : 1 } : widget
    ),
    updatedAt: new Date().toISOString()
  };
}

function defaultLayout(): WorkspaceLayoutState {
  return {
    widgets: DEFAULT_WIDGETS.map((widget) => ({ ...widget })),
    updatedAt: new Date().toISOString()
  };
}
