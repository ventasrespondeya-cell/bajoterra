# Bajoterra 4.0 — Guía de Dirección Artística Principal

> **Inspiración creativa**: Mundo subterráneo de *Slugterra* y duelos dinámicos de bláster tipo *Battle for Slugterra*.  
> **Regla de originalidad**: Todos los trazos, sprites pixel-art, retratos vectoriales, transformaciones, interfaces y efectos son creaciones originales diseñadas para este proyecto.

---

## 1. Principios de Estilo Visual

1. **Identidad Subterránea Bioluminiscente**:
   - Contraste claro entre la penumbra de las cavernas (`#060d14` – `#1f1932`) y los núcleos vibrantes de las babosas y cristales.
   - Regla de color **60 / 30 / 10**: 60% caverna y terreno legible, 30% arquitectura/vegetación/roca estructurada, 10% acentos elementales y señales de acción.
2. **Iluminación Direccional Unificada (`-45°`)**:
   - Todas las criaturas, personajes y bloques reciben luz clave desde la **esquina superior izquierda (`-45°`)** con un brillorim especular en el borde superior izquierdo y sombra de contacto elíptica debajo.
   - Contorno tintado oscuro (`#060c14`) para garantizar lectura instantánea tanto sobre roca clara de *Cuevas Heladas* como sobre obsidiana de *Magma* o penumbra *Sombría*.
3. **Proporciones y Escalas**:
   - **Protoforma (Hogar, Estuche, Cámara de Bláster, Mundo)**: Criaturas compactas expresivas (`24×24 px` en mapa RPG / `32×32 viewBox` en retrato SVG). Nunca una plantilla única recoloreada: varían ancho de torso, curvatura craneal, postura (erguida, acorazada al ras del suelo, esbelta, flotante), extremidades/crestas y cola.
   - **Transformación por Velocidad (Velocimorph)**: Al superar la distancia crítica de aceleración en combate, la babosa sufre anticipación, estiramiento cinético y expansión progresiva (`1.0× → 1.48×`), desplegando alas, taladros, cuernos o filamentos exclusivos.
   - **Megamorph (Tramo Avanzado / Final)**: Reservado estrictamente para el tramo avanzado (`Nv. 6+`, `Amistad 60+`, catalizador raro). Suma corona cristalina dorada, placas de energía y estela amplificada; nunca aparece como estado inicial ni desbloqueo temprano.

---

## 2. Sistema Reutilizable de Animación (`SlugAnimationSystem`)

Todas las pantallas (Hogar, Colección/Babosapedia, Ficha de Detalle, Captura, HUD y Duelo) comparten el evaluador determinista `sampleSlugAnimationFrame(speciesId, animState, timeSec, reducedMotion)`:

- **Estados soportados**: `idle`, `walk`, `happy`, `play`, `eat`, `rest`, `sleep`, `react`, `charge`, `fire`, `flight`, `transform`, `attack`, `hit`, `ko`, `victory`.
- **Cadencia por personalidad**:
  - *Tazerling* / *Voltrix*: pulsos rápidos, micro-vibraciones eléctricas y parpadeos breves.
  - *Frostcrawler* / *Lariat* / *Piroclasto*: respiración pesada, paso firme con poco rebote vertical y compresión sólida.
  - *Infurnus* / *Flaringo*: flotación cálida ascendente, oscilación rítmica de cresta ígnea.
- **Accesibilidad y rendimiento móvil**: Respeta `reducedMotion` suprimiendo sacudidas y reduciendo amplitud sin perder legibilidad; el renderizado Canvas reutiliza sprites cacheados (`24×24` / `28×28`) y limita partículas en modo `lightingQuality: 'eco'`.

---

## 3. Prototipo Visual Prioritario (Trío Fundacional)

Antes de ampliar al resto del catálogo, se validó la diferenciación total sobre tres arquetipos opuestos:

