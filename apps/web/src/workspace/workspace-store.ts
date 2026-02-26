import {
  DEFAULT_NODE_MINIMIZED_HEIGHT,
  DEFAULT_NODE_MINIMIZED_WIDTH,
  DEFAULT_WIDGET_HEIGHT,
  DEFAULT_WIDGET_WIDTH,
  ensureWorkspaceExists,
  type Widget,
  type Workspace
} from "./workspace-engine";

const WORKSPACE_STORAGE_KEY_V2 = "rehilo.workspaces.v2";
const LEGACY_WORKSPACE_STORAGE_KEY_V1 = "rehilo.workspaces.v1";
const ACTIVE_WORKSPACE_STORAGE_KEY = "rehilo.active-workspace.v1";

interface LegacyWorkspace {
  id: string;
  name: string;
  orderIndex: number;
  notes?: Array<{
    id: string;
    noteId: string;
    x: number;
    y: number;
    zIndex: number;
  }>;
  nodes?: Workspace["nodes"];
}

export function loadWorkspaces(): Workspace[] {
  if (typeof window === "undefined") {
    return [];
  }

  const v2Raw = window.localStorage.getItem(WORKSPACE_STORAGE_KEY_V2);
  if (v2Raw) {
    try {
      const parsed = JSON.parse(v2Raw) as Workspace[];
      if (!Array.isArray(parsed)) {
        return [];
      }
      return normalizeWorkspaces(parsed);
    } catch {
      return [];
    }
  }

  const migrated = migrateLegacyWorkspaces();
  if (migrated.length > 0) {
    saveWorkspaces(migrated);
  }
  return migrated;
}

export function saveWorkspaces(workspaces: Workspace[]): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(WORKSPACE_STORAGE_KEY_V2, JSON.stringify(normalizeWorkspaces(workspaces)));
}

export function loadActiveWorkspaceId(): string {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(ACTIVE_WORKSPACE_STORAGE_KEY) ?? "";
}

export function saveActiveWorkspaceId(workspaceId: string): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(ACTIVE_WORKSPACE_STORAGE_KEY, workspaceId);
}

function migrateLegacyWorkspaces(): Workspace[] {
  if (typeof window === "undefined") {
    return [];
  }

  const legacyRaw = window.localStorage.getItem(LEGACY_WORKSPACE_STORAGE_KEY_V1);
  if (!legacyRaw) {
    return [];
  }

  try {
    const parsed = JSON.parse(legacyRaw) as LegacyWorkspace[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    const migrated = parsed.map<Workspace>((workspace) => {
      const legacyNodes = Array.isArray(workspace.nodes)
        ? workspace.nodes
        : Array.isArray(workspace.notes)
          ? workspace.notes.map((item) => ({
              id: item.id,
              nodeId: item.noteId,
              x: item.x,
              y: item.y,
              width: DEFAULT_NODE_MINIMIZED_WIDTH,
              height: DEFAULT_NODE_MINIMIZED_HEIGHT,
              isMinimized: true,
              zIndex: item.zIndex
            }))
          : [];

      return {
        id: workspace.id,
        name: workspace.name,
        orderIndex: workspace.orderIndex,
        nodes: legacyNodes,
        widgets: []
      };
    });

    return normalizeWorkspaces(migrated);
  } catch {
    return [];
  }
}

function normalizeWorkspaces(workspaces: Workspace[]): Workspace[] {
  return ensureWorkspaceExists(
    workspaces
      .map((workspace) => ({
        ...workspace,
        nodes: Array.isArray(workspace.nodes)
          ? workspace.nodes.map((node) => ({
              ...node,
              width: Number.isFinite(node.width) ? node.width : DEFAULT_NODE_MINIMIZED_WIDTH,
              height: Number.isFinite(node.height) ? node.height : DEFAULT_NODE_MINIMIZED_HEIGHT,
              isMinimized: Boolean(node.isMinimized)
            }))
          : [],
        widgets: Array.isArray(workspace.widgets)
          ? workspace.widgets.map<Widget>((widget) => ({
              ...widget,
              width: Number.isFinite(widget.width) ? widget.width : DEFAULT_WIDGET_WIDTH,
              height: Number.isFinite(widget.height) ? widget.height : DEFAULT_WIDGET_HEIGHT,
              type: "timer",
              state: {
                durationSeconds: Number.isFinite(widget.state?.durationSeconds)
                  ? widget.state.durationSeconds
                  : 25 * 60,
                remainingSeconds: Number.isFinite(widget.state?.remainingSeconds)
                  ? widget.state.remainingSeconds
                  : 25 * 60,
                isRunning: Boolean(widget.state?.isRunning),
                lastTickAt: typeof widget.state?.lastTickAt === "string" ? widget.state.lastTickAt : null
              }
            }))
          : []
      }))
      .sort((first, second) => first.orderIndex - second.orderIndex)
  );
}
