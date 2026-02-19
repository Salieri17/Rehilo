import type { NodeEntity } from "./node";

export interface ContextEngineOptions {
  recentlyConnectedLimit?: number;
  suggestionLimit?: number;
  minSuggestionScore?: number;
}

export interface RelatedNodeSuggestion {
  node: NodeEntity;
  score: number;
  sharedTags: string[];
  matchedKeywords: string[];
}

export interface NodeContextView {
  node: NodeEntity;
  directRelations: NodeEntity[];
  backlinks: NodeEntity[];
  sharedTagNodes: NodeEntity[];
  recentlyConnectedNodes: NodeEntity[];
  parentNode: NodeEntity | null;
  childNodes: NodeEntity[];
  pendingTodosInside: NodeEntity[];
  suggestedRelatedNodes: RelatedNodeSuggestion[];
}

const DEFAULT_OPTIONS: Required<ContextEngineOptions> = {
  recentlyConnectedLimit: 8,
  suggestionLimit: 8,
  minSuggestionScore: 0.15
};

export function buildNodeContext(
  nodeId: string,
  allNodes: NodeEntity[],
  options: ContextEngineOptions = {}
): NodeContextView | null {
  const config = {
    ...DEFAULT_OPTIONS,
    ...options
  };

  const node = allNodes.find((candidate) => candidate.id === nodeId);
  if (!node) {
    return null;
  }

  const workspaceNodes = allNodes.filter((candidate) => candidate.workspaceId === node.workspaceId);
  const nodesById = new Map(workspaceNodes.map((candidate) => [candidate.id, candidate]));

  const directRelations = node.relations
    .map((relation) => nodesById.get(relation.targetNodeId))
    .filter((candidate): candidate is NodeEntity => Boolean(candidate));

  const backlinks = workspaceNodes.filter((candidate) =>
    candidate.relations.some((relation) => relation.targetNodeId === node.id)
  );

  const sharedTagNodes = workspaceNodes.filter((candidate) => {
    if (candidate.id === node.id) {
      return false;
    }
    return intersectStrings(node.tags, candidate.tags).length > 0;
  });

  const recentlyConnectedNodes = uniqueNodes([...directRelations, ...backlinks])
    .sort((left, right) => parseDateMillis(right.updatedAt) - parseDateMillis(left.updatedAt))
    .slice(0, config.recentlyConnectedLimit);

  const parentNode = node.parentId ? nodesById.get(node.parentId) ?? null : null;
  const childNodes = workspaceNodes.filter((candidate) => candidate.parentId === node.id);

  const pendingTodosInside = listDescendants(node.id, workspaceNodes).filter(
    (candidate) => candidate.type === "todo" && candidate.status === "pending"
  );

  const alreadyConnectedIds = new Set<string>([
    node.id,
    ...directRelations.map((candidate) => candidate.id),
    ...backlinks.map((candidate) => candidate.id),
    ...(parentNode ? [parentNode.id] : []),
    ...childNodes.map((candidate) => candidate.id)
  ]);

  const suggestedRelatedNodes = rankPotentialRelatedNodes(node, workspaceNodes, alreadyConnectedIds)
    .filter((suggestion) => suggestion.score >= config.minSuggestionScore)
    .slice(0, config.suggestionLimit);

  return {
    node,
    directRelations,
    backlinks,
    sharedTagNodes,
    recentlyConnectedNodes,
    parentNode,
    childNodes,
    pendingTodosInside,
    suggestedRelatedNodes
  };
}

function rankPotentialRelatedNodes(
  node: NodeEntity,
  workspaceNodes: NodeEntity[],
  excludedNodeIds: Set<string>
): RelatedNodeSuggestion[] {
  const baseTagSet = toStringSet(node.tags);
  const baseKeywordSet = tokenizeNode(node);

  return workspaceNodes
    .filter((candidate) => !excludedNodeIds.has(candidate.id))
    .map((candidate) => {
      const candidateTagSet = toStringSet(candidate.tags);
      const candidateKeywordSet = tokenizeNode(candidate);

      const sharedTags = intersectionFromSets(baseTagSet, candidateTagSet);
      const matchedKeywords = intersectionFromSets(baseKeywordSet, candidateKeywordSet);

      const tagScore = jaccardSimilarity(baseTagSet, candidateTagSet);
      const keywordScore = jaccardSimilarity(baseKeywordSet, candidateKeywordSet);
      const score = Number((tagScore * 0.65 + keywordScore * 0.35).toFixed(4));

      return {
        node: candidate,
        score,
        sharedTags,
        matchedKeywords
      };
    })
    .filter((suggestion) => suggestion.sharedTags.length > 0 || suggestion.matchedKeywords.length > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return parseDateMillis(right.node.updatedAt) - parseDateMillis(left.node.updatedAt);
    });
}

function listDescendants(parentId: string, workspaceNodes: NodeEntity[]): NodeEntity[] {
  const childrenByParentId = new Map<string, NodeEntity[]>();
  for (const candidate of workspaceNodes) {
    if (!candidate.parentId) {
      continue;
    }
    const current = childrenByParentId.get(candidate.parentId) ?? [];
    current.push(candidate);
    childrenByParentId.set(candidate.parentId, current);
  }

  const descendants: NodeEntity[] = [];
  const queue = [...(childrenByParentId.get(parentId) ?? [])];
  while (queue.length > 0) {
    const next = queue.shift();
    if (!next) {
      continue;
    }
    descendants.push(next);
    queue.push(...(childrenByParentId.get(next.id) ?? []));
  }

  return descendants;
}

function tokenizeNode(node: NodeEntity): Set<string> {
  const source = `${node.title} ${node.content}`.toLowerCase();
  const tokens = source
    .replace(/[^a-z0-9áéíóúüñ\s]/gi, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
  return new Set(tokens);
}

function jaccardSimilarity(left: Set<string>, right: Set<string>): number {
  const union = new Set<string>([...left, ...right]);
  if (union.size === 0) {
    return 0;
  }
  const intersection = intersectionFromSets(left, right);
  return intersection.length / union.size;
}

function toStringSet(values: string[]): Set<string> {
  return new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean));
}

function intersectionFromSets(left: Set<string>, right: Set<string>): string[] {
  const result: string[] = [];
  for (const value of left) {
    if (right.has(value)) {
      result.push(value);
    }
  }
  return result;
}

function intersectStrings(left: string[], right: string[]): string[] {
  const rightSet = new Set(right.map((value) => value.toLowerCase()));
  return left
    .map((value) => value.toLowerCase())
    .filter((value) => rightSet.has(value));
}

function uniqueNodes(nodes: NodeEntity[]): NodeEntity[] {
  const seen = new Set<string>();
  return nodes.filter((node) => {
    if (seen.has(node.id)) {
      return false;
    }
    seen.add(node.id);
    return true;
  });
}

function parseDateMillis(value: string): number {
  const millis = Date.parse(value);
  return Number.isNaN(millis) ? 0 : millis;
}
