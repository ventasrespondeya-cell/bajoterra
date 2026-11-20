import {
  FURNITURE_DEFS,
  HABITAT_DEFS,
  HOME_FOOD_DEFS,
  MAX_ACTIVE_HOME_SLUGS,
  MAX_SLUGS_PER_HABITAT,
  SHELTER_HOME_RADIUS,
  SPAWN_X,
  SPAWN_Y,
  getHabitatDef,
  getSpecies,
  isSpeciesCompatibleWithHabitat,
} from './data';
import {
  TileType,
  type FurnitureKind,
  type GameState,
  type HabitatId,
  type HomeBehavior,
  type HomeFurniture,
  type HomeMood,
  type HomeSlugEntry,
  type HomeState,
  type InventoryKey,
  type RoomValidationInfo,
  type SlugInstance,
} from './types';
import { ChunkManager, isTileSolid } from './world';

export function createDefaultHomeState(): HomeState {
  return {
    residents: [],
    furniture: [],
    lastNeedsTickSec: 0,
  };
}

export function ensureHomeState(state: GameState): HomeState {
  if (!state.home) {
    state.home = createDefaultHomeState();
  }
  return state.home;
}

export function computeHomeMood(hunger: number, energy: number, happiness: number): HomeMood {
  if (hunger < 30) return 'hambrienta';
  if (energy < 28) return 'cansada';
  if (happiness >= 72 && hunger >= 55 && energy >= 45) return 'contenta';
  return 'tranquila';
}

export function getMoodLabel(mood: HomeMood): string {
  switch (mood) {
    case 'contenta':
      return 'Contenta';
    case 'tranquila':
      return 'Tranquila';
    case 'hambrienta':
      return 'Hambrienta';
    case 'cansada':
      return 'Cansada';
  }
}

export function isInShelterZone(x: number, y: number): boolean {
  return Math.abs(x - SPAWN_X) <= SHELTER_HOME_RADIUS && Math.abs(y - SPAWN_Y) <= SHELTER_HOME_RADIUS;
}

export function canHomeSlugWalk(chunks: ChunkManager, speciesId: string, x: number, y: number): boolean {
  if (!isInShelterZone(x, y)) return false;
  const sp = getSpecies(speciesId);
  const cxCenter = x + 0.5;
  const cyCenter = y + 0.5;
  const r = 0.28;
  const pts = [
    [cxCenter - r, cyCenter - r],
    [cxCenter + r, cyCenter - r],
    [cxCenter - r, cyCenter + r],
    [cxCenter + r, cyCenter + r],
  ];
  for (const [px, py] of pts) {
    const t = chunks.getTile(Math.floor(px), Math.floor(py));
    if (isTileSolid(t)) return false;
    if (t === TileType.WATER && sp.type !== 'Agua') return false;
    if (t === TileType.LAVA && sp.type !== 'Fuego') return false;
  }
  return true;
}

function findSpawnSpotNearAnchor(
  chunks: ChunkManager,
  speciesId: string,
  anchorX: number,
  anchorY: number
): { x: number; y: number } {
  if (canHomeSlugWalk(chunks, speciesId, anchorX, anchorY)) {
    return { x: anchorX, y: anchorY };
  }
  for (let rad = 1; rad <= 5; rad++) {
    for (let dy = -rad; dy <= rad; dy++) {
      for (let dx = -rad; dx <= rad; dx++) {
        const tx = anchorX + dx;
        const ty = anchorY + dy;
        if (canHomeSlugWalk(chunks, speciesId, tx, ty)) {
          return { x: tx, y: ty };
        }
      }
    }
  }
  return { x: SPAWN_X, y: SPAWN_Y };
}

function isRoomBoundaryTile(tile: TileType): boolean {
  return (
    tile === TileType.WALL ||
    tile === TileType.ROCK ||
    tile === TileType.ANCIENT_BRICK ||
    tile === TileType.CRACKED_WALL ||
    tile === TileType.DOOR_CLOSED ||
    tile === TileType.DOOR_OPEN
  );
}

