import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { NodeEntity } from "@rehilo/domain";
import type { WorkspaceEntity } from "@rehilo/domain";

interface RehiloDbSchema extends DBSchema {
  nodes: {
    key: string;
    value: NodeEntity;
    indexes: { "by-workspace": string; "by-updatedAt": string };
  };
  workspaces: {
    key: string;
    value: WorkspaceEntity;
    indexes: { "by-updatedAt": string };
  };
}

let dbPromise: Promise<IDBPDatabase<RehiloDbSchema>> | null = null;

export function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<RehiloDbSchema>("rehilo-db", 2, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("nodes")) {
          const store = db.createObjectStore("nodes", { keyPath: "id" });
          store.createIndex("by-workspace", "workspaceId");
          store.createIndex("by-updatedAt", "updatedAt");
        }

        if (!db.objectStoreNames.contains("workspaces")) {
          const workspaceStore = db.createObjectStore("workspaces", { keyPath: "id" });
          workspaceStore.createIndex("by-updatedAt", "updatedAt");
        }
      }
    });
  }

  return dbPromise;
}
