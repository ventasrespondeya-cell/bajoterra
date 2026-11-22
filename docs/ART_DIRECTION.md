# Bajoterra 4.0 — Guía de Dirección Artística y Análisis de Referencias (Parte 1)

> **Principio rector**: Todos los activos en el juego son creaciones originales diseñadas para un RPG 2D cel-shaded subterráneo con iluminación direccional `-45°`, contornos tintados oscuros (`#060c14`) y lectura cromática `60 / 30 / 10`. Ninguna lámina de referencia se incrusta directamente como imagen estática en el mundo jugable.

---

## 1. Análisis de Referencias Visuales

### A. Diseño de Cuerpo Completo de Babosas (Láminas de criaturas y alas articuladas)
- **Siluetas diferenciadas por anatomía**: Cada especie posee proporción propia de torso/cabeza/extremidades (`widthScale` y `heightScale` propios), evitando plantillas clónicas:
  - *Acorazados* (`Frostcrawler`, `Armashelt`, `Rammstone`): caparazones segmentados en placas, hombreras blindadas, mandíbulas y mazas caudales.
  - *Ígneos / Voladores* (`Infurnus`, `Flaringo`): cuerpo estilizado ascendente, cresta tricolor en flama y cola estilizada en lengua de fuego.
  - *Eléctricos velocistas* (`Tazerling`, `Voltrix`): postura inclinada adelante, carrillos conductores luminosos, antenas en zigzag y colas bífidas.
  - *Acuáticos / Sanadores* (`Aquabeak`, `Doc`, `Bubbaleone`): aletas pectorales con motas luminosas, picos o halos curativos, antenas sensoriales.
  - *Insectoides y Alados* (inspirados en la hoja *Hoverbug*): placas dorsales segmentadas con franjas de energía, abdomen bioluminiscente semitransparente y **alas venadas cian/doradas** articuladas en estados `wing_flap`, `float`, `transform` y `Megamorph`.
  - *Malvadas (Ghoul)* (`Darkfurnus`, `Umbrospect`): pigmentación violeta/carmesí oscura, ojos rojos rasgados, colmillos descubiertos y venas de energía corrupta.
- **Clasificación honesta**: Se mantienen exactamente las **20 especies del proyecto**, conservando la distinción explícita entre canon de la serie (`serie_canon`) y adaptaciones originales del RPG (`adaptacion_juego`).

### B. Diseño Facial y Expresividad de Babosas
- **Ojos grandes expresivos** con brillo blanco superior-izquierdo y cejas inclinadas en estados `charge`, `attack`, `fire` y `transform`; ojos en cíclope resplandeciente para `Doc` y `Enigmo`; cierre curvo en `sleep` y aspas en `hit`/`ko`.
- **Bocas articuladas**: sonrisas pícaras con colmillos laterales en combate, apertura energética al cargar disparo y sonrisa relajada en el refugio.

### C. Diseño de Personajes y Jefes (Héroes, Banda de Shane, Mercenarios y Señores de Bioma)
- **Proporciones estilizadas de aventura 2D** con cabeza expresiva, torso blindado/equipado, cinturón con **cápsulas gemelas de babosas**, hombreras y arma característica:
  - **Eli Shane**: cabello azul-índigo en puntas, hombreras naranjas con peto oscuro, doble cápsula cian en el pecho y bláster Shane naranja/plata.
  - **Kord Zane**: Trol de las cavernas azul robusto, cuernos laterales, gafas en la frente, arnés naranja cruzado y lanzador pesado.
  - **Trixie Sting**: cabello carmesí con banda verde, uniforme turquesa de cronista, bláster/Chromecorder luminoso.
  - **Pronto**: Molenoide verde de baja estatura, hocico rosado, gafas de explorador y mochila de rastreo.
  - **Will Shane**: eco holográfico azul cian con manto protector.
  - **Rivales y Villanos**: *Garfio Rojo* (parche, garfio metálico, abrigo pirata), *Twist* (capucha verde/negra, guanteletes sombríos), *Soldado/Mercenario de Blakk* (casco táctico con visor rojo), *Dr. Thaddius Blakk* y *Comandante Blakk* (cuello alto carmesí, bandolera diagonal y ametralladora Ghoul violeta-rojo).
  - **5 Jefes de Bioma (`80×80`)**: *Leviatán Abisal* (corona de coral y tridente hidro-abanico), *Titán Piroclasto* (placas de obsidiana y fragua pectoral), *Reina Glaciomita* (tiara prismática y cetro glacial), *Oráculo Prisma* (halo de prismas orbitantes), *Espectro del Abismo* (cráneo cornudo sombrío y capa espectral).
