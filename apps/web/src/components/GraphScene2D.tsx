import { useEffect, useMemo, useRef, useState } from "react";
import type { NodeEntity } from "@rehilo/domain";
import type { GraphEdge } from "../lib/graph-utils";
import { Graph2DLayout, type LayoutEdge } from "../lib/graph-layout-2d";
import "./GraphScene2D.css";

interface GraphScene2DProps {
  nodes: NodeEntity[];
  edges: GraphEdge[];
  selectedNodeId: string;
  onSelectNode: (id: string) => void;
  onConnectNodes: (sourceId: string, targetId: string, mode: "relation" | "hierarchy") => void;
  selectedNodeTooltip?: string;
}

interface ViewState {
  pan: { x: number; y: number };
  zoom: number;
  animating: boolean;
}

interface DragState {
  isDragging: boolean;
  startX: number;
  startY: number;
  startPanX: number;
  startPanY: number;
}

interface NodeDragState {
  isDragging: boolean;
  nodeId: string | null;
  startWorld: { x: number; y: number };
  startNode: { x: number; y: number };
  currentPos: { x: number; y: number } | null;
  dragged: boolean;
}

interface LassoState {
  isActive: boolean;
  points: Array<{ x: number; y: number }>;
}

const HIERARCHY_COLORS = ["#cbb36a", "#9bb86a", "#7ba866", "#5f965d", "#4a824f"];
const NEUTRAL_GREEN = "#5f7f63";

type ViewMode = "exploration" | "contextual";

