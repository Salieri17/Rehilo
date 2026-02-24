import type { UpdateWorkspaceInput, WorkspaceEntity, WorkspaceRepository } from "@rehilo/domain";
import { getDb } from "./offline-db";

export function createOfflineWorkspaceRepository(): WorkspaceRepository {
  return {
    async list() {
      const db = await getDb();
      return db.getAll("workspaces");
    },
    async getById(id) {
      const db = await getDb();
      return (await db.get("workspaces", id)) ?? null;
    },
    async save(workspace) {
      const db = await getDb();
      await db.put("workspaces", workspace);
    },
    async update(id, patch) {
      const db = await getDb();
      const current = await db.get("workspaces", id);
      if (!current) {
        return null;
      }
      const updated: WorkspaceEntity = {
        ...current,
        ...patch,
        updatedAt: new Date().toISOString()
      };
      await db.put("workspaces", updated);
      return updated;
    },
    async remove(id) {
      const db = await getDb();
      const current = await db.get("workspaces", id);
      if (!current) {
        return false;
      }
      await db.delete("workspaces", id);
      return true;
    }
  };
}
