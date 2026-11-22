import { HIDDEN_DISCOVERIES } from './activities';
import { BIOME_INFO, BOSS_DEFINITIONS, FURNITURE_DEFS, HABITAT_DEFS, TILE_PX, WORLD_H, WORLD_W, getSpecies } from './data';
import { getSlugDisplayName } from './progression';
import { sampleSlugAnimationFrame, type SlugAnimationState } from './slugArtDirection';
import { sprites, type SlugSpritePose } from './sprites';
import { STORY_CHAPTERS_BY_ID, STORY_ROUTES, STORY_SCENARIOS } from './storyData';
import { canAccessRoute, ensureStoryState } from './storyEngine';
import { TileType, type BiomeId, type GameState, type RoamingEntity } from './types';
import { ChunkManager, getBiomeAt } from './world';

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
    targetTile: { x: number; y: number } | null
  ): void {
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, vw, vh);

    const reduced =
      Boolean(state.options.reducedMotion) ||
      (typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const visualTime = reduced ? 0 : timeSec;
    const sxShake = !reduced && this.shakeTime > 0 ? (Math.random() - 0.5) * 2 * this.shakeMag : 0;
    const syShake = !reduced && this.shakeTime > 0 ? (Math.random() - 0.5) * 2 * this.shakeMag : 0;
    const ox = Math.floor(this.camX - vw / 2 + TILE_PX / 2 + sxShake);
    const oy = Math.floor(this.camY - vh / 2 + TILE_PX / 2 + syShake);

    const x0 = Math.max(0, Math.floor(ox / TILE_PX) - 1);
    const y0 = Math.max(0, Math.floor(oy / TILE_PX) - 1);
    const x1 = Math.min(WORLD_W - 1, Math.ceil((ox + vw) / TILE_PX) + 1);
    const y1 = Math.min(WORLD_H - 1, Math.ceil((oy + vh) / TILE_PX) + 1);

    const lightSources: Array<{ sx: number; sy: number; r: number; color: string }> = [];

    // 1. Tiles pass
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const tile = chunks.getTile(tx, ty);
        const biome = getBiomeAt(tx, ty, state.worldSeed);
        const variant = ((tx * 73856093) ^ (ty * 19349663)) & 3;
        const sx = tx * TILE_PX - ox;
        const sy = ty * TILE_PX - oy;

        const sprite = sprites.getTileSprite(tile, biome, variant);
        ctx.drawImage(sprite, sx, sy);

        // 2.5D Wall Drop-Shadow onto floor tile directly below solid rock/wall
        if (!isOpaqueWallTile(tile) && ty > 0 && isOpaqueWallTile(chunks.getTile(tx, ty - 1))) {
          ctx.fillStyle = 'rgba(2, 6, 12, 0.34)';
          ctx.fillRect(sx, sy, TILE_PX, 5);
        }

        // Animated shimmer on crystals, water, lava, torches, recharge stations
        if (tile === TileType.LAVA) {
          const pulse = 0.18 + Math.sin(visualTime * 4 + tx + ty) * 0.1;
          ctx.fillStyle = `rgba(253, 224, 71, ${pulse})`;
          ctx.fillRect(sx + 4, sy + 6, 12, 6);
          const bubbleY = sy + 18 - ((visualTime * 12 + tx * 5 + ty * 7) % 10);
          ctx.fillStyle = 'rgba(254, 240, 138, 0.52)';
          ctx.fillRect(sx + 8 + ((tx * 3) % 8), bubbleY, 3, 3);
          if ((tx + ty) % 3 === 0) {
            lightSources.push({ sx: sx + 14, sy: sy + 14, r: 78, color: 'rgba(251, 146, 60, 0.6)' });
          }
        } else if (tile === TileType.WATER) {
          const shimmer = 0.14 + Math.sin(visualTime * 3 + tx * 0.8) * 0.08;
          ctx.fillStyle = `rgba(186, 230, 253, ${shimmer})`;
          ctx.fillRect(sx + 4, sy + 7 + Math.sin(visualTime * 2.2 + ty) * 2, 11, 2);
          ctx.fillStyle = `rgba(125, 211, 252, ${shimmer * 0.85})`;
          ctx.fillRect(sx + 11, sy + 16 + Math.cos(visualTime * 2.4 + tx) * 2, 9, 2);
        } else if (tile === TileType.TORCH) {
          const flick = reduced ? 6 : 6 + Math.sin(visualTime * 14 + tx * 3) * 2.5;
          lightSources.push({ sx: sx + 14, sy: sy + 10, r: 112 + flick, color: 'rgba(253, 186, 116, 0.88)' });
        } else if (tile === TileType.ENERGY_CRYSTAL || tile === TileType.ALTAR || tile === TileType.ICE_CRYSTAL) {
          lightSources.push({
            sx: sx + 14,
            sy: sy + 14,
            r: tile === TileType.ICE_CRYSTAL ? 68 : 88,
            color: tile === TileType.ICE_CRYSTAL ? 'rgba(125, 211, 252, 0.6)' : 'rgba(45, 212, 191, 0.68)',
          });
          if (!reduced && Math.sin(visualTime * 5 + tx) > 0.65) {
            ctx.fillStyle = 'rgba(255,255,255,0.72)';
            ctx.fillRect(sx + 11, sy + 5, 3, 3);
          }
          if (tile === TileType.ALTAR) {
            ctx.strokeStyle = `rgba(94, 234, 212, ${0.28 + Math.sin(visualTime * 4) * 0.14})`;
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.arc(sx + 14, sy + 14, 11 + Math.sin(visualTime * 3) * 1.5, 0, Math.PI * 2);
            ctx.stroke();
          }
        } else if (tile === TileType.SHADOW_CRYSTAL) {
          lightSources.push({ sx: sx + 14, sy: sy + 14, r: 78, color: 'rgba(192, 132, 252, 0.62)' });
        } else if (tile === TileType.EVO_STONE_VEIN) {
          lightSources.push({ sx: sx + 14, sy: sy + 14, r: 96, color: 'rgba(250, 204, 21, 0.78)' });
        } else if (tile === TileType.NEON_MUSHROOM) {
          lightSources.push({ sx: sx + 14, sy: sy + 14, r: 66, color: 'rgba(34, 211, 238, 0.58)' });
        } else if (tile === TileType.MAGMA_COAL) {
          lightSources.push({ sx: sx + 14, sy: sy + 14, r: 46, color: 'rgba(249, 115, 22, 0.44)' });
        } else if (tile === TileType.RECHARGE_STATION) {
          lightSources.push({ sx: sx + 14, sy: sy + 14, r: 116, color: 'rgba(56, 189, 248, 0.82)' });
          const scanAlpha = 0.35 + Math.sin(visualTime * 6 + tx) * 0.2;
          ctx.fillStyle = `rgba(125, 211, 252, ${scanAlpha})`;
          ctx.fillRect(sx + 7, sy + 9 + Math.round((Math.sin(visualTime * 4) + 1) * 4), 14, 2);
        } else if (tile === TileType.MUSHROOM) {
          lightSources.push({ sx: sx + 14, sy: sy + 14, r: 52, color: 'rgba(52, 211, 153, 0.42)' });
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

    // 1.5 Habitat floor zones & placed home furniture
    for (const hab of HABITAT_DEFS) {
      if (hab.anchorX < x0 - 1 || hab.anchorX > x1 + 1 || hab.anchorY < y0 - 1 || hab.anchorY > y1 + 1) {
        continue;
      }
      const hsx = hab.anchorX * TILE_PX - ox;
      const hsy = hab.anchorY * TILE_PX - oy;
      ctx.fillStyle = hab.floorTint;
      ctx.fillRect(hsx - 10, hsy - 10, TILE_PX + 20, TILE_PX + 20);
      ctx.strokeStyle = hab.accentColor;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(hsx - 9, hsy - 9, TILE_PX + 18, TILE_PX + 18);
      ctx.globalAlpha = 1;
    }

    if (state.home?.furniture) {
      for (const furn of state.home.furniture) {
        if (furn.x < x0 || furn.x > x1 || furn.y < y0 || furn.y > y1) continue;
        const fsx = furn.x * TILE_PX - ox;
        const fsy = furn.y * TILE_PX - oy;
        ctx.drawImage(sprites.getFurnitureSprite(furn.kind), fsx, fsy);
        if (FURNITURE_DEFS[furn.kind]?.emitsLight) {
          lightSources.push({ sx: fsx + 14, sy: fsy + 14, r: 102, color: 'rgba(94, 234, 212, 0.78)' });
        }
      }
    }

    // 2. Sculpted scanner target corner reticle
    if (targetTile) {
      const tsx = targetTile.x * TILE_PX - ox;
      const tsy = targetTile.y * TILE_PX - oy;
      const pulseAlpha = 0.65 + Math.sin(visualTime * 6) * 0.25;
      ctx.fillStyle = `rgba(94, 234, 212, ${pulseAlpha})`;
      // Top-left bracket
      ctx.fillRect(tsx, tsy, 7, 2);
      ctx.fillRect(tsx, tsy, 2, 7);
      // Top-right bracket
      ctx.fillRect(tsx + TILE_PX - 7, tsy, 7, 2);
      ctx.fillRect(tsx + TILE_PX - 2, tsy, 2, 7);
      // Bottom-left bracket
      ctx.fillRect(tsx, tsy + TILE_PX - 2, 7, 2);
      ctx.fillRect(tsx, tsy + TILE_PX - 7, 2, 7);
      // Bottom-right bracket
      ctx.fillRect(tsx + TILE_PX - 7, tsy + TILE_PX - 2, 7, 2);
      ctx.fillRect(tsx + TILE_PX - 2, tsy + TILE_PX - 7, 2, 7);
    }

    // 3. Roaming wild slugs, bosses, mercenaries, merchant
    const animFrame = reduced ? 0 : (Math.floor(timeSec * 5) & 3);

    for (const ent of entities) {
      const ex = ent.x * TILE_PX - ox;
      const ey = ent.y * TILE_PX - oy;
      if (ex < -40 || ey < -40 || ex > vw + 40 || ey > vh + 40) continue;

      // Ground contact shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
      ctx.beginPath();
      ctx.ellipse(ex + 14, ey + 23, ent.kind === 'boss' ? 11 : 9, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      const bob = reduced ? 0 : Math.sin(timeSec * 4.2 + ent.x) * 2.2;
      if (ent.kind === 'wild' && ent.speciesId) {
        const sp = getSpecies(ent.speciesId);
        const anim = sampleSlugAnimationFrame(ent.speciesId, 'walk', visualTime, reduced);
        const flipLeft = Math.cos(ent.dir) < 0;
        // Subtle elemental shimmer ring
        ctx.strokeStyle = sp.accent;
        ctx.globalAlpha = 0.35 + Math.sin(visualTime * 3.5 + ent.y) * 0.15;
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        ctx.ellipse(ex + 14, ey + 22, 10, 4.5, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;

        const spr = sprites.getSpeciesSlugSprite(ent.speciesId, false, 'walk', animFrame);
        ctx.save();
        ctx.translate(ex + 14 + anim.offsetX, ey + 14 + anim.offsetY);
        ctx.rotate((anim.tiltDeg * Math.PI) / 180);
        ctx.scale((flipLeft ? -1 : 1) * anim.scaleX, anim.scaleY);
        ctx.drawImage(spr, -12, -12);
        ctx.restore();

        if (!reduced) {
          this.drawSpeciesWorldMicroVfx(ctx, ent.speciesId, ex + 14, ey + 14 + anim.offsetY, timeSec);
        }
      } else if (
        ent.kind === 'boss' ||
        ent.kind === 'mercenary' ||
        ent.kind === 'merchant' ||
        ent.kind === 'story_npc'
      ) {
        // Boss / Mercenary / Merchant / Story NPC articulated RPG pixel character
        if (ent.kind === 'boss') {
          ctx.strokeStyle = 'rgba(248, 113, 113, 0.72)';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.ellipse(ex + 14, ey + 22, 12, 5.5, 0, 0, Math.PI * 2);
          ctx.stroke();
        } else if (ent.kind === 'merchant') {
          lightSources.push({ sx: ex + 14, sy: ey + 14, r: 84, color: 'rgba(52, 211, 153, 0.68)' });
        } else if (ent.kind === 'story_npc') {
          ctx.strokeStyle = 'rgba(45, 212, 191, 0.72)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.ellipse(ex + 14, ey + 22, 11, 4.5, 0, 0, Math.PI * 2);
          ctx.stroke();
          lightSources.push({ sx: ex + 14, sy: ey + 14, r: 82, color: 'rgba(45, 212, 191, 0.65)' });
        }
        const spriteKind = ent.kind === 'story_npc' ? 'merchant' : ent.kind;
        const npcSpr = sprites.getNpcCharacterSprite(spriteKind, ent.bossId, animFrame & 1);
        ctx.drawImage(npcSpr, ex, ey - 1 + bob * 0.55);
      }

      if (
        ent.kind === 'boss' ||
        ent.kind === 'mercenary' ||
        ent.kind === 'merchant' ||
        ent.kind === 'story_npc'
      ) {
        const label = ent.name;
        const plaqueW = Math.max(54, label.length * 6.2 + 12);
        ctx.fillStyle = 'rgba(5, 11, 18, 0.82)';
        ctx.fillRect(ex + 14 - plaqueW / 2, ey - 14 + bob, plaqueW, 13);
        ctx.strokeStyle =
          ent.kind === 'boss'
            ? '#f87171'
            : ent.kind === 'merchant'
            ? '#34d399'
            : ent.kind === 'story_npc'
            ? '#2dd4bf'
            : '#fbbf24';
        ctx.lineWidth = 1;
        ctx.strokeRect(ex + 14 - plaqueW / 2, ey - 14 + bob, plaqueW, 13);

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
        ctx.fillText(label, ex + 14, ey - 4 + bob);
        if (ent.kind === 'boss') {
          lightSources.push({ sx: ex + 14, sy: ey + 14, r: 102, color: 'rgba(248, 113, 113, 0.68)' });
        }
      }
    }

    // 3.5 Living home companion slugs roaming in the shelter
    if (state.home?.residents) {
      for (const res of state.home.residents) {
        const rsx = res.x * TILE_PX - ox;
        const rsy = res.y * TILE_PX - oy;
        if (rsx < -40 || rsy < -40 || rsx > vw + 40 || rsy > vh + 40) continue;

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

        ctx.fillStyle = 'rgba(0, 0, 0, 0.36)';
        ctx.beginPath();
        ctx.ellipse(rsx + 14, rsy + 23, 8, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();

        const pose: SlugSpritePose = isEating
          ? 'eat'
          : isSleeping
          ? 'rest'
          : isPlaying
          ? 'play'
          : isLooking
          ? 'react'
          : nearPlayer || res.reactionText
          ? 'happy'
          : isWalking
          ? 'walk'
          : 'idle';
        const spr = sprites.getSpeciesSlugSprite(res.slug.id, res.slug.mega, pose, animFrame);
        const faceDir = (res.facingX ?? 1) < 0 ? -1 : 1;

        ctx.save();
        ctx.translate(rsx + 14 + anim.offsetX, rsy + 14 + bob);
        ctx.rotate((anim.tiltDeg * Math.PI) / 180);
        ctx.scale(faceDir * anim.scaleX, anim.scaleY);
        ctx.drawImage(spr, -12, -12);
        ctx.restore();

        // Living micro-feedback per activity & priority species
        if (!reduced) {
          if (isSleeping) {
            const zy = (timeSec * 14 + res.x * 5) % 14;
            ctx.font = 'bold 9px sans-serif';
            ctx.fillStyle = `rgba(186, 230, 253, ${1 - zy / 14})`;
            ctx.fillText('Z', rsx + 22, rsy + 4 - zy);
          } else {
            this.drawSpeciesWorldMicroVfx(
              ctx,
              res.slug.id,
              rsx + 14 + anim.offsetX,
              rsy + 14 + bob,
              timeSec
            );
            if (isEating) {
              ctx.fillStyle = '#fde047';
              ctx.fillRect(rsx + 14 + faceDir * 7, rsy + 16 + (animFrame & 1) * 2, 2, 2);
              ctx.fillStyle = '#fb923c';
              ctx.fillRect(rsx + 14 + faceDir * 9, rsy + 18 - (animFrame & 1) * 2, 2, 2);
            } else if (activity === 'social') {
              ctx.fillStyle = '#f472b6';
              ctx.fillRect(rsx + 13, rsy - 2 + Math.sin(timeSec * 8) * 2, 3, 3);
            } else if (isLooking) {
              ctx.fillStyle = '#fde047';
              ctx.fillRect(rsx + 14 + faceDir * 8, rsy + 2, 2, 2);
            }
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
        ctx.fillRect(rsx + 14 - bw / 2, rsy - 13 + bob, bw, 12);
        ctx.fillStyle = res.reactionText
          ? '#fef08a'
          : res.mood === 'hambrienta'
          ? '#fdba74'
          : isSleeping || res.mood === 'cansada'
          ? '#bae6fd'
          : '#a7f3d0';
        ctx.fillText(badge, rsx + 14, rsy - 4 + bob);

        if (sp.type === 'Fuego' || sp.type === 'Luz' || sp.type === 'Electrico' || sp.type === 'Energia' || res.slug.mega) {
          lightSources.push({ sx: rsx + 14, sy: rsy + 14, r: res.slug.mega ? 58 : 46, color: sp.accent });
        }
      }
    }

    // 3.8 Ambient subterranean biome critters (lightweight life in every biome)
    const curBiome = getBiomeAt(Math.round(state.player.x), Math.round(state.player.y), state.worldSeed);
    this.renderAmbientCritters(ctx, vw, vh, curBiome, visualTime, state.options.lightingQuality, reduced);

    // 4. Companion Slug following player
    const activeSlug = state.party[state.activePartyIndex] || state.party[0];
    if (activeSlug) {
      const sp = getSpecies(activeSlug.id);
      const compAnim = sampleSlugAnimationFrame(activeSlug.id, 'walk', visualTime, reduced);
      const csx = this.companionX - ox;
      const csy = this.companionY - oy + compAnim.offsetY;
      ctx.fillStyle = 'rgba(0,0,0,0.34)';
      ctx.beginPath();
      ctx.ellipse(csx + 12, csy + 21 - compAnim.offsetY, 7, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      const compFace = state.player.facingX < 0 ? -1 : 1;
      ctx.save();
      ctx.translate(csx + 12 + compAnim.offsetX, csy + 12);
      ctx.rotate((compAnim.tiltDeg * Math.PI) / 180);
      ctx.scale(compFace * compAnim.scaleX, compAnim.scaleY);
      ctx.drawImage(sprites.getSpeciesSlugSprite(activeSlug.id, activeSlug.mega, 'walk', animFrame), -12, -12);
      ctx.restore();
      if (!reduced) {
        this.drawSpeciesWorldMicroVfx(ctx, activeSlug.id, csx + 12 + compAnim.offsetX, csy + 12, visualTime);
      }
      if (activeSlug.mega) {
        lightSources.push({ sx: csx + 12, sy: csy + 12, r: 52, color: 'rgba(251, 191, 36, 0.55)' });
      } else if (sp.type === 'Luz' || sp.type === 'Fuego' || sp.type === 'Energia') {
        lightSources.push({ sx: csx + 12, sy: csy + 12, r: 38, color: sp.accent });
      }
    }

    // 5. Player Explorer (+ mounted Mecha overlay when active)
    const psx = state.player.x * TILE_PX - ox;
    const psy = state.player.y * TILE_PX - oy;
    const mechaMounted = Boolean(state.mecha?.unlocked && state.mecha?.active);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(psx + 14, psy + 25, mechaMounted ? 12 : 9, mechaMounted ? 5 : 4, 0, 0, Math.PI * 2);
    ctx.fill();

    if (mechaMounted && state.mecha) {
      const mechaSpr = sprites.getMechaOverlaySprite(
        state.mecha.theme,
        state.mecha.tier,
        state.player.facingX,
        state.player.facingY
      );
      ctx.drawImage(mechaSpr, psx - 3, psy - 1);
    }

    const walkFrame = Math.floor(state.stats.steps * 2.2);
    const playerSprite = sprites.getExplorerSprite(state.player.facingX, state.player.facingY, walkFrame);
    ctx.drawImage(playerSprite, psx, mechaMounted ? psy - 4 : psy);

    // Player headlamp light
    lightSources.push({ sx: psx + 14, sy: psy + 14, r: 162, color: 'rgba(186, 230, 253, 0.94)' });

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

    // 7. Modern Vector Lighting Pass
    const currentBiome = getBiomeAt(Math.round(state.player.x), Math.round(state.player.y), state.worldSeed);
    this.renderLightingPass(ctx, vw, vh, currentBiome, lightSources, state.options.lightingQuality);

    // 8. Floating world labels (always legible above lighting pass)
    for (const lbl of this.labels) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, lbl.life * 1.4);
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#060d14';
      ctx.fillText(lbl.text, lbl.x - ox + 1, lbl.y - oy + 1);
      ctx.fillStyle = lbl.color;
      ctx.fillText(lbl.text, lbl.x - ox, lbl.y - oy);
      ctx.restore();
    }
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
      const grad = ctx.createRadialGradient(l.sx, l.sy, 2, l.sx, l.sy, l.r * 0.65);
      grad.addColorStop(0, l.color);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(l.sx, l.sy, l.r * 0.65, 0, Math.PI * 2);
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

  public renderFullWorldMap(canvas: HTMLCanvasElement, state: GameState): void {
    const g = canvas.getContext('2d');
    if (!g) return;
    const w = canvas.width;
    const h = canvas.height;
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#060c14';
    g.fillRect(0, 0, w, h);

    const chunksPerSide = WORLD_W / 16; // 20
    const cw = w / chunksPerSide;
    const ch = h / chunksPerSide;

    for (let cy = 0; cy < chunksPerSide; cy++) {
      for (let cx = 0; cx < chunksPerSide; cx++) {
        const wx = cx * 16 + 8;
        const wy = cy * 16 + 8;
        const b = getBiomeAt(wx, wy, state.worldSeed);
        const explored = !!state.exploredChunks[`${cx},${cy}`];
        g.fillStyle = BIOME_INFO[b].mapColor;
        g.globalAlpha = explored ? 0.95 : 0.14;
        g.fillRect(cx * cw, cy * ch, cw - 0.5, ch - 0.5);
      }
    }
    g.globalAlpha = 1;

    // Interconnected cavern routes
    const story = ensureStoryState(state);
    const activeChapter = STORY_CHAPTERS_BY_ID[story.currentChapterId];
    for (const route of Object.values(STORY_ROUTES)) {
      const fromSc = STORY_SCENARIOS[route.fromScenarioId];
      const toSc = STORY_SCENARIOS[route.toScenarioId];
      if (!fromSc || !toSc) continue;
      const x1 = (fromSc.worldAnchor.x / WORLD_W) * w;
      const y1 = (fromSc.worldAnchor.y / WORLD_H) * h;
      const x2 = (toSc.worldAnchor.x / WORLD_W) * w;
      const y2 = (toSc.worldAnchor.y / WORLD_H) * h;
      const access = canAccessRoute(state, route.id);
      g.save();
      g.beginPath();
      if (!access.allowed) {
        g.setLineDash([4, 4]);
        g.strokeStyle = 'rgba(148, 163, 184, 0.42)';
        g.lineWidth = 1.4;
      } else {
        g.strokeStyle = 'rgba(45, 212, 191, 0.72)';
        g.lineWidth = 2.2;
      }
      g.moveTo(x1, y1);
      g.lineTo(x2, y2);
      g.stroke();
      g.restore();
    }

    // Discovered POIs only (undiscovered chambers/ruins stay hidden until explored)
    if (state.discoveredPOIs) {
      for (const poi of state.discoveredPOIs) {
        const px = (poi.x / WORLD_W) * w;
        const py = (poi.y / WORLD_H) * h;
        g.fillStyle = poi.kind === 'crystal_chamber' ? '#38bdf8' : poi.kind === 'ancient_ruins' ? '#c084fc' : '#2dd4bf';
        g.fillRect(px - 2.5, py - 2.5, 5, 5);
      }
    }

    // Discovered hidden shrines ONLY (never reveal undiscovered secrets prematurely)
    for (const sec of HIDDEN_DISCOVERIES) {
      if (!sec.worldCoords || !state.discoveredSecrets?.includes(sec.id)) continue;
      const sxSec = (sec.worldCoords.x / WORLD_W) * w;
      const sySec = (sec.worldCoords.y / WORLD_H) * h;
      g.save();
      g.translate(sxSec, sySec);
      g.rotate(Math.PI / 4);
      g.fillStyle = '#c084fc';
      g.fillRect(-3, -3, 6, 6);
      g.strokeStyle = '#f5d0fe';
      g.lineWidth = 1;
      g.strokeRect(-3, -3, 6, 6);
      g.restore();
    }

    // Story Scenario nodes (visited / accessible / locked + active chapter objective)
    for (const sc of Object.values(STORY_SCENARIOS)) {
      const mx = (sc.worldAnchor.x / WORLD_W) * w;
      const my = (sc.worldAnchor.y / WORLD_H) * h;
      const isRefugio = sc.id === 'esc_refugio_shane';
      const isCurrent = story.currentScenarioId === sc.id;
      const isVisited = story.visitedScenarioIds.includes(sc.id);
      const isUnlocked = story.unlockedScenarioIds.includes(sc.id);
      const isObjective = activeChapter?.scenarioIds.includes(sc.id);

      if (isObjective) {
        g.strokeStyle = '#fbbf24';
        g.lineWidth = 1.6;
        g.beginPath();
        g.arc(mx, my, isRefugio ? 9 : 7.5, 0, Math.PI * 2);
        g.stroke();
      }

      if (isRefugio) {
        g.fillStyle = '#fde047';
        g.beginPath();
        g.arc(mx, my, 5.5, 0, Math.PI * 2);
        g.fill();
        g.font = 'bold 11px sans-serif';
        g.fillStyle = '#060c14';
        g.fillText('Refugio', mx + 9, my + 5);
        g.fillStyle = '#fef08a';
        g.fillText('Refugio', mx + 8, my + 4);
      } else {
        g.fillStyle = isCurrent
          ? '#38bdf8'
          : isVisited
          ? '#2dd4bf'
          : isUnlocked
          ? '#fbbf24'
          : '#475569';
        g.beginPath();
        g.arc(mx, my, 4.2, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = '#060c14';
        g.lineWidth = 1.2;
        g.stroke();

        const alignRight = mx > w * 0.65;
        const tx = alignRight ? mx - 7 : mx + 7;
        g.font = 'bold 9.5px sans-serif';
        g.textAlign = alignRight ? 'right' : 'left';
        const shortLabel = isUnlocked || isVisited ? sc.name : `🔒 ${sc.name}`;
        g.fillStyle = '#060c14';
        g.fillText(shortLabel, tx + 1, my - 5);
        g.fillStyle = isUnlocked || isVisited ? '#e2e8f0' : '#94a3b8';
        g.fillText(shortLabel, tx, my - 6);
        g.textAlign = 'left';
      }
    }

    // Bosses
    for (const boss of BOSS_DEFINITIONS) {
      const bx = (boss.x / WORLD_W) * w;
      const by = (boss.y / WORLD_H) * h;
      const defeated = state.defeatedBosses.includes(boss.id);
      const alignRight = bx > w * 0.65;
      const tx = alignRight ? bx - 7 : bx + 7;
      g.fillStyle = defeated ? '#4ade80' : '#ef4444';
      g.beginPath();
      g.arc(bx, by, 4.5, 0, Math.PI * 2);
      g.fill();
      g.font = 'bold 10px sans-serif';
      g.textAlign = alignRight ? 'right' : 'left';
      const txt = defeated ? `✓ ${boss.name}` : boss.name;
      g.fillStyle = '#060c14';
      g.fillText(txt, tx + 1, by + 4);
      g.fillStyle = defeated ? '#86efac' : '#fecaca';
      g.fillText(txt, tx, by + 3);
    }
    g.textAlign = 'left';

    // Player
    const px = (state.player.x / WORLD_W) * w;
    const py = (state.player.y / WORLD_H) * h;
    g.fillStyle = '#38bdf8';
    g.strokeStyle = '#ffffff';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(px, py, 5.5, 0, Math.PI * 2);
    g.fill();
    g.stroke();
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