export default function GraphScene2D({
  nodes,
  edges,
  selectedNodeId,
  onSelectNode,
  onConnectNodes,
  selectedNodeTooltip
}: GraphScene2DProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const focusAnimRef = useRef<number | null>(null);
  const transitionAnimRef = useRef<number | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("exploration");
  const [viewState, setViewState] = useState<ViewState>({
    pan: { x: 0, y: 0 },
    zoom: 1,
    animating: true
  });
  const [depthLimit, setDepthLimit] = useState(3);
  const [showRelations, setShowRelations] = useState(true);
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    startX: 0,
    startY: 0,
    startPanX: 0,
    startPanY: 0
  });
  const [nodeDragState, setNodeDragState] = useState<NodeDragState>({
    isDragging: false,
    nodeId: null,
    startWorld: { x: 0, y: 0 },
    startNode: { x: 0, y: 0 },
    currentPos: null,
    dragged: false
  });
  const [lassoState, setLassoState] = useState<LassoState>({
    isActive: false,
    points: []
  });
  const [manualPositions, setManualPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [lassoSelectedIds, setLassoSelectedIds] = useState<Set<string>>(new Set());
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  // Calculate layout based on view mode
  const layout = useMemo(() => {
    const layoutEngine = new Graph2DLayout({
      hierarchyVerticalGap: 140,
      childHorizontalSpacing: 120,
      relationRadialDistance: 220,
      minNodeDistance: 80,
      nodeRadius: 28
    });

    if (viewMode === "contextual") {
      return layoutEngine.layoutContextual(nodes, edges, selectedNodeId);
    }

    return layoutEngine.layout(nodes, edges, selectedNodeId, depthLimit);
  }, [nodes, edges, selectedNodeId, depthLimit, viewMode]);

  // Calculate bounds for auto-zoom
  const bounds = useMemo(() => {
    let minX = 0,
      minY = 0,
      maxX = 0,
      maxY = 0;

    layout.nodes.forEach((node) => {
      minX = Math.min(minX, node.x - node.radius);
      maxX = Math.max(maxX, node.x + node.radius);
      minY = Math.min(minY, node.y - node.radius);
      maxY = Math.max(maxY, node.y + node.radius);
    });

    const padding = 80;
    return { minX: minX - padding, maxX: maxX + padding, minY: minY - padding, maxY: maxY + padding };
  }, [layout.nodes]);

  // Auto-center and zoom view
  useEffect(() => {
    if (!svgRef.current) return;

    if (!viewState.animating) {
      return;
    }

    const svg = svgRef.current;
    const width = svg.clientWidth;
    const height = svg.clientHeight;

    const boundsWidth = bounds.maxX - bounds.minX;
    const boundsHeight = bounds.maxY - bounds.minY;

    const zoomX = width / boundsWidth;
    const zoomY = height / boundsHeight;
    const zoom = Math.min(zoomX, zoomY, 2); // Cap zoom at 2x

    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;

    const panX = width / 2 - centerX * zoom;
    const panY = height / 2 - centerY * zoom;

    setViewState((prev) => ({
      ...prev,
      zoom: zoom * 0.95, // Slight padding
      pan: { x: panX, y: panY },
      animating: false
    }));
  }, [bounds, viewState.animating]);

  useEffect(() => {
    if (nodes.length > 0) {
      setViewState((prev) => ({ ...prev, animating: true }));
    }
  }, [nodes.length]);

  // Handle mouse wheel zoom with native event listener (passive: false to allow preventDefault)
  // This is done in the useEffect below to properly prevent page scroll

  const getWorldPoint = (clientX: number, clientY: number) => {
    if (!svgRef.current) {
      return { x: 0, y: 0 };
    }
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: (clientX - rect.left - viewState.pan.x) / viewState.zoom,
      y: (clientY - rect.top - viewState.pan.y) / viewState.zoom
    };
  };

  const buildLassoPath = (points: Array<{ x: number; y: number }>) => {
    if (points.length === 0) {
      return "";
    }
    const [first, ...rest] = points;
    return `M ${first.x} ${first.y} ${rest.map((p) => `L ${p.x} ${p.y}`).join(" ")} Z`;
  };

  const isPointInPolygon = (point: { x: number; y: number }, polygon: Array<{ x: number; y: number }>) => {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x;
      const yi = polygon[i].y;
      const xj = polygon[j].x;
      const yj = polygon[j].y;

      const intersect = yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
      if (intersect) {
        inside = !inside;
      }
    }
    return inside;
  };

  // Filter edges based on depth limit and relation visibility
  const filteredEdges = useMemo(() => {
    if (!showRelations) {
      return layout.edges.filter((e) => e.edgeType === "hierarchy");
    }
    return layout.edges;
  }, [layout.edges, showRelations]);

  const layoutNodesFinal = useMemo(() => {
    return layout.nodes.map((node) => {
      const manual = manualPositions[node.id];
      if (nodeDragState.isDragging && nodeDragState.nodeId === node.id && nodeDragState.currentPos) {
        return { ...node, x: nodeDragState.currentPos.x, y: nodeDragState.currentPos.y };
      }
      if (!manual) {
        return node;
      }
      return { ...node, x: manual.x, y: manual.y };
    });
  }, [layout.nodes, manualPositions, nodeDragState]);

  const nodeById = useMemo(() => new Map(layoutNodesFinal.map((n) => [n.id, n])), [layoutNodesFinal]);

  const findDropTarget = (worldPoint: { x: number; y: number }, excludeId: string): string | null => {
    const radius = 34;
    let closestId: string | null = null;
    let closestDist = Infinity;

    layoutNodesFinal.forEach((node) => {
      if (node.id === excludeId) {
        return;
      }
      const dx = node.x - worldPoint.x;
      const dy = node.y - worldPoint.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= radius && dist < closestDist) {
        closestId = node.id;
        closestDist = dist;
      }
    });

    return closestId;
  };

  // Handle mouse down for drag
  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return; // Left mouse button only
    if ((e.target as HTMLElement).closest("circle")) return; // Don't drag if clicking node

    if (e.shiftKey) {
      const start = getWorldPoint(e.clientX, e.clientY);
      setLassoState({ isActive: true, points: [start] });
      setLassoSelectedIds(new Set());
      return;
    }
    
    setDragState({
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
      startPanX: viewState.pan.x,
      startPanY: viewState.pan.y
    });
  };

  // Handle mouse move for drag
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (lassoState.isActive) {
      const next = getWorldPoint(e.clientX, e.clientY);
      setLassoState((prev) => ({
        ...prev,
        points: [...prev.points, next]
      }));
      return;
    }

    if (nodeDragState.isDragging && nodeDragState.nodeId) {
      const current = getWorldPoint(e.clientX, e.clientY);
      const deltaX = current.x - nodeDragState.startWorld.x;
      const deltaY = current.y - nodeDragState.startWorld.y;
      const nextPos = {
        x: nodeDragState.startNode.x + deltaX,
        y: nodeDragState.startNode.y + deltaY
      };

      setNodeDragState((prev) => ({
        ...prev,
        currentPos: nextPos,
        dragged: prev.dragged || Math.hypot(deltaX, deltaY) > 4
      }));

      setManualPositions((prev) => ({
        ...prev,
        [nodeDragState.nodeId as string]: nextPos
      }));

      setDropTargetId(findDropTarget(nextPos, nodeDragState.nodeId));
      return;
    }

    if (!dragState.isDragging) return;

    const deltaX = e.clientX - dragState.startX;
    const deltaY = e.clientY - dragState.startY;

    setViewState((prev) => ({
      ...prev,
      pan: {
        x: dragState.startPanX + deltaX,
        y: dragState.startPanY + deltaY
      }
    }));
  };

  // Handle mouse up
  const handleMouseUp = () => {
    if (lassoState.isActive) {
      const polygon = lassoState.points;
      if (polygon.length > 2) {
        const selected = new Set<string>();
        layoutNodesFinal.forEach((node) => {
          if (isPointInPolygon({ x: node.x, y: node.y }, polygon)) {
            selected.add(node.id);
          }
        });
        setLassoSelectedIds(selected);
      }
      setLassoState({ isActive: false, points: [] });
      return;
    }

    if (nodeDragState.isDragging && nodeDragState.nodeId) {
      if (dropTargetId) {
        const choice = window.prompt("Connect as: relation or hierarchy?", "relation");
        if (choice && (choice.toLowerCase() === "relation" || choice.toLowerCase() === "hierarchy")) {
          onConnectNodes(nodeDragState.nodeId, dropTargetId, choice.toLowerCase() as "relation" | "hierarchy");
        }
      }
      if (nodeDragState.currentPos) {
        setManualPositions((prev) => ({
          ...prev,
          [nodeDragState.nodeId as string]: nodeDragState.currentPos as { x: number; y: number }
        }));
      }
      setDropTargetId(null);
      setNodeDragState({
        isDragging: false,
        nodeId: null,
        startWorld: { x: 0, y: 0 },
        startNode: { x: 0, y: 0 },
        currentPos: null,
        dragged: false
      });
      return;
    }

    setDragState((prev) => ({
      ...prev,
      isDragging: false
    }));
  };

  // Handle keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const panStep = 30;
      const zoomStep = 1.2;

      switch (e.key.toLowerCase()) {
        case "arrowup":
          e.preventDefault();
          setViewState((prev) => ({
            ...prev,
            pan: { ...prev.pan, y: prev.pan.y + panStep }
          }));
          break;
        case "arrowdown":
          e.preventDefault();
          setViewState((prev) => ({
            ...prev,
            pan: { ...prev.pan, y: prev.pan.y - panStep }
          }));
          break;
        case "arrowleft":
          e.preventDefault();
          setViewState((prev) => ({
            ...prev,
            pan: { ...prev.pan, x: prev.pan.x + panStep }
          }));
          break;
        case "arrowright":
          e.preventDefault();
          setViewState((prev) => ({
            ...prev,
            pan: { ...prev.pan, x: prev.pan.x - panStep }
          }));
          break;
        case "+":
        case "=":
          e.preventDefault();
          setViewState((prev) => ({
            ...prev,
            zoom: Math.min(5, prev.zoom * zoomStep)
          }));
          break;
        case "-":
          e.preventDefault();
          setViewState((prev) => ({
            ...prev,
            zoom: Math.max(0.1, prev.zoom / zoomStep)
          }));
          break;
        case "r":
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            setViewState({
              pan: { x: 0, y: 0 },
              zoom: 1,
              animating: true
            });
          }
          break;
      }
    };

    // Add native wheel listener with passive: false to allow preventDefault
    const handleWheelNative = (e: WheelEvent) => {
      // Only prevent if over the SVG
      if (svgRef.current && svgRef.current.contains(e.target as Node)) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.85 : 1.15;
        setViewState((prev) => ({
          ...prev,
          zoom: Math.max(0.1, Math.min(5, prev.zoom * delta))
        }));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("wheel", handleWheelNative, { passive: false });
    
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("wheel", handleWheelNative);
    };
  }, []);

  // Handle node click
  const handleNodeClick = (nodeId: string) => {
    onSelectNode(nodeId);
  };

  // Handle node double-click to enter contextual mode
  const handleNodeDoubleClick = (nodeId: string) => {
    if (viewMode === "exploration") {
      onSelectNode(nodeId);
      setViewMode("contextual");
    } else if (viewMode === "contextual" && nodeId !== selectedNodeId) {
      // Navigate to another node in contextual mode (smooth transition)
      onSelectNode(nodeId);
    }
  };

  const childrenById = useMemo(() => {
    const map = new Map<string, string[]>();
    nodes.forEach((node) => {
      if (!node.parentId) {
        return;
      }
      const children = map.get(node.parentId) ?? [];
      children.push(node.id);
      map.set(node.parentId, children);
    });
    return map;
  }, [nodes]);

  const nodeByEntityId = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);

  const hierarchyDepths = useMemo(() => {
    const depths = new Map<string, number>();

    const resolveDepth = (nodeId: string) => {
      if (depths.has(nodeId)) {
        return depths.get(nodeId) as number;
      }

      let depth = 0;
      let current = nodeByEntityId.get(nodeId);
      const visited = new Set<string>();

      while (current?.parentId && nodeByEntityId.has(current.parentId) && !visited.has(current.parentId)) {
        visited.add(current.parentId);
        depth += 1;
        current = nodeByEntityId.get(current.parentId);
      }

      depths.set(nodeId, depth);
      return depth;
    };

    nodes.forEach((node) => {
      const hasHierarchy = Boolean(node.parentId) || (childrenById.get(node.id)?.length ?? 0) > 0;
      if (hasHierarchy) {
        resolveDepth(node.id);
      }
    });

    return depths;
  }, [nodes, childrenById, nodeByEntityId]);

  const nodeColorMap = useMemo(() => {
    const map = new Map<string, string>();
    nodes.forEach((node) => {
      const hasHierarchy = Boolean(node.parentId) || (childrenById.get(node.id)?.length ?? 0) > 0;
      if (!hasHierarchy) {
        map.set(node.id, NEUTRAL_GREEN);
        return;
      }
      const depth = hierarchyDepths.get(node.id) ?? 0;
      const color = HIERARCHY_COLORS[Math.min(depth, HIERARCHY_COLORS.length - 1)];
      map.set(node.id, color);
    });
    return map;
  }, [nodes, childrenById, hierarchyDepths]);

  const edgesFinal = useMemo(() => {
    return filteredEdges.map((edge) => {
      const sourcePos = nodeById.get(edge.source);
      const targetPos = nodeById.get(edge.target);
      if (!sourcePos || !targetPos) {
        return null;
      }
      return {
        ...edge,
        sourcePos: { x: sourcePos.x, y: sourcePos.y },
        targetPos: { x: targetPos.x, y: targetPos.y }
      } as LayoutEdge;
    }).filter((edge): edge is LayoutEdge => edge !== null);
  }, [filteredEdges, nodeById]);

  // Smooth transition animation when switching modes
  useEffect(() => {
    if (!svgRef.current || !selectedNodeId) {
      return;
    }

    const svg = svgRef.current;
    const width = svg.clientWidth;
    const height = svg.clientHeight;
    const node = nodeById.get(selectedNodeId);
    if (!node) {
      return;
    }

    const targetZoom = viewMode === "contextual" ? 1.4 : 1.0;
    const targetPan = {
      x: width / 2 - node.x * targetZoom,
      y: height / 2 - node.y * targetZoom
    };

    const startZoom = viewState.zoom;
    const startPan = { ...viewState.pan };
    const start = performance.now();
    const duration = 400;

    if (transitionAnimRef.current) {
      cancelAnimationFrame(transitionAnimRef.current);
    }

    const step = (time: number) => {
      const t = Math.min(1, (time - start) / duration);
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      
      const nextZoom = startZoom + (targetZoom - startZoom) * eased;
      const nextPan = {
        x: startPan.x + (targetPan.x - startPan.x) * eased,
        y: startPan.y + (targetPan.y - startPan.y) * eased
      };

      setViewState((prev) => ({ ...prev, zoom: nextZoom, pan: nextPan }));

      if (t < 1) {
        transitionAnimRef.current = requestAnimationFrame(step);
      }
    };

    transitionAnimRef.current = requestAnimationFrame(step);

    return () => {
      if (transitionAnimRef.current) {
        cancelAnimationFrame(transitionAnimRef.current);
      }
    };
  }, [viewMode, selectedNodeId, nodeById]);

  useEffect(() => {
    if (!selectedNodeId || !svgRef.current) {
      return;
    }
    if (dragState.isDragging || nodeDragState.isDragging || lassoState.isActive) {
      return;
    }
    if (viewMode === "contextual") {
      return; // Contextual mode handles its own transitions
    }
    const node = nodeById.get(selectedNodeId);
    if (!node) {
      return;
    }
    const svg = svgRef.current;
    const width = svg.clientWidth;
    const height = svg.clientHeight;
    const targetPan = {
      x: width / 2 - node.x * viewState.zoom,
      y: height / 2 - node.y * viewState.zoom
    };
    const startPan = { ...viewState.pan };
    const start = performance.now();
    const duration = 360;

    if (focusAnimRef.current) {
      cancelAnimationFrame(focusAnimRef.current);
    }

    const step = (time: number) => {
      const t = Math.min(1, (time - start) / duration);
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      const nextPan = {
        x: startPan.x + (targetPan.x - startPan.x) * eased,
        y: startPan.y + (targetPan.y - startPan.y) * eased
      };
      setViewState((prev) => ({ ...prev, pan: nextPan }));
      if (t < 1) {
        focusAnimRef.current = requestAnimationFrame(step);
      }
    };

    focusAnimRef.current = requestAnimationFrame(step);
    return () => {
      if (focusAnimRef.current) {
        cancelAnimationFrame(focusAnimRef.current);
      }
    };
  }, [selectedNodeId, nodeById, viewState.zoom, dragState.isDragging, nodeDragState.isDragging, lassoState.isActive, viewMode]);

  return (
    <div className="graph-scene-2d">
      <svg
        ref={svgRef}
        className="graph-svg"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        viewBox="0 0 800 600"
        preserveAspectRatio="xMidYMid meet"
        style={{ cursor: dragState.isDragging ? "grabbing" : "grab" }}
      >
        <defs>
          <filter id="node-shadow">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2" />
          </filter>
          <marker id="arrow-hierarchy" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 10 3, 0 6" fill="#8b5cf6" opacity="0.7" />
          </marker>
          <marker id="arrow-relation" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 10 3, 0 6" fill="#94a3b8" opacity="0.4" />
          </marker>
          <marker id="arrow-cross" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 10 3, 0 6" fill="#10b981" opacity="0.3" />
          </marker>
        </defs>

        <g transform={`translate(${viewState.pan.x}, ${viewState.pan.y}) scale(${viewState.zoom})`}>
          {/* Background grid (subtle) */}
          <g className="graph-grid" opacity="0.05">
            {Array.from({ length: 20 }).map((_, i) => (
              <line
                key={`v-${i}`}
                x1={bounds.minX + ((bounds.maxX - bounds.minX) / 20) * i}
                y1={bounds.minY}
                x2={bounds.minX + ((bounds.maxX - bounds.minX) / 20) * i}
                y2={bounds.maxY}
                stroke="currentColor"
                strokeWidth="1"
              />
            ))}
            {Array.from({ length: 20 }).map((_, i) => (
              <line
                key={`h-${i}`}
                x1={bounds.minX}
                y1={bounds.minY + ((bounds.maxY - bounds.minY) / 20) * i}
                x2={bounds.maxX}
                y2={bounds.minY + ((bounds.maxY - bounds.minY) / 20) * i}
                stroke="currentColor"
                strokeWidth="1"
              />
            ))}
          </g>

          {/* Edges */}
          {edgesFinal.map((edge, idx) => {
            const lineColor =
              edge.edgeType === "hierarchy"
                ? "#8b5cf6"
                : edge.edgeType === "relation"
                  ? "#94a3b8"
                  : "#10b981";

            const lineOpacity =
              edge.edgeType === "hierarchy" ? 0.7 : edge.edgeType === "relation" ? 0.4 : 0.3;

            const lineWidth = edge.edgeType === "hierarchy" ? 2 : edge.edgeType === "relation" ? 1.5 : 1;

            if (edge.isCurved) {
              // Curved path for relations
              const dx = edge.targetPos.x - edge.sourcePos.x;
              const dy = edge.targetPos.y - edge.sourcePos.y;
              const controlX = edge.sourcePos.x + dx / 2 + dy * 0.3;
              const controlY = edge.sourcePos.y + dy / 2 - dx * 0.3;

              return (
                <path
                  key={`edge-${idx}`}
                  d={`M ${edge.sourcePos.x} ${edge.sourcePos.y} Q ${controlX} ${controlY} ${edge.targetPos.x} ${edge.targetPos.y}`}
                  stroke={lineColor}
                  strokeWidth={lineWidth}
                  opacity={lineOpacity}
                  fill="none"
                  strokeLinecap="round"
                  className="graph-edge"
                />
              );
            } else {
              // Straight line for hierarchy
              return (
                <line
                  key={`edge-${idx}`}
                  x1={edge.sourcePos.x}
                  y1={edge.sourcePos.y}
                  x2={edge.targetPos.x}
                  y2={edge.targetPos.y}
                  stroke={lineColor}
                  strokeWidth={lineWidth}
                  opacity={lineOpacity}
                  className="graph-edge"
                />
              );
            }
          })}

          {/* Nodes */}
          {layoutNodesFinal.map((node) => {
            const isSelected = node.id === selectedNodeId;
            const isLassoSelected = lassoSelectedIds.has(node.id);
            const isDropTarget = dropTargetId === node.id;
            const color = nodeColorMap.get(node.id) ?? "#6c757d";

            // Calculate node scale and opacity based on view mode and zone
            let nodeScale = 1.0;
            let nodeOpacity = 0.9;

            if (viewMode === "contextual") {
              const parentId = nodeByEntityId.get(selectedNodeId)?.parentId;
              const childIds = childrenById.get(selectedNodeId) ?? [];

              if (isSelected) {
                // ZONE 1: Center - Active node (larger)
                nodeScale = 1.6;
                nodeOpacity = 1.0;
              } else if (node.id === parentId) {
                // ZONE 2: Above - Parent (reduced)
                nodeScale = 0.85;
                nodeOpacity = 0.75;
              } else if (childIds.includes(node.id)) {
                // ZONE 3: Below - Children (standard)
                nodeScale = 1.0;
                nodeOpacity = 0.85;
              } else {
                // ZONE 4/5: Relations/Cross-workspace (smaller, subtle)
                nodeScale = 0.7;
                nodeOpacity = 0.65;
              }
            }

            return (
              <g
                key={`node-${node.id}`}
                className={`graph-node ${isSelected ? "selected" : ""} ${isLassoSelected ? "lasso-selected" : ""} ${isDropTarget ? "drop-target" : ""}`}
              >
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={node.radius * nodeScale}
                  fill={color}
                  opacity={nodeOpacity}
                  filter="url(#node-shadow)"
                  className="node-circle"
                  style={{ transition: "all 0.4s ease" }}
                  onMouseDown={(event) => {
                    event.stopPropagation();
                    const start = getWorldPoint(event.clientX, event.clientY);
                    setNodeDragState({
                      isDragging: true,
                      nodeId: node.id,
                      startWorld: start,
                      startNode: { x: node.x, y: node.y },
                      currentPos: { x: node.x, y: node.y },
                      dragged: false
                    });
                  }}
                  onClick={() => {
                    if (nodeDragState.dragged) {
                      return;
                    }
                    // In contextual mode, clicking parent/children navigates directly
                    if (viewMode === "contextual" && node.id !== selectedNodeId) {
                      const parentId = nodeByEntityId.get(selectedNodeId)?.parentId;
                      const childIds = childrenById.get(selectedNodeId) ?? [];
                      
                      if (node.id === parentId || childIds.includes(node.id)) {
                        handleNodeDoubleClick(node.id); // Navigate smoothly
                        return;
                      }
                    }
                    handleNodeClick(node.id);
                  }}
                  onDoubleClick={() => {
                    handleNodeDoubleClick(node.id);
                  }}
                />

                {isSelected && (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={(node.radius + 6) * nodeScale}
                    fill="none"
                    stroke="#9d8b5e"
                    strokeWidth="2"
                    opacity="0.6"
                    className="node-glow"
                    style={{ transition: "all 0.4s ease" }}
                  />
                )}

                {/* Node Tooltip (title above selected node) */}
                {isSelected && selectedNodeTooltip && (
                  <g className="node-tooltip">
                    <rect
                      x={node.x - 80}
                      y={node.y - 60}
                      width="160"
                      height="28"
                      rx="6"
                      fill="rgba(26, 31, 24, 0.95)"
                      stroke="rgba(157, 139, 94, 0.5)"
                      strokeWidth="1"
                    />
                    <text
                      x={node.x}
                      y={node.y - 40}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="tooltip-text"
                      fill="#f5f3ef"
                      fontSize="12"
                      fontWeight="500"
                    >
                      {selectedNodeTooltip.length > 20
                        ? `${selectedNodeTooltip.substring(0, 20)}...`
                        : selectedNodeTooltip}
                    </text>
                    <text
                      x={node.x}
                      y={node.y - 22}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="tooltip-hint"
                      fill="#94968f"
                      fontSize="10"
                    >
                      Click again for details
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {lassoState.isActive && lassoState.points.length > 2 && (
            <path
              d={buildLassoPath(lassoState.points)}
              className="lasso-path"
            />
          )}
        </g>
      </svg>

      {/* Controls */}
      <div className="graph-controls">
        <div className="control-group">
          <label className="control-label">Depth</label>
          <input
            type="range"
            min="1"
            max="5"
            value={depthLimit}
            onChange={(e) => setDepthLimit(Number(e.target.value))}
            className="control-slider"
          />
          <span className="control-value">{depthLimit}</span>
        </div>

        <button
          className={`control-button ${showRelations ? "active" : ""}`}
          onClick={() => setShowRelations(!showRelations)}
          title="Toggle relation edges"
        >
          {showRelations ? "Relations: On" : "Relations: Off"}
        </button>

        <button
          className={`control-button ${viewMode === "contextual" ? "active" : ""}`}
          onClick={() => setViewMode(viewMode === "contextual" ? "exploration" : "contextual")}
          title="Toggle contextual mode"
        >
          {viewMode === "contextual" ? "Exit Context" : "Enter Context"}
        </button>
      </div>

      {/* Breadcrumb Navigation (only in contextual mode) */}
      {viewMode === "contextual" && selectedNodeId && (
        <div className="graph-breadcrumb">
          {(() => {
            const path: Array<{ id: string; title: string }> = [];
            let current = nodeByEntityId.get(selectedNodeId);
            
            // Build path from current to root
            while (current) {
              path.unshift({ id: current.id, title: current.title });
              current = current.parentId ? nodeByEntityId.get(current.parentId) : undefined;
            }

            return (
              <>
                <span className="breadcrumb-label">Path:</span>
                {path.map((item, index) => (
                  <span key={item.id} className="breadcrumb-path">
                    {index > 0 && <span className="breadcrumb-separator">›</span>}
                    <button
                      className={`breadcrumb-item ${item.id === selectedNodeId ? "active" : ""}`}
                      onClick={() => {
                        if (item.id !== selectedNodeId) {
                          handleNodeDoubleClick(item.id);
                        }
                      }}
                      title={item.title}
                    >
                      {item.title.length > 20 ? `${item.title.substring(0, 20)}...` : item.title}
                    </button>
                  </span>
                ))}
              </>
            );
          })()}
        </div>
      )}

      {/* Contextual Quick Actions (only in contextual mode) */}
      {viewMode === "contextual" && selectedNodeId && (
        <div className="contextual-actions">
          <div className="action-hint">Quick Actions</div>
          <button 
            className="action-button action-add-child"
            onClick={() => {
              // This would trigger creation of a child node
              console.log("Add child to", selectedNodeId);
            }}
            title="Add child node"
          >
            + Child
          </button>
          <button 
            className="action-button action-add-relation"
            onClick={() => {
              // This would trigger creation of a related node
              console.log("Add relation to", selectedNodeId);
            }}
            title="Add related node"
          >
            ↔ Relate
          </button>
          <button 
            className="action-button action-link-workspace"
            onClick={() => {
              // This would trigger cross-workspace linking
              console.log("Link workspace for", selectedNodeId);
            }}
            title="Link to another workspace"
          >
            ⚡ Link WS
          </button>
        </div>
      )}

      {/* Help / Controls Info */}
      <div className="graph-help">
        <div className="help-item">
          <kbd>Click + Drag</kbd> Pan
        </div>
        <div className="help-item">
          <kbd>Shift + Drag</kbd> Select
        </div>
        <div className="help-item">
          <kbd>Double Click</kbd> Context
        </div>
        <div className="help-item">
          <kbd>↑↓←→</kbd> Move
        </div>
        <div className="help-item">
          <kbd>+/-</kbd> Zoom
        </div>
        <div className="help-item">
          <kbd>R</kbd> Reset
        </div>
        <div className="help-item">
          <kbd>Scroll</kbd> Zoom
        </div>
        <div className="help-item">
          <kbd>Drag Node</kbd> Connect
        </div>
      </div>

      {/* Legend */}
      <div className="graph-legend">
        <div className="legend-item">
          <svg width="20" height="3" className="legend-line">
            <line x1="0" y1="1.5" x2="20" y2="1.5" stroke="#8b5cf6" strokeWidth="2" opacity="0.7" />
          </svg>
          <span>Hierarchy</span>
        </div>
        <div className="legend-item">
          <svg width="20" height="3" className="legend-line">
            <path d="M 0 1.5 Q 10 -5 20 1.5" stroke="#94a3b8" strokeWidth="1.5" opacity="0.4" fill="none" />
          </svg>
          <span>Relations</span>
        </div>
        <div className="legend-item">
          <svg width="20" height="3" className="legend-line">
            <line x1="0" y1="1.5" x2="20" y2="1.5" stroke="#10b981" strokeWidth="1" opacity="0.3" strokeDasharray="3,2" />
          </svg>
          <span>Cross-WS</span>
        </div>
      </div>
    </div>
  );
}