function isDoorTile(tile: TileType): boolean {
  return tile === TileType.DOOR_CLOSED || tile === TileType.DOOR_OPEN;
}

function isLightTile(tile: TileType): boolean {
  return tile === TileType.TORCH || tile === TileType.RECHARGE_STATION || tile === TileType.ALTAR;
}

export function validateShelterRooms(chunks: ChunkManager, home: HomeState): RoomValidationInfo[] {
  const minX = Math.max(1, SPAWN_X - 18);
  const maxX = Math.min(318, SPAWN_X + 18);
  const minY = Math.max(1, SPAWN_Y - 18);
  const maxY = Math.min(318, SPAWN_Y + 18);
  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  const idx = (tx: number, ty: number) => (ty - minY) * width + (tx - minX);

  const exterior = new Uint8Array(width * height);
  const queue: number[] = [];

  const trySeedExterior = (tx: number, ty: number) => {
    const i = idx(tx, ty);
    if (exterior[i]) return;
    const t = chunks.getTile(tx, ty);
    if (isRoomBoundaryTile(t)) return;
    exterior[i] = 1;
    queue.push(i);
  };

  for (let tx = minX; tx <= maxX; tx++) {
    trySeedExterior(tx, minY);
    trySeedExterior(tx, maxY);
  }
  for (let ty = minY; ty <= maxY; ty++) {
    trySeedExterior(minX, ty);
    trySeedExterior(maxX, ty);
  }

  let qHead = 0;
  while (qHead < queue.length) {
    const cur = queue[qHead++];
    const cx = minX + (cur % width);
    const cy = minY + Math.floor(cur / width);
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    for (const [dx, dy] of dirs) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < minX || nx > maxX || ny < minY || ny > maxY) continue;
      const ni = idx(nx, ny);
      if (exterior[ni]) continue;
      const nt = chunks.getTile(nx, ny);
      if (isRoomBoundaryTile(nt)) continue;
      exterior[ni] = 1;
      queue.push(ni);
    }
  }

  const visitedClosed = new Uint8Array(width * height);
  const rooms: RoomValidationInfo[] = [];

  const buildRoomFromCells = (
    roomIdx: number,
    cells: Array<{ x: number; y: number }>,
    closed: boolean
  ): RoomValidationInfo => {
    const cellSet = new Set<string>(cells.map((c) => `${c.x},${c.y}`));
    let sumX = 0;
    let sumY = 0;
    let walkableCount = 0;
    let hasDoor = false;
    let hasLight = false;

    for (const c of cells) {
      sumX += c.x;
      sumY += c.y;
      const t = chunks.getTile(c.x, c.y);
      if (!isTileSolid(t) && t !== TileType.LAVA) {
        walkableCount++;
      }
      if (isLightTile(t)) hasLight = true;

      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const ax = c.x + dx;
        const ay = c.y + dy;
        const at = chunks.getTile(ax, ay);
        if (isDoorTile(at)) hasDoor = true;
        if (isLightTile(at)) hasLight = true;
      }
    }

    const furnitureInside = home.furniture.filter((f) => {
      if (cellSet.has(`${f.x},${f.y}`)) return true;
      if (!closed) {
        return Math.abs(f.x - sumX / cells.length) <= 5 && Math.abs(f.y - sumY / cells.length) <= 5;
      }
      return false;
    });

    for (const f of furnitureInside) {
      if (FURNITURE_DEFS[f.kind]?.emitsLight) {
        hasLight = true;
      }
    }

    const issues: string[] = [];
    if (!closed) {
      issues.push('Habitación abierta: sella paredes o puertas');
    }
    if (!hasDoor) {
      issues.push('Falta puerta de acceso');
    }
    if (!hasLight) {
      issues.push('Falta iluminación (Antorcha o Lámpara)');
    }
    if (cells.length < 4 || walkableCount < 2) {
      issues.push('Espacio insuficiente o bloqueado');
    }

    let comfortScore = closed ? 35 : 10;
    if (hasDoor) comfortScore += 10;
    if (hasLight) comfortScore += 15;
    if (walkableCount >= 6) comfortScore += 10;
    let furnBonus = 0;
    for (const f of furnitureInside) {
      furnBonus += FURNITURE_DEFS[f.kind]?.comfortBonus ?? 0;
    }
    comfortScore += Math.min(30, furnBonus);
    if (cells.length < 4 || walkableCount < 2) {
      comfortScore = Math.max(0, comfortScore - 20);
    }
    comfortScore = Math.max(0, Math.min(100, comfortScore));

    const centerX = Math.round(sumX / cells.length);
    const centerY = Math.round(sumY / cells.length);
    const isMain = Math.abs(centerX - SPAWN_X) <= 6 && Math.abs(centerY - SPAWN_Y) <= 6;

    return {
      id: isMain ? 'room_main' : `room_${roomIdx}`,
      label: isMain ? 'Refugio Central' : `Estancia ${roomIdx}`,
      closed,
      hasDoor,
      hasLight,
      tileCount: cells.length,
      walkableCount,
      furnitureCount: furnitureInside.length,
      comfortScore,
      issues,
      centerX,
      centerY,
    };
  };

  // Find all closed interior components inside the bounded region
  let nextRoomNum = 1;
  for (let ty = minY + 1; ty < maxY; ty++) {
    for (let tx = minX + 1; tx < maxX; tx++) {
      const i = idx(tx, ty);
      if (exterior[i] || visitedClosed[i]) continue;
      const t = chunks.getTile(tx, ty);
      if (isRoomBoundaryTile(t)) continue;

      const comp: Array<{ x: number; y: number }> = [];
      const stack = [i];
      visitedClosed[i] = 1;
      while (stack.length > 0 && comp.length < 180) {
        const cur = stack.pop()!;
        const cx = minX + (cur % width);
        const cy = minY + Math.floor(cur / width);
        comp.push({ x: cx, y: cy });
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < minX || nx > maxX || ny < minY || ny > maxY) continue;
          const ni = idx(nx, ny);
          if (exterior[ni] || visitedClosed[ni]) continue;
          const nt = chunks.getTile(nx, ny);
          if (isRoomBoundaryTile(nt)) continue;
          visitedClosed[ni] = 1;
          stack.push(ni);
        }
      }

      if (comp.length >= 1) {
        rooms.push(buildRoomFromCells(nextRoomNum++, comp, true));
      }
    }
  }

  // Detect open/breached BUILT_FLOOR shelter zones that leaked to exterior
  const visitedLeaked = new Uint8Array(width * height);
  for (let ty = minY + 1; ty < maxY; ty++) {
    for (let tx = minX + 1; tx < maxX; tx++) {
      const i = idx(tx, ty);
      if (!exterior[i] || visitedLeaked[i]) continue;
      const t = chunks.getTile(tx, ty);
      if (t !== TileType.BUILT_FLOOR) continue;

      const comp: Array<{ x: number; y: number }> = [];
      const stack = [i];
      visitedLeaked[i] = 1;
      while (stack.length > 0 && comp.length < 180) {
        const cur = stack.pop()!;
        const cx = minX + (cur % width);
        const cy = minY + Math.floor(cur / width);
        comp.push({ x: cx, y: cy });
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < minX || nx > maxX || ny < minY || ny > maxY) continue;
          const ni = idx(nx, ny);
          if (!exterior[ni] || visitedLeaked[ni]) continue;
          const nt = chunks.getTile(nx, ny);
          if (nt !== TileType.BUILT_FLOOR && nt !== TileType.TORCH && !isTileSolid(nt)) continue;
          if (nt !== TileType.BUILT_FLOOR && nt !== TileType.TORCH) continue;
          visitedLeaked[ni] = 1;
          stack.push(ni);
        }
      }

      if (comp.length >= 4) {
        rooms.push(buildRoomFromCells(nextRoomNum++, comp, false));
      }
    }
  }

  // Sort main shelter room first
  rooms.sort((a, b) => (a.id === 'room_main' ? -1 : b.id === 'room_main' ? 1 : b.tileCount - a.tileCount));
  return rooms.slice(0, 6);
}

