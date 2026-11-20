import { BIOME_INFO, BOSS_DEFINITIONS, FURNITURE_DEFS, HABITAT_DEFS, TILE_PX, WORLD_H, WORLD_W, getSpecies } from './data';
import { sprites } from './sprites';
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

    // Ambient particles in viewport
    const ambColor =
      biome === 'Magma'
        ? '#fb923c'
        : biome === 'Heladas'
        ? '#bae6fd'
        : biome === 'Sombrias'
        ? '#c084fc'
        : '#6ee7b7';
    if (Math.random() < 0.35) {
      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];
        if (!p.active) {
          p.active = true;
          p.x = this.camX + (Math.random() - 0.5) * 640;
          p.y = this.camY + (Math.random() - 0.5) * 440;
          p.vx = (Math.random() - 0.5) * 14;
          p.vy = biome === 'Magma' ? -18 - Math.random() * 14 : biome === 'Heladas' ? 14 + Math.random() * 12 : -6 - Math.random() * 10;
          p.life = 0;
          p.maxLife = 1.6 + Math.random() * 1.6;
          p.size = 1.8 + Math.random() * 2;
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

    const sxShake = this.shakeTime > 0 ? (Math.random() - 0.5) * 2 * this.shakeMag : 0;
    const syShake = this.shakeTime > 0 ? (Math.random() - 0.5) * 2 * this.shakeMag : 0;
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
        const variant = (tx * 7 + ty * 13) & 1;
        const sx = tx * TILE_PX - ox;
        const sy = ty * TILE_PX - oy;

        const sprite = sprites.getTileSprite(tile, biome, variant);
        ctx.drawImage(sprite, sx, sy);

        // Animated shimmer on crystals, water, lava, torches, recharge stations
        if (tile === TileType.LAVA) {
          const pulse = 0.16 + Math.sin(timeSec * 4 + tx + ty) * 0.08;
          ctx.fillStyle = `rgba(253, 224, 71, ${pulse})`;
          ctx.fillRect(sx + 4, sy + 6, 12, 6);
          if ((tx + ty) % 3 === 0) {
            lightSources.push({ sx: sx + 14, sy: sy + 14, r: 74, color: 'rgba(251, 146, 60, 0.55)' });
          }
        } else if (tile === TileType.WATER) {
          const shimmer = 0.12 + Math.sin(timeSec * 3 + tx * 0.8) * 0.07;
          ctx.fillStyle = `rgba(186, 230, 253, ${shimmer})`;
          ctx.fillRect(sx + 5, sy + 8 + Math.sin(timeSec * 2 + ty) * 2, 10, 2);
        } else if (tile === TileType.TORCH) {
          const flick = 6 + Math.sin(timeSec * 14 + tx * 3) * 2.5;
          lightSources.push({ sx: sx + 14, sy: sy + 10, r: 108 + flick, color: 'rgba(253, 186, 116, 0.85)' });
        } else if (tile === TileType.ENERGY_CRYSTAL || tile === TileType.ALTAR || tile === TileType.ICE_CRYSTAL) {
          lightSources.push({
            sx: sx + 14,
            sy: sy + 14,
            r: tile === TileType.ICE_CRYSTAL ? 64 : 84,
            color: tile === TileType.ICE_CRYSTAL ? 'rgba(125, 211, 252, 0.55)' : 'rgba(45, 212, 191, 0.65)',
          });
          if (Math.sin(timeSec * 5 + tx) > 0.65) {
            ctx.fillStyle = 'rgba(255,255,255,0.65)';
            ctx.fillRect(sx + 11, sy + 5, 3, 3);
          }
        } else if (tile === TileType.SHADOW_CRYSTAL) {
          lightSources.push({ sx: sx + 14, sy: sy + 14, r: 76, color: 'rgba(192, 132, 252, 0.6)' });
        } else if (tile === TileType.EVO_STONE_VEIN) {
          lightSources.push({ sx: sx + 14, sy: sy + 14, r: 92, color: 'rgba(250, 204, 21, 0.72)' });
        } else if (tile === TileType.NEON_MUSHROOM) {
          lightSources.push({ sx: sx + 14, sy: sy + 14, r: 62, color: 'rgba(34, 211, 238, 0.55)' });
        } else if (tile === TileType.MAGMA_COAL) {
          lightSources.push({ sx: sx + 14, sy: sy + 14, r: 44, color: 'rgba(249, 115, 22, 0.4)' });
        } else if (tile === TileType.RECHARGE_STATION) {
          lightSources.push({ sx: sx + 14, sy: sy + 14, r: 112, color: 'rgba(56, 189, 248, 0.78)' });
        } else if (tile === TileType.MUSHROOM) {
          lightSources.push({ sx: sx + 14, sy: sy + 14, r: 50, color: 'rgba(52, 211, 153, 0.4)' });
        } else if (
          (tile === TileType.ORE ||
            tile === TileType.THERMAL_COPPER ||
            tile === TileType.BLUE_QUARTZ ||
            tile === TileType.DARK_IRON) &&
          state.player.perks.includes('Visión de Cristal')
        ) {
          const glint = 0.25 + Math.sin(timeSec * 6 + tx) * 0.2;
          ctx.strokeStyle = `rgba(250, 204, 21, ${glint})`;
          ctx.lineWidth = 1.5;
          ctx.strokeRect(sx + 2, sy + 2, TILE_PX - 4, TILE_PX - 4);
        }
      }
    }

    // 1.5 Habitat floor accents & placed home furniture
    for (const hab of HABITAT_DEFS) {
      if (hab.anchorX < x0 - 1 || hab.anchorX > x1 + 1 || hab.anchorY < y0 - 1 || hab.anchorY > y1 + 1) {
        continue;
      }
      const hsx = hab.anchorX * TILE_PX - ox;
      const hsy = hab.anchorY * TILE_PX - oy;
      ctx.fillStyle = hab.floorTint;
      ctx.fillRect(hsx - 10, hsy - 10, TILE_PX + 20, TILE_PX + 20);
      ctx.strokeStyle = hab.accentColor;
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = 1.25;
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
          lightSources.push({ sx: fsx + 14, sy: fsy + 14, r: 96, color: 'rgba(94, 234, 212, 0.72)' });
        }
      }
    }

    // 2. Target tile highlight
    if (targetTile) {
      const tsx = targetTile.x * TILE_PX - ox;
      const tsy = targetTile.y * TILE_PX - oy;
      ctx.strokeStyle = 'rgba(103, 232, 249, 0.85)';
      ctx.lineWidth = 2;
      ctx.strokeRect(tsx + 1, tsy + 1, TILE_PX - 2, TILE_PX - 2);
    }

    // 3. Roaming creatures, bosses, merchant
    for (const ent of entities) {
      const ex = ent.x * TILE_PX - ox;
      const ey = ent.y * TILE_PX - oy;
      if (ex < -40 || ey < -40 || ex > vw + 40 || ey > vh + 40) continue;

      // Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.36)';
      ctx.beginPath();
      ctx.ellipse(ex + 14, ey + 23, 9, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      const bob = Math.sin(timeSec * 4 + ent.x) * 2;
      if (ent.kind === 'wild' && ent.speciesId) {
        const sp = getSpecies(ent.speciesId);
        const spr = sprites.getSlugPixelSprite(sp.color, sp.accent, false);
        ctx.drawImage(spr, ex + 3, ey + 3 + bob);
      } else {
        ctx.font = ent.kind === 'boss' ? '22px sans-serif' : '18px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(ent.icon, ex + 14, ey + 19 + bob);
      }

      if (ent.kind === 'boss' || ent.kind === 'mercenary' || ent.kind === 'merchant') {
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = ent.kind === 'boss' ? '#fca5a5' : ent.kind === 'merchant' ? '#6ee7b7' : '#fde68a';
        ctx.fillText(ent.name, ex + 14, ey - 4 + bob);
        if (ent.kind === 'boss') {
          lightSources.push({ sx: ex + 14, sy: ey + 14, r: 95, color: 'rgba(248, 113, 113, 0.6)' });
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
        const isResting = res.behavior === 'descansar';
        const isPlaying = res.behavior === 'jugar';
        const bobAmp = isResting ? 0.8 : isPlaying ? 4.2 : 2.2;
        const bobSpd = isResting ? 2 : isPlaying ? 9 : 4.5;
        const bob = Math.sin(timeSec * bobSpd + res.x * 2) * bobAmp;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.34)';
        ctx.beginPath();
        ctx.ellipse(rsx + 14, rsy + 23, 8, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();

        const spr = sprites.getSlugPixelSprite(sp.color, sp.accent, res.slug.mega);
        ctx.drawImage(spr, rsx + 3, rsy + 3 + bob);

        const nearPlayer = Math.hypot(res.x - state.player.x, res.y - state.player.y) <= 2.1;
        if (nearPlayer) {
          ctx.strokeStyle = 'rgba(103, 232, 249, 0.8)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(rsx + 14, rsy + 14, 15, 0, Math.PI * 2);
          ctx.stroke();
        }

        const badge =
          res.reactionText ||
          (res.mood === 'hambrienta'
            ? '🍖'
            : res.mood === 'cansada' || isResting
            ? '💤'
            : nearPlayer
            ? `${res.slug.name} · ♥`
            : res.slug.name);

        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#071018';
        ctx.fillText(badge, rsx + 15, rsy - 2 + bob);
        ctx.fillStyle = res.reactionText
          ? '#fef08a'
          : res.mood === 'hambrienta'
          ? '#fdba74'
          : res.mood === 'cansada'
          ? '#bae6fd'
          : '#a7f3d0';
        ctx.fillText(badge, rsx + 14, rsy - 3 + bob);

        if (sp.type === 'Fuego' || sp.type === 'Luz' || sp.type === 'Electrico' || sp.type === 'Energia') {
          lightSources.push({ sx: rsx + 14, sy: rsy + 14, r: 46, color: sp.accent });
        }
      }
    }

    // 4. Companion Slug following player
    const activeSlug = state.party[state.activePartyIndex] || state.party[0];
    if (activeSlug) {
      const sp = getSpecies(activeSlug.id);
      const csx = this.companionX - ox;
      const csy = this.companionY - oy + Math.sin(timeSec * 5) * 2.5;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(csx + 11, csy + 20, 7, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.drawImage(sprites.getSlugPixelSprite(sp.color, sp.accent, activeSlug.mega), csx, csy);
    }

    // 5. Player Explorer
    const psx = state.player.x * TILE_PX - ox;
    const psy = state.player.y * TILE_PX - oy;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
    ctx.beginPath();
    ctx.ellipse(psx + 14, psy + 25, 9, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    const walkFrame = Math.floor(state.stats.steps * 2.2);
    const playerSprite = sprites.getExplorerSprite(state.player.facingX, state.player.facingY, walkFrame);
    ctx.drawImage(playerSprite, psx, psy);

    // Player headlamp light
    lightSources.push({ sx: psx + 14, sy: psy + 14, r: 155, color: 'rgba(186, 230, 253, 0.92)' });

    // Pulse exploration ring
    if (this.pulseRing > 0) {
      const prx = this.pulseX - ox;
      const pry = this.pulseY - oy;
      const radius = (1 - this.pulseRing) * 145 + 16;
      ctx.save();
      ctx.strokeStyle = `rgba(56, 224, 239, ${this.pulseRing * 0.9})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(prx, pry, radius, 0, Math.PI * 2);
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

    // 8. Floating world labels (rendered above darkness so always legible)
    for (const lbl of this.labels) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, lbl.life * 1.4);
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#071018';
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
      grad.addColorStop(0, 'rgba(0,0,0,0.95)');
      grad.addColorStop(0.55, 'rgba(0,0,0,0.45)');
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
    ctx.globalAlpha = 0.14;
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

  public renderMinimap(canvas: HTMLCanvasElement, state: GameState): void {
    const g = canvas.getContext('2d');
    if (!g) return;
    const w = canvas.width;
    const h = canvas.height;
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#07111a';
    g.fillRect(0, 0, w, h);

    const viewRange = 72; // tiles radius shown
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
        g.globalAlpha = explored ? 0.92 : 0.25;
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
        g.arc(mx, my, 3.2, 0, Math.PI * 2);
        g.fill();
      }
    }

    // Discovered POI markers on minimap (never show undiscovered secrets)
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

    // Shelter marker (160,160)
    const sdx = 160 - px;
    const sdy = 160 - py;
    if (Math.abs(sdx) <= viewRange && Math.abs(sdy) <= viewRange) {
      const mx = ((sdx + viewRange) / (viewRange * 2)) * w;
      const my = ((sdy + viewRange) / (viewRange * 2)) * h;
      g.fillStyle = '#fde047';
      g.fillRect(mx - 2.5, my - 2.5, 5, 5);
    }

    // Player dot at center
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(w / 2, h / 2, 3.5, 0, Math.PI * 2);
    g.fill();
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

    // Discovered POIs only (undiscovered chambers/ruins stay hidden until explored)
    if (state.discoveredPOIs) {
      for (const poi of state.discoveredPOIs) {
        const px = (poi.x / WORLD_W) * w;
        const py = (poi.y / WORLD_H) * h;
        g.fillStyle = poi.kind === 'crystal_chamber' ? '#38bdf8' : poi.kind === 'ancient_ruins' ? '#c084fc' : '#2dd4bf';
        g.fillRect(px - 3, py - 3, 6, 6);
      }
    }

    // Shelter icon
    const sx = (160 / WORLD_W) * w;
    const sy = (160 / WORLD_H) * h;
    g.fillStyle = '#fde047';
    g.beginPath();
    g.arc(sx, sy, 5, 0, Math.PI * 2);
    g.fill();
    g.font = 'bold 11px sans-serif';
    g.fillText('Refugio', sx + 8, sy + 4);

    // Bosses
    for (const boss of BOSS_DEFINITIONS) {
      const bx = (boss.x / WORLD_W) * w;
      const by = (boss.y / WORLD_H) * h;
      const defeated = state.defeatedBosses.includes(boss.id);
      g.fillStyle = defeated ? '#4ade80' : '#ef4444';
      g.beginPath();
      g.arc(bx, by, 4.5, 0, Math.PI * 2);
      g.fill();
      g.font = '10px sans-serif';
      g.fillStyle = defeated ? '#86efac' : '#fecaca';
      g.fillText(defeated ? `✓ ${boss.name}` : boss.name, bx + 7, by + 3);
    }

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
}
