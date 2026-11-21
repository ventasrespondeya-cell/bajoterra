import {
  FURNITURE_DEFS,
  HABITAT_DEFS,
  HOME_FOOD_DEFS,
  MAX_ACTIVE_HOME_SLUGS,
  MAX_HOME_FURNITURE,
  MAX_SLUGS_PER_HABITAT,
  SHELTER_HOME_RADIUS,
  SPAWN_X,
  SPAWN_Y,
  getHabitatDef,
  getSpecies,
  isSpeciesCompatibleWithHabitat,
} from './data';
import {
  awardSlugExperience,
  ensureSlugProgressionFields,
  grantMoveMastery,
  grantSlugBond,
} from './progression';
import {
  TileType,
  type FurnitureKind,
  type GameState,
  type HabitatId,
  type HomeFurniture,
  type HomeMood,
  type HomeSlugEntry,
  type HomeState,
  type InventoryKey,
  type RoomValidationInfo,
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

export function canHomeSlugWalk(
  chunks: ChunkManager,
  speciesId: string,
  x: number,
  y: number,
  furniture: HomeFurniture[] = []
): boolean {
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
    const tx = Math.floor(px);
    const ty = Math.floor(py);
    const t = chunks.getTile(tx, ty);
    if (isTileSolid(t)) return false;
    if (t === TileType.WATER && sp.type !== 'Agua') return false;
    if (t === TileType.LAVA && sp.type !== 'Fuego') return false;
    if (furniture.length > 0 && furniture.some((f) => f.x === tx && f.y === ty)) {
      return false;
    }
  }
  return true;
}

function findAdjacentWalkableTile(
  chunks: ChunkManager,
  speciesId: string,
  tx: number,
  ty: number,
  furniture: HomeFurniture[]
): { x: number; y: number } | null {
  const offsets = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [-1, 1],
    [1, -1],
    [-1, -1],
  ];
  for (const [dx, dy] of offsets) {
    const nx = tx + dx;
    const ny = ty + dy;
    if (canHomeSlugWalk(chunks, speciesId, nx, ny, furniture)) {
      return { x: nx, y: ny };
    }
  }
  return null;
}

function findSpawnSpotNearAnchor(
  chunks: ChunkManager,
  speciesId: string,
  anchorX: number,
  anchorY: number,
  furniture: HomeFurniture[] = []
): { x: number; y: number } {
  if (canHomeSlugWalk(chunks, speciesId, anchorX, anchorY, furniture)) {
    return { x: anchorX, y: anchorY };
  }
  for (let rad = 1; rad <= 8; rad++) {
    for (let dy = -rad; dy <= rad; dy++) {
      for (let dx = -rad; dx <= rad; dx++) {
        const tx = anchorX + dx;
        const ty = anchorY + dy;
        if (canHomeSlugWalk(chunks, speciesId, tx, ty, furniture)) {
          return { x: tx, y: ty };
        }
      }
    }
  }
  return { x: SPAWN_X, y: SPAWN_Y };
}

function refreshResidentsAfterFurnitureChange(
  home: HomeState,
  chunks: ChunkManager,
  placedAt?: { x: number; y: number }
): void {
  for (const r of home.residents) {
    if (placedAt) {
      const standingOnPlaced =
        Math.floor(r.x + 0.5) === placedAt.x && Math.floor(r.y + 0.5) === placedAt.y;
      if (standingOnPlaced || !canHomeSlugWalk(chunks, r.slug.id, r.x, r.y, home.furniture)) {
        const safe = findSpawnSpotNearAnchor(
          chunks,
          r.slug.id,
          Math.round(r.x),
          Math.round(r.y),
          home.furniture
        );
        r.x = safe.x;
        r.y = safe.y;
        r.targetX = safe.x;
        r.targetY = safe.y;
      }
      const targetOnPlaced =
        Math.floor(r.targetX + 0.5) === placedAt.x && Math.floor(r.targetY + 0.5) === placedAt.y;
      if (targetOnPlaced || !canHomeSlugWalk(chunks, r.slug.id, r.targetX, r.targetY, home.furniture)) {
        r.targetX = r.x;
        r.targetY = r.y;
        r.behaviorTimer = 0;
      }
    } else {
      // Furniture removed: immediately allow choosing new routes through reopened space
      r.behaviorTimer = 0;
    }
  }
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

  rooms.sort((a, b) => (a.id === 'room_main' ? -1 : b.id === 'room_main' ? 1 : b.tileCount - a.tileCount));
  return rooms.slice(0, 6);
}

