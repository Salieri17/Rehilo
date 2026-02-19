import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { forceCenter, forceLink, forceManyBody, forceSimulation } from "d3-force-3d";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { NodeEntity } from "@rehilo/domain";
import type { GraphEdge } from "../lib/graph-utils";
import "./GraphScene.css";

interface GraphSceneProps {
  nodes: NodeEntity[];
  edges: GraphEdge[];
  selectedNodeId: string;
  onSelectNode: (id: string) => void;
}

type GraphNode = NodeEntity & {
  x?: number;
  y?: number;
  z?: number;
  vx?: number;
  vy?: number;
  vz?: number;
};

type GraphLink = {
  source: string | GraphNode;
  target: string | GraphNode;
};

const NODE_COLORS: Record<string, string> = {
  note: "#6c757d",
  todo: "#e63946",
  project: "#1d3557",
  idea: "#2a9d8f",
  link: "#457b9d",
  event: "#ffb703"
};

const HIGHLIGHT = {
  selected: "#ff6b35",
  direct: "#ffd166",
  depth: "#3a86ff"
};

export default function GraphScene({ nodes, edges, selectedNodeId, onSelectNode }: GraphSceneProps) {
  return (
    <Canvas
      className="graph-canvas"
      camera={{ position: [0, 0, 60], fov: 50 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
    >
      <GraphContent nodes={nodes} edges={edges} selectedNodeId={selectedNodeId} onSelectNode={onSelectNode} />
    </Canvas>
  );
}

function GraphContent({ nodes, edges, selectedNodeId, onSelectNode }: GraphSceneProps) {
  const nodeRefs = useRef<Record<string, THREE.Mesh | null>>({});
  const lineGeometryRef = useRef<THREE.BufferGeometry | null>(null);
  const highlightGeometryRef = useRef<THREE.BufferGeometry | null>(null);

  const simNodes = useMemo<GraphNode[]>(() => {
    return nodes.map((node) => ({
      ...node,
      x: (Math.random() - 0.5) * 30,
      y: (Math.random() - 0.5) * 30,
      z: (Math.random() - 0.5) * 30
    }));
  }, [nodes]);

  const simLinks = useMemo<GraphLink[]>(() => edges.map((edge) => ({ source: edge.source, target: edge.target })), [
    edges
  ]);

  const nodeById = useMemo(() => new Map(simNodes.map((node) => [node.id, node])), [simNodes]);

  const { depthMap, directEdgeSet } = useMemo(() => buildDepthHighlight(selectedNodeId, edges), [
    selectedNodeId,
    edges
  ]);

  const baseEdgeLinks = useMemo(() => edges.filter((edge) => !directEdgeSet.has(edgeKey(edge))), [
    edges,
    directEdgeSet
  ]);
  const directEdgeLinks = useMemo(() => edges.filter((edge) => directEdgeSet.has(edgeKey(edge))), [
    edges,
    directEdgeSet
  ]);

  const baseLinePositions = useMemo(() => new Float32Array(baseEdgeLinks.length * 6), [baseEdgeLinks.length]);
  const highlightLinePositions = useMemo(
    () => new Float32Array(directEdgeLinks.length * 6),
    [directEdgeLinks.length]
  );

  useEffect(() => {
    if (lineGeometryRef.current) {
      lineGeometryRef.current.setAttribute("position", new THREE.BufferAttribute(baseLinePositions, 3));
    }
    if (highlightGeometryRef.current) {
      highlightGeometryRef.current.setAttribute(
        "position",
        new THREE.BufferAttribute(highlightLinePositions, 3)
      );
    }
  }, [baseLinePositions, highlightLinePositions]);

  useEffect(() => {
    if (simNodes.length === 0) {
      return;
    }

    const simulation = forceSimulation(simNodes)
      .force("charge", forceManyBody().strength(-90))
      .force("center", forceCenter(0, 0, 0))
      .force(
        "link",
        forceLink(simLinks)
          .id((node: GraphNode) => node.id)
          .distance(20)
          .strength(0.7)
      )
      .alpha(1)
      .alphaDecay(0.05);

    return () => simulation.stop();
  }, [simNodes, simLinks]);

  useFrame(() => {
    for (const node of simNodes) {
      const mesh = nodeRefs.current[node.id];
      if (mesh && node.x !== undefined && node.y !== undefined && node.z !== undefined) {
        mesh.position.set(node.x, node.y, node.z);
      }
    }

    updateLinePositions(baseEdgeLinks, baseLinePositions, nodeById);
    updateLinePositions(directEdgeLinks, highlightLinePositions, nodeById);

    if (lineGeometryRef.current) {
      lineGeometryRef.current.attributes.position.needsUpdate = true;
    }
    if (highlightGeometryRef.current) {
      highlightGeometryRef.current.attributes.position.needsUpdate = true;
    }
  });

  return (
    <>
      <ambientLight intensity={0.65} />
      <directionalLight position={[20, 20, 20]} intensity={0.85} />
      <OrbitControls enableDamping dampingFactor={0.08} />

      <lineSegments>
        <bufferGeometry ref={lineGeometryRef} />
        <lineBasicMaterial color="#cbd5f5" opacity={0.45} transparent />
      </lineSegments>

      <lineSegments>
        <bufferGeometry ref={highlightGeometryRef} />
        <lineBasicMaterial color={HIGHLIGHT.direct} opacity={0.8} transparent />
      </lineSegments>

      {simNodes.map((node) => {
        const depth = depthMap.get(node.id);
        const isSelected = node.id === selectedNodeId;
        const isDirect = depth === 1;
        const isDepth = depth === 2;
        const baseColor = NODE_COLORS[node.type] ?? "#4b5563";
        const color = isSelected
          ? HIGHLIGHT.selected
          : isDirect
            ? HIGHLIGHT.direct
            : isDepth
              ? HIGHLIGHT.depth
              : baseColor;

        return (
          <mesh
            key={node.id}
            ref={(ref) => {
              nodeRefs.current[node.id] = ref;
            }}
            onPointerDown={() => onSelectNode(node.id)}
          >
            <sphereGeometry args={[0.9, 20, 20]} />
            <meshStandardMaterial color={color} emissive={isSelected ? color : "#000000"} emissiveIntensity={0.35} />
          </mesh>
        );
      })}
    </>
  );
}

function updateLinePositions(
  links: GraphEdge[],
  positions: Float32Array,
  nodeById: Map<string, GraphNode>
) {
  links.forEach((link, index) => {
    const source = nodeById.get(link.source);
    const target = nodeById.get(link.target);

    const offset = index * 6;
    positions[offset] = source?.x ?? 0;
    positions[offset + 1] = source?.y ?? 0;
    positions[offset + 2] = source?.z ?? 0;
    positions[offset + 3] = target?.x ?? 0;
    positions[offset + 4] = target?.y ?? 0;
    positions[offset + 5] = target?.z ?? 0;
  });
}

function buildDepthHighlight(selectedNodeId: string, edges: GraphEdge[]) {
  const depthMap = new Map<string, number>();
  const directEdgeSet = new Set<string>();

  if (!selectedNodeId) {
    return { depthMap, directEdgeSet };
  }

  const adjacency = new Map<string, Set<string>>();
  edges.forEach((edge) => {
    addAdjacency(adjacency, edge.source, edge.target);
    addAdjacency(adjacency, edge.target, edge.source);
  });

  const direct = adjacency.get(selectedNodeId) ?? new Set<string>();
  direct.forEach((neighbor) => depthMap.set(neighbor, 1));

  const depthTwo = new Set<string>();
  direct.forEach((neighbor) => {
    const neighbors = adjacency.get(neighbor) ?? new Set<string>();
    neighbors.forEach((candidate) => {
      if (candidate !== selectedNodeId && !depthMap.has(candidate)) {
        depthMap.set(candidate, 2);
        depthTwo.add(candidate);
      }
    });
  });

  edges.forEach((edge) => {
    if (
      (edge.source === selectedNodeId && direct.has(edge.target)) ||
      (edge.target === selectedNodeId && direct.has(edge.source))
    ) {
      directEdgeSet.add(edgeKey(edge));
    }
  });

  return { depthMap, directEdgeSet };
}

function addAdjacency(map: Map<string, Set<string>>, source: string, target: string) {
  const set = map.get(source) ?? new Set<string>();
  set.add(target);
  map.set(source, set);
}

function edgeKey(edge: GraphEdge): string {
  return [edge.source, edge.target].sort().join("::");
}