### 01 · Infurnus *(Fuego · Cuevas Verdes)* — *Prototipo Ágil Ígneo*
- **Silueta y anatomía**: Cuerpo esbelto y erguido (`width 0.88×`, `height 1.12×`), cresta flamígera tricolor escalonada sobre la coronilla, antenas finas y cola afilada como lengua de fuego.
- **Expresión y rasgos**: Ojos rasgados decididos con ceja firme, sonrisa pícara con colmillo lateral, vientre dorado incandescente (`ember_skin`).
- **Transformación**: *Fénix Solar* — alas amplias articuladas de fuego que baten en vuelo y cola bifurcada en cometa.
- **Efecto elemental**: Brasas ascendentes, destellos naranja-dorados y ondas térmicas concéntricas.

### 02 · Frostcrawler *(Hielo · Cuevas Heladas)* — *Prototipo Acorazado Pesado*
- **Silueta y anatomía**: Cuerpo ancho y bajo pegado al suelo (`width 1.24×`, `height 0.88×`), coraza dorsal segmentada en placas hexagonales, tres cuernos prismáticos de escarcha, mandíbulas laterales robustas y cola en maza helada.
- **Expresión y rasgos**: Ojos entrecerrados ámbar/hielo bajo ceja blindada, boca gruñona firme, acabado en quitina escarchada (`frosted_chitin`).
- **Transformación**: *Taladro Escarcha* — punta cónica giratoria con aristas cristalinas, propulsores laterales y placas dorsales desplegadas.
- **Efecto elemental**: Copos cristalinos rotatorios, estela de fragmentos gélidos e impacto de anillo escarchado.

### 03 · Tazerling *(Eléctrico · Cuevas Verdes)* — *Prototipo Velocista Hiperactivo*
- **Silueta y anatomía**: Cuerpo ágil ligeramente inclinado hacia adelante (`width 0.86×`, `height 0.96×`), antenas gemelas en zigzag de alto voltaje, carrillos cargados redondeados y cola bífida en forma de rayo.
- **Expresión y rasgos**: Ojos circulares enormes muy expresivos llenos de energía y boca abierta entusiasmada (`conductive_gel`).
- **Transformación**: *Depredador Voltio* — silueta afilada aerodinámica con aletas conductoras y arco eléctrico constante.
- **Efecto elemental**: Rayos quebrados en zigzag, chispas amarillo neón y anillo de descarga rápida.

---

## 4. Orden Narrativo del Catálogo (Progresión de Historia)

1. **Etapa 1 — Cuevas Verdes (Inicio y Refugio)**: `Infurnus`, `Aquabeak`, `Tazerling`, `Musgacorn`, `Doc`.
2. **Etapa 2 — Cuevas Heladas**: `Frostcrawler`, `Glaciomita`, `Voltrix`.
3. **Etapa 3 — Cavernas de Magma**: `Flaringo`, `Lariat`, `Piroclasto`.
4. **Etapa 4 — Cavernas Sombrías (Tramo Final)**: `Enigmo`, `Darkfurnus`, `Umbrospect`, `Aetherion` *(+ Megamorph en tramo avanzado)*.

---

## 5. Mundo RPG y Criaturas Ambientales

- **Personajes y Jefes RPG con Sprites Propios**: Mercaderes subterráneos con farol y mochila de cristales, Mercenarios con visor oscuro y bláster lateral, y Señores de Caverna (*Ignis Rex*, *Glacius Prime*, *Sombra Vex*) con armadura y corona distintiva en lugar de iconos genéricos.
- **Vida en el Hogar y Biomas**: Las babosas residentes caminan hacia la dirección en que miran, curiosean, se acercan a comer cerca del comedero, duermen con `Zzz`, juegan entre sí y reaccionan al jugador. Cada bioma cuenta con fauna ambiental ligera (esporas luminosas, chispas térmicas, cristales flotantes y polillas sombrías).
