# Rehilo

Sistema de conocimiento relacional orientado a comandos.

## Estado actual

Se implementó el **Módulo 1 (Core Architecture + Data Model)**:

- Estructura base monorepo (`apps` + `packages`).
- Modelo de dominio compartido para `Node`.
- Contratos de repositorio y sincronización offline-first.
- Documentación inicial de arquitectura.

Se implementó el **Módulo 2 (Workspaces)**:

- Entidad `Workspace` con `layoutConfig` propio.
- Estado de grafo por workspace (`graphState`).
- Contrato de repositorio para workspaces independientes.
- Aislamiento de nodos y relaciones por `workspaceId`.

Se implementó el **Módulo 3A (Hybrid Input Engine - Structured Command Mode)**:

- Parser para sintaxis `TYPE/TITLE/ARG1/...`.
- Mapeo de `TYPE` corto y largo a `node type`.
- Interpretación de argumentos según tipo (`todo`, `note`, `project`, `idea`, `link`, `event`).

Se implementó el **Módulo 3B (Hybrid Input Engine - Natural Language Mode)**:

- Detección de `[[NodeName]]` para intención de create/link.
- Detección de `#tag` para asignación de tags.
- Detección de fechas (`25/02/2026`, `tomorrow`, `next week`) como metadata.
- Detección de URLs para crear nodos link secundarios o adjuntar referencia.
- Detección de frases `before DATE` para `dueDate` en metadata.
- Soporte de input mixto estructurado + natural con `parseHybridInput`.

Se implementó el **Módulo 5 (Graph System 3D)**:

- Visualización 3D dinámica con `react-three-fiber`.
- Filtros por workspace, tipo, tags y rango de fechas.
- Highlight de nodo seleccionado, relaciones directas y conexiones por profundidad.
- Dataset demo local para pruebas.

Se implementó el **Modulo 6 (Dashboard System)**:

- Layout configurable con widgets movibles.
- Vistas: dashboard, list, graph y node detail.
- Layout guardado por workspace (localStorage).

Se implemento el **Modulo 7 (Offline-First Design)**:

- Persistencia local con IndexedDB (idb).
- Funcionamiento offline con repositorio local.
- Sync en background cuando hay conexion.
- Auth basica para sync entre dispositivos.
- Estrategia de resolucion de conflictos (last-write-wins).

Se implemento el **Modulo 8 (Import & Capture)**:

- Pegar URL crea nodo link automaticamente.
- Importa archivos .txt como notas.
- Dialogo de captura rapida con atajo de teclado.
- Arquitectura extensible para futura extension de navegador.

Se implementó el **Módulo 4 (Context Engine)**:

- Cálculo de relaciones directas y backlinks al abrir un nodo.
- Descubrimiento de nodos con tags compartidos y conexiones recientes.
- Soporte de jerarquía (`parentNode`, `childNodes`) y TODOs pendientes descendientes.
- Sugerencias de nodos potencialmente relacionados por similitud de tags y keywords.

## Estructura

```text
apps/
  web/      # Frontend React con grafo 3D (demo local)
  api/      # Backend API opcional (pendiente de implementación en módulos siguientes)
packages/
  domain/   # Tipos y contratos compartidos del dominio
docs/
  module-01-core-architecture.md
  module-02-workspaces.md
  module-03a-hybrid-input-structured.md
  module-03b-hybrid-input-natural.md
  module-04-context-engine.md
  module-05-graph-system.md
  module-06-dashboard-system.md
  module-07-offline-first.md
  module-08-import-capture.md
```

## Próximo paso recomendado

Conectar `Context Engine` + `Hybrid Input Engine` en la UI React para probar flujo completo de creación y navegación.




