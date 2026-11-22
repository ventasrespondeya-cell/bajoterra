# Babosas, Cuidados, Crianza y Babosapedia — Bajoterra 4.0

## 1. Colección de 20 Especies y Progresión

El juego incluye 20 especies organizadas por orden de historia en `STORY_ORDERED_SPECIES_IDS` (`src/game/slugArtDirection.ts` y `src/game/data.ts`), combinando especies canónicas de la serie animada (`Infurnus`, `Aquabeak`, `Tazerling`, `Frostcrawler`, `Doc`, `Darkfurnus`, `Flaringo`, `Lariat`, `Enigmo`, `Arachnet`, `Bubbaleone`, `Rammstone`, `Fandango`, `Armashelt`) con adaptaciones RPG para cada bioma.

Cada instancia (`SlugInstance`) conserva:
- **Estadísticas y Nivel** (`1`–`20`), experiencia (`xp`), personalidad determinista y apodo editable (`setSlugNickname` / `clearSlugNickname`).
- **Vínculo / Amistad (`bond`)**: sube mediante combates, cuidados en el hogar, bayas y Elixires Megamorph, desbloqueando rangos en `getBondTierInfo`.
- **Maestría de movimientos (`moveMastery`)**: reduce el coste de energía y multiplica el poder de sus dos técnicas especiales al usarlas y entrenarlas.
- **Megamorph**: desbloqueable tras superar el Acelerador (Capítulo 7) si la babosa cumple requisitos de nivel, amistad y piedra/elixir en `checkMegamorphEligibility`.

## 2. Babosapedia (`ExpeditionModal.tsx`)

La pestaña **Babosapedia** integra los retratos animados HiDPI de la Parte 1 con herramientas prácticas de consulta:
- **Búsqueda instantánea**: filtra por nombre de especie, rol táctico (`roleLabel`), elemento o bioma de origen.
- **Filtros por elemento y estado**: botones de filtro para los 9 elementos (`Fuego`, `Agua`, `Hielo`, `Eléctrico`, `Tierra`, `Planta`, `Luz`, `Sombra`, `Energía`) y estado de colección (`Todas`, `Capturadas`, `Por descubrir`).
- **Visor de expresiones y silueta**: permite previsualizar las 9 animaciones (`happy`, `idle`, `walk`, `play`, `eat`, `react`, `attack`, `hit`, `sleep`), modo **Silueta** y la **Guía Artística y Prototipos**.

## 3. Cuidados y Crianza (`src/game/home.ts`)

Las babosas asignadas al **Hogar Viviente** mantienen indicadores reales de **saciedad (`hunger`)**, **energía (`energy`)**, **alegría (`happiness`)** y estado de ánimo (`contenta`, `tranquila`, `hambrienta`, `cansada`):
- **Acariciar (`petHomeSlug`)**: eleva alegría, amistad y experiencia con enfriamiento de bono.
- **Jugar (`playWithHomeSlug`)**: otorga amistad, experiencia y maestría aleatoria en una técnica (requiere energía >= 18).
- **Alimentar (`feedHomeSlug`)**: consume alimentos del inventario (`berries`, `emberSnack`, `frostNectar`, `core`); cada especie recibe bonificaciones extra (`+55` saciedad, `+5` amistad) con su comida elemental favorita.
- **Crianza e Incubadora (`startBreeding`)**: hasta 3 huevos simultáneos entre babosas con al menos `25` de amistad; eclosionan al caminar por las cavernas heredando un rasgo adicional (`Vitalidad +`, `Potencia +` o `Velocidad +`).
