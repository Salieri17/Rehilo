# Módulo 3A: Hybrid Input Engine (Structured Command Mode)

## Objetivo

Soportar entrada estructurada con formato:

`TYPE/TITLE/ARG1/ARG2/ARG3`

Ejemplos:

- `T/ProjectX/Task1/Task2`
- `N/Research about graph databases`
- `P/ReportingSystem`

## Implementación

Se agregó `packages/domain/src/input-engine.ts` con:

- `parseStructuredCommand(rawInput)`
  - Valida sintaxis.
  - Separa segmentos por `/` (con soporte de escape `\/`).
  - Devuelve resultado tipado éxito/error.

- `mapTypeTokenToNodeType(typeToken)`
  - Alias cortos soportados: `N`, `T`, `P`, `I`, `L`, `E`.
  - Formas largas soportadas: `note`, `todo`, `project`, `idea`, `link`, `event`.

- `structuredCommandToNodeInput(parsed, { workspaceId })`
  - Convierte comando parseado en `CreateNodeInput`.
  - Interpreta argumentos según el tipo.

## Reglas de interpretación por tipo

- `todo` (`T`):
  - `TITLE` -> `title`
  - `ARGn` -> checklist en markdown (`- [ ] ...`) y `metadata.checklist`
  - `status` inicial -> `pending`

- `note` (`N`):
  - `TITLE` -> `title`
  - `ARGn` -> `content` en líneas

- `project` (`P`):
  - `TITLE` -> `title`
  - `ARGn` -> lista de hitos (`metadata.milestones` + bullets)

- `idea` (`I`):
  - `TITLE` -> `title`
  - `ARGn` -> `content`

- `link` (`L`):
  - `TITLE` -> `title`
  - `ARG1` -> `metadata.url`
  - `ARG2+` -> `content`

- `event` (`E`):
  - `TITLE` -> `title`
  - `ARG1` -> `metadata.startAt`
  - `ARG2` -> `metadata.endAt`
  - `ARG3` -> `metadata.location`
  - `ARG4+` -> `content`

## Resultado

El dominio queda preparado para capturar entrada estructurada consistente y convertirla en nodos dentro del `workspaceId` activo.
