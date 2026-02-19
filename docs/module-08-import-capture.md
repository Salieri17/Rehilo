# Modulo 8: Import & Capture

## Objetivo

- Pegar URL -> crear nodo link automatico.
- Importar archivos .txt.
- Dialogo de captura rapida con atajo de teclado.
- Arquitectura extensible para futura extension de navegador.
- Feedback visual con toast y panel de historial de capturas.

## Implementacion

### Quick capture

- Dialogo en `CaptureDialog`.
- Atajo: Ctrl/Cmd + Shift + K.
- Soporta texto libre o URLs.
- Toast de confirmacion al guardar.
- Historial visible en el panel lateral.

### Auto URL capture

- Listener global de paste cuando no estas escribiendo en inputs.
- Si el contenido es URL, se crea un nodo link.

### Import .txt

- Input de archivo en el dialogo de captura.
- Se crea un nodo note con el nombre del archivo y su contenido.

### Extension futura

- `capture-events.ts` escucha `window.dispatchEvent(new CustomEvent("rehilo:capture", { detail }))`.
- Soporta mensajes `postMessage` con `source: "rehilo-extension"`.

## Archivos clave

- `apps/web/src/components/CaptureDialog.tsx`
- `apps/web/src/lib/capture-events.ts`
- `apps/web/src/lib/capture-utils.ts`
- `apps/web/src/App.tsx`
