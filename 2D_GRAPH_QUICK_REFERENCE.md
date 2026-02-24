# 2D Graph System - Quick Reference & Extension Guide

## Quick Start for Users

### Opening the Graph

1. Click "Graph" tab in view switcher (top navigation)
2. Vite will load the 2D graph visualization
3. Demo data automatically populates

### Using the Graph

**Select a Node**
- Click any node (circle) in the graph
- Node becomes center with amber glow
- Parent appears above, children below
- Relationships appear around it

**Control Depth**
- Use slider bottom-left: "Depth: [===●===] 3"
- Range: 1-5 levels of hierarchy
- Graph updates instantly
- Lower depth = cleaner view, less data

**Toggle Relations**
- Click button: "Relations: On/Off"
- Shows/hides connection edges
- Hierarchy always visible
- Useful for focusing on parent-child only

**Zoom & Pan**
- Scroll wheel to zoom in/out
- View auto-fits to graph bounds
- Smooth animation (no jumpiness)

**Read the Legend**
- Top-right corner shows edge types:
  - ━━━ Hierarchy (solid violet lines)
  - ~~~ Relations (curved gray lines)
  - ... Cross-WS (dashed green lines)

## Quick Reference for Developers

### Using the Layout Engine

```typescript
import { Graph2DLayout, type LayoutNode, type LayoutEdge } from "../lib/graph-layout-2d";

const layoutEngine = new Graph2DLayout({
  hierarchyVerticalGap: 140,      // Adjust spacing
  childHorizontalSpacing: 120,
  relationRadialDistance: 220,
  minNodeDistance: 80,
  nodeRadius: 28
});

const { nodes, edges } = layoutEngine.layout(
  nodeEntities,           // NodeEntity[]
  graphEdges,            // GraphEdge[]
  selectedNodeId,        // string
  depthLimit             // number (1-5)
);
```

### Customizing Node Appearance

**Location**: `GraphScene2D.tsx` around line 200

```typescript
const color = nodeColorMap.get(node.id) ?? "#6c757d";

return (
  <circle
    cx={node.x}
    cy={node.y}
    r={node.radius}
    fill={color}
    opacity={0.9}
    // Modify these for different appearance:
    // - fill: change node color
    // - r: change node size
    // - opacity: change transparency
    // - filter: change shadow effect
  />
);
```

### Adding Node Labels

**After**: Existing SVG nodes (line ~250)

```jsx
{/* Node labels - optional */}
{layout.nodes.map((node) => {
  const nodeData = nodes.find(n => n.id === node.id);
  if (!nodeData) return null;
  
  return (
    <text
      key={`label-${node.id}`}
      x={node.x}
      y={node.y}
      textAnchor="middle"
      dominantBaseline="central"
      fontSize="11"
      fill="var(--text-secondary)"
      className="node-label"
      pointerEvents="none"
    >
      {nodeData.title}
    </text>
  );
})}
```

### Changing Edge Colors

**Colors** in `GraphScene2D.tsx` (line ~170):

```typescript
const lineColor =
  edge.edgeType === "hierarchy"
    ? "#8b5cf6"           // Change hierarchy color
    : edge.edgeType === "relation"
      ? "#94a3b8"         // Change relation color
      : "#10b981";         // Change cross-workspace color
```

**Use design tokens instead**:

```typescript
const lineColor = edge.edgeType === "hierarchy"
  ? "var(--accent-hierarchy, #8b5cf6)"
  : edge.edgeType === "relation"
    ? "var(--accent-relation, #94a3b8)"
    : "var(--accent-cross-workspace, #10b981)";
```

### Customizing Animations

**Location**: `GraphScene2D.css`

**All animations use cubic-bezier easing** (no bounce):

