import type { NodeEntity } from "@rehilo/domain";
import type { GraphEdge } from "./graph-utils";

export interface Point {
  x: number;
  y: number;
}

export interface LayoutNode extends Point {
  id: string;
  radius: number;
  depth?: number;
  level?: number; // Hierarchy level relative to selected node
}

export interface LayoutEdge {
  source: string;
  target: string;
  edgeType: "hierarchy" | "relation" | "cross-workspace";
  sourcePos: Point;
  targetPos: Point;
  isCurved: boolean;
}

interface LayoutConfig {
  hierarchyVerticalGap: number; // Gap between parent and child levels
  childHorizontalSpacing: number; // Horizontal spacing between siblings
  relationRadialDistance: number; // Distance for radial relation placement
  minNodeDistance: number; // Minimum distance between any two nodes
  nodeRadius: number; // Base node radius
}

const DEFAULT_CONFIG: LayoutConfig = {
  hierarchyVerticalGap: 120,
  childHorizontalSpacing: 100,
  relationRadialDistance: 200,
  minNodeDistance: 80,
  nodeRadius: 24
};

export class Graph2DLayout {
  private config: LayoutConfig;
  private nodePositions: Map<string, Point> = new Map();
  private hierarchyParents: Map<string, string> = new Map(); // node -> parent
  private hierarchyChildren: Map<string, string[]> = new Map(); // node -> [children]
  private relationEdges: Set<string> = new Set(); // "id1::id2" format
  private crossWorkspaceEdges: Set<string> = new Set();