export function getShelterComfortAverage(rooms: RoomValidationInfo[], home: HomeState): number {
  if (rooms.length === 0) {
    return Math.min(40, home.furniture.length * 10);
  }
  return rooms.reduce((acc, r) => Math.max(acc, r.comfortScore), 0);
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

  const [moved] = state.storage.splice(sIdx, 1);
  ensureSlugProgressionFields(moved);
  const spot = findSpawnSpotNearAnchor(chunks, moved.id, habDef.anchorX, habDef.anchorY, home.furniture);
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
  ensureSlugProgressionFields(removed.slug);
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
  const spot = findSpawnSpotNearAnchor(
    chunks,
    resident.slug.id,
    habDef.anchorX,
    habDef.anchorY,
    home.furniture
  );
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
  if (home.furniture.length >= MAX_HOME_FURNITURE) {
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
  refreshResidentsAfterFurnitureChange(home, chunks, { x: tx, y: ty });
  return {
    ok: true,
    message: `${FURNITURE_DEFS[kind].name} colocado en el refugio.`,
  };
}

export function pickupHomeFurnitureAt(state: GameState, tx: number, ty: number, chunks?: ChunkManager): HomeActionResult {
  const home = ensureHomeState(state);
  const idx = home.furniture.findIndex((f) => f.x === tx && f.y === ty);
  if (idx < 0) {
    return { ok: false, message: 'No hay mobiliario en esa casilla.' };
  }
  const [removed] = home.furniture.splice(idx, 1);
  const invKey = removed.kind as InventoryKey;
  state.inventory[invKey] = (state.inventory[invKey] || 0) + 1;
  if (chunks) {
    refreshResidentsAfterFurnitureChange(home, chunks);
  } else {
    home.residents.forEach((r) => {
      r.behaviorTimer = 0;
    });
  }
  return {
    ok: true,
    message: `Recogiste ${FURNITURE_DEFS[removed.kind].name}.`,
  };
}

export function pickupHomeFurnitureById(state: GameState, furnitureId: string, chunks?: ChunkManager): HomeActionResult {
  const home = ensureHomeState(state);
  const idx = home.furniture.findIndex((f) => f.id === furnitureId);
  if (idx < 0) return { ok: false, message: 'Mueble no encontrado.' };
  const [removed] = home.furniture.splice(idx, 1);
  const invKey = removed.kind as InventoryKey;
  state.inventory[invKey] = (state.inventory[invKey] || 0) + 1;
  if (chunks) {
    refreshResidentsAfterFurnitureChange(home, chunks);
  } else {
    home.residents.forEach((r) => {
      r.behaviorTimer = 0;
    });
  }
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
  r.visualActivity = 'greet';
  r.facingX = state.player.x >= r.x ? 1 : -1;
  r.behaviorTimer = 2.2;
  r.reactionText = '♥';
  r.reactionTimer = 1.6;

  if (r.lastPetAt < 0 || now - r.lastPetAt >= 25) {
    r.lastPetAt = now;
    r.happiness = Math.min(100, r.happiness + 12);
    const bondRes = grantSlugBond(r.slug, 3);
    const xpMsgs = awardSlugExperience(state, r.slug, 4);
    r.mood = computeHomeMood(r.hunger, r.energy, r.happiness);
    if (bondRes.tieredUp) {
      r.reactionText = `✨ ¡${bondRes.newTier.label}!`;
      r.reactionTimer = 2.5;
    }
    const extra = xpMsgs.length > 0 ? ` ${xpMsgs[0]}` : '';
    return {
      ok: true,
      message: `Acariciaste a ${r.slug.name} (+${bondRes.gained} Amistad, +12 Alegría, +4 EXP).${extra}`,
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
  r.visualActivity = 'play';
  r.behaviorTimer = 3.2;
  r.reactionText = '★ ¡Qué divertido!';
  r.reactionTimer = 1.8;

  if (r.lastPlayAt < 0 || now - r.lastPlayAt >= 35) {
    r.lastPlayAt = now;
    r.happiness = Math.min(100, r.happiness + 16);
    r.energy = Math.max(0, r.energy - 10);
    r.hunger = Math.max(0, r.hunger - 5);
    const bondRes = grantSlugBond(r.slug, 4);
    const xpMsgs = awardSlugExperience(state, r.slug, 6);
    const moveIdx: 0 | 1 = Math.random() < 0.5 ? 0 : 1;
    grantMoveMastery(r.slug, moveIdx, 4);
    r.mood = computeHomeMood(r.hunger, r.energy, r.happiness);
    if (bondRes.tieredUp) {
      r.reactionText = `✨ ¡${bondRes.newTier.label}!`;
      r.reactionTimer = 2.5;
    }
    const extra = xpMsgs.length > 0 ? ` ${xpMsgs[0]}` : '';
    return {
      ok: true,
      message: `Jugaste con ${r.slug.name} (+${bondRes.gained} Amistad, +16 Alegría, +6 EXP).${extra}`,
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
  let extraMsg = '';
  let tieredUp = false;
  let newTierLabel = '';
  if (r.lastFeedAt < 0 || now - r.lastFeedAt >= 20) {
    r.lastFeedAt = now;
    const baseBond = isFavorite ? 5 : 3;
    const bondRes = grantSlugBond(r.slug, baseBond);
    const xpGain = isFavorite ? 6 : 4;
    const xpMsgs = awardSlugExperience(state, r.slug, xpGain);
    bondMsg = `, +${bondRes.gained} Amistad, +${xpGain} EXP`;
    tieredUp = bondRes.tieredUp;
    newTierLabel = bondRes.newTier.label;
    if (xpMsgs.length > 0) extraMsg = ` ${xpMsgs[0]}`;
  }

  r.mood = computeHomeMood(r.hunger, r.energy, r.happiness);
  r.visualActivity = 'eat';
  r.behavior = 'descansar';
  r.behaviorTimer = 2.4;
  r.reactionText = tieredUp
    ? `✨ ¡${newTierLabel}!`
    : isFavorite
    ? '★ ¡Mi favorito!'
    : '🍖 ¡Qué rico!';
  r.reactionTimer = tieredUp ? 2.5 : 1.8;

  return {
    ok: true,
    message: `${r.slug.name} disfrutó ${foodDef.label} (+${hungerGain} Saciedad${bondMsg}).${extraMsg}`,
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

  const stepSec = Math.min(elapsed, 15);
  home.lastNeedsTickSec = state.playTimeSec;

  const hasFeeder = home.furniture.some((f) => f.kind === 'feeder');
  const hasRestFurn = home.furniture.some((f) => f.kind === 'nest' || f.kind === 'bed');
  const hungerMult = hasFeeder ? 0.68 : 1;
  const comfortFactor = comfortAvg / 100;

  for (const r of home.residents) {
    r.hunger = Math.max(5, r.hunger - 0.32 * hungerMult * stepSec);

    if (r.behavior === 'descansar') {
      const recovery = (hasRestFurn ? 2.6 : 1.7) + comfortFactor * 0.8;
      r.energy = Math.min(100, r.energy + recovery * stepSec);
    } else if (r.behavior === 'jugar') {
      r.energy = Math.max(10, r.energy - 0.5 * stepSec);
    } else {
      r.energy = Math.max(12, r.energy - 0.14 * stepSec);
    }

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

    if (!playerNearShelter) {
      if (!isInShelterZone(r.x, r.y) || !canHomeSlugWalk(chunks, r.slug.id, r.x, r.y, home.furniture)) {
        const spot = findSpawnSpotNearAnchor(
          chunks,
          r.slug.id,
          habDef.anchorX,
          habDef.anchorY,
          home.furniture
        );
        r.x = spot.x;
        r.y = spot.y;
        r.targetX = spot.x;
        r.targetY = spot.y;
      }
      r.behavior = 'descansar';
      r.visualActivity = 'sleep';
      continue;
    }

    r.behaviorTimer -= dt;

    // 1. Slug-to-slug spontaneous socialization in shelter
    if (
      r.behavior !== 'descansar' &&
      r.visualActivity !== 'eat' &&
      r.visualActivity !== 'sleep' &&
      (!r.lastSocialAt || state.playTimeSec - r.lastSocialAt >= 32)
    ) {
      const peer = home.residents.find(
        (other) =>
          other.slug.uid !== r.slug.uid &&
          other.behavior !== 'descansar' &&
          other.visualActivity !== 'sleep' &&
          (!other.lastSocialAt || state.playTimeSec - other.lastSocialAt >= 32) &&
          Math.hypot(other.x - r.x, other.y - r.y) <= 2.15
      );
      if (peer) {
        r.lastSocialAt = state.playTimeSec;
        peer.lastSocialAt = state.playTimeSec;
        r.facingX = peer.x >= r.x ? 1 : -1;
        peer.facingX = r.x >= peer.x ? 1 : -1;
        r.visualActivity = 'social';
        peer.visualActivity = 'social';
        r.behavior = 'jugar';
        peer.behavior = 'jugar';
        r.behaviorTimer = 2.4;
        peer.behaviorTimer = 2.4;
        r.targetX = r.x;
        r.targetY = r.y;
        peer.targetX = peer.x;
        peer.targetY = peer.y;
        r.happiness = Math.min(100, r.happiness + 2);
        peer.happiness = Math.min(100, peer.happiness + 2);
        if (!r.reactionText) {
          r.reactionText = '♥ ¡Hola!';
          r.reactionTimer = 1.8;
        }
        if (!peer.reactionText) {
          peer.reactionText = '✨ ¡A jugar!';
          peer.reactionTimer = 1.8;
        }
      }
    }

    const distToPlayer = Math.hypot(state.player.x - r.x, state.player.y - r.y);
    const greetRadius = r.slug.bond >= 50 ? 4.4 : 3.4;
    if (
      distToPlayer < greetRadius &&
      distToPlayer > 1.15 &&
      r.behavior !== 'descansar' &&
      r.behavior !== 'jugar'
    ) {
      r.behavior = 'acercarse';
      r.visualActivity = 'greet';
      r.facingX = state.player.x >= r.x ? 1 : -1;
      if (canHomeSlugWalk(chunks, r.slug.id, state.player.x, state.player.y, home.furniture)) {
        r.targetX = state.player.x;
        r.targetY = state.player.y;
      } else {
        const adjPlayer = findAdjacentWalkableTile(
          chunks,
          r.slug.id,
          Math.floor(state.player.x + 0.5),
          Math.floor(state.player.y + 0.5),
          home.furniture
        );
        if (adjPlayer) {
          r.targetX = adjPlayer.x;
          r.targetY = adjPlayer.y;
        }
      }
      if (!r.reactionText && (!r.lastGreetAt || state.playTimeSec - r.lastGreetAt >= 30)) {
        r.lastGreetAt = state.playTimeSec;
        r.reactionText =
          r.slug.bond >= 75
            ? '♥ ¡Qué alegría verte!'
            : r.slug.bond >= 50
            ? '¡Hola, amigo!'
            : r.mood === 'hambrienta'
            ? '¿Tienes bayas?'
            : '¡Hola!';
        r.reactionTimer = 1.7;
      }
    } else if (r.behaviorTimer <= 0) {
      const feederSpot = home.furniture.find((f) => f.kind === 'feeder');
      if (feederSpot && r.hunger < 62 && Math.random() < 0.7) {
        // Spontaneous visit to home feeder & eat!
        const adjFeeder = findAdjacentWalkableTile(
          chunks,
          r.slug.id,
          feederSpot.x,
          feederSpot.y,
          home.furniture
        );
        if (adjFeeder) {
          const distFeeder = Math.hypot(adjFeeder.x - r.x, adjFeeder.y - r.y);
          if (distFeeder <= 1.2) {
            r.behavior = 'descansar';
            r.visualActivity = 'eat';
            r.behaviorTimer = 2.6;
            r.targetX = r.x;
            r.targetY = r.y;
            r.facingX = feederSpot.x >= r.x ? 1 : -1;
            r.hunger = Math.min(100, r.hunger + 6);
            r.mood = computeHomeMood(r.hunger, r.energy, r.happiness);
            if (!r.reactionText) {
              r.reactionText = '🍖 Ñam';
              r.reactionTimer = 1.6;
            }
          } else {
            r.behavior = 'pasear';
            r.visualActivity = 'walk';
            r.behaviorTimer = 3.2;
            r.targetX = adjFeeder.x;
            r.targetY = adjFeeder.y;
          }
        }
      } else if (r.energy < 35) {
        r.behavior = 'descansar';
        r.visualActivity = 'sleep';
        r.behaviorTimer = 4 + Math.random() * 2.5;
        const restSpot = home.furniture.find((f) => f.kind === 'nest' || f.kind === 'bed');
        const adjacentRest = restSpot
          ? findAdjacentWalkableTile(chunks, r.slug.id, restSpot.x, restSpot.y, home.furniture)
          : null;
        if (adjacentRest) {
          r.targetX = adjacentRest.x;
          r.targetY = adjacentRest.y;
        } else {
          const anchorSpot = findSpawnSpotNearAnchor(
            chunks,
            r.slug.id,
            habDef.anchorX,
            habDef.anchorY,
            home.furniture
          );
          r.targetX = anchorSpot.x;
          r.targetY = anchorSpot.y;
        }
        if (!r.reactionText) {
          r.reactionText = '💤 Descansando...';
          r.reactionTimer = 1.5;
        }
      } else {
        const roll = Math.random();
        if (roll < 0.16) {
          // Curious looking around (flips facing direction smoothly)
          r.behavior = 'descansar';
          r.visualActivity = 'look';
          r.facingX = (r.facingX ?? 1) > 0 ? -1 : 1;
          r.behaviorTimer = 1.9 + Math.random() * 1.4;
          r.targetX = r.x;
          r.targetY = r.y;
        } else if (roll < 0.34) {
          r.behavior = 'descansar';
          r.visualActivity = 'sleep';
          r.behaviorTimer = 2.6 + Math.random() * 2;
          r.targetX = r.x;
          r.targetY = r.y;
        } else if (roll < 0.5 && r.energy > 45) {
          r.behavior = 'jugar';
          r.visualActivity = 'play';
          r.behaviorTimer = 2.4 + Math.random() * 1.6;
          let picked: { x: number; y: number } | null = null;
          for (let attempt = 0; attempt < 5; attempt++) {
            const ox = habDef.anchorX + (Math.random() - 0.5) * 4;
            const oy = habDef.anchorY + (Math.random() - 0.5) * 4;
            if (canHomeSlugWalk(chunks, r.slug.id, ox, oy, home.furniture)) {
              picked = { x: ox, y: oy };
              break;
            }
          }
          r.targetX = picked ? picked.x : r.x;
          r.targetY = picked ? picked.y : r.y;
        } else {
          r.behavior = 'pasear';
          r.visualActivity = 'walk';
          r.behaviorTimer = 2.5 + Math.random() * 3;
          let picked: { x: number; y: number } | null = null;
          for (let attempt = 0; attempt < 6; attempt++) {
            const ox = habDef.anchorX + (Math.random() - 0.5) * 5;
            const oy = habDef.anchorY + (Math.random() - 0.5) * 5;
            if (canHomeSlugWalk(chunks, r.slug.id, ox, oy, home.furniture)) {
              picked = { x: ox, y: oy };
              break;
            }
          }
          if (!picked) {
            picked = findSpawnSpotNearAnchor(
              chunks,
              r.slug.id,
              habDef.anchorX,
              habDef.anchorY,
              home.furniture
            );
          }
          r.targetX = picked.x;
          r.targetY = picked.y;
        }
      }
    }

    // Move toward targetX/targetY avoiding walls, closed doors, hazards, and furniture
    const dx = r.targetX - r.x;
    const dy = r.targetY - r.y;
    const distTarget = Math.hypot(dx, dy);
    if (distTarget > 0.15 && (r.behavior === 'pasear' || r.behavior === 'acercarse' || r.behavior === 'jugar')) {
      if (Math.abs(dx) > 0.05) {
        r.facingX = dx >= 0 ? 1 : -1;
      }
      if (!r.visualActivity || r.visualActivity === 'sleep' || r.visualActivity === 'look') {
        r.visualActivity = r.behavior === 'jugar' ? 'play' : r.behavior === 'acercarse' ? 'greet' : 'walk';
      }
      const baseSpeed = r.behavior === 'jugar' ? 2.1 : r.behavior === 'acercarse' ? 1.9 : 1.25;
      const step = Math.min(distTarget, baseSpeed * dt);
      const vx = (dx / distTarget) * step;
      const vy = (dy / distTarget) * step;

      let moved = false;
      if (Math.abs(vx) > 0.001 && canHomeSlugWalk(chunks, r.slug.id, r.x + vx, r.y, home.furniture)) {
        r.x += vx;
        moved = true;
      }
      if (Math.abs(vy) > 0.001 && canHomeSlugWalk(chunks, r.slug.id, r.x, r.y + vy, home.furniture)) {
        r.y += vy;
        moved = true;
      }

      // If straight axis toward target is blocked (e.g., furniture in front), try perpendicular sidestep
      if (!moved) {
        const perpCandidates: Array<[number, number]> =
          Math.abs(dx) >= Math.abs(dy)
            ? [
                [0, step],
                [0, -step],
                [-vx * 0.6, 0],
              ]
            : [
                [step, 0],
                [-step, 0],
                [0, -vy * 0.6],
              ];
        for (const [sx, sy] of perpCandidates) {
          if (canHomeSlugWalk(chunks, r.slug.id, r.x + sx, r.y + sy, home.furniture)) {
            r.x += sx;
            r.y += sy;
            moved = true;
            break;
          }
        }
      }

      if (!moved) {
        r.targetX = r.x;
        r.targetY = r.y;
        r.behavior = 'descansar';
        r.visualActivity = 'look';
        r.behaviorTimer = 1.0;
      }
    } else if (!canHomeSlugWalk(chunks, r.slug.id, r.x, r.y, home.furniture)) {
      // Safety snap to valid habitat tile if blocked by newly placed wall/door/furniture
      const safe = findSpawnSpotNearAnchor(
        chunks,
        r.slug.id,
        habDef.anchorX,
        habDef.anchorY,
        home.furniture
      );
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
      slug: {
        ...r.slug,
        ...(r.slug.moveMastery ? { moveMastery: [...r.slug.moveMastery] as [number, number] } : {}),
      },
    })),
    furniture: home.furniture.map((f) => ({ ...f })),
    lastNeedsTickSec: home.lastNeedsTickSec,
  };
}
