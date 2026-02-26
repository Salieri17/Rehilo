export interface Workspace {
  id: string;
  name: string;
  orderIndex: number;
  nodes: WorkspaceNode[];
  widgets: Widget[];
}

export interface WorkspaceNode {
  id: string;
  nodeId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isMinimized: boolean;
  zIndex: number;
}

export interface TimerWidgetState {
  durationSeconds: number;
  remainingSeconds: number;
  isRunning: boolean;
  lastTickAt: string | null;
}

export interface Widget {
  id: string;
  type: "timer";
  x: number;
  y: number;
  state: TimerWidgetState;
  width: number;
  height: number;
  zIndex: number;
}

export const WORLD_WIDTH = 5000;
export const WORLD_HEIGHT = 5000;

export const DEFAULT_NODE_MINIMIZED_WIDTH = 220;
export const DEFAULT_NODE_MINIMIZED_HEIGHT = 56;
export const DEFAULT_NODE_EXPANDED_WIDTH = 320;
export const DEFAULT_NODE_EXPANDED_HEIGHT = 220;

export const DEFAULT_WIDGET_WIDTH = 260;
export const DEFAULT_WIDGET_HEIGHT = 136;

export function createWorkspace(name: string, orderIndex: number): Workspace {
  return {
    id: crypto.randomUUID(),
    name: name.trim() || "Workspace",
    orderIndex,
    nodes: [],
    widgets: []
  };
}

export function ensureWorkspaceExists(workspaces: Workspace[]): Workspace[] {
  if (workspaces.length > 0) {
    return workspaces;
  }
  return [createWorkspace("Workspace 1", 0)];
}

export function createWorkspaceNode(nodeId: string, x: number, y: number, zIndex: number): WorkspaceNode {
  const clamped = clampWithinWorld(x, y, DEFAULT_NODE_MINIMIZED_WIDTH, DEFAULT_NODE_MINIMIZED_HEIGHT);

  return {
    id: crypto.randomUUID(),
    nodeId,
    x: clamped.x,
    y: clamped.y,
    width: DEFAULT_NODE_MINIMIZED_WIDTH,
    height: DEFAULT_NODE_MINIMIZED_HEIGHT,
    isMinimized: true,
    zIndex
  };
}

export function createTimerWidget(x: number, y: number, zIndex: number): Widget {
  const clamped = clampWithinWorld(x, y, DEFAULT_WIDGET_WIDTH, DEFAULT_WIDGET_HEIGHT);

  return {
    id: crypto.randomUUID(),
    type: "timer",
    x: clamped.x,
    y: clamped.y,
    width: DEFAULT_WIDGET_WIDTH,
    height: DEFAULT_WIDGET_HEIGHT,
    zIndex,
    state: {
      durationSeconds: 25 * 60,
      remainingSeconds: 25 * 60,
      isRunning: false,
      lastTickAt: null
    }
  };
}

export function getNextZIndex(workspace: Workspace): number {
  const nodeMax = workspace.nodes.length > 0 ? Math.max(...workspace.nodes.map((node) => node.zIndex)) : 0;
  const widgetMax = workspace.widgets.length > 0 ? Math.max(...workspace.widgets.map((widget) => widget.zIndex)) : 0;
  return Math.max(nodeMax, widgetMax) + 1;
}

export function bringWorkspaceNodeToFront(
  workspaces: Workspace[],
  workspaceId: string,
  nodeId: string
): Workspace[] {
  return workspaces.map((workspace) => {
    if (workspace.id !== workspaceId) {
      return workspace;
    }

    const target = workspace.nodes.find((item) => item.nodeId === nodeId);
    if (!target) {
      return workspace;
    }

    const nextZIndex = getNextZIndex(workspace);
    return {
      ...workspace,
      nodes: workspace.nodes.map((workspaceNode) =>
        workspaceNode.nodeId === nodeId ? { ...workspaceNode, zIndex: nextZIndex } : workspaceNode
      )
    };
  });
}

export function bringWidgetToFront(workspaces: Workspace[], workspaceId: string, widgetId: string): Workspace[] {
  return workspaces.map((workspace) => {
    if (workspace.id !== workspaceId) {
      return workspace;
    }

    const target = workspace.widgets.find((widget) => widget.id === widgetId);
    if (!target) {
      return workspace;
    }

    const nextZIndex = getNextZIndex(workspace);
    return {
      ...workspace,
      widgets: workspace.widgets.map((widget) =>
        widget.id === widgetId ? { ...widget, zIndex: nextZIndex } : widget
      )
    };
  });
}

