import type { NodeEntity } from "@rehilo/domain";
import "./node-detail.css";

interface NodeDetailViewProps {
  node: NodeEntity | null;
  nodes: NodeEntity[];
}

export default function NodeDetailView({ node, nodes }: NodeDetailViewProps) {
  if (!node) {
    return (
      <div className="node-detail">
        <h2>Node detail</h2>
        <p className="muted">Select a node from list or graph.</p>
      </div>
    );
  }

  const childCount = nodes.filter((candidate) => candidate.parentId === node.id).length;
  const backlinkCount = nodes.filter((candidate) =>
    candidate.relations.some((relation) => relation.targetNodeId === node.id)
  ).length;

  return (
    <div className="node-detail">
      <h2>{node.title}</h2>
      <p className="muted">Type: {node.type}</p>
      <p className="muted">Workspace: {node.workspaceId}</p>
      <p>{node.content || "No content yet."}</p>
      <div className="detail-grid">
        <div>
          <strong>{node.tags.length}</strong>
          <span>Tags</span>
        </div>
        <div>
          <strong>{childCount}</strong>
          <span>Children</span>
        </div>
        <div>
          <strong>{backlinkCount}</strong>
          <span>Backlinks</span>
        </div>
      </div>
    </div>
  );
}