export function getShelterComfortAverage(rooms: RoomValidationInfo[], home: HomeState): number {
  if (rooms.length === 0) {
    return Math.min(40, home.furniture.length * 10);
  }
  const best = rooms.reduce((acc, r) => Math.max(acc, r.comfortScore), 0);
  return best;
}

export interface HomeActionResult {
  ok: boolean;
  message: string;
}

export function assignSlugToHabitat(
  state: GameState,
  slugUid: string,
  habitatId: HabitatId,
  chunks: ChunkManager
): HomeActionResult {
  const home = ensureHomeState(state);
  if (home.residents.length >= MAX_ACTIVE_HOME_SLUGS) {
    return {
      ok: false,
      message: `El hogar ya tiene el máximo de ${MAX_ACTIVE_HOME_SLUGS} babosas activas.`,
    };
  }

  const habDef = getHabitatDef(habitatId);
  const inHabitat = home.residents.filter((r) => r.habitatId === habitatId).length;
  if (inHabitat >= MAX_SLUGS_PER_HABITAT) {
    return {
      ok: false,
      message: `${habDef.name} ya está completo (${MAX_SLUGS_PER_HABITAT}/${MAX_SLUGS_PER_HABITAT}).`,
    };
  }

  if (home.residents.some((r) => r.slug.uid === slugUid)) {
    return { ok: false, message: 'Esa babosa ya vive en el hogar.' };
  }

  const sIdx = state.storage.findIndex((s) => s.uid === slugUid);
  if (sIdx < 0) {
    return { ok: false, message: 'Solo puedes asignar babosas desde la reserva del refugio.' };
  }

  const slug = state.storage[sIdx];
  if (!isSpeciesCompatibleWithHabitat(slug.id, habitatId)) {
    return {
      ok: false,
      message: `${slug.name} (${slug.type}) no es compatible con ${habDef.name}.`,
    };
  }

  // Move cleanly out of storage into home.residents (no duplication)
  const [moved] = state.storage.splice(sIdx, 1);
  const spot = findSpawnSpotNearAnchor(chunks, moved.id, habDef.anchorX, habDef.anchorY);
  const entry: HomeSlugEntry = {
    slug: moved,
    habitatId,
    x: spot.x,
    y: spot.y,
    targetX: spot.x,
    targetY: spot.y,
    behavior: 'pasear',
    behaviorTimer: 2.5,
    mood: 'contenta',
    hunger: 85,
    energy: 90,
    happiness: 80,
    lastPetAt: -100,
    lastPlayAt: -100,
    lastFeedAt: -100,
    reactionText: '¡En casa!',
    reactionTimer: 2,
  };
  entry.mood = computeHomeMood(entry.hunger, entry.energy, entry.happiness);
  home.residents.push(entry);

  return {
    ok: true,
    message: `${moved.name} ahora vive en ${habDef.name}.`,
  };
}

