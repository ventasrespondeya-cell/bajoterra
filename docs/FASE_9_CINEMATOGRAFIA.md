# Fase 9 — Arquitectura Preparada para Cinematografía y Narrativa (Etapa E)

Este documento define el contrato técnico implementado en `src/game/cinematicEvents.ts` y conectado de forma no bloqueante en `src/game/engine.ts` para soportar secuencias cinematográficas ligeras en la próxima fase sin reescribir el motor de juego.

## 1. Bus de Eventos Ligero (`cinematicEvents`)

Ubicado en `src/game/cinematicEvents.ts`, expone una cola acotada (máx. 16 eventos recientes) y suscripción desacoplada (`subscribe(listener)`) con aislamiento de errores para que ninguna futura animación pueda interrumpir el bucle a 60 FPS ni los tests headless.

### Tipos de Eventos Implementados
1. **`slug_captured`**: Disparado al capturar una babosa salvaje en combate (`engine.ts -> engageEntity -> onEnd`). Ideal para celebración con cámara cercana, destello elemental y tarjeta de especie registrada.
2. **`encounter_intro`**: Disparado antes de duelos contra mercenarios, guardianes de ruinas o jefes de bioma. Permite presentar silueta, título y lema del rival.
3. **`combat_intro`**: Disparado al iniciar encuentros salvajes para transiciones breves y entrada musical dinámica.
4. **`megamorph_awakened`**: Disparado al evolucionar intencionalmente una babosa a Megamorph (`engine.ts -> evolveSlugToMegamorph`). Permite destello dorado, emblema y fanfarria.
5. **`biome_discovered`**: Disparado la primera vez que el jugador cruza hacia un bioma nuevo (`Cuevas Verdes`, `Cavernas de Magma`, `Cuevas Heladas`, `Cavernas Sombrías`).
6. **`poi_discovered`**: Disparado al acercarse a un punto de interés procedural (`mina abandonada`, `puesto avanzado`, `cámara de cristal`, `ruinas antiguas`, `cámara secreta`).

## 2. Pistas de Audio Dinámico (`AudioCueMood`)

Cada evento incluye un campo `audioCue` tipado:
- `exploration_calm`
- `discovery_wonder`
- `duel_tension`
- `boss_ominous`
- `victory_fanfare`
- `capture_chime`

En Fase 9, un controlador de música ambiental podrá suscribirse a `cinematicEvents` para modular capas de sintetizador en `src/game/audio.ts` según bioma y prioridad (`ambient` | `highlight` | `dramatic`), respetando siempre la preferencia `options.soundEnabled` y `options.volume`.

## 3. Reglas de Diseño para Fase 9
- Toda secuencia `highlight` o `dramatic` incluye `skippable: true` para saltar con clic o tecla.
- Las transiciones visuales se montarán como un overlay ligero desacoplado sobre `App.tsx`, pausando únicamente la entrada del usuario durante 1–2.5s en eventos `dramatic` (sin congelar animaciones ambientales ni corromper autoguardados).
- Los eventos `ambient` (POIs y descubrimientos menores) se mostrarán como banners no intrusivos en el HUD superior sin detener al explorador.
