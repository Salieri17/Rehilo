# Módulo 2: Workspaces

## Objetivo

Soportar múltiples workspaces independientes donde cada workspace contiene:

- Sus propios nodos.
- Sus propias relaciones.
- Su propia configuración de layout.
- Su propio estado de grafo.

## Implementación en dominio

### 1) Entidad Workspace

Definida en `packages/domain/src/workspace.ts` mediante `WorkspaceEntity`.

Campos principales:

- `id`
- `name`
- `layoutConfig`
- `graphState`
- `metadata`
- `createdAt`
- `updatedAt`

### 2) Layout por workspace

`WorkspaceLayoutConfig` encapsula preferencias visuales por espacio:

- `mode` (`list`, `kanban`, `graph` o extensible)
- `nodePositions`
- `pinnedNodeIds`
- `metadata`

### 3) Graph state por workspace

`WorkspaceGraphState` guarda estado UI/graph aislado:

- `selectedNodeIds`
- `focusedNodeId`
- `expandedNodeIds`
- `viewport` (`x`, `y`, `zoom`)
- `metadata`

### 4) Aislamiento de nodos y relaciones

La entidad `NodeEntity` ya contiene `workspaceId` obligatorio.

Por contrato, cualquier relación de un nodo (`relations`) referencia nodos del mismo `workspaceId`, lo que garantiza independencia lógica entre workspaces.

### 5) Repositorio de workspaces

Se agregó `WorkspaceRepository` en `packages/domain/src/repository.ts` para CRUD de workspaces:

- `list`
- `getById`
- `save`
- `update`
- `remove`

## Resultado

El dominio ya permite modelar múltiples espacios de trabajo completamente independientes, preparado para las siguientes capas:

- Persistencia local offline-first.
- Sincronización remota opcional por workspace.
- UI React con selector de workspace y vistas aisladas.