export function updateWorkspaceNodePosition(
  workspaces: Workspace[],
  workspaceId: string,
  nodeId: string,
  x: number,
  y: number
): Workspace[] {
  return workspaces.map((workspace) => {
    if (workspace.id !== workspaceId) {
      return workspace;
    }

    return {
      ...workspace,
      nodes: workspace.nodes.map((workspaceNode) => {
        if (workspaceNode.nodeId !== nodeId) {
          return workspaceNode;
        }

        const clamped = clampWithinWorld(x, y, workspaceNode.width, workspaceNode.height);
        return {
          ...workspaceNode,
          x: clamped.x,
          y: clamped.y
        };
      })
    };
  });
}

export function setWorkspaceNodeMinimized(
  workspaces: Workspace[],
  workspaceId: string,
  nodeId: string,
  isMinimized: boolean
): Workspace[] {
  return workspaces.map((workspace) => {
    if (workspace.id !== workspaceId) {
      return workspace;
    }

    return {
      ...workspace,
      nodes: workspace.nodes.map((workspaceNode) => {
        if (workspaceNode.nodeId !== nodeId) {
          return workspaceNode;
        }

        const width = isMinimized ? DEFAULT_NODE_MINIMIZED_WIDTH : DEFAULT_NODE_EXPANDED_WIDTH;
        const height = isMinimized ? DEFAULT_NODE_MINIMIZED_HEIGHT : DEFAULT_NODE_EXPANDED_HEIGHT;
        const clamped = clampWithinWorld(workspaceNode.x, workspaceNode.y, width, height);

        return {
          ...workspaceNode,
          isMinimized,
          width,
          height,
          x: clamped.x,
          y: clamped.y
        };
      })
    };
  });
}

export function removeNodeFromWorkspaces(workspaces: Workspace[], nodeId: string): Workspace[] {
  return workspaces.map((workspace) => ({
    ...workspace,
    nodes: workspace.nodes.filter((workspaceNode) => workspaceNode.nodeId !== nodeId)
  }));
}

export function addWidget(workspaces: Workspace[], workspaceId: string, widget: Widget): Workspace[] {
  return workspaces.map((workspace) =>
    workspace.id === workspaceId ? { ...workspace, widgets: [...workspace.widgets, widget] } : workspace
  );
}

export function removeWidget(workspaces: Workspace[], workspaceId: string, widgetId: string): Workspace[] {
  return workspaces.map((workspace) =>
    workspace.id === workspaceId
      ? { ...workspace, widgets: workspace.widgets.filter((widget) => widget.id !== widgetId) }
      : workspace
  );
}

export function updateWidgetPosition(
  workspaces: Workspace[],
  workspaceId: string,
  widgetId: string,
  x: number,
  y: number
): Workspace[] {
  return workspaces.map((workspace) => {
    if (workspace.id !== workspaceId) {
      return workspace;
    }

    return {
      ...workspace,
      widgets: workspace.widgets.map((widget) => {
        if (widget.id !== widgetId) {
          return widget;
        }

        const clamped = clampWithinWorld(x, y, widget.width, widget.height);
        return {
          ...widget,
          x: clamped.x,
          y: clamped.y
        };
      })
    };
  });
}

export function updateWidgetState(
  workspaces: Workspace[],
  workspaceId: string,
  widgetId: string,
  statePatch: Partial<TimerWidgetState>
): Workspace[] {
  return workspaces.map((workspace) => {
    if (workspace.id !== workspaceId) {
      return workspace;
    }

    return {
      ...workspace,
      widgets: workspace.widgets.map((widget) => {
        if (widget.id !== widgetId) {
          return widget;
        }

        return {
          ...widget,
          state: {
            ...widget.state,
            ...statePatch
          }
        };
      })
    };
  });
}

export function tickTimerWidgets(workspaces: Workspace[], nowIso: string = new Date().toISOString()): Workspace[] {
  const nowMs = Date.parse(nowIso);

  return workspaces.map((workspace) => ({
    ...workspace,
    widgets: workspace.widgets.map((widget) => {
      if (!widget.state.isRunning || !widget.state.lastTickAt) {
        return widget;
      }

      const previousMs = Date.parse(widget.state.lastTickAt);
      const elapsed = Number.isFinite(previousMs) ? Math.floor((nowMs - previousMs) / 1000) : 0;
      if (elapsed <= 0) {
        return widget;
      }

      const remainingSeconds = Math.max(0, widget.state.remainingSeconds - elapsed);
      return {
        ...widget,
        state: {
          ...widget.state,
          remainingSeconds,
          isRunning: remainingSeconds > 0,
          lastTickAt: remainingSeconds > 0 ? nowIso : null
        }
      };
    })
  }));
}

export function clampWithinWorld(
  x: number,
  y: number,
  width: number,
  height: number
): { x: number; y: number } {
  const maxX = Math.max(0, WORLD_WIDTH - width);
  const maxY = Math.max(0, WORLD_HEIGHT - height);

  return {
    x: clamp(x, 0, maxX),
    y: clamp(y, 0, maxY)
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
