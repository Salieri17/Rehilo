import type { NodeEntity, NodeRepository, UpdateNodeInput } from "@rehilo/domain";
import { getDb } from "./offline-db";

export interface OfflineNodeRepository extends NodeRepository {
  listAll(): Promise<NodeEntity[]>;
  seedIfEmpty(nodes: NodeEntity[]): Promise<NodeEntity[]>;
  upsertMany(nodes: NodeEntity[]): Promise<void>;
}

export function createOfflineNodeRepository(): OfflineNodeRepository {
  return {
    async listAll() {
      const db = await getDb();
      return db.getAll("nodes");
    },
    async listByWorkspace(workspaceId) {
      const db = await getDb();
      return db.getAllFromIndex("nodes", "by-workspace", workspaceId);
    },
    async getById(_workspaceId, id) {
      const db = await getDb();
      return (await db.get("nodes", id)) ?? null;
    },
    async save(node) {
      const db = await getDb();
      await db.put("nodes", node);
    },
    async update(_workspaceId, id, patch) {
      const db = await getDb();
      const current = await db.get("nodes", id);
      if (!current) {
        return null;
      }
      const updated: NodeEntity = {
        ...current,
        ...patch,
        updatedAt: new Date().toISOString()
      };
      await db.put("nodes", updated);
      return updated;
    },
    async remove(_workspaceId, id) {
      const db = await getDb();
      await db.delete("nodes", id);
      return true;
    },
    async listUpdatedSince(workspaceId, sinceIso) {
      const nodes = await this.listByWorkspace(workspaceId);
      const sinceTime = Date.parse(sinceIso);
      return nodes.filter((node) => Date.parse(node.updatedAt) > sinceTime);
    },
    async seedIfEmpty(nodes) {
      const existing = await this.listAll();
      if (existing.length > 0) {
        return existing;
      }
      await this.upsertMany(nodes);
      return this.listAll();
    },
    async upsertMany(nodes) {
      const db = await getDb();
      const tx = db.transaction("nodes", "readwrite");
      for (const node of nodes) {
        await tx.store.put(node);
      }
      await tx.done;
    }
  };
}

export function mergeNodeConflict(local: NodeEntity | null, remote: NodeEntity): NodeEntity {
  if (!local) {
    return remote;
  }

  const localTime = Date.parse(local.updatedAt);
  const remoteTime = Date.parse(remote.updatedAt);

  if (remoteTime > localTime) {
    return remote;
  }

  if (remoteTime < localTime) {
    return local;
  }

  return remote;
}
