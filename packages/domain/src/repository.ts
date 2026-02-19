import type { NodeEntity, UpdateNodeInput } from "./node";
import type { UpdateWorkspaceInput, WorkspaceEntity } from "./workspace";

export interface NodeRepository {
  listByWorkspace(workspaceId: string): Promise<NodeEntity[]>;
  getById(workspaceId: string, id: string): Promise<NodeEntity | null>;
  save(node: NodeEntity): Promise<void>;
  update(workspaceId: string, id: string, patch: UpdateNodeInput): Promise<NodeEntity | null>;
  remove(workspaceId: string, id: string): Promise<boolean>;
  listUpdatedSince(workspaceId: string, sinceIso: string): Promise<NodeEntity[]>;
}

export interface WorkspaceRepository {
  list(): Promise<WorkspaceEntity[]>;
  getById(id: string): Promise<WorkspaceEntity | null>;
  save(workspace: WorkspaceEntity): Promise<void>;
  update(id: string, patch: UpdateWorkspaceInput): Promise<WorkspaceEntity | null>;
  remove(id: string): Promise<boolean>;
}

export interface SyncResult {
  pushedCount: number;
  pulledCount: number;
  lastSyncedAt: string;
}

export interface SyncAdapter {
  push(workspaceId: string, changes: NodeEntity[]): Promise<{ accepted: number; rejected: number }>;
  pull(workspaceId: string, sinceIso?: string): Promise<NodeEntity[]>;
  sync(workspaceId: string, localChanges: NodeEntity[], sinceIso?: string): Promise<SyncResult>;
}

export interface WorkspaceScopedSnapshot {
  workspace: WorkspaceEntity;
  nodes: NodeEntity[];
}

