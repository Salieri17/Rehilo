# Módulo 4: Context Engine

## Objetivo

Al abrir un nodo, el sistema debe exponer contexto enriquecido para la UI:

- Relaciones directas.
- Backlinks.
- Nodos con tags compartidos.
- Nodos conectados recientemente.
- Nodo padre.
- Nodos hijos.
- TODOs pendientes dentro del nodo.
- Sugerencias de nodos potencialmente relacionados.

## Implementación

Se agregó `packages/domain/src/context-engine.ts` con:

- `buildNodeContext(nodeId, allNodes, options)`
  - Devuelve `NodeContextView` con todo el contexto necesario por nodo.
  - Aísla el cálculo al `workspaceId` del nodo abierto.

## Campos expuestos en `NodeContextView`

- `directRelations`: targets de `node.relations`.
- `backlinks`: nodos que apuntan al nodo actual.
- `sharedTagNodes`: intersección de tags con el nodo actual.
- `recentlyConnectedNodes`: `directRelations + backlinks` ordenados por `updatedAt` descendente.
- `parentNode`: resuelto por `parentId`.
- `childNodes`: nodos con `parentId = node.id`.
- `pendingTodosInside`: TODOs con `status = pending` dentro del subárbol del nodo.
- `suggestedRelatedNodes`: ranking por similitud semántica.

## Estrategia de sugerencias

Las sugerencias se calculan sobre nodos del mismo workspace que aún no están conectados (excluye nodo actual, directos, backlinks, padre e hijos).

Puntaje:

- Similitud de tags (Jaccard) con peso `0.65`.
- Similitud de keywords título+contenido (Jaccard) con peso `0.35`.

Solo se incluyen sugerencias con coincidencias reales (tags o keywords) y por encima de un umbral configurable (`minSuggestionScore`).

## Resultado

El dominio ya entrega una vista contextual lista para consumo en React al abrir cualquier nodo, cumpliendo la especificación funcional del motor de contexto.
