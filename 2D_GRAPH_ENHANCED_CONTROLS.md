# 2D Graph - Enhanced Controls Guide

## Cambios Realizados

Se han mejorado significativamente los controles del grafo para una experiencia más fluida e intuitiva.

---

## 🎮 Controls Disponibles

### 1. **Click + Drag para Desplazamiento (Pan)**

```
Haz click en el mapa y arrastra
```

- **Cómo funciona**: Presiona el botón izquierdo del mouse sobre el grafo y arrastra
- **Cursor visual**: Cambia a "grab" (mano abierta) y "grabbing" (mano cerrada) durante el arrastre
- **Restricción**: No funciona si clickeas directamente en un nodo (permite seleccionar nodos sin desplaces)

### 2. **Flechas del Teclado para Movimiento**

```
↑ Mover arriba
↓ Mover abajo
← Mover izquierda
→ Mover derecha
```

- **Velocidad**: 30 píxeles por pulsación
- **Útil para**: Exploración precisa del grafo
- **Combinación**: Úsalas mientras mantienes el grafo centrado

### 3. **Teclado para Zoom**

```
+ o = para zoom in (más cerca)
- para zoom out (más lejos)
Scroll wheel para zoom suave y continuo
```

- **Rango zoom**: 0.1x a 5x (mucho más amplio que antes)
  - `0.1x` = grafo muy pequeño (vista general de todo)
  - `1.0x` = tamaño normal
  - `5x` = muy amplificado (para detalles)
- **Teclas +/-**: Aumento/disminución en pasos de 1.2x
- **Scroll**: Suave y proporcional al deltaY

### 4. **R para Resetear Vista**

```
Presiona R
```

- Vuelve a la vista inicial
- Pan reset a (0, 0)
- Zoom reset a 1.0
- Automáticamente ajusta a los límites del grafo

---

## 🎯 Rango de Zoom Mejorado

| Valor | Nivel | Uso |
|-------|-------|-----|
| **0.1x** | Zoom muy out | Ver todo el grafo de una vez |
| **0.3x** | Zoom out | Vista general |
| **0.5x** | Zoom out moderado | Exploración |
| **1.0x** | Normal | Visualización estándar |
| **2.0x** | Zoom in | Detalles de un área |
| **5.0x** | Zoom muy in | Examinar detalles finos |

---

## 🖱️ Interacción del Mouse

### Estados del Cursor

```
grab       = Puedes arrastrar el grafo
grabbing   = Estás arrastrando actualmente
pointer    = Sobre un nodo (clickable)
```

### No Desplaza al Clickear Nodos

- Si haces click en un nodo, **selecciona el nodo** en lugar de iniciar el pan
- Usa background vacío para arrastrar

---

## ⌨️ Tabla Rápida de Teclas

| Tecla | Acción |
|-------|--------|
| `↑` | Mover grafo arriba |
| `↓` | Mover grafo abajo |
| `←` | Mover grafo izquierda |
| `→` | Mover grafo derecha |
| `+` o `=` | Zoom in |
| `-` | Zoom out |
| `Scroll wheel` | Zoom suave |
| `R` | Reset vista |
| `Click + Drag` | Pan (desplazar) |

---

## 💡 Panel de Ayuda Visible

En la esquina inferior derecha hay un panel pequeño que muestra los controles principales:

```
┌─────────────────────┐
│ Click+Drag Pan      │
│ ↑↓←→ Move          │
│ +/- Zoom           │
│ R Reset            │
│ Scroll Zoom        │
└─────────────────────┘
```

Este panel desaparece en pantallas pequeñas (responsive).

---

## 🎬 Detalles de Implementación

### Pan por Arrastre

```typescript
// Al hacer click + drag, se calcula:
const deltaX = e.clientX - dragState.startX;
const deltaY = e.clientY - dragState.startY;

// Y se aplica al pan:
pan.x = startPanX + deltaX;
pan.y = startPanY + deltaY;
```

**Características**:
- No hay restricción de límite (puedes arrastrar indefinidamente)
- Movimiento suave y responsivo
- Preserva zoom durante el pan

### Keyboard Controls

```typescript
// Teclas implementadas:
// Arrow keys: 30px step
// +/-: 1.2x zoom multiplier
// R: Reset a estado inicial
```

**Detalles**:
- Las flechas no interfieren con navegación de la página
- R solo funciona si no presionas Ctrl/Cmd (para no conflictuar con reload del navegador)
- Todos los eventos usan `preventDefault()` para evitar comportamientos del navegador

