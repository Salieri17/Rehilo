# Módulo 3B: Hybrid Input Engine (Natural Language Mode)

## Objetivo

Detectar y parsear automáticamente entrada natural para enriquecer nodos y relaciones:

- `[[NodeName]]` → create or link to node.
- `#tag` → asignar tag.
- Fechas (`25/02/2026`, `tomorrow`, `next week`) → metadata.
- URLs → crear nodo link secundario o adjuntar referencia.
- Frases tipo `before DATE` → metadata de vencimiento (`dueDate`).
- Permitir mezcla con comandos estructurados.

## Implementación

Se agregó `packages/domain/src/natural-language.ts` con:

- `parseNaturalLanguage(input, options)`
  - Extrae `mentions`, `tags`, `dates`, `dueDateIso`, `urls`, `linkIntents`.

- `parseHybridInput(rawInput, options)`
  - Si detecta sintaxis estructurada válida, usa parser de módulo 3A y luego enriquece con señales naturales.
  - Si no es estructurado, genera nodo principal natural (default `note`) y secundarios derivados.

## Reglas clave

### `[[NodeName]]`

- Se detecta con regex y se generan `linkIntents` con estrategia `create-or-link`.
- También se generan nodos secundarios candidatos para creación cuando no exista destino.

### `#tag`

- Se detectan tags alfanuméricos (`#research`, `#q1-plan`) y se integran con los tags existentes.

### Fechas

- Explícitas con formato `dd/mm/yyyy`.
- Relativas: `tomorrow`, `next week`.
- Se almacenan en `metadata.detectedDates`.

### `before DATE`

- Se detecta la expresión posterior a `before`.
- Si se puede parsear, se guarda en `metadata.dueDate` en formato ISO (`yyyy-mm-dd`).

### URLs

- Se detectan URLs HTTP/HTTPS.
- Se agregan como `metadata.urls`.
- Se generan nodos secundarios tipo `link` con `metadata.url`.

## Input mixto (structured + natural)

`parseHybridInput` combina ambos modos en una sola salida:

- `primary`: `CreateNodeInput` final enriquecido.
- `secondary`: nodos secundarios sugeridos (mentions/urls).
- `mode`: `structured` o `natural`.

Esto permite que entradas como:

`T/ProjectX/Task1 before tomorrow #urgent [[OpsBoard]] https://status.example.com`

sean interpretadas simultáneamente como comando estructurado y señales naturales.