export function withdrawSlugFromHome(state: GameState, slugUid: string): HomeActionResult {
  const home = ensureHomeState(state);
  const idx = home.residents.findIndex((r) => r.slug.uid === slugUid);
  if (idx < 0) {
    return { ok: false, message: 'No se encontró esa babosa en el hogar.' };
  }
  const [removed] = home.residents.splice(idx, 1);
  state.storage.push(removed.slug);
  return {
    ok: true,
    message: `${removed.slug.name} regresó a la reserva en su cápsula.`,
  };
}

export function moveHomeSlugToHabitat(
  state: GameState,
  slugUid: string,
  targetHabitatId: HabitatId,
  chunks: ChunkManager
): HomeActionResult {
  const home = ensureHomeState(state);
  const resident = home.residents.find((r) => r.slug.uid === slugUid);
  if (!resident) return { ok: false, message: 'Babosa no encontrada en el hogar.' };
  const habDef = getHabitatDef(targetHabitatId);
  if (!isSpeciesCompatibleWithHabitat(resident.slug.id, targetHabitatId)) {
    return { ok: false, message: `${resident.slug.name} no es compatible con ${habDef.name}.` };
  }
  const count = home.residents.filter((r) => r.habitatId === targetHabitatId).length;
  if (resident.habitatId !== targetHabitatId && count >= MAX_SLUGS_PER_HABITAT) {
    return { ok: false, message: `${habDef.name} ya está completo.` };
  }
  resident.habitatId = targetHabitatId;
  const spot = findSpawnSpotNearAnchor(chunks, resident.slug.id, habDef.anchorX, habDef.anchorY);
  resident.x = spot.x;
  resident.y = spot.y;
  resident.targetX = spot.x;
  resident.targetY = spot.y;
  resident.reactionText = '¡Nuevo rincón!';
  resident.reactionTimer = 1.6;
  return { ok: true, message: `${resident.slug.name} se mudó a ${habDef.name}.` };
}

