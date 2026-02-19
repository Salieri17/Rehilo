export const NODE_TYPES = [
  "note",
  "todo",
  "project",
  "idea",
  "link",
  "event"
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
  relations: NodeRelation[];
  parentId?: string;
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
  relations?: NodeRelation[];
  parentId?: string;
  metadata?: Record<string, JsonValue>;
  status?: TodoStatus;
}

export interface UpdateNodeInput {
  type?: NodeType;
  title?: string;
  content?: string;
  tags?: string[];
  relations?: NodeRelation[];
  parentId?: string;
  metadata?: Record<string, JsonValue>;
  status?: TodoStatus;
}

export function createNode(input: CreateNodeInput, nowIso: string = new Date().toISOString()): NodeEntity {
  return {
    id: crypto.randomUUID(),
    workspaceId: input.workspaceId,
    type: input.type,
    title: input.title.trim(),
    content: input.content ?? "",
    tags: input.tags ?? [],
    relations: input.relations ?? [],
    parentId: input.parentId,
    metadata: input.metadata ?? {},
    createdAt: nowIso,
    updatedAt: nowIso,
    status: input.status
  };
}
