import { Html, Line, MapControls } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { Canvas, useThree } from "@react-three/fiber";
import type { MutableRefObject } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { NodeEntity } from "@rehilo/domain";
import type { GraphEdge } from "../lib/graph-utils";
import { Graph2DLayout } from "../lib/graph-layout-2d";
import "./GraphScene2D.css";

interface GraphScene2DProps {
  nodes: NodeEntity[];
  edges: GraphEdge[];
  selectedNodeId: string;
  onSelectNode: (id: string) => void;
  onConnectNodes: (sourceId: string, targetId: string, mode: "relation" | "hierarchy") => void;
  selectedNodeTooltip?: string;
}

type RenderEdge = {
  source: string;
  target: string;
  edgeType: "hierarchy" | "relation" | "cross-workspace";
  points: [number, number, number][];
};

interface NodeDragState {
  isDragging: boolean;
  nodeId: string | null;
  startWorld: { x: number; y: number };
  startNode: { x: number; y: number };
  startClient: { x: number; y: number };
  currentPos: { x: number; y: number } | null;
  dragged: boolean;
}

interface LassoState {
  isActive: boolean;
  points: Array<{ x: number; y: number }>;
}

const HIERARCHY_COLORS = ["#cbb36a", "#9bb86a", "#7ba866", "#5f965d", "#4a824f"];
const NEUTRAL_GREEN = "#5f7f63";
const EDGE_COLORS = {
  hierarchy: "#8b5cf6",
  relation: "#94a3b8",
  "cross-workspace": "#10b981"
} as const;

const NODE_Z = 0;
const EDGE_Z = -0.5;
const MAX_WORLD_COORD = 8000;

