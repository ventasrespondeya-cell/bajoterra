# Sistema de Combate Bláster — Bajoterra 4.0

Bajoterra 4.0 unifica el combate bláster en tiempo real tanto durante la exploración en cavernas (`BajoterraEngine`) como en las arenas de duelo (`CombatManager` + `BattleModal`).

## 1. Combate en Tiempo Real en el Mundo

- **Movimiento y disparo simultáneos**: el jugador se desplaza con suavidad (aceleración/desaceleración exponencial y deslizamiento en esquinas) mientras apunta con el ratón (`handleCanvasPointerMove`) y dispara con clic izquierdo o la acción vinculada (`fireWorldBlaster`).
- **Proyectiles con transformación Velocimorph**: cada disparo nace en **protoforma** y se transforma en el aire al recorrer `transformDistTiles`, ganando estela elemental, daño mejorado y propiedades propias según la especie (rebote en muros, guiado ligero o perforación).
- **Habilidades especiales Z / X**: `triggerWorldAbility(0 | 1)` activa los movimientos especiales de la babosa equipada consumiendo Energía (`energy`) y respetando su enfriamiento individual (`worldAbilityCooldowns`), incluidos efectos de curación, escudo, drenaje o perforación.
- **Interacción ambiental**: los proyectiles del jugador rompen muros agrietados (`TileType.CRACKED_WALL`) para revelar pasajes secretos.
- **Enemigos activos y esquiva**: los mercenarios y guardianes exploran, entran en estado `windup` con anillo telegrafiado antes de disparar proyectiles enemigos y pueden ser evadidos mediante **Esquivar** (`Espacio`), que otorga impulso rápido e invulnerabilidad breve (`playerInvulnTimer`). Derrotarlos en caverna otorga Fichas de Caverna y experiencia.

## 2. Duelos en Arena (`src/game/combat.ts`)

- **Arena 2D física**: cada bioma cuenta con una arena dedicada (`src/game/combatArenas.ts`) con coberturas destructibles/bloqueantes, gravedad balística y choques entre proyectiles opuestos (`resolveProjectileClashes`).
- **Carga y liberación**: mantener el disparo carga el bláster para escalar velocidad y potencia (tap rápido -> Disparo Rápido, carga media -> Técnica 1, carga alta -> Técnica 2 o **Pulso Maestro** si la ventana está activa).
- **Esquiva táctica**: `triggerDodge` realiza un dash direccional con cuadros de invulnerabilidad (`invulnTimer`) y otorga `+15` de carga de Pulso si esquiva cerca de un proyectil enemigo.
- **Jefes de Bioma (6 jefes)**: `boss_aquatic`, `boss_magma`, `boss_ice`, `boss_crystal`, `boss_shadow` y `boss_blakk` alternan repertorios de babosas temáticos y entran en **Fase 2** al caer por debajo del 55 % de PS (ráfagas múltiples, parpadeo sombrío, escudos criogénicos o proyectiles guiados).
- **Multiplicadores elementales**: `ELEMENT_CHART` aplica `×1.75` en ventaja, `×1.0` neutral y `×0.65` en resistencia.

## 3. Identidad de Combate por Especie (`src/game/slugCombatProfiles.ts`)

Las **20 especies** definidas en `SPECIES_LIST` poseen perfiles de combate propios (`SlugCombatProfile`):
- `roleLabel` y clase de peso (`ligera`, `equilibrada`, `pesada`).
- `baseLaunchSpeed`, `maxLaunchSpeed`, `gravityScale`, `transformDist`, `hitboxRadius` y `reloadSec`.
- Mecánicas diferenciadas: `bounces` (rebotes en muros), `homing` (curva guiada tras transformarse), `phaseObstacles` (atraviesa una cobertura), `aoeRadius` (onda expansiva al impactar), `silhouette` y `trailStyle`.