```css
/* Change animation speed */
.control-button {
  transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1);
  /* Adjust 150ms to change speed */
  /* Adjust cubic-bezier to change easing */
}

/* Modify node glow pulse */
@keyframes nodeGlow {
  0%, 100% {
    r: calc(28px + 4px);     /* Starting size */
    opacity: 0.4;
  }
  50% {
    r: calc(28px + 8px);     /* Maximum size */
    opacity: 0.2;
  }
}
```

### Automatic Zoom Fitting

**Location**: `GraphScene2D.tsx` useEffect (line ~120)

```typescript
const bounds = useMemo(() => {
  // ... calculate bounds ...
  const padding = 80;  // Change to adjust padding around graph
  return { minX, minY, maxX, maxY };
}, [layout.nodes]);
```

## Common Tasks

### Task: Make Graph Show More Nodes at Default

In `App.tsx` where `GraphScene2D` is used:

```typescript
// Change initial depth limit
const [depthLimit, setDepthLimit] = useState(5);  // Was 3
```

### Task: Change Default Zoom Behavior

In `GraphScene2D.tsx` useEffect for auto-zoom:

```typescript
const zoom = Math.min(zoomX, zoomY, 3);  // Increase 2 to 3
setViewState((prev) => ({
  ...prev,
  zoom: zoom * 0.95,      // Adjust multiplier (0.9 = more zoom out)
}));
```

### Task: Modify Hierarchy Spacing

In `GraphScene2D.tsx` layout initialization:

```typescript
const layoutEngine = new Graph2DLayout({
  hierarchyVerticalGap: 160,       // Increase for more space
  childHorizontalSpacing: 140,     // Increase for wider spread
  relationRadialDistance: 250,     // Increase for farther relations
  // ... rest ...
});
```

### Task: Add Node Type Filtering

In `GraphScene2D.tsx` before rendering:

```typescript
const filteredNodes = layout.nodes.filter((node) => {
  const nodeData = nodes.find(n => n.id === node.id);
  return nodeData?.type === "idea";  // Only show ideas
});
```

### Task: Highlight Specific Node Type

Modify node rendering in `GraphScene2D.tsx`:

```typescript
const isHighlighted = nodeData?.type === "task";

return (
  <circle
    // ... existing props ...
    opacity={isHighlighted ? 1.0 : 0.7}
    r={node.radius * (isHighlighted ? 1.2 : 1)}
  />
);
```

### Task: Add Node Hover Effects

In `GraphScene2D.css`:

```css
.node-circle:hover {
  filter: drop-shadow(0 6px 16px rgba(0, 0, 0, 0.5))
          brightness(1.2);  /* Brighten on hover */
  opacity: 1 !important;
}
```

### Task: Show/Hide Specific Edge Types

In `GraphScene2D.tsx` edge filtering:

```typescript
const filteredEdges = useMemo(() => {
  let edges = layout.edges;
  
  if (!showRelations) {
    edges = edges.filter(e => e.edgeType === "hierarchy");
  }
  
  // Add more filters:
  // edges = edges.filter(e => e.edgeType !== "cross-workspace");
  
  return edges;
}, [layout.edges, showRelations]);
```

## Troubleshooting

### Graph Not Appearing

**Check**:
1. Browser console for errors (F12)
2. Vite dev server running on 5174
3. React dev tools shows GraphScene2D mounted
4. `selectedNodeId` is valid (not empty)

**Fix**:
```typescript
// In App.tsx, ensure selectedNodeId has a value
const [selectedNodeId, setSelectedNodeId] = useState("node-1");  // Not empty
```

### Nodes Overlapping

**Cause**: `minNodeDistance` too small or `nodeRadius` too large

**Fix** in `GraphScene2D.tsx`:
```typescript
const layoutEngine = new Graph2DLayout({
  minNodeDistance: 100,    // Increase from 80
  nodeRadius: 24,          // Decrease from 28
  // ... rest ...
});
```

### Graph Too Zoomed In/Out

**Cause**: Bounds calculation or zoom formula incorrect

**Fix**:
1. Check `hierarchyVerticalGap` (increase = more spacing)
2. Adjust padding in bounds calculation
3. Change zoom multiplier (0.9 vs 0.95)

