# Refugio Shane y Hábitats Vivientes — Bajoterra 4.0

## 1. Cinco Hábitats Elementales del Refugio (`src/game/data.ts`)

Dentro de la zona segura del Refugio Shane (`SHELTER_HOME_RADIUS = 16` alrededor de `SPAWN_X, SPAWN_Y`), hasta **6 babosas residentes activas** (`MAX_ACTIVE_HOME_SLUGS`) conviven libremente repartidas en **5 hábitats** (máximo 2 babosas por hábitat):

| Hábitat | Elementos compatibles | Función |
|---|---|---|
| **Rincón Térmico** (`habitat_thermal`) | `Fuego` | Zona cálida de brasas volcánicas |
| **Estanque Fresco** (`habitat_aquatic`) | `Agua`, `Hielo` | Estanque cristalino y húmedo |
| **Rincón Cristalino** (`habitat_crystal`) | `Eléctrico`, `Energía`, `Luz` | Cristales resonantes de recarga |
| **Rincón Sombrío** (`habitat_shadow`) | `Sombra` | Penumbra serena de ecos oscuros |
| **Jardín Subterráneo** (`habitat_garden`) | `Planta`, `Tierra` | Musgo blando y sustrato fértil |

## 2. Mobiliario, Validación de Estancias y Simulación

- **Mobiliario funcional (`placeHomeFurniture`)**: nidos (`nest`), camas (`bed`), comederos (`feeder`) y lámparas de cristal (`decor`). Los comederos reducen la pérdida de saciedad; nidos y camas aceleran la recuperación de energía al descansar; las lámparas emiten iluminación cálida y aumentan la comodidad.
- **Validación de habitaciones (`validateShelterRooms`)**: analiza por inundación desde el exterior los recintos delimitados por muros y puertas en el refugio para calcular el índice de comodidad (`getShelterComfortAverage`).
- **IA Autónoma (`updateHomeResidents`)**: las babosas residentes patrullan su hábitat evitando muros, líquidos incompatibles y mobiliario, descansan cuando bajan de energía, saludan al explorador al acercarse y muestran reacciones visuales sobre el lienzo.

## 3. Mejoras del Refugio y Respaldo de Partida

- **Nivel 1 -> Nivel 2 (6 Fichas)**: aura de regeneración pasiva de PS dentro del refugio e incubación de huevos un **50 % más rápida**.
- **Nivel 2 -> Nivel 3 (10 Fichas)**: desbloquea la baliza de **Retorno Rápido** al Refugio Shane (`warpToShelter`).
- **Respaldo automático (`src/game/save.ts`)**: antes de sobrescribir la partida principal (`V4_SAVE_KEY`), `saveGameV4` guarda una copia previa verificada en `V4_BACKUP_KEY` además de sincronizar IndexedDB; si ambas copias primarias sufrieran corrupción, `loadGameV4Detailed` restaura automáticamente desde el respaldo local.
