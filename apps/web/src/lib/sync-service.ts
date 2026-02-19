import type { NodeEntity } from "@rehilo/domain";
import type { OfflineNodeRepository } from "./offline-repository";
import { mergeNodeConflict } from "./offline-repository";

const DEFAULT_SYNC_URL = "http://localhost:8787";
const SYNC_META_PREFIX = "rehilo:sync:";

interface SyncOptions {
  workspaceId: string;
  repo: OfflineNodeRepository;
}

export async function syncWorkspace({ workspaceId, repo }: SyncOptions): Promise<void> {
  const syncUrl = import.meta.env.VITE_SYNC_URL ?? DEFAULT_SYNC_URL;
  const authHeader = buildAuthHeader();

  const lastSync = getLastSync(workspaceId);
  const localChanges = lastSync ? await repo.listUpdatedSince(workspaceId, lastSync) : await repo.listByWorkspace(workspaceId);

  await fetch(`${syncUrl}/sync/push`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader
    },
    body: JSON.stringify({ workspaceId, changes: localChanges })
  });

  const pullUrl = new URL(`${syncUrl}/sync/pull`);
  pullUrl.searchParams.set("workspaceId", workspaceId);
  if (lastSync) {
    pullUrl.searchParams.set("since", lastSync);
  }

  const response = await fetch(pullUrl.toString(), {
    headers: {
      Authorization: authHeader
    }
  });

  if (!response.ok) {
    return;
  }

  const payload = await response.json();
  const remoteNodes = Array.isArray(payload.nodes) ? (payload.nodes as NodeEntity[]) : [];

  const merged: NodeEntity[] = [];
  for (const remote of remoteNodes) {
    const local = await repo.getById(workspaceId, remote.id);
    merged.push(mergeNodeConflict(local, remote));
  }

  if (merged.length > 0) {
    await repo.upsertMany(merged);
  }

  const nextSync = payload.serverTime ?? new Date().toISOString();
  setLastSync(workspaceId, nextSync);
}

export function startBackgroundSync(repo: OfflineNodeRepository, workspaces: string[]) {
  const run = () => {
    if (!navigator.onLine) {
      return;
    }
    workspaces.forEach((workspaceId) => {
      syncWorkspace({ workspaceId, repo }).catch(() => undefined);
    });
  };

  const interval = window.setInterval(run, 30000);
  window.addEventListener("online", run);
  run();

  return () => {
    window.clearInterval(interval);
    window.removeEventListener("online", run);
  };
}

function buildAuthHeader(): string {
  const user = import.meta.env.VITE_SYNC_USER ?? "admin";
  const pass = import.meta.env.VITE_SYNC_PASS ?? "rehilo";
  const token = btoa(`${user}:${pass}`);
  return `Basic ${token}`;
}

function getLastSync(workspaceId: string): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(`${SYNC_META_PREFIX}${workspaceId}`);
}

function setLastSync(workspaceId: string, iso: string) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(`${SYNC_META_PREFIX}${workspaceId}`, iso);
}