- **Animación y 4 direcciones**: Todos distinguen `down`, `up` (mochila/capa trasera/cabello posterior), `left` y `right` (perfil lateral real con brazo lanzador adelantado) en estados `idle`, `walk`, `interact`, `combat`, `hit` y `special`.

### D. Entornos, Biomas y Arquitectura de Caverna
- **Profundidad 2.5D**: Muros y acantilados con cara vertical estratificada al sur, sombra de caída proyectada, **enredaderas y musgo colgante** en cornisas y **abismo con neblina paralaje** debajo de las simas (`CHASM`).
- **Transiciones suaves de terreno**: Los bordes entre agua, lava, hielo, adoquín, suelo construido y tierra natural dibujan orillas y biseles suavizados eliminando cortes duros de cuadrícula 28×28.
- **Arquitectura emblemática**:
  - **Refugio Shane**: inspirada en la cúpula tecnológica azul-cian hundida bajo **cascadas luminosas**, pasarela de adoquín, círculo rúnico de cristal, plataformas de madera cálida y hábitats integrados sin cuadrados planos.
  - **Aventura Subterránea**: puentes colgantes de madera y cuerda sobre simas y ríos de lava, escaleras de madera, racimos de hongos bioluminiscentes sobre losas de piedra, pilares antiguos y hogueras de campamento.

---

## 2. Arquitectura de Activos (`/src/assets/*`)

| Categoría | Archivo | Dimensiones | Estados |
| :--- | :--- | :--- | :--- |
| Utilidades seguras | `src/assets/canvasUtils.ts` | N/A | `roundRectPath`, brillo radial, hash determinista |
| Manifiesto | `src/assets/manifest.ts` | Global | Registro maestro y conteo de cuadros |
| Héroes y Aliados | `src/assets/characters/characterSpritesheet.ts` | `64×64` (`72×72` Mecha) | `down/up/left/right` × `idle, walk, interact, combat, hit, special` |
| Enemigos y Jefes | `src/assets/enemies/enemySpritesheet.ts` | `64×64` / `80×80` | `down/up/left/right` × `idle, walk, interact, combat, hit, special` |
| Babosas HiDPI | `src/assets/slugs/slugSpritesheet.ts` | `64×64` | 20 especies × Normal/Megamorph/Ghoul × 14 estados |
| Terreno 2.5D | `src/assets/environments/hdTileset.ts` | `56×56` (2×) | Auto-tiling 4-bit, caras sur, enredaderas, abismos |
| Decoración Bioma | `src/assets/environments/biomeDecorations.ts` | `56×56` (2×) | Hongos en losa, cristales facetados, cascadas, basalto, algas |
| Arquitectura | `src/assets/buildings/caveArchitecture.ts` | `56×56` (2×) + compuestos | Puentes colgantes, escaleras, hogueras, cofres, altares, cúpula Shane |

---

## 3. Paletas de los 6 Biomas

1. **Cuevas Verdes (`Verdes`)**: tierra cálida `#4a372a`, roca estratificada `#5c4637`, musgo `#4ade80`, hongos cian/esmeralda `#2dd4bf` y cascadas cian `#22d3ee`.
2. **Cavernas Acuáticas (`Acuaticas`)**: suelo pizarra húmedo `#173244`, agua profunda `#0284c7`, cuarzo azul `#38bdf8`, cascadas luminosas y algas `#10b981`.
3. **Cavernas de Magma (`Magma`)**: obsidiana `#241414`, roca volcánica `#43201b`, ríos incandescentes `#f97316` / `#fde047`, columnas de basalto hexagonal.
4. **Cuevas Heladas (`Heladas`)**: hielo translúcido `#5ea8d4`, cristal glacial `#e0f2fe`, muros azul cobalto `#0e7490` y ventisca tenue.
5. **Cavernas Cristalinas (`Cristalinas`)**: pizarra violeta profunda `#231a3d`, espiras prismáticas `#a78bfa` y vetas de energía `#67e8f9`.
6. **Cavernas Sombrías (`Sombrias`)**: suelo abisal `#161124`, ladrillo antiguo oscuro `#3b2d4a`, hongos neón `#a855f7` y acentos carmesí `#f43f5e`.