  constructor(config: Partial<LayoutConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  layout(
    nodes: NodeEntity[],
    edges: GraphEdge[],
    selectedNodeId: string,
    depthLimit: number = 3
  ): { nodes: LayoutNode[]; edges: LayoutEdge[] } {
    this.nodePositions.clear();
    this.hierarchyParents.clear();
    this.hierarchyChildren.clear();
    this.relationEdges.clear();
    this.crossWorkspaceEdges.clear();

    // Build graph relationships
    this.buildGraphStructure(edges);

    // Position the selected node at center
    const selectedNode = nodes.find((n) => n.id === selectedNodeId);
    if (!selectedNode) {
      // Fallback: layout all nodes in a circle if no selection
      return this.layoutAllNodesCircle(nodes, edges);
    }

    // Layout hierarchy starting from selected node
    this.layoutHierarchyTree(selectedNode, nodes, depthLimit);

    // Layout relations radially around selected node
    this.layoutRadialRelations(selectedNodeId, nodes, depthLimit);

    // Construct LayoutNode[] and LayoutEdge[]
    const layoutNodes = this.constructLayoutNodes(nodes);
    const layoutEdges = this.constructLayoutEdges(edges);

    return { nodes: layoutNodes, edges: layoutEdges };
  }

  /**
   * Contextual layout transforms the graph into a spatial cognitive space around the selected node.
   * 5 zones: Center (active), Above (parent), Below (children), Around (relations), Peripheral (cross-workspace)
   */
  layoutContextual(
    nodes: NodeEntity[],
    edges: GraphEdge[],
    selectedNodeId: string
  ): { nodes: LayoutNode[]; edges: LayoutEdge[] } {
    this.nodePositions.clear();
    this.hierarchyParents.clear();
    this.hierarchyChildren.clear();
    this.relationEdges.clear();
    this.crossWorkspaceEdges.clear();

    this.buildGraphStructure(edges);

    const selectedNode = nodes.find((n) => n.id === selectedNodeId);
    if (!selectedNode) {
      return this.layoutAllNodesCircle(nodes, edges);
    }

    // ZONE 1: Center - Active node at origin, larger
    this.nodePositions.set(selectedNodeId, { x: 0, y: 0 });

    // ZONE 2: Above - Parent (reduced scale)
    const parentId = this.hierarchyParents.get(selectedNodeId);
    if (parentId) {
      this.nodePositions.set(parentId, { x: 0, y: -180 });
    }

    // ZONE 3: Below - Children (structured branching)
    const childIds = this.hierarchyChildren.get(selectedNodeId) || [];
    const childNodes = childIds
      .map((id) => nodes.find((n) => n.id === id))
      .filter((n): n is NodeEntity => n !== undefined);

    if (childNodes.length > 0) {
      const childSpacing = 160;
      const totalWidth = (childNodes.length - 1) * childSpacing;
      childNodes.forEach((child, index) => {
        const x = -totalWidth / 2 + index * childSpacing;
        this.nodePositions.set(child.id, { x, y: 180 });
      });
    }

    // ZONE 4: Around - Relations (radial circle)
    const relationNodeIds = this.getRelationNodeIds(selectedNodeId);
    const alreadyPositioned = new Set(this.nodePositions.keys());
    const newRelationNodes = relationNodeIds
      .filter((id) => !alreadyPositioned.has(id))
      .map((id) => nodes.find((n) => n.id === id))
      .filter((n): n is NodeEntity => n !== undefined);

    if (newRelationNodes.length > 0) {
      const angleStart = Math.PI * 0.25; // Start at 45°
      const angleEnd = Math.PI * 1.75; // End at 315°
      const angleRange = angleEnd - angleStart;
      const angleStep = newRelationNodes.length > 1 ? angleRange / (newRelationNodes.length - 1) : 0;

      newRelationNodes.forEach((node, index) => {
        const angle = angleStart + angleStep * index;
        const distance = 280;
        const x = Math.cos(angle) * distance;
        const y = Math.sin(angle) * distance;
        this.nodePositions.set(node.id, { x, y });
      });
    }

    // ZONE 5: Peripheral - Cross-workspace (far right/left)
    const crossWorkspaceNodeIds = this.getCrossWorkspaceNodeIds(selectedNodeId);
    const unpositionedCrossWorkspace = crossWorkspaceNodeIds
      .filter((id) => !this.nodePositions.has(id))
      .map((id) => nodes.find((n) => n.id === id))
      .filter((n): n is NodeEntity => n !== undefined);

    if (unpositionedCrossWorkspace.length > 0) {
      const stackSpacing = 80;
      unpositionedCrossWorkspace.forEach((node, index) => {
        const side = index % 2 === 0 ? 1 : -1;
        const stackIndex = Math.floor(index / 2);
        this.nodePositions.set(node.id, { 
          x: side * 400, 
          y: stackIndex * stackSpacing - ((unpositionedCrossWorkspace.length / 2) * stackSpacing) / 2 
        });
      });
    }

    const layoutNodes = this.constructLayoutNodes(nodes);
    const layoutEdges = this.constructLayoutEdges(edges);

    return { nodes: layoutNodes, edges: layoutEdges };
  }

  private getCrossWorkspaceNodeIds(nodeId: string): string[] {
    const ids: string[] = [];
    this.crossWorkspaceEdges.forEach((edge) => {
      const [id1, id2] = edge.split("::");
      if (id1 === nodeId) {
        ids.push(id2);
      } else if (id2 === nodeId) {
        ids.push(id1);
      }
    });
    return ids;
  }

  private buildGraphStructure(edges: GraphEdge[]) {
    edges.forEach((edge) => {
      if (edge.edgeType === "hierarchy") {
        this.hierarchyParents.set(edge.target, edge.source);
        const children = this.hierarchyChildren.get(edge.source) || [];
        children.push(edge.target);
        this.hierarchyChildren.set(edge.source, children);
      } else if (edge.edgeType === "relation") {
        this.relationEdges.add([edge.source, edge.target].sort().join("::"));
      } else if (edge.edgeType === "cross-workspace") {
        this.crossWorkspaceEdges.add([edge.source, edge.target].sort().join("::"));
      }
    });
  }

  private layoutHierarchyTree(node: NodeEntity, allNodes: NodeEntity[], depthLimit: number, level: number = 0): number {
    if (level > depthLimit) {
      return 0;
    }

    const position: Point = level === 0 ? { x: 0, y: 0 } : this.calculateNodePosition(node, level);

    this.nodePositions.set(node.id, position);

    // Layout children below this node
    const childIds = this.hierarchyChildren.get(node.id) || [];
    if (childIds.length > 0 && level < depthLimit) {
      const childNodes = childIds
        .map((id) => allNodes.find((n) => n.id === id))
        .filter((n): n is NodeEntity => n !== undefined);

      const childCount = childNodes.length;
      const childrenWidth = childCount * this.config.childHorizontalSpacing;

      childNodes.forEach((child, index) => {
        const offsetX = -childrenWidth / 2 + index * this.config.childHorizontalSpacing + this.config.childHorizontalSpacing / 2;
        const childPos: Point = {
          x: position.x + offsetX,
          y: position.y + this.config.hierarchyVerticalGap
        };
        this.nodePositions.set(child.id, childPos);
        this.layoutHierarchyTree(child, allNodes, depthLimit, level + 1);
      });
    }

    // Layout parent above this node (only for direct parent)
    if (level === 0) {
      const parentId = this.hierarchyParents.get(node.id);
      if (parentId && level < depthLimit) {
        const parentNode = allNodes.find((n) => n.id === parentId);
        if (parentNode) {
          this.nodePositions.set(parentId, { x: 0, y: -this.config.hierarchyVerticalGap });
        }
      }
    }

    return level;
  }

  private calculateNodePosition(node: NodeEntity, level: number): Point {
    // This is called internally; actual positioning done in layoutHierarchyTree
    return { x: 0, y: 0 };
  }

  private layoutRadialRelations(selectedNodeId: string, allNodes: NodeEntity[], depthLimit: number) {
    const selectedPos = this.nodePositions.get(selectedNodeId);
    if (!selectedPos) return;

    const relationNodeIds = this.getRelationNodeIds(selectedNodeId);
    const alreadyPositioned = new Set(this.nodePositions.keys());

    // Filter relations to unpositioned nodes
    const newRelationNodes = relationNodeIds
      .filter((id) => !alreadyPositioned.has(id))
      .map((id) => allNodes.find((n) => n.id === id))
      .filter((n): n is NodeEntity => n !== undefined);

    if (newRelationNodes.length === 0) return;

    // Arrange relations radially around selected node
    const angleStep = (Math.PI * 2) / newRelationNodes.length;
    newRelationNodes.forEach((node, index) => {
      const angle = angleStep * index;
      const x = selectedPos.x + Math.cos(angle) * this.config.relationRadialDistance;
      const y = selectedPos.y + Math.sin(angle) * this.config.relationRadialDistance;
      this.nodePositions.set(node.id, { x, y });
    });
  }

  private getRelationNodeIds(nodeId: string): string[] {
    const relations: string[] = [];
    this.relationEdges.forEach((edge) => {
      const [id1, id2] = edge.split("::");
      if (id1 === nodeId) {
        relations.push(id2);
      } else if (id2 === nodeId) {
        relations.push(id1);
      }
    });
    return relations;
  }

  private layoutAllNodesCircle(nodes: NodeEntity[], edges: GraphEdge[]): { nodes: LayoutNode[]; edges: LayoutEdge[] } {
    const radius = Math.min(300, Math.max(150, nodes.length * 30));
    const angleStep = (Math.PI * 2) / Math.max(1, nodes.length);

    nodes.forEach((node, index) => {
      const angle = angleStep * index;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      this.nodePositions.set(node.id, { x, y });
    });

    const layoutNodes = this.constructLayoutNodes(nodes);
    const layoutEdges = this.constructLayoutEdges(edges);

    return { nodes: layoutNodes, edges: layoutEdges };
  }

  private constructLayoutNodes(nodes: NodeEntity[]): LayoutNode[] {
    return nodes.map((node) => {
      const pos = this.nodePositions.get(node.id) || { x: 0, y: 0 };
      return {
        id: node.id,
        x: pos.x,
        y: pos.y,
        radius: this.config.nodeRadius
      };
    });
  }

  private constructLayoutEdges(edges: GraphEdge[]): LayoutEdge[] {
    return edges
      .map((edge) => {
        const sourcePos = this.nodePositions.get(edge.source);
        const targetPos = this.nodePositions.get(edge.target);

        if (!sourcePos || !targetPos) return null;

        return {
          source: edge.source,
          target: edge.target,
          edgeType: edge.edgeType,
          sourcePos,
          targetPos,
          isCurved: edge.edgeType === "relation" || edge.edgeType === "cross-workspace"
        };
      })
      .filter((e): e is LayoutEdge => e !== null);
  }
}
