export type NodeType = "note" | "todo" | "journal";

export interface NodeEntity {
  id: string;
  type: NodeType;
  data: {
    title: string;
    content: string;
    done?: boolean;
    checklistItems?: Array<{ id: string; text: string; checked: boolean }>;
  };
  createdAt: string;
  updatedAt: string;
}

export interface Connection {
  id: string;
  fromId: string;
  toId: string;
}

export interface GraphState {
  nodesById: Record<string, NodeEntity>;
  connectionsById: Record<string, Connection>;
}

export interface CreateNodeInput {
  type: NodeType;
  data?: Partial<NodeEntity["data"]>;
}

export interface UpdateNodeInput {
  type?: NodeType;
  data?: Partial<NodeEntity["data"]>;
}

export function createEmptyGraphState(): GraphState {
  return {
    nodesById: {},
    connectionsById: {}
  };
}

export function listNodes(state: GraphState): NodeEntity[] {
  return Object.values(state.nodesById).sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

export function listConnections(state: GraphState): Connection[] {
  return Object.values(state.connectionsById);
}

export function createNode(
  state: GraphState,
  input: CreateNodeInput,
  nowIso: string = new Date().toISOString()
): { state: GraphState; node: NodeEntity } {
  const node: NodeEntity = {
    id: crypto.randomUUID(),
    type: input.type,
    data: {
      title: input.data?.title?.trim() || "Untitled",
      content: input.data?.content ?? "",
      done: input.data?.done ?? false,
      checklistItems: Array.isArray(input.data?.checklistItems)
        ? input.data?.checklistItems.map((item) => ({
            id: item.id || crypto.randomUUID(),
            text: item.text?.trim() || "",
            checked: Boolean(item.checked)
          }))
        : []
    },
    createdAt: nowIso,
    updatedAt: nowIso
  };

  return {
    node,
    state: {
      ...state,
      nodesById: {
        ...state.nodesById,
        [node.id]: node
      }
    }
  };
}

export function updateNode(state: GraphState, nodeId: string, patch: UpdateNodeInput): GraphState {
  const current = state.nodesById[nodeId];
  if (!current) {
    return state;
  }

  const nextNode: NodeEntity = {
    ...current,
    type: patch.type ?? current.type,
    data: {
      ...current.data,
      ...(patch.data ?? {}),
      title:
        patch.data && Object.prototype.hasOwnProperty.call(patch.data, "title")
          ? patch.data.title?.trim() || "Untitled"
          : current.data.title,
      checklistItems:
        patch.data && Object.prototype.hasOwnProperty.call(patch.data, "checklistItems")
          ? (patch.data.checklistItems ?? []).map((item) => ({
              id: item.id || crypto.randomUUID(),
              text: item.text?.trim() || "",
              checked: Boolean(item.checked)
            }))
          : current.data.checklistItems ?? []
    },
    updatedAt: new Date().toISOString()
  };

  return {
    ...state,
    nodesById: {
      ...state.nodesById,
      [nodeId]: nextNode
    }
  };
}

export function deleteNode(state: GraphState, nodeId: string): GraphState {
  if (!state.nodesById[nodeId]) {
    return state;
  }

  const nextNodesById = { ...state.nodesById };
  delete nextNodesById[nodeId];

  const nextConnectionsById: Record<string, Connection> = {};
  for (const connection of Object.values(state.connectionsById)) {
    if (connection.fromId === nodeId || connection.toId === nodeId) {
      continue;
    }
    nextConnectionsById[connection.id] = connection;
  }

  return {
    nodesById: nextNodesById,
    connectionsById: nextConnectionsById
  };
}

export function connectNodes(
  state: GraphState,
  fromId: string,
  toId: string
): { state: GraphState; connected: boolean } {
  if (fromId === toId) {
    return { state, connected: false };
  }

  if (!state.nodesById[fromId] || !state.nodesById[toId]) {
    return { state, connected: false };
  }

  const connectionKey = makeConnectionKey(fromId, toId);
  const existing = Object.values(state.connectionsById).some(
    (connection) => makeConnectionKey(connection.fromId, connection.toId) === connectionKey
  );

  if (existing) {
    return { state, connected: false };
  }

  const connection: Connection = {
    id: crypto.randomUUID(),
    fromId,
    toId
  };

  return {
    connected: true,
    state: {
      ...state,
      connectionsById: {
        ...state.connectionsById,
        [connection.id]: connection
      }
    }
  };
}

export function normalizeGraphState(input: Partial<GraphState> | null | undefined): GraphState {
  const nodesById: Record<string, NodeEntity> = {};
  const rawNodes = input?.nodesById ?? {};

  for (const [nodeId, node] of Object.entries(rawNodes)) {
    if (!node || typeof node !== "object") {
      continue;
    }

    nodesById[nodeId] = {
      id: nodeId,
      type: normalizeNodeType(node.type),
      data: {
        title: node.data?.title?.trim() || "Untitled",
        content: node.data?.content ?? "",
        done: Boolean(node.data?.done),
        checklistItems: Array.isArray(node.data?.checklistItems)
          ? node.data.checklistItems.map((item) => ({
              id: item?.id || crypto.randomUUID(),
              text: item?.text?.trim?.() || "",
              checked: Boolean(item?.checked)
            }))
          : []
      },
      createdAt: node.createdAt ?? new Date().toISOString(),
      updatedAt: node.updatedAt ?? node.createdAt ?? new Date().toISOString()
    };
  }

  const connectionsById: Record<string, Connection> = {};
  const seenKeys = new Set<string>();
  const rawConnections = input?.connectionsById ?? {};

  for (const [connectionId, connection] of Object.entries(rawConnections)) {
    if (!connection || typeof connection !== "object") {
      continue;
    }

    const fromId = connection.fromId;
    const toId = connection.toId;

    if (!fromId || !toId || fromId === toId) {
      continue;
    }

    if (!nodesById[fromId] || !nodesById[toId]) {
      continue;
    }

    const key = makeConnectionKey(fromId, toId);
    if (seenKeys.has(key)) {
      continue;
    }

    seenKeys.add(key);
    connectionsById[connectionId] = {
      id: connectionId,
      fromId,
      toId
    };
  }

  return {
    nodesById,
    connectionsById
  };
}

function normalizeNodeType(type: unknown): NodeType {
  if (type === "todo" || type === "journal") {
    return type;
  }
  return "note";
}

function makeConnectionKey(leftId: string, rightId: string): string {
  return [leftId, rightId].sort().join("::");
}
