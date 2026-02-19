import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { NodeEntity } from "@rehilo/domain";

interface RehiloDbSchema extends DBSchema {
  nodes: {
    key: string;
    value: NodeEntity;
    indexes: { "by-workspace": string; "by-updatedAt": string };
  };
}

let dbPromise: Promise<IDBPDatabase<RehiloDbSchema>> | null = null;

export function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<RehiloDbSchema>("rehilo-db", 1, {
      upgrade(db) {
        const store = db.createObjectStore("nodes", { keyPath: "id" });
        store.createIndex("by-workspace", "workspaceId");
        store.createIndex("by-updatedAt", "updatedAt");
      }
    });
  }

  return dbPromise;
}
