# Contextual Node Mode

## Overview

**Contextual Node Mode** transforms the graph visualization into a spatial cognitive space centered around a selected node. Instead of navigating through pages or menus, you "step into" an idea's ecosystem.

## Activation

- **Double-click any node** to enter Contextual Mode
- Or click the **"Enter Context"** button in the controls panel
- **Exit** by clicking "Exit Context" button or pressing **Escape**

## Spatial Layout (5 Zones)

When in Contextual Mode, the graph reorganizes into distinct spatial zones:

### Zone 1: Center — Active Node
- **Position**: Origin (0, 0)
- **Scale**: 1.6× (60% larger)
- **Purpose**: The node you're currently exploring
- **Interaction**: Quick actions appear for adding children, relations, or workspace links

### Zone 2: Above — Parent Node
- **Position**: Directly above center (-180px Y)
- **Scale**: 0.85× (reduced size)
- **Opacity**: 75%
- **Purpose**: Shows hierarchical context (where this idea came from)
- **Interaction**: Click to navigate up the hierarchy smoothly

### Zone 3: Below — Children Nodes
- **Position**: Structured branching below center (+180px Y, horizontal spread)
- **Scale**: 1.0× (standard size)
- **Opacity**: 85%
- **Purpose**: Direct descendants of the active node
- **Interaction**: Click to navigate down into child ideas

### Zone 4: Around — Related Nodes
- **Position**: Radial arc (45° to 315°, 280px distance)
- **Scale**: 0.7× (smaller)
- **Opacity**: 65%
- **Purpose**: Non-hierarchical connections (lateral relations)
- **Interaction**: Click to select, double-click to re-center

### Zone 5: Peripheral — Cross-Workspace Links
- **Position**: Far left/right edges (±400px X, stacked vertically)
- **Scale**: 0.7× (smaller)
- **Opacity**: 65%
- **Purpose**: Connections to nodes in other workspaces
- **Interaction**: Click to navigate across workspace boundaries

## Visual Design

### Smooth Transitions
- **Duration**: 400ms ease-in-out animation
- **Properties**: Simultaneous zoom (1.0 → 1.4×) + pan to center + layout reorganization
- **Feel**: Organic spatial transformation, not a page change

### Depth Hierarchy
- Parent nodes appear visually "above" (reduced scale + opacity)
- Children appear "below" (standard prominence)
- Relations appear "around" (subtle presence)
- Creates a sense of walking through layers of thought

### Color Coding
Maintained from exploration mode:
- **Hierarchy roots**: Brown (`#cbb36a`)
- **Deeper levels**: Gradient to green (`#9bb86a` → `#4a824f`)
- **Non-hierarchical**: Neutral green (`#5f7f63`)

## Breadcrumb Navigation

When in Contextual Mode, a breadcrumb path appears at the top:

```
Path: Workspace › Root Node › Parent › Current Node
```

- **Click any item** to navigate directly to that level
- **Active item** is highlighted in accent color
- **Truncated titles** (max 20 chars) with hover tooltip for full text

## Quick Actions

Contextual Mode presents inline actions (no toolbars):

- **+ Child**: Create a new child node under the current node
- **↔ Relate**: Create a lateral relation to another node
- **⚡ Link WS**: Connect to a node in another workspace

These appear as a centered action bar near the bottom of the viewport.

## Bi-Directional Navigation

### In Contextual Mode:
- **Click parent** → Smooth re-center on parent (walk up)
- **Click child** → Smooth re-center on child (walk down)
- **Click relation** → Select node (remains in current context)
- **Double-click relation** → Re-center on that node

### In Exploration Mode:
- **Single click** → Select node (focus animation)
- **Double-click** → Enter Contextual Mode

## Technical Implementation

### Layout Algorithm
- **File**: `apps/web/src/lib/graph-layout-2d.ts`
- **Method**: `layoutContextual(nodes, edges, selectedNodeId)`
- **Logic**: Deterministic positioning (no physics simulation)

### View State
- **Mode toggle**: `"exploration"` | `"contextual"`
- **Zoom shift**: Exploration (1.0×) → Contextual (1.4×)
- **Pan**: Always centered on selected node

### Performance
- **Node count**: Optimized for 20-200 nodes per view
- **Animation**: RAF-based (60fps target)
- **Transitions**: CSS + JS combined for smooth spatial morph

## Design Philosophy

> "Selecting a node should feel like stepping into that idea's ecosystem — not opening a modal, not switching pages, but entering a cognitive space where everything related is spatially organized around what matters right now."

This aligns with Rehilo's **Garden of Ideas** metaphor:
- Walking up to a plant (node) to examine it closely
- Seeing its roots (parent), branches (children), and surrounding flora (relations)
- Moving through the garden naturally, not jumping between isolated views

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| **Double-click** | Enter/navigate Contextual Mode |
| **Escape** | Exit Contextual Mode |
| **←→↑↓** | Pan view (works in both modes) |
| **+/-** | Zoom in/out |
| **R** | Reset view to exploration mode |

## Future Enhancements

- [ ] Multi-select in Contextual Mode (Shift+Click)
- [ ] Quick create from zones (click empty space to add node there)
- [ ] Contextual edge creation (drag from action buttons)
- [ ] Workspace preview on peripheral nodes (hover tooltip)
- [ ] Animation presets (speed/easing preferences)
- [ ] Gestures for touch devices (pinch to zoom, swipe to navigate)

---

**Status**: ✅ Implemented (v0.1.0)  
**Author**: Rehilo Team  
**Last Updated**: 2024
