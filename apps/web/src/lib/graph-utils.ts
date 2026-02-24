import { getNodeRelationIds, type NodeEntity } from "@rehilo/domain";

export interface GraphEdge {
  source: string;
  target: string;
  edgeType: "hierarchy" | "relation" | "cross-workspace";
}

export interface GraphFilters {
  workspaceId: string;
  type: string;
  tags: string[];
  dateFrom?: string;
  dateTo?: string;
}

export interface UnlinkedSuggestion {
  target: NodeEntity;
  score: number;
  matchedTags: string[];
  matchedTitleTokens: string[];
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
    if (node.parentId && nodesById.has(node.parentId)) {
      const key = `hierarchy::${node.parentId}::${node.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        edges.push({
          source: node.parentId,
          target: node.id,
          edgeType: "hierarchy"
        });
      }
    }
  });

  nodes.forEach((node) => {
    getNodeRelationIds(node).forEach((targetNodeId) => {
      if (!nodesById.has(targetNodeId)) {
        return;
      }
      const key = `relation::${[node.id, targetNodeId].sort().join("::")}`;
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      edges.push({
        source: node.id,
        target: targetNodeId,
        edgeType: "relation"
      });
    });
  });

  nodes.forEach((node) => {
    node.crossWorkspaceRefs.forEach((targetNodeId) => {
      if (!nodesById.has(targetNodeId)) {
        return;
      }
      const key = `cross-workspace::${[node.id, targetNodeId].sort().join("::")}`;
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      edges.push({
        source: node.id,
        target: targetNodeId,
        edgeType: "cross-workspace"
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

export function listUnlinkedNodes(nodes: NodeEntity[]): NodeEntity[] {
  const backlinkCounts = new Map<string, number>();

  nodes.forEach((node) => {
    getNodeRelationIds(node).forEach((targetId) => {
      backlinkCounts.set(targetId, (backlinkCounts.get(targetId) ?? 0) + 1);
    });
  });

  return nodes.filter((node) => {
    const hasNoParent = (node.parentId ?? null) === null;
    const hasNoRelations = getNodeRelationIds(node).length === 0;
    const hasNoBacklinks = (backlinkCounts.get(node.id) ?? 0) === 0;
    return hasNoParent && hasNoRelations && hasNoBacklinks;
  });
}

export function suggestLinksForUnlinked(node: NodeEntity, allNodes: NodeEntity[], limit: number = 5): UnlinkedSuggestion[] {
  const nodeTags = new Set(node.tags.map((tag) => tag.toLowerCase()));
  const nodeTokens = tokenize(node.title);

  return allNodes
    .filter((candidate) => candidate.id !== node.id && candidate.workspaceId === node.workspaceId)
    .map((candidate) => {
      const candidateTags = new Set(candidate.tags.map((tag) => tag.toLowerCase()));
      const candidateTokens = tokenize(candidate.title);

      const matchedTags = intersect(nodeTags, candidateTags);
      const matchedTitleTokens = intersect(nodeTokens, candidateTokens);

      const score = matchedTags.length * 0.7 + matchedTitleTokens.length * 0.5;

      return {
        target: candidate,
        score,
        matchedTags,
        matchedTitleTokens
      };
    })
    .filter((suggestion) => suggestion.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}

function tokenize(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .split(/[^a-z0-9áéíóúüñ]+/i)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3)
  );
}

function intersect(left: Set<string>, right: Set<string>): string[] {
  const values: string[] = [];
  for (const value of left) {
    if (right.has(value)) {
      values.push(value);
    }
  }
  return values;
}
