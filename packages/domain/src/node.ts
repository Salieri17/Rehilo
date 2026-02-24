export const NODE_TYPES = [
  "note",
  "task",
  "project",
  "idea",
  "research",
  "reference",
  "link",
  "event",
  "todo"
] as const;

export type NodeType = (typeof NODE_TYPES)[number] | (string & {});

export type TodoStatus = "pending" | "completed";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface NodeRelation {
  targetNodeId: string;
  kind?: string;
}

export interface NodeEntity {
  id: string;
  workspaceId: string;
  type: NodeType;
  title: string;
  content: string;
  tags: string[];
  relationIds: string[];
  crossWorkspaceRefs: string[];
  parentId: string | null;
  relations?: NodeRelation[];
  metadata: Record<string, JsonValue>;
  createdAt: string;
  updatedAt: string;
  status?: TodoStatus;
}

export interface CreateNodeInput {
  workspaceId: string;
  type: NodeType;
  title: string;
  content?: string;
  tags?: string[];
  relationIds?: string[];
  crossWorkspaceRefs?: string[];
  relations?: NodeRelation[];
  parentId?: string | null;
  metadata?: Record<string, JsonValue>;
  status?: TodoStatus;
}

export interface UpdateNodeInput {
  type?: NodeType;
  title?: string;
  content?: string;
  tags?: string[];
  relationIds?: string[];
  crossWorkspaceRefs?: string[];
  relations?: NodeRelation[];
  parentId?: string | null;
  metadata?: Record<string, JsonValue>;
  status?: TodoStatus;
}

export function createNode(input: CreateNodeInput, nowIso: string = new Date().toISOString()): NodeEntity {
  const relationIds = normalizeRelationIds(input.relationIds, input.relations);
  const isUnlinked = (input.parentId ?? null) === null && relationIds.length === 0;
  return {
    id: crypto.randomUUID(),
    workspaceId: input.workspaceId,
    type: input.type,
    title: input.title.trim(),
    content: input.content ?? "",
    tags: input.tags ?? [],
    relationIds,
    crossWorkspaceRefs: input.crossWorkspaceRefs ?? [],
    relations: relationIds.map((targetNodeId) => ({ targetNodeId })),
    parentId: input.parentId ?? null,
    metadata: {
      ...(input.metadata ?? {}),
      ...(isUnlinked ? { linkState: "unlinked" } : {})
    },
    createdAt: nowIso,
    updatedAt: nowIso,
    status: input.status
  };
}

export function getNodeRelationIds(node: {
  relationIds?: string[];
  relations?: NodeRelation[];
}): string[] {
  return normalizeRelationIds(node.relationIds, node.relations);
}

export function normalizeNodeEntity(node: NodeEntity): NodeEntity {
  const relationIds = normalizeRelationIds(node.relationIds, node.relations);
  return {
    ...node,
    relationIds,
    crossWorkspaceRefs: node.crossWorkspaceRefs ?? [],
    parentId: node.parentId ?? null,
    relations: relationIds.map((targetNodeId) => ({ targetNodeId }))
  };
}

function normalizeRelationIds(
  relationIds: string[] | undefined,
  relations: NodeRelation[] | undefined
): string[] {
  const idsFromRelations = (relations ?? []).map((relation) => relation.targetNodeId);
  return uniqueStrings([...(relationIds ?? []), ...idsFromRelations]);
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => {
      if (seen.has(value)) {
        return false;
      }
      seen.add(value);
      return true;
    });
}
