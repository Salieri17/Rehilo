import { useState } from "react";
import { buildNodeContext, getNodeRelationIds, type NodeEntity } from "@rehilo/domain";
import "./node-detail.css";

interface NodeDetailViewProps {
  node: NodeEntity | null;
  nodes: NodeEntity[];
  onSelectNode?: (id: string) => void;
}

export default function NodeDetailView({ node, nodes, onSelectNode }: NodeDetailViewProps) {
  const [depthLimit, setDepthLimit] = useState(2);

  if (!node) {
    return (
      <div className="node-detail">
        <h2>Node detail</h2>
        <p className="muted">Select a node from list or graph.</p>
      </div>
    );
  }

  const context = buildNodeContext(node.id, nodes);

  if (!context) {
    return null;
  }

  const directRelationCount = getNodeRelationIds(node).length;

  const depthConnections = buildDepthConnections(node.id, nodes, depthLimit).filter(
    (candidate) => candidate.id !== node.id
  );

  const renderNodeList = (items: NodeEntity[], emptyMessage: string) => {
    if (items.length === 0) {
      return <p className="muted">{emptyMessage}</p>;
    }

    return (
      <ul className="node-list">
        {items.map((item) => (
          <li key={item.id}>
            {onSelectNode ? (
              <button type="button" className="node-link" onClick={() => onSelectNode(item.id)}>
                {item.title}
              </button>
            ) : (
              item.title
            )}
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="node-detail">
      <h2>Context workspace: {node.title}</h2>
      <p className="muted">Type: {node.type}</p>
      <p className="muted">Workspace: {node.workspaceId}</p>
      <p>{node.content || "No content yet."}</p>
      <div className="detail-grid">
        <div>
          <strong>{node.tags.length}</strong>
          <span>Tags</span>
        </div>
        <div>
          <strong>{context.childNodes.length}</strong>
          <span>Children</span>
        </div>
        <div>
          <strong>{context.backlinks.length}</strong>
          <span>Backlinks</span>
        </div>
        <div>
          <strong>{directRelationCount}</strong>
          <span>Direct relations</span>
        </div>
      </div>

      <section className="context-block">
        <h3>Parent</h3>
        {context.parentNode ? renderNodeList([context.parentNode], "No parent.") : <p className="muted">No parent.</p>}
      </section>

      <section className="context-block">
        <h3>Children</h3>
        {renderNodeList(context.childNodes, "No children.")}
      </section>

      <section className="context-block">
        <h3>Direct relations</h3>
        {renderNodeList(context.directRelations, "No direct relations.")}
      </section>

      <section className="context-block">
        <h3>Backlinks</h3>
        {renderNodeList(context.backlinks, "No backlinks.")}
      </section>

      <section className="context-block">
        <div className="depth-header">
          <h3>Depth connections</h3>
          <label>
            Depth
            <input
              type="number"
              min={1}
              max={4}
              value={depthLimit}
              onChange={(event) => setDepthLimit(Math.max(1, Math.min(4, Number(event.target.value) || 1)))}
            />
          </label>
        </div>
        {renderNodeList(depthConnections, "No depth connections for current limit.")}
      </section>

      <section className="context-block">
        <h3>Related tags</h3>
        {renderNodeList(context.sharedTagNodes.slice(0, 8), "No tag-based related nodes.")}
      </section>

      <section className="context-block">
        <h3>Cross-workspace refs</h3>
        {node.crossWorkspaceRefs.length === 0 ? (
          <p className="muted">No cross-workspace references.</p>
        ) : (
          <ul className="node-list">
            {node.crossWorkspaceRefs.map((referenceId) => (
              <li key={referenceId}>{referenceId}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function buildDepthConnections(sourceNodeId: string, nodes: NodeEntity[], maxDepth: number): NodeEntity[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const adjacency = new Map<string, Set<string>>();

  for (const node of nodes) {
    for (const relationId of getNodeRelationIds(node)) {
      addNeighbor(adjacency, node.id, relationId);
      addNeighbor(adjacency, relationId, node.id);
    }

    if (node.parentId) {
      addNeighbor(adjacency, node.id, node.parentId);
      addNeighbor(adjacency, node.parentId, node.id);
    }
  }

  const visited = new Set<string>([sourceNodeId]);
  const queue: Array<{ id: string; depth: number }> = [{ id: sourceNodeId, depth: 0 }];
  const result: NodeEntity[] = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    if (current.depth >= maxDepth) {
      continue;
    }

    const neighbors = adjacency.get(current.id) ?? new Set<string>();
    for (const neighborId of neighbors) {
      if (visited.has(neighborId)) {
        continue;
      }
      visited.add(neighborId);

      const neighbor = byId.get(neighborId);
      if (neighbor) {
        result.push(neighbor);
      }

      queue.push({ id: neighborId, depth: current.depth + 1 });
    }
  }

  return result;
}

function addNeighbor(graph: Map<string, Set<string>>, source: string, target: string) {
  const current = graph.get(source) ?? new Set<string>();
  current.add(target);
  graph.set(source, current);
}