export function placeHomeFurniture(
  state: GameState,
  chunks: ChunkManager,
  kind: FurnitureKind,
  tx: number,
  ty: number
): HomeActionResult {
  const home = ensureHomeState(state);
  const invKey = kind as InventoryKey;
  if ((state.inventory[invKey] || 0) <= 0) {
    return { ok: false, message: `No tienes ${FURNITURE_DEFS[kind].name} en el inventario.` };
  }
  if (!isInShelterZone(tx, ty)) {
    return { ok: false, message: 'Solo puedes colocar mobiliario dentro de la zona del Refugio.' };
  }
  const tile = chunks.getTile(tx, ty);
  if (isTileSolid(tile) || tile === TileType.LAVA || tile === TileType.WATER || tile === TileType.TORCH) {
    return { ok: false, message: 'Ese espacio está ocupado; elige suelo libre del refugio.' };
  }
  if (home.furniture.some((f) => f.x === tx && f.y === ty)) {
    return { ok: false, message: 'Ya hay un mueble colocado en esa casilla.' };
  }
  if (home.furniture.length >= 32) {
    return { ok: false, message: 'Límite de mobiliario alcanzado en el refugio.' };
  }

  state.inventory[invKey]--;
  const furn: HomeFurniture = {
    id: `furn_${kind}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    kind,
    x: tx,
    y: ty,
  };
  home.furniture.push(furn);
  return {
    ok: true,
    message: `${FURNITURE_DEFS[kind].name} colocado en el refugio.`,
  };
}

export function pickupHomeFurnitureAt(state: GameState, tx: number, ty: number): HomeActionResult {
  const home = ensureHomeState(state);
  const idx = home.furniture.findIndex((f) => f.x === tx && f.y === ty);
  if (idx < 0) {
    return { ok: false, message: 'No hay mobiliario en esa casilla.' };
  }
  const [removed] = home.furniture.splice(idx, 1);
  const invKey = removed.kind as InventoryKey;
  state.inventory[invKey] = (state.inventory[invKey] || 0) + 1;
  return {
    ok: true,
    message: `Recogiste ${FURNITURE_DEFS[removed.kind].name}.`,
  };
}

export function pickupHomeFurnitureById(state: GameState, furnitureId: string): HomeActionResult {
  const home = ensureHomeState(state);
  const idx = home.furniture.findIndex((f) => f.id === furnitureId);
  if (idx < 0) return { ok: false, message: 'Mueble no encontrado.' };
  const [removed] = home.furniture.splice(idx, 1);
  const invKey = removed.kind as InventoryKey;
  state.inventory[invKey] = (state.inventory[invKey] || 0) + 1;
  return {
    ok: true,
    message: `Recogiste ${FURNITURE_DEFS[removed.kind].name}.`,
  };
}

export function petHomeSlug(state: GameState, slugUid: string): HomeActionResult {
  const home = ensureHomeState(state);
  const r = home.residents.find((e) => e.slug.uid === slugUid);
  if (!r) return { ok: false, message: 'Babosa no encontrada en el hogar.' };

  const now = state.playTimeSec;
  const cdLeft = Math.ceil(25 - (now - r.lastPetAt));
  r.behavior = 'acercarse';
  r.behaviorTimer = 2.2;
  r.reactionText = '♥';
  r.reactionTimer = 1.6;

  if (r.lastPetAt < 0 || now - r.lastPetAt >= 25) {
    r.lastPetAt = now;
    r.happiness = Math.min(100, r.happiness + 12);
    r.slug.bond = Math.min(100, r.slug.bond + 3);
    r.mood = computeHomeMood(r.hunger, r.energy, r.happiness);
    return {
      ok: true,
      message: `Acariciaste a ${r.slug.name} (+3 Amistad, +12 Alegría).`,
    };
  }

  r.mood = computeHomeMood(r.hunger, r.energy, r.happiness);
  return {
    ok: true,
    message: `${r.slug.name} ronronea feliz (próxima mejora de amistad en ${cdLeft}s).`,
  };
}

export function playWithHomeSlug(state: GameState, slugUid: string): HomeActionResult {
  const home = ensureHomeState(state);
  const r = home.residents.find((e) => e.slug.uid === slugUid);
  if (!r) return { ok: false, message: 'Babosa no encontrada en el hogar.' };

  if (r.energy < 18) {
    r.behavior = 'descansar';
    r.behaviorTimer = 3.5;
    r.reactionText = '💤';
    r.reactionTimer = 1.5;
    return {
      ok: false,
      message: `${r.slug.name} está cansada y prefiere descansar un poco primero.`,
    };
  }

  const now = state.playTimeSec;
  r.behavior = 'jugar';
  r.behaviorTimer = 3.2;
  r.reactionText = '★ ¡A jugar!';
  r.reactionTimer = 1.8;

  if (r.lastPlayAt < 0 || now - r.lastPlayAt >= 35) {
    r.lastPlayAt = now;
    r.happiness = Math.min(100, r.happiness + 16);
    r.energy = Math.max(0, r.energy - 10);
    r.hunger = Math.max(0, r.hunger - 5);
    r.slug.bond = Math.min(100, r.slug.bond + 4);
    r.mood = computeHomeMood(r.hunger, r.energy, r.happiness);
    return {
      ok: true,
      message: `Jugaste con ${r.slug.name} (+4 Amistad, +16 Alegría).`,
    };
  }

  const cdLeft = Math.ceil(35 - (now - r.lastPlayAt));
  r.energy = Math.max(0, r.energy - 4);
  r.mood = computeHomeMood(r.hunger, r.energy, r.happiness);
  return {
    ok: true,
    message: `${r.slug.name} da saltos contigo (siguiente bono de amistad en ${cdLeft}s).`,
  };
}

export function feedHomeSlug(
  state: GameState,
  slugUid: string,
  foodKey: InventoryKey
): HomeActionResult {
  const home = ensureHomeState(state);
  const r = home.residents.find((e) => e.slug.uid === slugUid);
  if (!r) return { ok: false, message: 'Babosa no encontrada en el hogar.' };

  const foodDef = HOME_FOOD_DEFS.find((f) => f.key === foodKey);
  if (!foodDef) return { ok: false, message: 'Alimento no compatible para el hogar.' };

  if ((state.inventory[foodKey] || 0) <= 0) {
    return { ok: false, message: `No te queda ${foodDef.label}.` };
  }

  state.inventory[foodKey]--;
  const isFavorite =
    Array.isArray(foodDef.favoriteFor) && foodDef.favoriteFor.includes(r.slug.type);
  const hungerGain = isFavorite ? 55 : foodKey === 'berries' ? 38 : 34;
  const happyGain = isFavorite ? 28 : foodKey === 'berries' ? 16 : 14;
  const energyGain = isFavorite ? 12 : 6;

  r.hunger = Math.min(100, r.hunger + hungerGain);
  r.happiness = Math.min(100, r.happiness + happyGain);
  r.energy = Math.min(100, r.energy + energyGain);

  const now = state.playTimeSec;
  let bondMsg = '';
  if (r.lastFeedAt < 0 || now - r.lastFeedAt >= 20) {
    r.lastFeedAt = now;
    const bondGain = isFavorite ? 5 : 3;
    r.slug.bond = Math.min(100, r.slug.bond + bondGain);
    bondMsg = `, +${bondGain} Amistad`;
  }

  r.mood = computeHomeMood(r.hunger, r.energy, r.happiness);
  r.reactionText = isFavorite ? '★ ¡Favorito!' : '🍖 ¡Ñam!';
  r.reactionTimer = 1.8;

  return {
    ok: true,
    message: `${r.slug.name} disfrutó ${foodDef.label} (+${hungerGain} Saciedad${bondMsg}).`,
  };
}

export function tickHomeNeeds(state: GameState, comfortAvg: number): void {
  const home = ensureHomeState(state);
  if (home.residents.length === 0) {
    home.lastNeedsTickSec = state.playTimeSec;
    return;
  }
  const elapsed = state.playTimeSec - home.lastNeedsTickSec;
  if (elapsed < 2) return;

  // Bounded delta based purely on active playTimeSec (never offline Date.now())
  const stepSec = Math.min(elapsed, 15);
  home.lastNeedsTickSec = state.playTimeSec;

  const hasFeeder = home.furniture.some((f) => f.kind === 'feeder');
  const hasRestFurn = home.furniture.some((f) => f.kind === 'nest' || f.kind === 'bed');
  const hungerMult = hasFeeder ? 0.68 : 1;
  const comfortFactor = comfortAvg / 100;

  for (const r of home.residents) {
    // Gentle non-punishing hunger decay (~0.32/sec base -> ~5 mins full to hungry)
    r.hunger = Math.max(5, r.hunger - 0.32 * hungerMult * stepSec);

    if (r.behavior === 'descansar') {
      const recovery = (hasRestFurn ? 2.6 : 1.7) + comfortFactor * 0.8;
      r.energy = Math.min(100, r.energy + recovery * stepSec);
    } else if (r.behavior === 'jugar') {
      r.energy = Math.max(10, r.energy - 0.5 * stepSec);
    } else {
      r.energy = Math.max(12, r.energy - 0.14 * stepSec);
    }

    // Happiness nudged gently by comfort & hunger
    if (r.hunger < 25) {
      r.happiness = Math.max(20, r.happiness - 0.35 * stepSec);
    } else if (comfortAvg >= 60) {
      r.happiness = Math.min(100, r.happiness + 0.12 * stepSec);
    }

    r.mood = computeHomeMood(r.hunger, r.energy, r.happiness);
  }
}

export function updateHomeResidents(
  dt: number,
  state: GameState,
  chunks: ChunkManager,
  rooms: RoomValidationInfo[],
  playerNearShelter: boolean
): void {
  const home = ensureHomeState(state);
  if (home.residents.length === 0) return;

  const comfortAvg = getShelterComfortAverage(rooms, home);
  tickHomeNeeds(state, comfortAvg);

  for (const r of home.residents) {
    if (r.reactionTimer && r.reactionTimer > 0) {
      r.reactionTimer = Math.max(0, r.reactionTimer - dt);
      if (r.reactionTimer <= 0) r.reactionText = undefined;
    }

    const habDef = getHabitatDef(r.habitatId);

    // If player left the shelter zone, anchor slugs cleanly at home in their habitat
    if (!playerNearShelter) {
      if (!isInShelterZone(r.x, r.y)) {
        const spot = findSpawnSpotNearAnchor(chunks, r.slug.id, habDef.anchorX, habDef.anchorY);
        r.x = spot.x;
        r.y = spot.y;
        r.targetX = spot.x;
        r.targetY = spot.y;
      }
      r.behavior = 'descansar';
      continue;
    }

    r.behaviorTimer -= dt;

    const distToPlayer = Math.hypot(state.player.x - r.x, state.player.y - r.y);
    if (distToPlayer < 3.4 && distToPlayer > 1.15 && r.behavior !== 'descansar' && r.behavior !== 'jugar') {
      r.behavior = 'acercarse';
      r.targetX = state.player.x;
      r.targetY = state.player.y;
    } else if (r.behaviorTimer <= 0) {
      // Pick next natural home behavior
      if (r.energy < 35) {
        r.behavior = 'descansar';
        r.behaviorTimer = 4 + Math.random() * 2.5;
        const restSpot = home.furniture.find((f) => f.kind === 'nest' || f.kind === 'bed');
        if (restSpot && canHomeSlugWalk(chunks, r.slug.id, restSpot.x, restSpot.y)) {
          r.targetX = restSpot.x;
          r.targetY = restSpot.y;
        } else {
          r.targetX = habDef.anchorX;
          r.targetY = habDef.anchorY;
        }
      } else {
        const roll = Math.random();
        if (roll < 0.28) {
          r.behavior = 'descansar';
          r.behaviorTimer = 2.8 + Math.random() * 2;
          r.targetX = r.x;
          r.targetY = r.y;
        } else {
          r.behavior = 'pasear';
          r.behaviorTimer = 2.5 + Math.random() * 3;
          const ox = habDef.anchorX + (Math.random() - 0.5) * 4.5;
          const oy = habDef.anchorY + (Math.random() - 0.5) * 4.5;
          if (canHomeSlugWalk(chunks, r.slug.id, ox, oy)) {
            r.targetX = ox;
            r.targetY = oy;
          } else {
            r.targetX = habDef.anchorX;
            r.targetY = habDef.anchorY;
          }
        }
      }
    }

    // Move toward targetX/targetY with collision avoidance
    const dx = r.targetX - r.x;
    const dy = r.targetY - r.y;
    const distTarget = Math.hypot(dx, dy);
    if (distTarget > 0.15 && (r.behavior === 'pasear' || r.behavior === 'acercarse' || r.behavior === 'jugar')) {
      const speed = r.behavior === 'jugar' ? 2.1 : r.behavior === 'acercarse' ? 1.85 : 1.25;
      const step = Math.min(distTarget, speed * dt);
      const vx = (dx / distTarget) * step;
      const vy = (dy / distTarget) * step;

      let moved = false;
      if (canHomeSlugWalk(chunks, r.slug.id, r.x + vx, r.y)) {
        r.x += vx;
        moved = true;
      }
      if (canHomeSlugWalk(chunks, r.slug.id, r.x, r.y + vy)) {
        r.y += vy;
        moved = true;
      }
      if (!moved) {
        r.targetX = r.x;
        r.targetY = r.y;
        r.behavior = 'descansar';
        r.behaviorTimer = 1.2;
      }
    } else if (!canHomeSlugWalk(chunks, r.slug.id, r.x, r.y)) {
      // Safety snap to valid habitat tile if blocked by newly built wall/door
      const safe = findSpawnSpotNearAnchor(chunks, r.slug.id, habDef.anchorX, habDef.anchorY);
      r.x = safe.x;
      r.y = safe.y;
      r.targetX = safe.x;
      r.targetY = safe.y;
    }
  }
}

export function findNearbyHomeSlug(state: GameState, maxDist = 2.1): HomeSlugEntry | null {
  const home = state.home;
  if (!home || home.residents.length === 0) return null;
  let best: HomeSlugEntry | null = null;
  let bestDist = maxDist;
  for (const r of home.residents) {
    const d = Math.hypot(r.x - state.player.x, r.y - state.player.y);
    if (d <= bestDist) {
      bestDist = d;
      best = r;
    }
  }
  return best;
}

export function cloneHomeState(home?: HomeState): HomeState {
  if (!home) return createDefaultHomeState();
  return {
    residents: home.residents.map((r) => ({
      ...r,
      slug: { ...r.slug },
    })),
    furniture: home.furniture.map((f) => ({ ...f })),
    lastNeedsTickSec: home.lastNeedsTickSec,
  };
}
