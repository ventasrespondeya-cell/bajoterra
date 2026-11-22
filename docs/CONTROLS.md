# Sistema de Controles y Entrada — Bajoterra 4.0

## 1. Gestor Centralizado (`src/game/inputManager.ts`)

Todas las acciones de teclado y ratón pasan por `CONTROL_ACTION_DEFS`, `resolveEffectiveBindings` y `rebindControlKey`, compartidos entre la exploración en el mundo (`BajoterraEngine`) y los duelos de arena (`BattleModal`).

### Controles predeterminados de PC
| Acción | Tecla / Botón por defecto | Contexto |
|---|---|---|
| Moverse | `W`, `A`, `S`, `D` (o flechas) | Mundo y arena de duelo |
| Esquivar / Impulso | `Espacio` | Esquiva con breve invulnerabilidad |
| Apuntar bláster | Ratón | Apunta hacia el cursor |
| Disparar bláster | `Clic Izquierdo` | Carga y lanza babosa |
| Acción secundaria / Guardia | `Clic Derecho` | Escudo en duelo / pulso o baya rápida en caverna |
| Interactuar | `F` (o clic contextual) | Hablar, cofres, puertas, altares, capturar |
| Cambiar babosa | `Q` | Rota la babosa activa del estuche |
| Selección directa | `1` – `4` | Elige directamente una babosa del estuche |
| Habilidad especial 1 y 2 | `Z` / `X` | Técnicas elementales de la babosa activa |
| Pulso escáner / Maestro | `R` | Escanea secretos al explorar o Pulso Maestro en duelo |
| Meca Shane | `V` | Montar o desmontar el Meca desbloqueado |
| Mapa del mundo | `M` | Abre o cierra el mapa completo |
| Inventario y Campaña | `Tab` (o `I`) | Estuche, Campaña, Hogar y Babosapedia |
| Pausa / Opciones | `Esc` | Menú de pausa y configuración |

## 2. Reasignación y Prevención de Conflictos

En el menú **Pausa (`Esc`) -> Configuración de Controles** (`src/components/PauseModal.tsx`):
- Haz clic sobre la tecla asignada a cualquier acción editable para capturar una nueva tecla.
- `rebindControlKey` bloquea teclas de sistema (`Control`, `Alt`, `Meta`, `CapsLock`, `Escape` reservada para Pausa y `E` bloqueada para evitar conflictos residuales).
- `findConflictingAction` impide asignar una misma tecla a dos acciones distintas mostrando un aviso inmediato con la acción en conflicto.
- El botón **Restablecer** restaura `createDefaultKeyBindings()` y los cambios se guardan automáticamente en `options.keyBindings`.

## 3. Controles Táctiles y Móviles

En dispositivos táctiles (o cuando **Controles táctiles** está en `Sí` / `Auto`):
- Tanto `GameHUD.tsx` (exploración) como `BattleModal.tsx` (duelos) renderizan una interfaz táctil dedicada con `touch-none` y márgenes seguros (`env(safe-area-inset-*)`) para evitar el desplazamiento accidental del navegador.
- **Exploración**: joystick virtual izquierdo, botones de disparo (`TIRO`), esquiva (`Esquivar`), habilidades especiales (`Z` / `X`), interacción contextual, rotación de babosa y acceso rápido a pausa/mapa/estuche (todos con área mínima de `44×44 px`).
- **Duelos en arena**: joystick izquierdo de movimiento 2D, panel táctil derecho de apuntado/carga/disparo, botones dedicados de **Esquivar**, **Habilidades Z / X**, **Escudo / Capturar** y cambio rápido de babosa.