export default function GraphScene2D({
  nodes,
  edges,
  selectedNodeId,
  onSelectNode,
  onConnectNodes,
  selectedNodeTooltip
}: GraphScene2DProps) {
  const [depthLimit, setDepthLimit] = useState(3);
  const [showRelations, setShowRelations] = useState(true);
  const [fitViewToken, setFitViewToken] = useState(1);
  const [layoutAnchorId, setLayoutAnchorId] = useState("");
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [manualPositions, setManualPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [lassoSelectedIds, setLassoSelectedIds] = useState<Set<string>>(new Set());
  const renderRuntimeRef = useRef<{ camera: THREE.OrthographicCamera | null; canvas: HTMLCanvasElement | null }>({
    camera: null,
    canvas: null
  });
  const [nodeDragState, setNodeDragState] = useState<NodeDragState>({
    isDragging: false,
    nodeId: null,
    startWorld: { x: 0, y: 0 },
    startNode: { x: 0, y: 0 },
    startClient: { x: 0, y: 0 },
    currentPos: null,
    dragged: false
  });
  const [lassoState, setLassoState] = useState<LassoState>({ isActive: false, points: [] });

  useEffect(() => {
    if (nodes.length === 0) {
      setLayoutAnchorId("");
      return;
    }

    if (!layoutAnchorId || !nodes.some((node) => node.id === layoutAnchorId)) {
      setLayoutAnchorId(nodes[0].id);
    }
  }, [nodes, layoutAnchorId]);

  const layout = useMemo(() => {
    const layoutEngine = new Graph2DLayout({
      hierarchyVerticalGap: 140,
      childHorizontalSpacing: 120,
      relationRadialDistance: 220,
      minNodeDistance: 80,
      nodeRadius: 28
    });

    return layoutEngine.layout(nodes, edges, layoutAnchorId, depthLimit);
  }, [nodes, edges, selectedNodeId, depthLimit, layoutAnchorId]);

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

  const nodeByLayoutId = useMemo(() => new Map(layoutNodesFinal.map((node) => [node.id, node])), [layoutNodesFinal]);

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

  const filteredEdges = useMemo(() => {
    if (!showRelations) {
      return layout.edges.filter((edge) => edge.edgeType === "hierarchy");
    }
    return layout.edges;
  }, [layout.edges, showRelations]);

  const edgesFinal = useMemo<RenderEdge[]>(() => {
    const renderEdges: RenderEdge[] = [];

    filteredEdges.forEach((edge) => {
      const source = nodeByLayoutId.get(edge.source);
      const target = nodeByLayoutId.get(edge.target);
      if (!source || !target) {
        return;
      }

      if (edge.isCurved) {
        const sourceVec = new THREE.Vector3(source.x, source.y, EDGE_Z);
        const targetVec = new THREE.Vector3(target.x, target.y, EDGE_Z);
        const midX = (source.x + target.x) / 2;
        const midY = (source.y + target.y) / 2;
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const control = new THREE.Vector3(midX + dy * 0.3, midY - dx * 0.3, EDGE_Z);
        const curve = new THREE.QuadraticBezierCurve3(sourceVec, control, targetVec);
        const points = curve
          .getPoints(24)
          .map((point) => [point.x, point.y, point.z] as [number, number, number]);

        renderEdges.push({
          source: edge.source,
          target: edge.target,
          edgeType: edge.edgeType,
          points
        });
        return;
      }

      renderEdges.push({
        source: edge.source,
        target: edge.target,
        edgeType: edge.edgeType,
        points: [
          [source.x, source.y, EDGE_Z],
          [target.x, target.y, EDGE_Z]
        ]
      });
    });

    return renderEdges;
  }, [filteredEdges, nodeByLayoutId]);

  const relatedNodeIds = useMemo(() => {
    const related = new Set<string>();
    if (!selectedNodeId) {
      return related;
    }

    related.add(selectedNodeId);
    edges.forEach((edge) => {
      if (edge.source === selectedNodeId) {
        related.add(edge.target);
      }
      if (edge.target === selectedNodeId) {
        related.add(edge.source);
      }
    });

    return related;
  }, [selectedNodeId, edges]);

  const highlightedEdgeKeys = useMemo(() => {
    const keys = new Set<string>();
    if (!selectedNodeId) {
      return keys;
    }

    edges.forEach((edge) => {
      if (edge.source === selectedNodeId || edge.target === selectedNodeId) {
        keys.add(edgeKey(edge.source, edge.target));
      }
    });
    return keys;
  }, [selectedNodeId, edges]);

  const bounds = useMemo(() => {
    if (layout.nodes.length === 0) {
      return { minX: -200, maxX: 200, minY: -200, maxY: 200 };
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    layout.nodes.forEach((node) => {
      minX = Math.min(minX, node.x - node.radius);
      maxX = Math.max(maxX, node.x + node.radius);
      minY = Math.min(minY, node.y - node.radius);
      maxY = Math.max(maxY, node.y + node.radius);
    });

    const padding = 120;
    return {
      minX: minX - padding,
      maxX: maxX + padding,
      minY: minY - padding,
      maxY: maxY + padding
    };
  }, [layout.nodes]);

  const findDropTarget = (worldPoint: { x: number; y: number }, excludeId: string): string | null => {
    const radius = 36;
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

  const finalizeLasso = () => {
    if (!lassoState.isActive) {
      return;
    }

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
  };

  const finalizeNodeDrag = () => {
    if (!nodeDragState.isDragging || !nodeDragState.nodeId) {
      return;
    }

    if (dropTargetId) {
      const choice = window.prompt("Connect as: relation or hierarchy?", "relation");
      if (choice && (choice.toLowerCase() === "relation" || choice.toLowerCase() === "hierarchy")) {
        onConnectNodes(nodeDragState.nodeId, dropTargetId, choice.toLowerCase() as "relation" | "hierarchy");
      }
    }

    if (nodeDragState.dragged && nodeDragState.currentPos) {
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
      startClient: { x: 0, y: 0 },
      currentPos: null,
      dragged: false
    });
  };

  useEffect(() => {
    if (!nodeDragState.isDragging) {
      return;
    }

    const getWorldPointFromClient = (clientX: number, clientY: number): { x: number; y: number } | null => {
      const camera = renderRuntimeRef.current.camera;
      const canvas = renderRuntimeRef.current.canvas;

      if (!camera || !canvas) {
        return null;
      }

      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        return null;
      }

      const normalizedX = ((clientX - rect.left) / rect.width) * 2 - 1;
      const normalizedY = -(((clientY - rect.top) / rect.height) * 2 - 1);

      const worldHalfWidth = rect.width / (2 * camera.zoom);
      const worldHalfHeight = rect.height / (2 * camera.zoom);

      const worldX = camera.position.x + normalizedX * worldHalfWidth;
      const worldY = camera.position.y + normalizedY * worldHalfHeight;

      return sanitizeWorldPoint(worldX, worldY);
    };

    const handlePointerMove = (event: PointerEvent) => {
      const current = getWorldPointFromClient(event.clientX, event.clientY);
      if (!current || !nodeDragState.nodeId) {
        return;
      }

      const deltaX = current.x - nodeDragState.startWorld.x;
      const deltaY = current.y - nodeDragState.startWorld.y;
      const nextPos = {
        x: clamp(nodeDragState.startNode.x + deltaX, -MAX_WORLD_COORD, MAX_WORLD_COORD),
        y: clamp(nodeDragState.startNode.y + deltaY, -MAX_WORLD_COORD, MAX_WORLD_COORD)
      };

      setNodeDragState((prev) => ({
        ...prev,
        currentPos: nextPos,
        dragged: prev.dragged || Math.hypot(deltaX, deltaY) > 3
      }));

      setDropTargetId(findDropTarget(nextPos, nodeDragState.nodeId));
    };

    const handlePointerUp = () => {
      finalizeNodeDrag();
    };

    const handleWindowBlur = () => {
      finalizeNodeDrag();
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("blur", handleWindowBlur);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [
    nodeDragState.isDragging,
    nodeDragState.nodeId,
    nodeDragState.startWorld.x,
    nodeDragState.startWorld.y,
    nodeDragState.startNode.x,
    nodeDragState.startNode.y,
    layoutNodesFinal
  ]);

  const handleBackgroundPointerDown = (event: ThreeEvent<PointerEvent>) => {
    if (event.button !== 0) {
      return;
    }

    if (event.shiftKey) {
      event.stopPropagation();
      const start = sanitizeWorldPoint(event.point.x, event.point.y);
      setLassoState({
        isActive: true,
        points: [start]
      });
      setLassoSelectedIds(new Set());
    }
  };

  const handleBackgroundPointerMove = (event: ThreeEvent<PointerEvent>) => {
    if (lassoState.isActive) {
      const next = sanitizeWorldPoint(event.point.x, event.point.y);
      setLassoState((prev) => {
        const last = prev.points[prev.points.length - 1];
        if (last && Math.hypot(next.x - last.x, next.y - last.y) < 2) {
          return prev;
        }
        return { ...prev, points: [...prev.points, next] };
      });
    }
  };

  const handleBackgroundPointerUp = () => {
    finalizeLasso();
  };

  const lassoPoints = useMemo<[number, number, number][]>(() => {
    if (lassoState.points.length < 2) {
      return [];
    }
    const points = lassoState.points.map((point) => [point.x, point.y, 2] as [number, number, number]);
    const first = points[0];
    return [...points, first];
  }, [lassoState.points]);

  return (
    <div className="graph-scene-2d">
      <Canvas
        className="graph-three-canvas"
        orthographic
        camera={{ position: [0, 0, 300], zoom: 1, near: -2000, far: 2000 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        onContextMenu={(event) => event.preventDefault()}
        onPointerMissed={() => {
          if (!nodeDragState.isDragging) {
            onSelectNode("");
            setHoveredNodeId(null);
          }
        }}
      >
        <color attach="background" args={["#000000"]} />
        <RenderRuntimeBridge runtimeRef={renderRuntimeRef} />

        <SceneFitter bounds={bounds} fitViewToken={fitViewToken} />

        <MapControls
          makeDefault
          enabled={!nodeDragState.isDragging && !lassoState.isActive}
          enableRotate={false}
          enableDamping
          dampingFactor={0.08}
          minZoom={0.3}
          maxZoom={4.2}
          zoomSpeed={0.9}
          panSpeed={0.9}
          mouseButtons={{
            LEFT: THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.PAN
          }}
        />

        <mesh
          position={[0, 0, -20]}
          onPointerDown={handleBackgroundPointerDown}
          onPointerMove={handleBackgroundPointerMove}
          onPointerUp={handleBackgroundPointerUp}
        >
          <planeGeometry args={[12000, 12000]} />
          <meshBasicMaterial transparent opacity={0} side={THREE.DoubleSide} />
        </mesh>

        {edgesFinal.map((edge, index) => {
          const isHighlighted = highlightedEdgeKeys.has(edgeKey(edge.source, edge.target));
          const isDimmed = selectedNodeId ? !isHighlighted : false;
          const color = isHighlighted ? "#ffd166" : EDGE_COLORS[edge.edgeType] ?? "#94a3b8";
          const baseOpacity = edge.edgeType === "hierarchy" ? 0.7 : edge.edgeType === "relation" ? 0.45 : 0.35;
          const opacity = isHighlighted ? 0.95 : isDimmed ? Math.max(0.25, baseOpacity * 0.75) : baseOpacity;

          return (
            <group key={`${edge.source}-${edge.target}-${edge.edgeType}-${index}`}>
              <Line
                points={edge.points}
                color={color}
                transparent
                opacity={opacity}
                lineWidth={isHighlighted ? 2.4 : edge.edgeType === "hierarchy" ? 1.8 : 1.2}
                dashed={edge.edgeType === "cross-workspace" && !isHighlighted}
                dashSize={3}
                gapSize={2}
              />
              {isHighlighted && (
                <Line
                  points={edge.points}
                  color="#fff1b8"
                  transparent
                  opacity={0.35}
                  lineWidth={4.6}
                />
              )}
            </group>
          );
        })}

        {lassoPoints.length > 2 && (
          <Line
            points={lassoPoints}
            color="#9d8b5e"
            transparent
            opacity={0.85}
            lineWidth={1.4}
            dashed
            dashSize={4}
            gapSize={3}
          />
        )}

        {layoutNodesFinal.map((node) => {
          const isSelected = node.id === selectedNodeId;
          const isRelated = selectedNodeId ? relatedNodeIds.has(node.id) : true;
          const isDimmed = selectedNodeId ? !isRelated : false;
          const isHovered = hoveredNodeId === node.id;
          const isLassoSelected = lassoSelectedIds.has(node.id);
          const isDropTarget = dropTargetId === node.id;
          const entity = nodeByEntityId.get(node.id);
          const color = nodeColorMap.get(node.id) ?? "#6c757d";
          const radius = isSelected ? node.radius * 1.2 : node.radius;
          const nodeOpacity = isSelected ? 1 : isDimmed ? 0.65 : 0.9;

          return (
            <group key={node.id} position={[node.x, node.y, NODE_Z]}>
              <mesh
                onPointerDown={(event) => {
                  if (event.button !== 0) {
                    return;
                  }
                  event.stopPropagation();
                  const captureTarget = event.target as unknown as {
                    setPointerCapture?: (pointerId: number) => void;
                  };
                  captureTarget.setPointerCapture?.(event.pointerId);
                  setNodeDragState({
                    isDragging: true,
                    nodeId: node.id,
                    startWorld: { x: event.point.x, y: event.point.y },
                    startNode: { x: node.x, y: node.y },
                    startClient: { x: event.nativeEvent.clientX, y: event.nativeEvent.clientY },
                    currentPos: { x: node.x, y: node.y },
                    dragged: false
                  });
                }}
                onPointerMove={(event) => {
                  if (nodeDragState.isDragging && nodeDragState.nodeId === node.id) {
                    event.stopPropagation();
                  }
                }}
                onPointerUp={(event) => {
                  event.stopPropagation();
                  const captureTarget = event.target as unknown as {
                    releasePointerCapture?: (pointerId: number) => void;
                  };
                  captureTarget.releasePointerCapture?.(event.pointerId);
                  const wasClick = nodeDragState.nodeId === node.id && !nodeDragState.dragged;
                  if (wasClick) {
                    onSelectNode(node.id);
                  }
                  finalizeNodeDrag();
                }}
                onPointerOver={(event) => {
                  event.stopPropagation();
                  setHoveredNodeId(node.id);
                }}
                onPointerOut={(event) => {
                  event.stopPropagation();
                  setHoveredNodeId((prev) => (prev === node.id ? null : prev));
                }}
              >
                <circleGeometry args={[radius, 40]} />
                <meshBasicMaterial color={color} transparent opacity={nodeOpacity} />
              </mesh>

              {isSelected && (
                <mesh>
                  <ringGeometry args={[radius + 4, radius + 7, 48]} />
                  <meshBasicMaterial color="#9d8b5e" transparent opacity={0.55} side={THREE.DoubleSide} />
                </mesh>
              )}

              {isLassoSelected && !isSelected && (
                <mesh>
                  <ringGeometry args={[radius + 3, radius + 5, 40]} />
                  <meshBasicMaterial color="#bfa56a" transparent opacity={0.45} side={THREE.DoubleSide} />
                </mesh>
              )}

              {isDropTarget && (
                <mesh>
                  <ringGeometry args={[radius + 6, radius + 9, 40]} />
                  <meshBasicMaterial color="#10b981" transparent opacity={0.55} side={THREE.DoubleSide} />
                </mesh>
              )}

              {(isHovered || (isSelected && selectedNodeTooltip)) && (
                <Html position={[0, radius + 26, 0]} center>
                  <div className="three-tooltip">
                    <div className="three-tooltip-title">
                      {(entity?.title ?? selectedNodeTooltip ?? "Node").length > 20
                        ? `${(entity?.title ?? selectedNodeTooltip ?? "Node").substring(0, 20)}...`
                        : entity?.title ?? selectedNodeTooltip ?? "Node"}
                    </div>
                    <div className="three-tooltip-hint">
                      {entity ? `${entity.type} · ${entity.workspaceId}` : "Click again for details"}
                    </div>
                  </div>
                </Html>
              )}
            </group>
          );
        })}
      </Canvas>

      <div className="graph-controls">
        <div className="control-group">
          <label className="control-label">Depth</label>
          <input
            type="range"
            min="1"
            max="5"
            value={depthLimit}
            onChange={(event) => setDepthLimit(Number(event.target.value))}
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
          className="control-button"
          onClick={() => setFitViewToken((prev) => prev + 1)}
          title="Fit graph to viewport"
        >
          Center View
        </button>
      </div>

      <div className="graph-help">
        <div className="help-item">
          <kbd>Left Click</kbd> Select Node
        </div>
        <div className="help-item">
          <kbd>Left Drag Node</kbd> Move / Connect
        </div>
        <div className="help-item">
          <kbd>Right Drag</kbd> Pan Space
        </div>
        <div className="help-item">
          <kbd>Shift + Drag</kbd> Lasso
        </div>
        <div className="help-item">
          <kbd>Center View</kbd> Fit Graph
        </div>
      </div>
    </div>
  );
}

function SceneFitter({
  bounds,
  fitViewToken
}: {
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  fitViewToken: number;
}) {
  const { camera, size } = useThree();
  const cameraRef = camera as THREE.OrthographicCamera;

  useEffect(() => {
    const width = Math.max(1, bounds.maxX - bounds.minX);
    const height = Math.max(1, bounds.maxY - bounds.minY);

    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;

    const targetWidth = width;
    const targetHeight = height;

    const zoomX = size.width / targetWidth;
    const zoomY = size.height / targetHeight;
    const zoom = Math.max(0.3, Math.min(4.2, Math.min(zoomX, zoomY) * 0.92));

    cameraRef.position.set(centerX, centerY, 300);
    cameraRef.zoom = zoom;
    cameraRef.updateProjectionMatrix();
  }, [bounds, cameraRef, fitViewToken, size.height, size.width]);

  return null;
}

function RenderRuntimeBridge({
  runtimeRef
}: {
  runtimeRef: MutableRefObject<{
    camera: THREE.OrthographicCamera | null;
    canvas: HTMLCanvasElement | null;
  }>;
}) {
  const { camera, gl } = useThree();

  useEffect(() => {
    runtimeRef.current.camera = camera as THREE.OrthographicCamera;
    runtimeRef.current.canvas = gl.domElement;

    return () => {
      runtimeRef.current.camera = null;
      runtimeRef.current.canvas = null;
    };
  }, [camera, gl, runtimeRef]);

  return null;
}

function isPointInPolygon(point: { x: number; y: number }, polygon: Array<{ x: number; y: number }>) {
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
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function sanitizeWorldPoint(x: number, y: number): { x: number; y: number } {
  const safeX = Number.isFinite(x) ? clamp(x, -MAX_WORLD_COORD, MAX_WORLD_COORD) : 0;
  const safeY = Number.isFinite(y) ? clamp(y, -MAX_WORLD_COORD, MAX_WORLD_COORD) : 0;
  return { x: safeX, y: safeY };
}

function edgeKey(source: string, target: string): string {
  return [source, target].sort().join("::");
}
