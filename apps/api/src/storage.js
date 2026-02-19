import fs from "fs";
import path from "path";

const DATA_PATH = path.resolve(process.cwd(), "data", "sync-store.json");

const store = loadStore();

export function listNodesSince(workspaceId, since) {
  const workspace = ensureWorkspace(workspaceId);
  const nodes = Object.values(workspace.nodes);
  if (!since) {
    return nodes;
  }

  const sinceTime = Date.parse(since);
  return nodes.filter((node) => Date.parse(node.updatedAt) > sinceTime);
}

export function upsertNodes(workspaceId, changes) {
  const workspace = ensureWorkspace(workspaceId);
  let accepted = 0;
  let rejected = 0;
  const merged = [];

  changes.forEach((incoming) => {
    const existing = workspace.nodes[incoming.id];
    const resolved = resolveConflict(existing, incoming);
    if (!resolved) {
      rejected += 1;
      return;
    }
    workspace.nodes[resolved.id] = resolved;
    merged.push(resolved);
    accepted += 1;
  });

  workspace.updatedAt = new Date().toISOString();
  persistStore();

  return { accepted, rejected, merged };
}

export function getStats() {
  return {
    workspaceCount: Object.keys(store.workspaces).length,
    updatedAt: store.updatedAt
  };
}

function resolveConflict(existing, incoming) {
  if (!existing) {
    return incoming;
  }

  const existingTime = Date.parse(existing.updatedAt);
  const incomingTime = Date.parse(incoming.updatedAt);

  if (incomingTime > existingTime) {
    return incoming;
  }

  if (incomingTime < existingTime) {
    return existing;
  }

  return incoming;
}

function ensureWorkspace(workspaceId) {
  if (!store.workspaces[workspaceId]) {
    store.workspaces[workspaceId] = {
      id: workspaceId,
      nodes: {},
      updatedAt: new Date().toISOString()
    };
  }
  return store.workspaces[workspaceId];
}

function loadStore() {
  const directory = path.dirname(DATA_PATH);
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }

  if (!fs.existsSync(DATA_PATH)) {
    const empty = { workspaces: {}, updatedAt: new Date().toISOString() };
    fs.writeFileSync(DATA_PATH, JSON.stringify(empty, null, 2), "utf8");
    return empty;
  }

  try {
    const raw = fs.readFileSync(DATA_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return { workspaces: {}, updatedAt: new Date().toISOString() };
  }
}

function persistStore() {
  store.updatedAt = new Date().toISOString();
  fs.writeFileSync(DATA_PATH, JSON.stringify(store, null, 2), "utf8");
}
