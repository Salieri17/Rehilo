# Modulo 6: Dashboard System

## Objetivo

Agregar un layout configurable con widgets movibles y vistas multiples:

- Dashboard view
- List view
- Graph view
- Node detail view

El layout se guarda por workspace.

## Implementacion

### Layout persistente por workspace

- `layout-store.ts` guarda el orden y el tamanio de widgets en `localStorage`.
- La clave usa `rehilo:layout:{workspaceId}`.

### Drag and drop

- `DashboardView` permite reordenar widgets con HTML5 drag and drop.
- En modo edicion se permite cambiar el `span` de los widgets.

### Vistas

- `DashboardView`: resumen, pendientes, recientes, tags.
- `ListView`: tabla de nodos.
- `GraphView`: vista 3D existente.
- `NodeDetailView`: detalle simple del nodo seleccionado.

## Archivos clave

- `apps/web/src/components/dashboard/DashboardView.tsx`
- `apps/web/src/components/ListView.tsx`
- `apps/web/src/components/NodeDetailView.tsx`
- `apps/web/src/lib/layout-store.ts`
