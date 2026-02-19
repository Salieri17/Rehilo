import type { JsonValue } from "./node";

export interface WorkspaceLayoutConfig {
  mode?: "list" | "kanban" | "graph" | (string & {});
  nodePositions?: Record<string, { x: number; y: number }>;
  pinnedNodeIds?: string[];
  metadata?: Record<string, JsonValue>;
}

export interface WorkspaceGraphState {
  selectedNodeIds: string[];
  focusedNodeId?: string;
  expandedNodeIds?: string[];
  viewport?: {
    x: number;
    y: number;
    zoom: number;
  };
  metadata?: Record<string, JsonValue>;
}

export interface WorkspaceEntity {
  id: string;
  name: string;
  layoutConfig: WorkspaceLayoutConfig;
  graphState: WorkspaceGraphState;
  metadata: Record<string, JsonValue>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWorkspaceInput {
  name: string;
  layoutConfig?: WorkspaceLayoutConfig;
  graphState?: WorkspaceGraphState;
  metadata?: Record<string, JsonValue>;
}

export interface UpdateWorkspaceInput {
  name?: string;
  layoutConfig?: WorkspaceLayoutConfig;
  graphState?: WorkspaceGraphState;
  metadata?: Record<string, JsonValue>;
}

export function createWorkspace(
  input: CreateWorkspaceInput,
  nowIso: string = new Date().toISOString()
): WorkspaceEntity {
  return {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    layoutConfig: input.layoutConfig ?? {},
    graphState: input.graphState ?? { selectedNodeIds: [] },
    metadata: input.metadata ?? {},
    createdAt: nowIso,
    updatedAt: nowIso
  };
}
