import type { NodeEntity } from "@rehilo/domain";
import "./list-view.css";

interface ListViewProps {
  nodes: NodeEntity[];
  selectedNodeId: string;
  onSelectNode: (id: string) => void;
}

export default function ListView({ nodes, selectedNodeId, onSelectNode }: ListViewProps) {
  return (
    <div className="list-view">
      <h2>List view</h2>
      <div className="list-table">
        <div className="list-row header">
          <span>Title</span>
          <span>Type</span>
          <span>Workspace</span>
          <span>Updated</span>
        </div>
        {nodes.map((node) => (
          <button
            key={node.id}
            type="button"
            className={`list-row ${node.id === selectedNodeId ? "active" : ""}`}
            onClick={() => onSelectNode(node.id)}
          >
            <span>{node.title}</span>
            <span>{node.type}</span>
            <span>{node.workspaceId}</span>
            <span>{node.updatedAt.slice(0, 10)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