### Animations Not Smooth

**Cause**: CSS easing curve of JavaScript animation

**Check**:
```typescript
// Ensure useEffect dependencies are correct
const layout = useMemo(() => {
  // ... should recompute when needed
}, [nodes, edges, selectedNodeId, depthLimit]);  // All deps here
```

### Controls Not Responding

**Check in Console**:
```javascript
// Verify state updates
const [depthLimit, setDepthLimit] = useState(3);
// Check if setDepthLimit is called
```

## Performance Optimization Tips

### For Large Graphs (1000+ nodes)

1. **Lower default depth**:
   ```typescript
   const [depthLimit, setDepthLimit] = useState(2);
   ```

2. **Disable animations**:
   ```css
   /* In GraphScene2D.css */
   .graph-node {
     transition: none;  /* Remove transition */
   }
   ```

3. **Simplify shadows**:
   ```css
   .node-circle {
     filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2));
   }
   ```

4. **Memoize node colors**:
   - Already done in `GraphScene2D.tsx`
   - Prevents recalculation

### For Mobile Devices

1. **Reduce animation duration**:
   ```css
   --duration-medium: 150ms;  /* Reduce from 300ms */
   ```

2. **Simplify visuals**:
   - Remove glow animation
   - Reduce shadow complexity

3. **Use CSS containment**:
   ```css
   .graph-svg {
     contain: layout style paint;
   }
   ```

## Testing the Graph

### Manual Test Checklist

- [ ] Select different nodes - all center correctly
- [ ] Adjust depth slider - graph updates smoothly
- [ ] Toggle relations - edges appear/disappear
- [ ] Zoom in/out - smooth and responsive
- [ ] Check mobile - controls stack vertically
- [ ] No console errors - check developer tools
- [ ] Legend visible - shows all edge types
- [ ] Node colors - match node types
- [ ] Selected node glow - visible and distinctive
- [ ] Animations - smooth (no jumps or bounce)

### Browser DevTools Tips

```javascript
// In console, test the layout engine:
import { Graph2DLayout } from './lib/graph-layout-2d.ts';

const layout = new Graph2DLayout();
const result = layout.layout(nodes, edges, selectedId, 3);
console.log(result);  // See layout output
```

## Contributing

### Adding Features

1. **New layout algorithm**:
   - Create new class in `graph-layout-2d.ts`
   - Implement same `layout()` interface
   - Test with demo nodes

2. **New UI control**:
   - Add to controls div in `GraphScene2D.tsx`
   - Style in `GraphScene2D.css`
   - Add state variable

3. **New animation**:
   - Add keyframes to `GraphScene2D.css`
   - Reference from component
   - Test animation smoothness

### Code Standards

- Use TypeScript (strict mode)
- Export interfaces for external use
- Add JSDoc comments for public APIs
- Test on Chrome, Firefox, Safari
- Verify mobile responsive
- Check CSS design token usage

## File Structure Reference

```
apps/web/src/
├── components/
│   ├── GraphScene2D.tsx      (Main component - 280 lines)
│   ├── GraphScene2D.css      (Styling - 250+ lines)
│   ├── GraphScene.tsx        (Old 3D - deprecate)
│   └── App.tsx               (Updated imports)
│
├── lib/
│   ├── graph-layout-2d.ts    (Layout engine - 247 lines)
│   ├── graph-utils.ts        (Edge building - unchanged)
│   └── ... other utilities
│
└── styles/
    └── design-tokens.css     (Color/motion vars)
```

## Version History

### v1.0.0 (2D Restructure)
- [x] SVG-based rendering (replace Three.js)
- [x] Hierarchical tree layout
- [x] Radial relation placement
- [x] Depth control system
- [x] Zoom/pan interaction
- [x] Design system integration
- [x] Mobile responsiveness
- [x] TypeScript validation
- [x] Production build passing

**Status**: ✅ Complete & Live

