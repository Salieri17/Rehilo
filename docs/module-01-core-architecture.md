# Módulo 1: Core Architecture + Data Model

## Filosofía base

- Todo es un `Node`.
- Los `Node` se relacionan entre sí (many-to-many).
- Se permite jerarquía opcional por `parentId`.
- El sistema debe operar offline-first y sincronizar cuando haya conectividad.
- Se soportan múltiples workspaces independientes.

## Modelo principal

La entidad central es `Node`, definida en `packages/domain/src/node.ts`.

Campos incluidos:

- `id`
- `workspaceId`
- `type`
- `title`
- `content` (markdown liviano soportado a nivel de UI/render)
- `tags`
- `relations`
- `parentId` (opcional)
- `metadata` (JSON flexible)
- `createdAt`
- `updatedAt`
- `status` (aplicable a TODOs)

## Decisiones de arquitectura

1. **Dominio compartido** (`packages/domain`)
   - Evita duplicación entre frontend y API.
   - Define tipos y contratos de persistencia/sync.

2. **API opcional y desacoplada** (`apps/api`)
   - Permite iniciar offline con almacenamiento local.
   - La sincronización se conecta cuando esté disponible.

3. **Frontend React como cliente principal** (`apps/web`)
   - Orquesta comando estructurado + lenguaje natural.
   - Consume repositorio local y adaptador de sincronización.

## Contratos definidos

En `packages/domain/src/repository.ts`:

- `NodeRepository`: CRUD + queries por workspace.
- `SyncAdapter`: push/pull de cambios entre cliente y backend.
- `SyncResult`: reporte de sincronización por timestamps.

Esto permite implementar distintas estrategias en módulos siguientes:

- Repositorio local con IndexedDB.
- API REST para sync remoto.
- Resolución de conflictos por `updatedAt` o reglas más avanzadas.