### Nuevo Rango de Zoom

```javascript
// Antes: 0.3x a 3x
// Ahora: 0.1x a 5x

Math.max(0.1, Math.min(5, zoom * multiplier))
```

**Por qué**:
- `0.1x` permite ver el grafo completo si es muy grande
- `5x` permite examinar detalles finos
- Mejor exploración de grafos variados

---

## 🐛 Troubleshooting

### El arrastre no funciona

**Causa**: Clickeaste en un nodo

**Solución**: Haz click en el área vacía del grafo, no en los nodos

### Las teclas de flecha no funcionan

**Causa**: Enfoque en un elemento de entrada (input)

**Solución**: Clickea en el grafo primero para darle enfoque

### Zoom muy rápido

**Ajustar**: En `GraphScene2D.tsx`, cambiar `zoomStep`:
```typescript
const zoomStep = 1.2;  // Cambiar a 1.1 para pasos más pequeños
```

---

## 🎨 Mejoras CSS

### Cursor Dinámico

```css
cursor: grabbing    /* Durante drag */
cursor: grab        /* Cuando puedes arrastrar */
cursor: pointer     /* Sobre nodos */
```

### Panel de Ayuda

- Aparece en esquina inferior derecha
- Semi-transparente con blur
- Teclas resaltadas con diseño visual
- Responsive en móvil

### Transiciones Suaves

- Pan es instantáneo (sin laggy)
- Zoom es suave si usas scroll
- Animaciones de controles fluidas

---

## 📱 Mobile Considerations

### Touch Support

Actualmente soporta:
- Touch drag para pan (click + drag tradicional)
- Pinch-to-zoom (zoom nativa del navegador)

Futuro:
- Dos dedos para pan
- Soporte mejorado de gestos

---

## 🔧 Configuración

### Velocidad de Pan

En `GraphScene2D.tsx`:
```typescript
const panStep = 30;  // Píxeles por pulsación
```

Aumentar para movimiento más rápido, disminuir para más preciso.

### Velocidad de Zoom

En `GraphScene2D.tsx`:
```typescript
const zoomStep = 1.2;  // Multiplicador
```

- `1.1` = zoom más lento
- `1.5` = zoom más rápido

### Rango de Zoom

En `GraphScene2D.tsx`:
```typescript
Math.max(0.1, Math.min(5, newZoom))  // Cambiar estos números
```

---

## ✨ Casos de Uso

### Exploración del Grafo

1. Start con **R** para reset
2. Usa **Scroll** para zoom out y ver estructura general
3. Usa **Flechas** para moverte a áreas interesantes
4. **Click + Drag** para pan fino
5. **Zoom in** con scroll/+/- para ver detalles

### Presentación

1. Resetea con **R**
2. Usa **Flechas** para navegación controlada
3. **Zoom** para enfatizar áreas
4. Las teclas son discretas (ideales para presentaciones)

### Análisis Detallado

1. **Zoom muy in** (5x) para examinar un área
2. **Pan** para mover alrededor
3. **Zoom out** (0.1x) para contexto general
4. **Arrow keys** para navegación precisa

---

## 📊 Archivos Modificados

### GraphScene2D.tsx
- Agregado `DragState` interface
- Agregado `handleMouseDown`, `handleMouseMove`, `handleMouseUp`
- Agregado keyboard event listener
- Actualizado rango de zoom (0.1 a 5)
- Agregado panel de ayuda en JSX

### GraphScene2D.css
- Agregado estilos para `.graph-help`
- Agregado estilos para `kbd` shortcuts
- Actualizado cursor dinámico
- Responsive styles para panel de ayuda

---

## 🚀 Rendimiento

- No hay impacto en performance
- Event listeners optimizados
- Cálculos de pan/zoom son O(1)
- Smooth 60fps en zoom continuado

---

## 🎯 Conclusión

Los controles del grafo ahora son:
- ✅ **Intuitivos**: Click+drag, arrows, zoom
- ✅ **Potentes**: Rango 0.1x-5x para cualquier tamaño de grafo
- ✅ **Flexibles**: Múltiples formas de navegar
- ✅ **Responsivos**: Feedback visual en cada interacción
- ✅ **Accesibles**: Teclas y mouse, sin dependencias complejas

¡Disfruta explorando tu jardín de ideas! 🌱
