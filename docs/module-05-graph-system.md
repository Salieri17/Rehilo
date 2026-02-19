# Modulo 5: Graph System (3D)

## Objetivo

Implementar una visualizacion 3D dinamica del grafo con:

- Filtros por workspace, tipo, tags y rango de fechas.
- Highlight de nodo seleccionado, relaciones directas y conexiones por profundidad.
- Interaccion fluida y optimizaciones base de rendimiento.

## Implementación

### UI

- Se creo un frontend React en `apps/web` con Vite.
- Barra superior de filtros (`FilterBar`) con inputs dedicados a cada filtro.
- Panel lateral de inspeccion para nodo seleccionado + leyenda visual.

### Render 3D

- `GraphScene` usa `react-three-fiber` + `drei`.
- Layout force-directed con `d3-force-3d`.
- Actualizacion de posiciones por frame con geometrias reutilizadas.

### Filtros

Aplicados en `filterNodes`:

- `workspaceId`: limita a un workspace o todos.
- `type`: filtra por tipo de nodo.
- `tags`: requiere coincidencia de todos los tags seleccionados.
- `dateFrom/dateTo`: filtra por `createdAt`.

### Highlight

- Nodo seleccionado: color `#ff6b35`.
- Relaciones directas: color `#ffd166`.
- Conexiones de profundidad 2: color `#3a86ff`.

## Archivos clave

- `apps/web/src/components/GraphScene.tsx`
- `apps/web/src/components/FilterBar.tsx`
- `apps/web/src/lib/graph-utils.ts`
- `apps/web/src/data/demoGraph.ts`

## Próximo paso

Conectar el grafo con persistencia real y el `Context Engine` para que el grafo se alimente de nodos creados por el usuario.
