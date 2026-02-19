# Modulo 7: Offline-First Design

## Objetivo

- Persistencia local en IndexedDB.
- Aplicacion funcional sin conexion.
- Sync en background cuando hay internet.
- Auth basica para sync cross-device.
- Estrategia de resolucion de conflictos.

## IndexedDB

- `offline-db.ts` inicializa la base `rehilo-db`.
- `offline-repository.ts` implementa un repositorio local (CRUD).
- Se incluye `seedIfEmpty` para poblar demo en primer arranque.

## Sync

### Cliente (web)

- `sync-service.ts` hace push/pull con `Basic Auth`.
- Se guarda `lastSync` por workspace en `localStorage`.
- Se ejecuta cada 30s y al recuperar conexion (`online`).

### Servidor (api)

- API Express en `apps/api` con endpoints:
  - `GET /sync/pull?workspaceId&since`
  - `POST /sync/push`
- Auth basica usando `REHILO_USER` y `REHILO_PASS`.

## Resolucion de conflictos

- Estrategia **last-write-wins** por `updatedAt`.
- Si timestamps empatan, gana el cambio remoto.

## Archivos clave

- `apps/web/src/lib/offline-db.ts`
- `apps/web/src/lib/offline-repository.ts`
- `apps/web/src/lib/sync-service.ts`
- `apps/api/src/index.js`
- `apps/api/src/storage.js`
- `apps/api/src/auth.js`
