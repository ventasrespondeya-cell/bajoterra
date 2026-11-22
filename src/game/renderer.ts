import { drawRefugioShaneDomeOverlay, drawRuneCircleOverlay } from '../assets/buildings/caveArchitecture';
import { drawHabitatZoneOverlay } from '../assets/environments/biomeDecorations';
import { getHdCharacterSprite, getHdMechaSprite } from '../assets/characters/characterSpritesheet';
import { encodeAutoTileMask, getHdTileSprite } from '../assets/environments/hdTileset';
import { type CharacterAnimState, type CharacterFacingDir, type SlugAnimState } from '../assets/manifest';
import { getHdSlugSprite } from '../assets/slugs/slugSpritesheet';
import { HIDDEN_DISCOVERIES } from './activities';
import { BIOME_INFO, BOSS_DEFINITIONS, ELEMENT_CHART, FURNITURE_DEFS, HABITAT_DEFS, TILE_PX, WORLD_H, WORLD_W, getSpecies } from './data';
import { getSlugDisplayName } from './progression';
import { sampleSlugAnimationFrame, type SlugAnimationState } from './slugArtDirection';
import { sprites, type SlugSpritePose } from './sprites';
import { STORY_CHAPTERS_BY_ID, STORY_ROUTES, STORY_SCENARIOS } from './storyData';
import { canAccessRoute, ensureStoryState } from './storyEngine';
import { TileType, type BiomeId, type GameState, type RoamingEntity, type WorldProjectile } from './types';
import { ChunkManager, WORLD_REGIONS, getBiomeAt, type WorldRegionDef, type WorldRegionKind } from './world';

export interface FullWorldMapRenderOptions {
  zoom?: number;
  panX?: number;
  panY?: number;
  filterKind?: 'all' | WorldRegionKind;
  selectedRegionId?: string | null;
  selectedScenarioId?: string | null;
}

export interface WorldMapHitTarget {
  kind: 'scenario' | 'region' | 'boss' | 'secret';
  id: string;
  name: string;
  scenarioId?: string;
  regionId?: string;
  worldX: number;
  worldY: number;
}

interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

interface FloatingLabel {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
}

function isOpaqueWallTile(tile: TileType): boolean {
  return (
    tile === TileType.ROCK ||
    tile === TileType.VOLCANIC_ROCK ||
    tile === TileType.WALL ||
    tile === TileType.CRACKED_WALL ||
    tile === TileType.ANCIENT_BRICK
  );
}

export class WorldRenderer {
  private particles: Particle[] = Array.from({ length: 220 }, () => ({
    active: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    life: 0,
    maxLife: 1,
    size: 2,
    color: '#fff',
  }));
  private labels: FloatingLabel[] = [];
  private lightCanvas: HTMLCanvasElement;
  private lightCtx: CanvasRenderingContext2D;
  private camX = 0;
  private camY = 0;
  private camReady = false;
  private shakeTime = 0;
  private shakeMag = 0;
  private companionX = 0;
  private companionY = 0;
  private pulseRing = 0;
  private pulseX = 0;
  private pulseY = 0;
  private lastStepDust = 0;

  constructor() {
    this.lightCanvas = document.createElement('canvas');
    this.lightCtx = this.lightCanvas.getContext('2d')!;
  }

  public resetCamera(px: number, py: number): void {
    this.camX = px * TILE_PX;
    this.camY = py * TILE_PX;
    this.companionX = px * TILE_PX - 16;
    this.companionY = py * TILE_PX + 8;
    this.camReady = true;
  }

  public triggerShake(mag = 5, duration = 0.22): void {
    this.shakeMag = mag;
    this.shakeTime = duration;
  }

  public triggerPulseRing(tileX: number, tileY: number): void {
    this.pulseX = (tileX + 0.5) * TILE_PX;
    this.pulseY = (tileY + 0.5) * TILE_PX;
    this.pulseRing = 1;
  }

