import type { NodeEntity } from "@rehilo/domain";

export interface GraphEdge {
  source: string;
  target: string;
  relation?: string;
}

export interface GraphFilters {
  workspaceId: string;
  type: string;
  tags: string[];
  dateFrom?: string;
  dateTo?: string;
}

export function filterNodes(nodes: NodeEntity[], filters: GraphFilters): NodeEntity[] {
  const { workspaceId, type, tags, dateFrom, dateTo } = filters;
  const minDate = dateFrom ? Date.parse(dateFrom) : undefined;
  const maxDate = dateTo ? Date.parse(dateTo) : undefined;

  return nodes.filter((node) => {
    if (workspaceId !== "all" && node.workspaceId !== workspaceId) {
      return false;
    }

    if (type !== "all" && node.type !== type) {
      return false;
    }

    if (tags.length > 0) {
      const tagSet = new Set(node.tags.map((tag) => tag.toLowerCase()));
      const matches = tags.every((tag) => tagSet.has(tag.toLowerCase()));
      if (!matches) {
        return false;
      }
    }

    if (minDate || maxDate) {
      const created = Date.parse(node.createdAt);
      if (minDate && created < minDate) {
        return false;
      }
      if (maxDate && created > maxDate) {
        return false;
      }
    }

    return true;
  });
}

export function buildGraphEdges(nodes: NodeEntity[]): GraphEdge[] {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const seen = new Set<string>();
  const edges: GraphEdge[] = [];

  nodes.forEach((node) => {
    node.relations.forEach((relation) => {
      if (!nodesById.has(relation.targetNodeId)) {
        return;
      }
      const key = [node.id, relation.targetNodeId].sort().join("::");
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      edges.push({
        source: node.id,
        target: relation.targetNodeId,
        relation: relation.kind
      });
    });
  });

  return edges;
}

export function parseTagQuery(query: string): string[] {
  if (!query.trim()) {
    return [];
  }
  return query
    .split(/[\s,]+/)
    .map((token) => token.replace(/^#/, "").trim())
    .filter(Boolean);
}