  public spawnBurst(tileX: number, tileY: number, color: string, count = 12): void {
    let spawned = 0;
    for (let i = 0; i < this.particles.length && spawned < count; i++) {
      const p = this.particles[i];
      if (!p.active) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 20 + Math.random() * 65;
        p.active = true;
        p.x = (tileX + 0.5) * TILE_PX;
        p.y = (tileY + 0.5) * TILE_PX;
        p.vx = Math.cos(ang) * spd;
        p.vy = Math.sin(ang) * spd - 12;
        p.life = 0;
        p.maxLife = 0.35 + Math.random() * 0.4;
        p.size = 2 + Math.random() * 2.5;
        p.color = color;
        spawned++;
      }
    }
  }

  public addFloatingText(tileX: number, tileY: number, text: string, color = '#e0f2fe'): void {
    this.labels.push({
      x: (tileX + 0.5) * TILE_PX,
      y: tileY * TILE_PX,
      text,
      color,
      life: 1.15,
    });
    if (this.labels.length > 24) this.labels.shift();
  }

  public updateEffects(dt: number, state: GameState, biome: BiomeId): void {
    if (this.shakeTime > 0) this.shakeTime = Math.max(0, this.shakeTime - dt);
    if (this.pulseRing > 0) this.pulseRing = Math.max(0, this.pulseRing - dt * 1.4);

    // Smooth camera & companion follow
    const targetCamX = state.player.x * TILE_PX;
    const targetCamY = state.player.y * TILE_PX;
    if (!this.camReady) {
      this.resetCamera(state.player.x, state.player.y);
    } else {
      const lerp = 1 - Math.exp(-10 * dt);
      this.camX += (targetCamX - this.camX) * lerp;
      this.camY += (targetCamY - this.camY) * lerp;
      const compTargetX = targetCamX - state.player.facingX * 20;
      const compTargetY = targetCamY - state.player.facingY * 18;
      this.companionX += (compTargetX - this.companionX) * (1 - Math.exp(-7 * dt));
      this.companionY += (compTargetY - this.companionY) * (1 - Math.exp(-7 * dt));
    }

    // Subtle explorer footstep dust every few steps
    const stepEpoch = Math.floor(state.stats.steps * 1.4);
    if (stepEpoch !== this.lastStepDust) {
      this.lastStepDust = stepEpoch;
      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];
        if (!p.active) {
          p.active = true;
          p.x = state.player.x * TILE_PX + 14 + (Math.random() - 0.5) * 8;
          p.y = state.player.y * TILE_PX + 23;
          p.vx = (Math.random() - 0.5) * 14;
          p.vy = -8 - Math.random() * 8;
          p.life = 0;
          p.maxLife = 0.28;
          p.size = 2;
          p.color = 'rgba(203, 213, 225, 0.55)';
          break;
        }
      }
    }

    // Ambient biome atmosphere particles
    const spawnChance = state.options.lightingQuality === 'high' ? 0.42 : 0.18;
    const ambColor =
      biome === 'Magma'
        ? Math.random() < 0.5
          ? '#fb923c'
          : '#fde047'
        : biome === 'Heladas'
        ? Math.random() < 0.5
          ? '#bae6fd'
          : '#ffffff'
        : biome === 'Acuaticas'
        ? Math.random() < 0.5
          ? '#22d3ee'
          : '#a5f3fc'
        : biome === 'Cristalinas'
        ? Math.random() < 0.5
          ? '#a78bfa'
          : '#67e8f9'
        : biome === 'Sombrias'
        ? Math.random() < 0.5
          ? '#c084fc'
          : '#38bdf8'
        : Math.random() < 0.5
        ? '#6ee7b7'
        : '#5eead4';

    if (!state.options.reducedMotion && Math.random() < spawnChance) {
      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];
        if (!p.active) {
          p.active = true;
          p.x = this.camX + (Math.random() - 0.5) * 680;
          p.y = this.camY + (Math.random() - 0.5) * 460;
          p.vx = biome === 'Heladas' ? (Math.random() - 0.3) * 18 : (Math.random() - 0.5) * 14;
          p.vy =
            biome === 'Magma'
              ? -20 - Math.random() * 16
              : biome === 'Heladas'
              ? 14 + Math.random() * 14
              : biome === 'Acuaticas'
              ? -14 - Math.random() * 10
              : -6 - Math.random() * 10;
          p.life = 0;
          p.maxLife = 1.6 + Math.random() * 1.5;
          p.size = biome === 'Magma' ? 2.2 : 1.8 + Math.random() * 1.8;
          p.color = ambColor;
          break;
        }
      }
    }

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }

    for (let i = this.labels.length - 1; i >= 0; i--) {
      const lbl = this.labels[i];
      lbl.y -= 24 * dt;
      lbl.life -= dt;
      if (lbl.life <= 0) this.labels.splice(i, 1);
    }
  }

  public renderWorld(
    ctx: CanvasRenderingContext2D,
    vw: number,
    vh: number,
    timeSec: number,
    state: GameState,
    chunks: ChunkManager,
    entities: RoamingEntity[],
    targetTile: { x: number; y: number } | null,
    worldProjectiles: WorldProjectile[] = [],
    playerCombatVisual?: { aimAngle: number; dodging: boolean; invuln: boolean }
  ): void {
    ctx.imageSmoothingEnabled = true;
    ctx.clearRect(0, 0, vw, vh);

    const reduced =
      Boolean(state.options.reducedMotion) ||
      (typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const visualTime = reduced ? 0 : timeSec;
    const allowShake = !reduced && state.options.screenShake !== false;
    const sxShake = allowShake && this.shakeTime > 0 ? Math.sin(timeSec * 52) * this.shakeMag : 0;
    const syShake = allowShake && this.shakeTime > 0 ? Math.cos(timeSec * 47) * this.shakeMag : 0;

    // Tactile diorama zoom so HiDPI characters, slugs & 2.5D cliffs read crisply on desktop & mobile
    const camZoom = vw < 540 ? 1.14 : 1.24;
    const ox = Math.floor(this.camX - vw / 2 + TILE_PX / 2 + sxShake);
    const oy = Math.floor(this.camY - vh / 2 + TILE_PX / 2 + syShake);

    const halfViewTilesX = Math.ceil((vw / camZoom) / TILE_PX / 2) + 3;
    const halfViewTilesY = Math.ceil((vh / camZoom) / TILE_PX / 2) + 3;
    const centerTileX = Math.floor((ox + vw / 2) / TILE_PX);
    const centerTileY = Math.floor((oy + vh / 2) / TILE_PX);
    const x0 = Math.max(0, centerTileX - halfViewTilesX);
    const y0 = Math.max(0, centerTileY - halfViewTilesY);
    const x1 = Math.min(WORLD_W - 1, centerTileX + halfViewTilesX);
    const y1 = Math.min(WORLD_H - 1, centerTileY + halfViewTilesY);

    const lightSources: Array<{ sx: number; sy: number; r: number; color: string }> = [];

    const toScreenX = (worldPxX: number) => (worldPxX - vw / 2) * camZoom + vw / 2;
    const toScreenY = (worldPxY: number) => (worldPxY - vh / 2) * camZoom + vh / 2;

    ctx.save();
    ctx.translate(vw / 2, vh / 2);
    ctx.scale(camZoom, camZoom);
    ctx.translate(-vw / 2, -vh / 2);

    // 0.5 Abyssal Cavern Parallax Layer (visible behind chasms & rope bridges)
    ctx.fillStyle = '#02050c';
    ctx.fillRect(-16, -16, vw + 32, vh + 32);
    const pShiftX = -(this.camX * 0.25) % 96;
    const pShiftY = -(this.camY * 0.25) % 96;
    ctx.save();
    ctx.fillStyle = 'rgba(30, 58, 95, 0.14)';
    for (let py = pShiftY - 96; py < vh + 96; py += 96) {
      for (let px = pShiftX - 96; px < vw + 96; px += 96) {
        ctx.beginPath();
        ctx.ellipse(px + 48, py + 44, 34, 12, 0.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    const isAutoMatchTile = (candidate: TileType, target: TileType): boolean => {
      if (target === TileType.CHASM) return candidate === TileType.CHASM;
      return isOpaqueWallTile(candidate) || candidate === TileType.ICE;
    };

    const altarCenters: Array<{ sx: number; sy: number }> = [];

    // 1. HiDPI 2.5D Autotiled Terrain & Architectural Pass
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const tile = chunks.getTile(tx, ty);
        const biome = getBiomeAt(tx, ty, state.worldSeed);
        const hash = ((tx * 73856093) ^ (ty * 19349663) ^ (state.worldSeed * 83492791)) >>> 0;
        const variant = hash & 3;
        const sx = tx * TILE_PX - ox;
        const sy = ty * TILE_PX - oy;

        const maskBits = encodeAutoTileMask({
          n: ty > 0 ? isAutoMatchTile(chunks.getTile(tx, ty - 1), tile) : true,
          e: tx + 1 < WORLD_W ? isAutoMatchTile(chunks.getTile(tx + 1, ty), tile) : true,
          s: ty + 1 < WORLD_H ? isAutoMatchTile(chunks.getTile(tx, ty + 1), tile) : true,
          w: tx > 0 ? isAutoMatchTile(chunks.getTile(tx - 1, ty), tile) : true,
        });

        const hdTile = getHdTileSprite(tile, biome, variant, maskBits);
        if (hdTile) {
          ctx.drawImage(hdTile, 0, 0, hdTile.width, hdTile.height, sx, sy, TILE_PX, TILE_PX);
        } else {
          const sprite = sprites.getTileSprite(tile, biome, variant);
          ctx.drawImage(sprite, sx, sy);
        }

        // Organic Terrain Edge & Shoreline Blending (eliminates hard 28x28 grid seams)
        if (tile === TileType.WATER || tile === TileType.LAVA) {
          const nTile = ty > 0 ? chunks.getTile(tx, ty - 1) : tile;
          const sTile = ty + 1 < WORLD_H ? chunks.getTile(tx, ty + 1) : tile;
          const wTile = tx > 0 ? chunks.getTile(tx - 1, ty) : tile;
          const eTile = tx + 1 < WORLD_W ? chunks.getTile(tx + 1, ty) : tile;
          const rimColor =
            tile === TileType.LAVA ? 'rgba(251, 146, 60, 0.55)' : 'rgba(125, 211, 252, 0.42)';
          const bankColor =
            tile === TileType.LAVA ? 'rgba(67, 20, 7, 0.6)' : 'rgba(15, 23, 42, 0.42)';
          if (nTile !== tile && nTile !== TileType.WATERFALL) {
            ctx.fillStyle = bankColor;
            ctx.fillRect(sx, sy, TILE_PX, 4);
            ctx.fillStyle = rimColor;
            ctx.fillRect(sx + 1, sy + 4, TILE_PX - 2, 2);
          }
          if (sTile !== tile) {
            ctx.fillStyle = rimColor;
            ctx.fillRect(sx + 2, sy + TILE_PX - 3, TILE_PX - 4, 2);
          }
          if (wTile !== tile) {
            ctx.fillStyle = rimColor;
            ctx.fillRect(sx, sy + 2, 2.5, TILE_PX - 4);
          }
          if (eTile !== tile) {
            ctx.fillStyle = rimColor;
            ctx.fillRect(sx + TILE_PX - 2.5, sy + 2, 2.5, TILE_PX - 4);
          }
        } else if (tile === TileType.COBBLESTONE || tile === TileType.ICE_FLOOR) {
          const nTile = ty > 0 ? chunks.getTile(tx, ty - 1) : tile;
          if (nTile === TileType.FLOOR) {
            ctx.fillStyle =
              tile === TileType.ICE_FLOOR ? 'rgba(186, 230, 253, 0.25)' : 'rgba(71, 85, 105, 0.35)';
            ctx.fillRect(sx + 2, sy, TILE_PX - 4, 3);
          }
        }

        // Deterministic micro-details on open cavern floors
        if (tile === TileType.FLOOR && (hash & 7) === 0) {
          ctx.fillStyle =
            biome === 'Magma'
              ? 'rgba(251, 146, 60, 0.14)'
              : biome === 'Heladas'
              ? 'rgba(186, 230, 253, 0.18)'
              : biome === 'Acuaticas'
              ? 'rgba(34, 211, 238, 0.18)'
              : biome === 'Cristalinas'
              ? 'rgba(167, 139, 250, 0.2)'
              : biome === 'Sombrias'
              ? 'rgba(192, 132, 252, 0.15)'
              : 'rgba(110, 231, 183, 0.16)';
          const pxOff = 4 + ((hash >> 3) % 16);
          const pyOff = 5 + ((hash >> 7) % 15);
          ctx.fillRect(sx + pxOff, sy + pyOff, 3, 2);
          ctx.fillRect(sx + pxOff + 4, sy + pyOff + 2, 2, 2);
        }

        // 2.5D Elevation Drop Shadows beneath south-facing cliff walls
        const isWallHere = isOpaqueWallTile(tile);
        if (!isWallHere && tile !== TileType.CHASM) {
          if (ty > 0 && isOpaqueWallTile(chunks.getTile(tx, ty - 1))) {
            ctx.fillStyle = 'rgba(2, 6, 12, 0.48)';
            ctx.fillRect(sx, sy, TILE_PX, 7);
          }
          if (tx > 0 && isOpaqueWallTile(chunks.getTile(tx - 1, ty))) {
            ctx.fillStyle = 'rgba(2, 6, 12, 0.24)';
            ctx.fillRect(sx, sy, 4, TILE_PX);
          }
        }

        // Animated water, waterfalls, campfires, interactive beacons & biome illumination
        const lsx = toScreenX(sx + 14);
        const lsy = toScreenY(sy + 14);

        if (tile === TileType.LAVA) {
          const pulse = 0.18 + Math.sin(visualTime * 4 + tx + ty) * 0.1;
          ctx.fillStyle = `rgba(253, 224, 71, ${pulse})`;
          ctx.fillRect(sx + 4, sy + 6, 12, 6);
          if ((tx + ty) % 3 === 0) {
            lightSources.push({ sx: lsx, sy: lsy, r: 92, color: 'rgba(251, 146, 60, 0.65)' });
          }
        } else if (tile === TileType.WATER) {
          const shimmer = 0.14 + Math.sin(visualTime * 3 + tx * 0.8) * 0.08;
          ctx.fillStyle = `rgba(186, 230, 253, ${shimmer})`;
          ctx.fillRect(sx + 4, sy + 7 + Math.sin(visualTime * 2.2 + ty) * 2, 11, 2);
        } else if (tile === TileType.WATERFALL) {
          const flow = reduced ? 0 : Math.floor((visualTime * 20 + tx * 3) % 12);
          ctx.fillStyle = 'rgba(224, 242, 254, 0.62)';
          ctx.fillRect(sx + 7, sy + ((flow + 2) % 20), 4, 7);
          ctx.fillRect(sx + 16, sy + ((flow + 10) % 20), 4, 7);
          ctx.fillStyle = 'rgba(236, 254, 255, 0.72)';
          ctx.beginPath();
          ctx.ellipse(sx + 14, sy + 24, 11, 4, 0, 0, Math.PI * 2);
          ctx.fill();
          lightSources.push({ sx: lsx, sy: lsy, r: 94, color: 'rgba(34, 211, 238, 0.7)' });
        } else if (tile === TileType.CAMPFIRE) {
          const flicker = reduced ? 0 : Math.sin(visualTime * 16 + tx * 3) * 4;
          ctx.fillStyle = 'rgba(254, 240, 138, 0.75)';
          ctx.beginPath();
          ctx.arc(sx + 14, sy + 13 + flicker * 0.25, 3.2, 0, Math.PI * 2);
          ctx.fill();
          lightSources.push({ sx: lsx, sy: lsy, r: 145 + flicker * 2, color: 'rgba(251, 146, 60, 0.92)' });
        } else if (tile === TileType.CRYSTAL_SPIRE) {
          lightSources.push({ sx: lsx, sy: lsy, r: 108, color: 'rgba(167, 139, 250, 0.76)' });
        } else if (tile === TileType.TORCH) {
          const flick = reduced ? 6 : 6 + Math.sin(visualTime * 14 + tx * 3) * 2.5;
          lightSources.push({ sx: lsx, sy: toScreenY(sy + 10), r: 124 + flick, color: 'rgba(253, 186, 116, 0.88)' });
        } else if (tile === TileType.CHEST_CLOSED) {
          const glintAlpha = 0.42 + Math.sin(visualTime * 4.5 + tx) * 0.22;
          ctx.strokeStyle = `rgba(251, 191, 36, ${glintAlpha})`;
          ctx.lineWidth = 1.6;
          ctx.strokeRect(sx + 2, sy + 4, TILE_PX - 4, TILE_PX - 6);
          lightSources.push({ sx: lsx, sy: lsy, r: 78, color: 'rgba(251, 191, 36, 0.65)' });
        } else if (tile === TileType.CRACKED_WALL) {
          const seamAlpha = 0.45 + Math.sin(visualTime * 4 + tx + ty) * 0.2;
          ctx.strokeStyle = `rgba(103, 232, 249, ${seamAlpha})`;
          ctx.lineWidth = 1.5;
          ctx.strokeRect(sx + 2, sy + 2, TILE_PX - 4, TILE_PX - 4);
          lightSources.push({ sx: lsx, sy: lsy, r: 72, color: 'rgba(56, 189, 248, 0.58)' });
        } else if (tile === TileType.DOOR_CLOSED) {
          ctx.strokeStyle = 'rgba(251, 191, 36, 0.46)';
          ctx.lineWidth = 1.3;
          ctx.strokeRect(sx + 2, sy + 2, TILE_PX - 4, TILE_PX - 4);
        } else if (tile === TileType.ENERGY_CRYSTAL || tile === TileType.ALTAR || tile === TileType.ICE_CRYSTAL) {
          lightSources.push({
            sx: lsx,
            sy: lsy,
            r: tile === TileType.ICE_CRYSTAL ? 84 : 112,
            color: tile === TileType.ICE_CRYSTAL ? 'rgba(125, 211, 252, 0.65)' : 'rgba(45, 212, 191, 0.72)',
          });
          if (tile === TileType.ALTAR) {
            altarCenters.push({ sx: sx + TILE_PX / 2, sy: sy + TILE_PX / 2 });
            ctx.strokeStyle = `rgba(94, 234, 212, ${0.42 + Math.sin(visualTime * 4) * 0.18})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(sx + 14, sy + 14, 12 + Math.sin(visualTime * 3) * 1.4, 0, Math.PI * 2);
            ctx.stroke();
          }
        } else if (tile === TileType.SHADOW_CRYSTAL) {
          lightSources.push({ sx: lsx, sy: lsy, r: 92, color: 'rgba(192, 132, 252, 0.65)' });
        } else if (tile === TileType.EVO_STONE_VEIN) {
          lightSources.push({ sx: lsx, sy: lsy, r: 108, color: 'rgba(250, 204, 21, 0.8)' });
        } else if (tile === TileType.NEON_MUSHROOM) {
          lightSources.push({ sx: lsx, sy: lsy, r: 84, color: 'rgba(168, 85, 247, 0.62)' });
        } else if (tile === TileType.MUSHROOM) {
          lightSources.push({ sx: lsx, sy: lsy, r: 68, color: 'rgba(52, 211, 153, 0.5)' });
        } else if (tile === TileType.RECHARGE_STATION) {
          lightSources.push({ sx: lsx, sy: lsy, r: 138, color: 'rgba(56, 189, 248, 0.88)' });
          const scanAlpha = 0.4 + Math.sin(visualTime * 6 + tx) * 0.2;
          ctx.fillStyle = `rgba(125, 211, 252, ${scanAlpha})`;
          ctx.fillRect(sx + 7, sy + 9 + Math.round((Math.sin(visualTime * 4) + 1) * 4), 14, 2);
        } else if (
          (tile === TileType.ORE ||
            tile === TileType.THERMAL_COPPER ||
            tile === TileType.BLUE_QUARTZ ||
            tile === TileType.DARK_IRON) &&
          state.player.perks.includes('Visión de Cristal')
        ) {
          const glint = 0.28 + Math.sin(visualTime * 6 + tx) * 0.22;
          ctx.strokeStyle = `rgba(250, 204, 21, ${glint})`;
          ctx.lineWidth = 1.5;
          ctx.strokeRect(sx + 2, sy + 2, TILE_PX - 4, TILE_PX - 4);
        }
      }
    }

    // 1.35 Sunken Shane Sanctuary Dome & Rune Circle Shrine Decals
    if (160 >= x0 - 2 && 160 <= x1 + 2 && 160 >= y0 - 2 && 160 <= y1 + 2) {
      drawRefugioShaneDomeOverlay(
        ctx,
        160 * TILE_PX - ox + TILE_PX / 2,
        160 * TILE_PX - oy + TILE_PX / 2,
        visualTime,
        reduced
      );
    }
    for (const ac of altarCenters) {
      drawRuneCircleOverlay(ctx, ac.sx, ac.sy, visualTime, reduced);
    }

    // 1.5 Sculpted Habitat Sanctuary Zones & Placed Home Furniture
    for (const hab of HABITAT_DEFS) {
      if (hab.anchorX < x0 - 1 || hab.anchorX > x1 + 1 || hab.anchorY < y0 - 1 || hab.anchorY > y1 + 1) {
        continue;
      }
      const hsx = hab.anchorX * TILE_PX - ox;
      const hsy = hab.anchorY * TILE_PX - oy;
      drawHabitatZoneOverlay(ctx, hsx, hsy, TILE_PX, hab.accentColor, hab.floorTint, hab.name);
    }

    if (state.home?.furniture) {
      for (const furn of state.home.furniture) {
        if (furn.x < x0 || furn.x > x1 || furn.y < y0 || furn.y > y1) continue;
        const fsx = furn.x * TILE_PX - ox;
        const fsy = furn.y * TILE_PX - oy;
        ctx.drawImage(sprites.getFurnitureSprite(furn.kind), fsx, fsy);
        if (FURNITURE_DEFS[furn.kind]?.emitsLight) {
          lightSources.push({
            sx: toScreenX(fsx + 14),
            sy: toScreenY(fsy + 14),
            r: 120,
            color: 'rgba(94, 234, 212, 0.8)',
          });
        }
      }
    }

    // 2. Sculpted scanner target corner reticle
    if (targetTile) {
      const tsx = targetTile.x * TILE_PX - ox;
      const tsy = targetTile.y * TILE_PX - oy;
      const pulseAlpha = 0.7 + Math.sin(visualTime * 6) * 0.25;
      ctx.fillStyle = `rgba(94, 234, 212, ${pulseAlpha})`;
      ctx.fillRect(tsx, tsy, 7, 2);
      ctx.fillRect(tsx, tsy, 2, 7);
      ctx.fillRect(tsx + TILE_PX - 7, tsy, 7, 2);
      ctx.fillRect(tsx + TILE_PX - 2, tsy, 2, 7);
      ctx.fillRect(tsx, tsy + TILE_PX - 2, 7, 2);
      ctx.fillRect(tsx, tsy + TILE_PX - 7, 2, 7);
      ctx.fillRect(tsx + TILE_PX - 7, tsy + TILE_PX - 2, 7, 2);
      ctx.fillRect(tsx + TILE_PX - 2, tsy + TILE_PX - 7, 2, 7);
    }

    // 3. HiDPI Entities: Wild Slugs, Story NPCs, Merchants, Mercenaries & Bosses
    const animFrame = reduced ? 0 : (Math.floor(timeSec * 6) & 3);

    for (const ent of entities) {
      const ex = ent.x * TILE_PX - ox;
      const ey = ent.y * TILE_PX - oy;
      if (ex < -48 || ey < -48 || ex > vw + 48 || ey > vh + 48) continue;

      const bob = reduced ? 0 : Math.sin(timeSec * 4.2 + ent.x) * 2;
      if (ent.kind === 'wild' && ent.speciesId) {
        const sp = getSpecies(ent.speciesId);
        const anim = sampleSlugAnimationFrame(ent.speciesId, 'walk', visualTime, reduced);
        const flipLeft = Math.cos(ent.dir) < 0;
        const hdSlug = getHdSlugSprite(ent.speciesId, false, 'walk', animFrame, flipLeft ? 'left' : 'right');
        ctx.save();
        ctx.translate(ex + 14 + anim.offsetX, ey + 14 + anim.offsetY);
        ctx.rotate((anim.tiltDeg * Math.PI) / 180);
        ctx.scale(anim.scaleX, anim.scaleY);
        if (hdSlug) {
          ctx.drawImage(hdSlug, 0, 0, hdSlug.width, hdSlug.height, -16, -18, 32, 32);
        } else {
          const spr = sprites.getSpeciesSlugSprite(ent.speciesId, false, 'walk', animFrame);
          ctx.scale(flipLeft ? -1 : 1, 1);
          ctx.drawImage(spr, -12, -12);
        }
        ctx.restore();
        if (!reduced) {
          this.drawSpeciesWorldMicroVfx(ctx, ent.speciesId, ex + 14, ey + 14 + anim.offsetY, timeSec);
        }
        if (sp.type === 'Luz' || sp.type === 'Fuego') {
          lightSources.push({ sx: toScreenX(ex + 14), sy: toScreenY(ey + 14), r: 48, color: sp.accent });
        }
      } else if (
        ent.kind === 'boss' ||
        ent.kind === 'mercenary' ||
        ent.kind === 'merchant' ||
        ent.kind === 'story_npc'
      ) {
        if (ent.kind === 'boss') {
          ctx.strokeStyle = 'rgba(248, 113, 113, 0.78)';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.ellipse(ex + 14, ey + 23, 15, 6, 0, 0, Math.PI * 2);
          ctx.stroke();
        } else if (ent.kind === 'merchant') {
          lightSources.push({ sx: toScreenX(ex + 14), sy: toScreenY(ey + 14), r: 102, color: 'rgba(52, 211, 153, 0.75)' });
        } else if (ent.kind === 'story_npc') {
          ctx.strokeStyle = 'rgba(45, 212, 191, 0.75)';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.ellipse(ex + 14, ey + 23, 12, 4.5, 0, 0, Math.PI * 2);
          ctx.stroke();
          lightSources.push({ sx: toScreenX(ex + 14), sy: toScreenY(ey + 14), r: 96, color: 'rgba(45, 212, 191, 0.72)' });
        }

        const charId =
          ent.kind === 'boss'
            ? ent.bossId || 'boss_acuaticas'
            : ent.kind === 'merchant'
            ? 'merchant'
            : ent.kind === 'mercenary'
            ? 'mercenary'
            : ent.characterId || 'trixie';
        const hdNpc = getHdCharacterSprite(charId, 'down', 'idle', animFrame);
        if (hdNpc) {
          const drawSize = ent.kind === 'boss' ? 48 : 38;
          const off = (drawSize - TILE_PX) / 2;
          ctx.drawImage(
            hdNpc,
            0,
            0,
            hdNpc.width,
            hdNpc.height,
            ex - off,
            ey - off - 4 + bob * 0.45,
            drawSize,
            drawSize
          );
        } else {
          const npcSpr =
            ent.kind === 'story_npc'
              ? sprites.getStoryCharacterSprite(ent.characterId || 'trixie', animFrame & 1)
              : sprites.getNpcCharacterSprite(ent.kind, ent.bossId, animFrame & 1);
          ctx.drawImage(npcSpr, ex, ey - 1 + bob * 0.55);
        }

        const label = ent.name;
        const plaqueW = Math.max(54, label.length * 6.2 + 12);
        ctx.fillStyle = 'rgba(5, 11, 18, 0.85)';
        ctx.fillRect(ex + 14 - plaqueW / 2, ey - 18 + bob, plaqueW, 13);
        ctx.strokeStyle =
          ent.kind === 'boss'
            ? '#f87171'
            : ent.kind === 'merchant'
            ? '#34d399'
            : ent.kind === 'story_npc'
            ? '#2dd4bf'
            : '#fbbf24';
        ctx.lineWidth = 1;
        ctx.strokeRect(ex + 14 - plaqueW / 2, ey - 18 + bob, plaqueW, 13);

        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle =
          ent.kind === 'boss'
            ? '#fecaca'
            : ent.kind === 'merchant'
            ? '#a7f3d0'
            : ent.kind === 'story_npc'
            ? '#99f6e4'
            : '#fef08a';
        ctx.fillText(label, ex + 14, ey - 8 + bob);
        if (ent.kind === 'boss') {
          lightSources.push({ sx: toScreenX(ex + 14), sy: toScreenY(ey + 14), r: 120, color: 'rgba(248, 113, 113, 0.72)' });
        }
      }

      if (ent.behaviorState === 'windup' && (ent.telegraphTimer ?? 0) > 0) {
        const pulse = 0.55 + Math.sin(visualTime * 18) * 0.35;
        ctx.strokeStyle = `rgba(248, 113, 113, ${pulse.toFixed(2)})`;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(ex + 14, ey + 15, 19, 0, Math.PI * 2);
        ctx.stroke();
      }

      if ((ent.hitFlash ?? 0) > 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.beginPath();
        ctx.arc(ex + 14, ey + 14, 15, 0, Math.PI * 2);
        ctx.fill();
      }

      if (
        (ent.kind === 'wild' || ent.kind === 'mercenary' || ent.kind === 'boss') &&
        typeof ent.maxHp === 'number' &&
        ent.maxHp > 0 &&
        ent.hp < ent.maxHp
      ) {
        const barW = ent.kind === 'boss' ? 38 : 26;
        const barX = ex + 14 - barW / 2;
        const barY = ent.kind === 'wild' ? ey - 8 : ey - 24;
        const ratio = Math.max(0, Math.min(1, ent.hp / ent.maxHp));
        ctx.fillStyle = 'rgba(2, 6, 14, 0.88)';
        ctx.fillRect(barX - 1, barY - 1, barW + 2, 5);
        ctx.fillStyle = ratio > 0.5 ? '#22c55e' : ratio > 0.25 ? '#f59e0b' : '#ef4444';
        ctx.fillRect(barX, barY, barW * ratio, 3);
      }
    }

    // 3.5 HiDPI Living Home Companion Slugs roaming in the shelter
    if (state.home?.residents) {
      for (const res of state.home.residents) {
        const rsx = res.x * TILE_PX - ox;
        const rsy = res.y * TILE_PX - oy;
        if (rsx < -44 || rsy < -44 || rsx > vw + 44 || rsy > vh + 44) continue;

        const sp = getSpecies(res.slug.id);
        const activity = res.visualActivity;
        const isLooking = activity === 'look';
        const isEating = activity === 'eat';
        const isSleeping =
          activity === 'sleep' ||
          (res.behavior === 'descansar' && !isEating && !isLooking && activity !== 'play' && activity !== 'social');
        const isPlaying = activity === 'play' || activity === 'social' || res.behavior === 'jugar';
        const isWalking = activity === 'walk' || res.behavior === 'pasear' || res.behavior === 'acercarse';
        const nearPlayer = Math.hypot(res.x - state.player.x, res.y - state.player.y) <= 2.1;

        const animKind: SlugAnimationState = isEating
          ? 'eat'
          : isSleeping
          ? 'sleep'
          : isPlaying
          ? 'play'
          : isLooking
          ? 'react'
          : nearPlayer || res.reactionText
          ? 'happy'
          : isWalking
          ? 'walk'
          : 'idle';
        const anim = sampleSlugAnimationFrame(res.slug.id, animKind, visualTime, reduced);
        const bob = anim.offsetY;

        const hdPose: SlugAnimState = isEating
          ? 'eat'
          : isSleeping
          ? 'sleep'
          : isPlaying
          ? 'wing_flap'
          : nearPlayer || res.reactionText
          ? 'victory'
          : isWalking
          ? 'hop'
          : 'idle';
        const faceDir = (res.facingX ?? 1) < 0 ? 'left' : 'right';
        const hdResident = getHdSlugSprite(res.slug.id, res.slug.mega, hdPose, animFrame, faceDir);

        ctx.save();
        ctx.translate(rsx + 14 + anim.offsetX, rsy + 14 + bob);
        ctx.rotate((anim.tiltDeg * Math.PI) / 180);
        ctx.scale(anim.scaleX, anim.scaleY);
        if (hdResident) {
          ctx.drawImage(hdResident, 0, 0, hdResident.width, hdResident.height, -15, -17, 30, 30);
        } else {
          const pose: SlugSpritePose = isEating ? 'eat' : isSleeping ? 'rest' : isPlaying ? 'play' : isLooking ? 'react' : nearPlayer ? 'happy' : isWalking ? 'walk' : 'idle';
          const spr = sprites.getSpeciesSlugSprite(res.slug.id, res.slug.mega, pose, animFrame);
          ctx.scale(faceDir === 'left' ? -1 : 1, 1);
          ctx.drawImage(spr, -12, -12);
        }
        ctx.restore();

        if (!reduced) {
          if (isSleeping) {
            const zy = (timeSec * 14 + res.x * 5) % 14;
            ctx.font = 'bold 9px sans-serif';
            ctx.fillStyle = `rgba(186, 230, 253, ${1 - zy / 14})`;
            ctx.fillText('Z', rsx + 22, rsy + 4 - zy);
          } else {
            this.drawSpeciesWorldMicroVfx(ctx, res.slug.id, rsx + 14 + anim.offsetX, rsy + 14 + bob, timeSec);
          }
        }

        if (nearPlayer) {
          ctx.strokeStyle = 'rgba(94, 234, 212, 0.85)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(rsx + 14, rsy + 14, 15, 0, Math.PI * 2);
          ctx.stroke();
        }

        const displayName = getSlugDisplayName(res.slug);
        const badge =
          res.reactionText ||
          (res.mood === 'hambrienta'
            ? `${displayName} · Hambre`
            : isSleeping || res.mood === 'cansada'
            ? `${displayName} · Zzz`
            : isEating
            ? `${displayName} · Comiendo`
            : isPlaying
            ? `${displayName} · Jugando`
            : isLooking
            ? `${displayName} · Curiosa`
            : nearPlayer
            ? `${displayName} · ♥`
            : displayName);

        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(6, 13, 20, 0.82)';
        const bw = Math.max(46, badge.length * 5.6 + 10);
        ctx.fillRect(rsx + 14 - bw / 2, rsy - 15 + bob, bw, 12);
        ctx.fillStyle = res.reactionText
          ? '#fef08a'
          : res.mood === 'hambrienta'
          ? '#fdba74'
          : isSleeping || res.mood === 'cansada'
          ? '#bae6fd'
          : '#a7f3d0';
        ctx.fillText(badge, rsx + 14, rsy - 6 + bob);

        if (sp.type === 'Fuego' || sp.type === 'Luz' || sp.type === 'Electrico' || sp.type === 'Energia' || res.slug.mega) {
          lightSources.push({
            sx: toScreenX(rsx + 14),
            sy: toScreenY(rsy + 14),
            r: res.slug.mega ? 68 : 54,
            color: sp.accent,
          });
        }
      }
    }

    // 3.8 Ambient subterranean biome critters
    const curBiome = getBiomeAt(Math.round(state.player.x), Math.round(state.player.y), state.worldSeed);
    this.renderAmbientCritters(ctx, vw, vh, curBiome, visualTime, state.options.lightingQuality, reduced);

    // 4. HiDPI Companion Slug following Eli
    const activeSlug = state.party[state.activePartyIndex] || state.party[0];
    if (activeSlug) {
      const sp = getSpecies(activeSlug.id);
      const compAnim = sampleSlugAnimationFrame(activeSlug.id, 'walk', visualTime, reduced);
      const csx = this.companionX - ox;
      const csy = this.companionY - oy + compAnim.offsetY;
      const compDir = state.player.facingX < 0 ? 'left' : 'right';
      const hdComp = getHdSlugSprite(activeSlug.id, activeSlug.mega, activeSlug.mega ? 'wing_flap' : 'hop', animFrame, compDir);

      ctx.save();
      ctx.translate(csx + 14 + compAnim.offsetX, csy + 14);
      ctx.rotate((compAnim.tiltDeg * Math.PI) / 180);
      ctx.scale(compAnim.scaleX, compAnim.scaleY);
      if (hdComp) {
        ctx.drawImage(hdComp, 0, 0, hdComp.width, hdComp.height, -15, -17, 30, 30);
      } else {
        ctx.scale(compDir === 'left' ? -1 : 1, 1);
        ctx.drawImage(sprites.getSpeciesSlugSprite(activeSlug.id, activeSlug.mega, 'walk', animFrame), -12, -12);
      }
      ctx.restore();
      if (!reduced) {
        this.drawSpeciesWorldMicroVfx(ctx, activeSlug.id, csx + 14 + compAnim.offsetX, csy + 14, visualTime);
      }
      if (activeSlug.mega) {
        lightSources.push({ sx: toScreenX(csx + 14), sy: toScreenY(csy + 14), r: 62, color: 'rgba(251, 191, 36, 0.6)' });
      } else if (sp.type === 'Luz' || sp.type === 'Fuego' || sp.type === 'Energia') {
        lightSources.push({ sx: toScreenX(csx + 14), sy: toScreenY(csy + 14), r: 44, color: sp.accent });
      }
    }

    // 5. HiDPI Player Explorer Eli Shane (+ mounted Mecha Shane when active)
    const psx = state.player.x * TILE_PX - ox;
    const psy = state.player.y * TILE_PX - oy;
    const mechaMounted = Boolean(state.mecha?.unlocked && state.mecha?.active);
    const dirKey: CharacterFacingDir =
      Math.abs(state.player.facingX) > Math.abs(state.player.facingY)
        ? state.player.facingX >= 0
          ? 'right'
          : 'left'
        : state.player.facingY < 0
        ? 'up'
        : 'down';
    const walkFrame = Math.floor(state.stats.steps * 2.4) % 4;
    const playerAnim: CharacterAnimState =
      this.pulseRing > 0.45
        ? 'special'
        : Math.abs(state.stats.steps * 10) % 10 > 0
        ? 'walk'
        : 'idle';

    // Crisp explorer drop shadow
    ctx.fillStyle = 'rgba(2, 6, 23, 0.45)';
    ctx.beginPath();
    ctx.ellipse(psx + 14, psy + 24, mechaMounted ? 15 : 11, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();

    if (mechaMounted && state.mecha) {
      const hdMecha = getHdMechaSprite(state.mecha.tier, state.mecha.theme, dirKey, playerAnim, walkFrame);
      if (hdMecha) {
        ctx.drawImage(hdMecha, 0, 0, hdMecha.width, hdMecha.height, psx - 10, psy - 14, 48, 48);
      } else {
        const mechaSpr = sprites.getMechaOverlaySprite(
          state.mecha.theme,
          state.mecha.tier,
          state.player.facingX,
          state.player.facingY
        );
        ctx.drawImage(mechaSpr, psx - 3, psy - 1);
      }
    } else {
      const hdPlayer = getHdCharacterSprite('eli', dirKey, playerAnim, walkFrame);
      if (hdPlayer) {
        ctx.drawImage(hdPlayer, 0, 0, hdPlayer.width, hdPlayer.height, psx - 6, psy - 10, 40, 40);
      } else {
        const playerSprite = sprites.getExplorerSprite(state.player.facingX, state.player.facingY, walkFrame);
        ctx.drawImage(playerSprite, psx, psy);
      }
    }

    if (playerCombatVisual?.invuln || playerCombatVisual?.dodging) {
      ctx.save();
      ctx.strokeStyle = 'rgba(94, 234, 212, 0.85)';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(psx + 14, psy + 14, 18, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(45, 212, 191, 0.22)';
      ctx.fill();
      ctx.restore();
    }

    if (playerCombatVisual) {
      const aimX = psx + 14 + Math.cos(playerCombatVisual.aimAngle) * 24;
      const aimY = psy + 14 + Math.sin(playerCombatVisual.aimAngle) * 24;
      ctx.save();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.72)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(aimX, aimY, 4.2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#e0f2fe';
      ctx.beginPath();
      ctx.arc(aimX, aimY, 1.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Player headlamp spotlight
    lightSources.push({
      sx: toScreenX(psx + 14),
      sy: toScreenY(psy + 14),
      r: 205,
      color: 'rgba(186, 230, 253, 0.96)',
    });

    // 5.5 Overworld Blaster & Enemy Projectiles
    for (const wp of worldProjectiles) {
      const wpx = wp.x * TILE_PX - ox + 14;
      const wpy = wp.y * TILE_PX - oy + 14;
      if (wpx < -40 || wpy < -40 || wpx > vw + 40 || wpy > vh + 40) continue;
      const col = wp.owner === 'enemy' ? '#f87171' : ELEMENT_CHART[wp.element]?.color || '#38bdf8';

      if (wp.trail.length > 1) {
        ctx.save();
        ctx.strokeStyle = col;
        ctx.lineCap = 'round';
        for (let tIdx = 1; tIdx < wp.trail.length; tIdx++) {
          const prev = wp.trail[tIdx - 1];
          const cur = wp.trail[tIdx];
          ctx.globalAlpha = (tIdx / wp.trail.length) * 0.55;
          ctx.lineWidth = Math.max(1.5, (tIdx / wp.trail.length) * (wp.phase === 'transformed' ? 7 : 4));
          ctx.beginPath();
          ctx.moveTo(prev.x * TILE_PX - ox + 14, prev.y * TILE_PX - oy + 14);
          ctx.lineTo(cur.x * TILE_PX - ox + 14, cur.y * TILE_PX - oy + 14);
          ctx.stroke();
        }
        ctx.restore();
      }

      const radPx = wp.phase === 'transformed' ? 7.5 : 4.5;
      ctx.save();
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(wpx, wpy, radPx, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(wpx, wpy, radPx * 0.46, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      lightSources.push({ sx: toScreenX(wpx), sy: toScreenY(wpy), r: wp.phase === 'transformed' ? 68 : 42, color: col });
    }

    // Pulse exploration ring
    if (this.pulseRing > 0) {
      const prx = this.pulseX - ox;
      const pry = this.pulseY - oy;
      const radius = (1 - this.pulseRing) * 145 + 16;
      ctx.save();
      ctx.strokeStyle = `rgba(45, 212, 191, ${this.pulseRing * 0.92})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(prx, pry, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = `rgba(186, 230, 253, ${this.pulseRing * 0.5})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(prx, pry, Math.max(6, radius - 10), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 6. Particles pass
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      const alpha = 1 - p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - ox, p.y - oy, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    // 8. Floating world labels inside scaled world space
    for (const lbl of this.labels) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, lbl.life * 1.4);
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#060d14';
      ctx.fillText(lbl.text, lbl.x - ox + 1, lbl.y - oy + 1);
      ctx.fillStyle = lbl.color;
      ctx.fillText(lbl.text, lbl.x - ox, lbl.y - oy);
      ctx.restore();
    }

    ctx.restore();

    // 7. Fullscreen Atmospheric Lighting & Bloom Pass
    const currentBiome = getBiomeAt(Math.round(state.player.x), Math.round(state.player.y), state.worldSeed);
    this.renderLightingPass(ctx, vw, vh, currentBiome, lightSources, state.options.lightingQuality);
  }

  private renderLightingPass(
    ctx: CanvasRenderingContext2D,
    vw: number,
    vh: number,
    biome: BiomeId,
    lights: Array<{ sx: number; sy: number; r: number; color: string }>,
    quality: 'high' | 'eco'
  ): void {
    const info = BIOME_INFO[biome];
    if (quality === 'eco') {
      // Lightweight single vignette overlay for modest 8GB RAM laptops
      ctx.save();
      ctx.fillStyle = info.ambientHex;
      ctx.globalAlpha = info.darknessAlpha * 0.45;
      ctx.fillRect(0, 0, vw, vh);
      ctx.restore();
      return;
    }

    const scale = 0.5;
    const lw = Math.max(1, Math.floor(vw * scale));
    const lh = Math.max(1, Math.floor(vh * scale));
    if (this.lightCanvas.width !== lw || this.lightCanvas.height !== lh) {
      this.lightCanvas.width = lw;
      this.lightCanvas.height = lh;
    }

    const lg = this.lightCtx;
    lg.globalCompositeOperation = 'source-over';
    lg.clearRect(0, 0, lw, lh);
    lg.fillStyle = info.ambientHex;
    lg.globalAlpha = info.darknessAlpha;
    lg.fillRect(0, 0, lw, lh);
    lg.globalAlpha = 1;

    lg.globalCompositeOperation = 'destination-out';
    for (const l of lights) {
      const lx = l.sx * scale;
      const ly = l.sy * scale;
      const lr = l.r * scale;
      if (lx < -lr || ly < -lr || lx > lw + lr || ly > lh + lr) continue;
      const grad = lg.createRadialGradient(lx, ly, lr * 0.12, lx, ly, lr);
      grad.addColorStop(0, 'rgba(0,0,0,0.96)');
      grad.addColorStop(0.55, 'rgba(0,0,0,0.48)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      lg.fillStyle = grad;
      lg.beginPath();
      lg.arc(lx, ly, lr, 0, Math.PI * 2);
      lg.fill();
    }

    ctx.drawImage(this.lightCanvas, 0, 0, vw, vh);

    // Subtle colored bloom for bright crystals/torches
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.15;
    for (const l of lights) {
      const bloomR = l.r * 0.65;
      if (l.sx < -bloomR || l.sy < -bloomR || l.sx > vw + bloomR || l.sy > vh + bloomR) continue;
      const grad = ctx.createRadialGradient(l.sx, l.sy, 2, l.sx, l.sy, bloomR);
      grad.addColorStop(0, l.color);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(l.sx, l.sy, bloomR, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private renderAmbientCritters(
    ctx: CanvasRenderingContext2D,
    vw: number,
    vh: number,
    biome: BiomeId,
    timeSec: number,
    quality: 'high' | 'eco',
    reducedMotion: boolean
  ): void {
    const count = reducedMotion ? 2 : quality === 'eco' ? 4 : 8;
    const wing = reducedMotion ? 1.5 : 1 + Math.abs(Math.sin(timeSec * 14)) * 2.2;
    ctx.save();
    for (let i = 0; i < count; i++) {
      const speedX = biome === 'Heladas' ? 14 : 20 + (i % 3) * 6;
      const fx = ((i * 137 + timeSec * speedX * (i % 2 === 0 ? 1 : -0.7)) % Math.max(120, vw) + Math.max(120, vw)) % Math.max(120, vw);
      const fy = ((i * 97 + Math.sin(timeSec * 1.8 + i * 1.3) * 28) % Math.max(120, vh) + Math.max(120, vh)) % Math.max(120, vh);
      if (biome === 'Verdes') {
        // Bioluminescent spore fireflies
        ctx.fillStyle = i % 2 === 0 ? '#6ee7b7' : '#fde047';
        ctx.globalAlpha = 0.45 + Math.sin(timeSec * 5 + i) * 0.25;
        ctx.fillRect(fx, fy, 2.5, 2.5);
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillRect(fx - wing * 0.5, fy - 1, wing, 1);
      } else if (biome === 'Magma') {
        // Magma ember wisps
        ctx.fillStyle = i % 2 === 0 ? '#fb923c' : '#fef08a';
        ctx.globalAlpha = 0.5;
        ctx.fillRect(fx, fy - ((timeSec * 24 + i * 11) % 36), 2.5, 3);
      } else if (biome === 'Heladas') {
        // Floating prism ice sprites
        ctx.fillStyle = '#bae6fd';
        ctx.globalAlpha = 0.48;
        ctx.fillRect(fx, fy, 2, 2);
        ctx.fillRect(fx + 2, fy + 2, 2, 2);
      } else if (biome === 'Acuaticas') {
        // Luminous aquatic bubbles & darting mist droplets
        ctx.strokeStyle = i % 2 === 0 ? '#22d3ee' : '#a5f3fc';
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.48;
        ctx.beginPath();
        ctx.arc(fx, fy - ((timeSec * 16 + i * 9) % 24), 2.2, 0, Math.PI * 2);
        ctx.stroke();
      } else if (biome === 'Cristalinas') {
        // Prismatic crystal light shards
        ctx.fillStyle = i % 2 === 0 ? '#a78bfa' : '#67e8f9';
        ctx.globalAlpha = 0.5 + Math.sin(timeSec * 4 + i) * 0.2;
        ctx.fillRect(fx, fy - 2, 2, 5);
        ctx.fillRect(fx - 1.5, fy, 5, 1.5);
      } else {
        // Abyssal shadow moths
        ctx.fillStyle = i % 2 === 0 ? '#c084fc' : '#f472b6';
        ctx.globalAlpha = 0.45;
        ctx.fillRect(fx - wing, fy, wing * 2 + 1, 2);
      }
    }
    ctx.restore();
  }

  public renderMinimap(canvas: HTMLCanvasElement, state: GameState): void {
    const g = canvas.getContext('2d');
    if (!g) return;
    const w = canvas.width;
    const h = canvas.height;
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#060d14';
    g.fillRect(0, 0, w, h);

    const viewRange = 72;
    const px = Math.round(state.player.x);
    const py = Math.round(state.player.y);
    const step = 4;
    const cellPx = (w / (viewRange * 2)) * step;

    for (let dy = -viewRange; dy <= viewRange; dy += step) {
      for (let dx = -viewRange; dx <= viewRange; dx += step) {
        const wx = px + dx;
        const wy = py + dy;
        if (wx < 0 || wy < 0 || wx >= WORLD_W || wy >= WORLD_H) continue;
        const cx = Math.floor(wx / 16);
        const cy = Math.floor(wy / 16);
        const explored = !!state.exploredChunks[`${cx},${cy}`];
        const b = getBiomeAt(wx, wy, state.worldSeed);
        g.fillStyle = BIOME_INFO[b].mapColor;
        g.globalAlpha = explored ? 0.94 : 0.2;
        const mx = ((dx + viewRange) / (viewRange * 2)) * w;
        const my = ((dy + viewRange) / (viewRange * 2)) * h;
        g.fillRect(mx, my, cellPx + 0.6, cellPx + 0.6);
      }
    }
    g.globalAlpha = 1;

    // Boss markers on minimap if in range
    for (const boss of BOSS_DEFINITIONS) {
      if (state.defeatedBosses.includes(boss.id)) continue;
      const dx = boss.x - px;
      const dy = boss.y - py;
      if (Math.abs(dx) <= viewRange && Math.abs(dy) <= viewRange) {
        const mx = ((dx + viewRange) / (viewRange * 2)) * w;
        const my = ((dy + viewRange) / (viewRange * 2)) * h;
        g.fillStyle = '#f87171';
        g.beginPath();
        g.arc(mx, my, 3.4, 0, Math.PI * 2);
        g.fill();
      }
    }

    // Discovered POI markers on minimap
    if (state.discoveredPOIs) {
      for (const poi of state.discoveredPOIs) {
        const dx = poi.x - px;
        const dy = poi.y - py;
        if (Math.abs(dx) <= viewRange && Math.abs(dy) <= viewRange) {
          const mx = ((dx + viewRange) / (viewRange * 2)) * w;
          const my = ((dy + viewRange) / (viewRange * 2)) * h;
          g.fillStyle = poi.kind === 'crystal_chamber' ? '#38bdf8' : poi.kind === 'ancient_ruins' ? '#c084fc' : '#2dd4bf';
          g.fillRect(mx - 2, my - 2, 4, 4);
        }
      }
    }

    // Shelter beacon (160,160)
    const sdx = 160 - px;
    const sdy = 160 - py;
    if (Math.abs(sdx) <= viewRange && Math.abs(sdy) <= viewRange) {
      const mx = ((sdx + viewRange) / (viewRange * 2)) * w;
      const my = ((sdy + viewRange) / (viewRange * 2)) * h;
      g.fillStyle = '#fbbf24';
      g.fillRect(mx - 3, my - 3, 6, 6);
      g.strokeStyle = '#ffffff';
      g.lineWidth = 1;
      g.strokeRect(mx - 3, my - 3, 6, 6);
    }

    // Player beacon at center
    g.fillStyle = '#38bdf8';
    g.strokeStyle = '#ffffff';
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(w / 2, h / 2, 3.8, 0, Math.PI * 2);
    g.fill();
    g.stroke();

    // Crisp outer reticle frame
    g.strokeStyle = 'rgba(45, 212, 191, 0.35)';
    g.lineWidth = 1;
    g.strokeRect(0.5, 0.5, w - 1, h - 1);
  }

  public renderFullWorldMap(
    canvas: HTMLCanvasElement,
    state: GameState,
    options?: FullWorldMapRenderOptions
  ): void {
    const g = canvas.getContext('2d');
    if (!g) return;
    const w = canvas.width;
    const h = canvas.height;
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#050b13';
    g.fillRect(0, 0, w, h);

    const zoom = Math.max(1, Math.min(3.5, options?.zoom ?? 1));
    const panX = options?.panX ?? 0;
    const panY = options?.panY ?? 0;
    const filterKind = options?.filterKind ?? 'all';
    const selectedRegionId = options?.selectedRegionId ?? null;
    const selectedScenarioId = options?.selectedScenarioId ?? null;

    const toScreen = (wx: number, wy: number) => {
      const bx = (wx / WORLD_W) * w;
      const by = (wy / WORLD_H) * h;
      return {
        x: (bx - w / 2) * zoom + w / 2 + panX,
        y: (by - h / 2) * zoom + h / 2 + panY,
      };
    };

    const chunksPerSide = WORLD_W / 16; // 20
    const cw = (w / chunksPerSide) * zoom;
    const ch = (h / chunksPerSide) * zoom;
    const originX = (0 - w / 2) * zoom + w / 2 + panX;
    const originY = (0 - h / 2) * zoom + h / 2 + panY;

    // 1. Contiguous subterranean biome terrain with smooth fog-of-war veil
    for (let cy = 0; cy < chunksPerSide; cy++) {
      for (let cx = 0; cx < chunksPerSide; cx++) {
        const rx = originX + cx * cw;
        const ry = originY + cy * ch;
        if (rx + cw < -4 || ry + ch < -4 || rx > w + 4 || ry > h + 4) continue;
        const wx = cx * 16 + 8;
        const wy = cy * 16 + 8;
        const b = getBiomeAt(wx, wy, state.worldSeed);
        const explored = !!state.exploredChunks[`${cx},${cy}`];
        g.fillStyle = BIOME_INFO[b].mapColor;
        g.globalAlpha = explored ? 0.9 : 0.24;
        g.fillRect(rx, ry, cw + 0.8, ch + 0.8);

        // Subterranean topographic contour rim between adjacent biomes
        const bRight = cx + 1 < chunksPerSide ? getBiomeAt((cx + 1) * 16 + 8, wy, state.worldSeed) : b;
        const bDown = cy + 1 < chunksPerSide ? getBiomeAt(wx, (cy + 1) * 16 + 8, state.worldSeed) : b;
        g.globalAlpha = 0.36;
        g.fillStyle = '#03070e';
        if (bRight !== b) {
          g.fillRect(rx + cw - 1, ry, 2, ch + 0.6);
        }
        if (bDown !== b) {
          g.fillRect(rx, ry + ch - 1, cw + 0.6, 2);
        }
      }
    }
    g.globalAlpha = 1;

    // Subtle geological coordinate grid
    g.strokeStyle = 'rgba(148, 163, 184, 0.09)';
    g.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const top = toScreen((WORLD_W * i) / 4, 0);
      const bot = toScreen((WORLD_W * i) / 4, WORLD_H);
      const lft = toScreen(0, (WORLD_H * i) / 4);
      const rgt = toScreen(WORLD_W, (WORLD_H * i) / 4);
      g.beginPath();
      g.moveTo(top.x, Math.max(0, top.y));
      g.lineTo(bot.x, Math.min(h, bot.y));
      g.moveTo(Math.max(0, lft.x), lft.y);
      g.lineTo(Math.min(w, rgt.x), rgt.y);
      g.stroke();
    }

    // Secondary organic subterranean arteries connecting settlements & landmarks
    const secondaryLinks: Array<[string, string]> = [
      ['reg_refugio_shane', 'reg_santuario_musgo'],
      ['reg_valle_verde', 'reg_paso_rio'],
      ['reg_paso_rio', 'reg_marea_azul'],
      ['reg_marea_azul', 'reg_muelle_oscuro'],
      ['reg_marea_azul', 'reg_ruinas_cascada'],
      ['reg_camp_termal', 'reg_fragua_magma'],
      ['reg_camp_termal', 'reg_puente_grieta'],
      ['reg_puente_deshielo', 'reg_catacumba_glacial'],
      ['reg_escalinata_norte', 'reg_sendero_agujas'],
      ['reg_sendero_agujas', 'reg_vigia_prisma'],
      ['reg_vigia_prisma', 'reg_templo_cuarzo'],
      ['reg_torre_voltaica', 'reg_templo_cuarzo'],
      ['reg_gran_falla', 'reg_galeria_ecos'],
      ['reg_galeria_ecos', 'reg_bastion_sombrio'],
    ];
    const regionsById = new Map<string, WorldRegionDef>();
    for (const r of WORLD_REGIONS) regionsById.set(r.id, r);
    g.save();
    g.strokeStyle = 'rgba(45, 212, 191, 0.2)';
    g.lineWidth = 1.4;
    for (const [aId, bId] of secondaryLinks) {
      const ra = regionsById.get(aId);
      const rb = regionsById.get(bId);
      if (!ra || !rb) continue;
      const p1 = toScreen(ra.x, ra.y);
      const p2 = toScreen(rb.x, rb.y);
      g.beginPath();
      g.moveTo(p1.x, p1.y);
      g.lineTo(p2.x, p2.y);
      g.stroke();
    }
    g.restore();

    // 2. Interconnected cavern story routes with dark halo so unlocked vs locked routes read crisply
    const story = ensureStoryState(state);
    const activeChapter = STORY_CHAPTERS_BY_ID[story.currentChapterId];
    for (const route of Object.values(STORY_ROUTES)) {
      const fromSc = STORY_SCENARIOS[route.fromScenarioId];
      const toSc = STORY_SCENARIOS[route.toScenarioId];
      if (!fromSc || !toSc) continue;
      const p1 = toScreen(fromSc.worldAnchor.x, fromSc.worldAnchor.y);
      const p2 = toScreen(toSc.worldAnchor.x, toSc.worldAnchor.y);
      const access = canAccessRoute(state, route.id);
      g.save();
      g.beginPath();
      g.strokeStyle = 'rgba(4, 10, 18, 0.75)';
      g.lineWidth = access.allowed ? 4.4 : 2.8;
      g.moveTo(p1.x, p1.y);
      g.lineTo(p2.x, p2.y);
      g.stroke();

      g.beginPath();
      if (!access.allowed) {
        g.setLineDash([4, 4]);
        g.strokeStyle = 'rgba(148, 163, 184, 0.45)';
        g.lineWidth = 1.5;
      } else {
        g.strokeStyle = 'rgba(94, 234, 212, 0.85)';
        g.lineWidth = 2.3;
      }
      g.moveTo(p1.x, p1.y);
      g.lineTo(p2.x, p2.y);
      g.stroke();
      g.restore();
    }

    // 3. Discovered POIs only (undiscovered chambers/ruins stay hidden until explored)
    if (state.discoveredPOIs) {
      for (const poi of state.discoveredPOIs) {
        const pt = toScreen(poi.x, poi.y);
        if (pt.x < -8 || pt.y < -8 || pt.x > w + 8 || pt.y > h + 8) continue;
        g.fillStyle = poi.kind === 'crystal_chamber' ? '#38bdf8' : poi.kind === 'ancient_ruins' ? '#c084fc' : '#2dd4bf';
        g.fillRect(pt.x - 2.5, pt.y - 2.5, 5, 5);
      }
    }

    // 4. Discovered hidden shrines ONLY (never reveal undiscovered secrets prematurely)
    for (const sec of HIDDEN_DISCOVERIES) {
      if (!sec.worldCoords || !state.discoveredSecrets?.includes(sec.id)) continue;
      const pt = toScreen(sec.worldCoords.x, sec.worldCoords.y);
      if (pt.x < -12 || pt.y < -12 || pt.x > w + 12 || pt.y > h + 12) continue;
      g.save();
      g.translate(pt.x, pt.y);
      g.rotate(Math.PI / 4);
      g.fillStyle = '#c084fc';
      g.fillRect(-3, -3, 6, 6);
      g.strokeStyle = '#f5d0fe';
      g.lineWidth = 1;
      g.strokeRect(-3, -3, 6, 6);
      g.restore();
    }

    const drawLabel = (txt: string, lx: number, ly: number, color: string, align: 'left' | 'right') => {
      g.textAlign = align;
      g.fillStyle = 'rgba(4, 9, 16, 0.92)';
      g.fillText(txt, lx + 1, ly + 1);
      g.fillText(txt, lx - 1, ly);
      g.fillText(txt, lx, ly - 1);
      g.fillStyle = color;
      g.fillText(txt, lx, ly);
    };

    // 4.5 WORLD_REGIONS Nodes (Settlements, Dungeons, Enemy Bases & Explored Landmarks)
    for (const reg of WORLD_REGIONS) {
      if (filterKind !== 'all' && reg.kind !== filterKind) continue;
      const pt = toScreen(reg.x, reg.y);
      if (pt.x < -16 || pt.y < -16 || pt.x > w + 16 || pt.y > h + 16) continue;
      const cx = Math.floor(reg.x / 16);
      const cy = Math.floor(reg.y / 16);
      const chunkExplored = Boolean(state.exploredChunks[`${cx},${cy}`]);
      const isSelected = selectedRegionId === reg.id;

      // Keep story scenario anchors clean from double-markers unless filtered specifically
      if (reg.scenarioId && filterKind === 'all' && !isSelected) continue;

      if (isSelected) {
        g.strokeStyle = '#facc15';
        g.lineWidth = 2;
        g.beginPath();
        g.arc(pt.x, pt.y, 10, 0, Math.PI * 2);
        g.stroke();
      }

      if (reg.kind === 'settlement') {
        // Warm amber house icon (using only stub-safe moveTo/lineTo/fill/stroke)
        g.fillStyle = '#fbbf24';
        g.strokeStyle = '#060c14';
        g.lineWidth = 1.1;
        g.beginPath();
        g.moveTo(pt.x, pt.y - 5.5);
        g.lineTo(pt.x + 5, pt.y - 0.5);
        g.lineTo(pt.x + 3.5, pt.y - 0.5);
        g.lineTo(pt.x + 3.5, pt.y + 4.5);
        g.lineTo(pt.x - 3.5, pt.y + 4.5);
        g.lineTo(pt.x - 3.5, pt.y - 0.5);
        g.lineTo(pt.x - 5, pt.y - 0.5);
        g.lineTo(pt.x, pt.y - 5.5);
        g.fill();
        g.stroke();
      } else if (reg.kind === 'dungeon') {
        // Violet/cyan temple arch diamond
        g.fillStyle = '#c084fc';
        g.strokeStyle = '#060c14';
        g.lineWidth = 1.1;
        g.beginPath();
        g.moveTo(pt.x, pt.y - 5.5);
        g.lineTo(pt.x + 5, pt.y);
        g.lineTo(pt.x, pt.y + 5.5);
        g.lineTo(pt.x - 5, pt.y);
        g.lineTo(pt.x, pt.y - 5.5);
        g.fill();
        g.stroke();
      } else if (reg.kind === 'enemy_base') {
        // Crimson fortified turret diamond
        g.fillStyle = '#ef4444';
        g.strokeStyle = '#060c14';
        g.lineWidth = 1.1;
        g.beginPath();
        g.moveTo(pt.x - 4, pt.y - 4.5);
        g.lineTo(pt.x + 4, pt.y - 4.5);
        g.lineTo(pt.x + 4, pt.y + 4.5);
        g.lineTo(pt.x - 4, pt.y + 4.5);
        g.lineTo(pt.x - 4, pt.y - 4.5);
        g.fill();
        g.stroke();
      } else if (chunkExplored || zoom >= 1.3 || filterKind === 'landmark' || isSelected) {
        g.fillStyle = chunkExplored ? '#5eead4' : 'rgba(148, 163, 184, 0.55)';
        g.beginPath();
        g.arc(pt.x, pt.y, isSelected ? 3.6 : 2.3, 0, Math.PI * 2);
        g.fill();
      }

      const showRegionLabel =
        isSelected ||
        (!reg.scenarioId &&
          ((reg.kind !== 'landmark' && (zoom >= 1.32 || filterKind === reg.kind)) ||
            (reg.kind === 'landmark' && (zoom >= 1.75 || filterKind === 'landmark'))));
      if (showRegionLabel) {
        const alignRight = pt.x > w * 0.68;
        g.font = 'bold 9px sans-serif';
        const lblColor =
          reg.kind === 'settlement'
            ? '#fde68a'
            : reg.kind === 'dungeon'
            ? '#e9d5ff'
            : reg.kind === 'enemy_base'
            ? '#fca5a5'
            : '#99f6e4';
        drawLabel(reg.name, alignRight ? pt.x - 7 : pt.x + 7, pt.y + 3, lblColor, alignRight ? 'right' : 'left');
      }
    }

    // 5. Story Scenario nodes (visited / accessible / locked + active chapter objective)
    if (filterKind === 'all') {
      for (const sc of Object.values(STORY_SCENARIOS)) {
        const pt = toScreen(sc.worldAnchor.x, sc.worldAnchor.y);
        const mx = pt.x;
        const my = pt.y;
        const isRefugio = sc.id === 'esc_refugio_shane';
        const isCurrent = story.currentScenarioId === sc.id;
        const isSelectedSc = selectedScenarioId === sc.id;
        const isVisited = story.visitedScenarioIds.includes(sc.id);
        const isUnlocked = story.unlockedScenarioIds.includes(sc.id);
        const isObjective = activeChapter?.scenarioIds.includes(sc.id);

        if (isObjective || isSelectedSc) {
          g.strokeStyle = isSelectedSc ? '#67e8f9' : '#fbbf24';
          g.lineWidth = 1.8;
          g.beginPath();
          g.arc(mx, my, isRefugio ? 9.5 : 8, 0, Math.PI * 2);
          g.stroke();
        }

        if (isRefugio) {
          g.fillStyle = '#fde047';
          g.beginPath();
          g.arc(mx, my, 5.5, 0, Math.PI * 2);
          g.fill();
          g.strokeStyle = '#060c14';
          g.lineWidth = 1.3;
          g.stroke();
          g.font = 'bold 11px sans-serif';
          drawLabel('Refugio', mx - 9, my + 4, '#fef08a', 'right');
        } else {
          g.fillStyle = isCurrent
            ? '#38bdf8'
            : isVisited
            ? '#2dd4bf'
            : isUnlocked
            ? '#fbbf24'
            : '#475569';
          g.beginPath();
          g.arc(mx, my, 4.4, 0, Math.PI * 2);
          g.fill();
          g.strokeStyle = '#060c14';
          g.lineWidth = 1.2;
          g.stroke();

          const alignRight =
            mx > w * 0.65 ||
            sc.id === 'esc_caverna_descenso' ||
            sc.id === 'esc_caverna_magma';
          const tx = alignRight ? mx - 7 : mx + 7;
          g.font = 'bold 9.5px sans-serif';
          const shortLabel = isUnlocked || isVisited ? sc.name : `🔒 ${sc.name}`;
          const labelOffsetY =
            sc.id === 'esc_templo_cristalino'
              ? my - 10
              : sc.id === 'esc_puesto_agua_oscura' || sc.id === 'esc_pueblo_valle_verde'
              ? my - 8
              : my - 7;
          drawLabel(shortLabel, tx, labelOffsetY, isUnlocked || isVisited ? '#f1f5f9' : '#94a3b8', alignRight ? 'right' : 'left');
        }
      }
    }

    // 6. Bosses (placed below node marker so scenario titles above never collide)
    for (const boss of BOSS_DEFINITIONS) {
      const pt = toScreen(boss.x, boss.y);
      const bx = pt.x;
      const by = pt.y;
      const defeated = state.defeatedBosses.includes(boss.id);
      const alignRight = bx > w * 0.65 || boss.id === 'boss_crystal';
      const tx = alignRight ? bx - 7 : bx + 7;
      g.fillStyle = defeated ? '#4ade80' : '#ef4444';
      g.beginPath();
      g.arc(bx, by, 4.4, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#060c14';
      g.lineWidth = 1.1;
      g.stroke();
      g.font = 'bold 10px sans-serif';
      const txt = defeated ? `✓ ${boss.name}` : boss.name;
      const bossOffsetY =
        boss.id === 'boss_aquatic' ? by + 16 : boss.id === 'boss_crystal' ? by + 13 : by + 11;
      drawLabel(txt, tx, bossOffsetY, defeated ? '#86efac' : '#fecaca', alignRight ? 'right' : 'left');
    }
    g.textAlign = 'left';

    // 7. Player marker
    const playerPt = toScreen(state.player.x, state.player.y);
    g.strokeStyle = 'rgba(56, 189, 248, 0.55)';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(playerPt.x, playerPt.y, 9, 0, Math.PI * 2);
    g.stroke();

    g.fillStyle = '#38bdf8';
    g.strokeStyle = '#ffffff';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(playerPt.x, playerPt.y, 5.2, 0, Math.PI * 2);
    g.fill();
    g.stroke();

    // 8. Subtle Compass Rose in top-left corner
    g.fillStyle = 'rgba(5, 11, 19, 0.72)';
    g.fillRect(6, 6, 26, 26);
    g.strokeStyle = 'rgba(94, 234, 212, 0.4)';
    g.lineWidth = 1;
    g.strokeRect(6, 6, 26, 26);
    g.font = 'bold 9px sans-serif';
    g.textAlign = 'left';
    g.fillStyle = '#5eead4';
    g.fillText('N', 16, 17);
    g.fillStyle = '#94a3b8';
    g.fillText('O', 9, 27);
    g.fillText('E', 22, 27);
  }

  public hitTestWorldMapNode(
    w: number,
    h: number,
    clickX: number,
    clickY: number,
    state: GameState,
    options?: FullWorldMapRenderOptions
  ): WorldMapHitTarget | null {
    const zoom = Math.max(1, Math.min(3.5, options?.zoom ?? 1));
    const panX = options?.panX ?? 0;
    const panY = options?.panY ?? 0;
    const filterKind = options?.filterKind ?? 'all';
    const toScreen = (wx: number, wy: number) => {
      const bx = (wx / WORLD_W) * w;
      const by = (wy / WORLD_H) * h;
      return {
        x: (bx - w / 2) * zoom + w / 2 + panX,
        y: (by - h / 2) * zoom + h / 2 + panY,
      };
    };

    let best: { dist: number; target: WorldMapHitTarget } | null = null;
    const consider = (dist: number, target: WorldMapHitTarget) => {
      if (dist <= 16 && (!best || dist < best.dist)) {
        best = { dist, target };
      }
    };

    // Priority 1: Story Scenarios (when shown)
    if (filterKind === 'all') {
      for (const sc of Object.values(STORY_SCENARIOS)) {
        const pt = toScreen(sc.worldAnchor.x, sc.worldAnchor.y);
        const d = Math.hypot(pt.x - clickX, pt.y - clickY);
        const matchingRegion = WORLD_REGIONS.find((r) => r.scenarioId === sc.id);
        consider(d, {
          kind: 'scenario',
          id: sc.id,
          name: sc.name,
          scenarioId: sc.id,
          regionId: matchingRegion?.id,
          worldX: sc.worldAnchor.x,
          worldY: sc.worldAnchor.y,
        });
      }
    }

    // Priority 2: WORLD_REGIONS nodes matching active filter
    for (const reg of WORLD_REGIONS) {
      if (filterKind !== 'all' && reg.kind !== filterKind) continue;
      const pt = toScreen(reg.x, reg.y);
      const d = Math.hypot(pt.x - clickX, pt.y - clickY);
      consider(d, {
        kind: 'region',
        id: reg.id,
        name: reg.name,
        scenarioId: reg.scenarioId,
        regionId: reg.id,
        worldX: reg.x,
        worldY: reg.y,
      });
    }

    // Priority 3: Discovered secrets
    for (const sec of HIDDEN_DISCOVERIES) {
      if (!sec.worldCoords || !state.discoveredSecrets?.includes(sec.id)) continue;
      const pt = toScreen(sec.worldCoords.x, sec.worldCoords.y);
      const d = Math.hypot(pt.x - clickX, pt.y - clickY);
      consider(d, {
        kind: 'secret',
        id: sec.id,
        name: sec.title,
        scenarioId: sec.scenarioId,
        worldX: sec.worldCoords.x,
        worldY: sec.worldCoords.y,
      });
    }

    // Priority 4: Bosses
    for (const boss of BOSS_DEFINITIONS) {
      const pt = toScreen(boss.x, boss.y);
      const d = Math.hypot(pt.x - clickX, pt.y - clickY);
      consider(d, {
        kind: 'boss',
        id: boss.id,
        name: boss.name,
        worldX: boss.x,
        worldY: boss.y,
      });
    }

    return best ? (best as { dist: number; target: WorldMapHitTarget }).target : null;
  }

  private drawSpeciesWorldMicroVfx(
    ctx: CanvasRenderingContext2D,
    speciesId: string,
    cx: number,
    cy: number,
    timeSec: number
  ): void {
    if (speciesId === 'infurnus') {
      const lift = (timeSec * 18) % 9;
      ctx.fillStyle = lift < 4.5 ? '#fde047' : '#fb923c';
      ctx.fillRect(cx - 1 + Math.sin(timeSec * 9) * 2, cy - 11 - lift, 2, 2);
    } else if (speciesId === 'frostcrawler') {
      const glint = 0.45 + 0.4 * Math.sin(timeSec * 5 + cx * 0.1);
      ctx.fillStyle = `rgba(186, 230, 253, ${glint.toFixed(2)})`;
      ctx.fillRect(cx + 7, cy - 8, 2, 2);
      ctx.fillRect(cx - 8, cy - 5, 1.8, 1.8);
    } else if (speciesId === 'tazerling') {
      if (Math.sin(timeSec * 14 + cy * 0.2) > 0.35) {
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(cx - 9, cy - 9, 2, 2);
        ctx.fillStyle = '#fde047';
        ctx.fillRect(cx + 8, cy - 10, 2, 2);
      }
    }
  }
}
