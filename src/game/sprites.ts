import { BIOME_INFO, TILE_PX, getSpecies } from './data';
import { TileType, type BiomeId, type FurnitureKind } from './types';

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  return [c, g];
}

function px(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string): void {
  g.fillStyle = color;
  g.fillRect(x, y, w, h);
}

export type SlugSpritePose = 'idle' | 'rest' | 'happy';

class SpriteAtlas {
  private tileCache = new Map<string, HTMLCanvasElement>();
  private charCache = new Map<string, HTMLCanvasElement>();

  public getTileSprite(tile: TileType, biome: BiomeId, variant = 0): HTMLCanvasElement {
    const v = variant & 3;
    const key = `${tile}_${biome}_${v}`;
    const existing = this.tileCache.get(key);
    if (existing) return existing;

    const [c, g] = makeCanvas(TILE_PX, TILE_PX);
    const info = BIOME_INFO[biome];
    // Draw at 14x14 pixel grid scaled 2x -> crisp 28x28 pixel art
    const S = 2;
    const p = (gx: number, gy: number, gw: number, gh: number, col: string) =>
      px(g, gx * S, gy * S, gw * S, gh * S, col);

    // Rich subterranean biome-textured floor
    p(0, 0, 14, 14, v % 2 === 0 ? info.floorA : info.floorB);
    if (biome === 'Verdes') {
      p(1, 2, 3, 1, 'rgba(74, 222, 128, 0.12)');
      p(8, 10, 4, 1, 'rgba(0, 0, 0, 0.16)');
      if (v === 1) {
        p(4, 5, 2, 1, 'rgba(52, 211, 153, 0.22)');
        p(10, 3, 1, 1, 'rgba(167, 243, 208, 0.18)');
      } else if (v === 2) {
        p(2, 9, 2, 2, 'rgba(16, 185, 129, 0.14)');
        p(9, 4, 2, 1, 'rgba(255, 255, 255, 0.06)');
      } else if (v === 3) {
        p(6, 7, 2, 1, 'rgba(0, 0, 0, 0.14)');
        p(11, 11, 1, 1, 'rgba(110, 231, 183, 0.25)');
      }
    } else if (biome === 'Magma') {
      p(2, 4, 3, 1, 'rgba(0, 0, 0, 0.24)');
      p(7, 9, 4, 1, 'rgba(251, 146, 60, 0.11)');
      if (v === 1) {
        p(4, 8, 2, 1, 'rgba(249, 115, 22, 0.24)');
        p(10, 2, 2, 1, 'rgba(0, 0, 0, 0.28)');
      } else if (v === 2) {
        p(3, 2, 1, 2, 'rgba(253, 224, 71, 0.14)');
        p(8, 6, 3, 1, 'rgba(0, 0, 0, 0.2)');
      } else if (v === 3) {
        p(1, 11, 3, 1, 'rgba(234, 88, 12, 0.18)');
      }
    } else if (biome === 'Heladas') {
      p(1, 2, 4, 1, 'rgba(224, 242, 254, 0.14)');
      p(8, 11, 4, 1, 'rgba(14, 116, 144, 0.22)');
      if (v === 1) {
        p(4, 6, 3, 1, 'rgba(186, 230, 253, 0.2)');
        p(10, 3, 1, 2, 'rgba(255, 255, 255, 0.14)');
      } else if (v === 2) {
        p(2, 9, 2, 1, 'rgba(255, 255, 255, 0.18)');
        p(7, 4, 2, 2, 'rgba(56, 189, 248, 0.12)');
      } else if (v === 3) {
        p(6, 8, 3, 1, 'rgba(224, 242, 254, 0.14)');
      }
    } else {
      // Sombrias
      p(0, 7, 14, 1, 'rgba(0, 0, 0, 0.18)');
      p(7, 0, 1, 7, 'rgba(0, 0, 0, 0.14)');
      if (v === 1) {
        p(3, 3, 2, 1, 'rgba(192, 132, 252, 0.18)');
        p(9, 10, 2, 1, 'rgba(168, 85, 247, 0.14)');
      } else if (v === 2) {
        p(4, 9, 1, 1, 'rgba(216, 180, 254, 0.22)');
        p(10, 4, 2, 1, 'rgba(0, 0, 0, 0.24)');
      }
    }

    switch (tile) {
      case TileType.WATER: {
        p(0, 0, 14, 14, '#0c3a54');
        p(1, 1, 12, 12, '#14587e');
        p(2, 3, 5, 1, '#38bdf8');
        p(4, 4, 2, 1, '#bae6fd');
        p(6, 9, 6, 1, '#38bdf8');
        p(9, 10, 3, 1, '#e0f2fe');
        p(0, 13, 14, 1, '#08273b');
        break;
      }
      case TileType.LAVA: {
        p(0, 0, 14, 14, '#5c1408');
        p(1, 1, 12, 12, '#9a260a');
        p(2, 2, 10, 10, '#c2410c');
        p(2, 3, 5, 2, '#f97316');
        p(7, 7, 5, 3, '#fb923c');
        p(3, 4, 2, 1, '#fef08a');
        p(8, 8, 3, 1, '#fef08a');
        p(4, 11, 3, 1, '#facc15');
        break;
      }
      case TileType.ICE_FLOOR: {
        p(0, 0, 14, 14, '#467ca0');
        p(1, 1, 12, 12, '#5c97bd');
        p(2, 2, 6, 1, '#bae6fd');
        p(3, 3, 2, 1, '#f0f9ff');
        p(7, 8, 5, 1, '#bae6fd');
        p(10, 9, 2, 1, '#e0f2fe');
        p(0, 13, 14, 1, '#366585');
        break;
      }
      case TileType.BUILT_FLOOR: {
        p(0, 0, 14, 14, '#4a3628');
        p(0, 0, 14, 1, '#6e523d');
        p(0, 7, 14, 1, '#6e523d');
        p(1, 2, 4, 1, '#5b4332');
        p(8, 9, 4, 1, '#5b4332');
        p(6, 1, 1, 6, '#332419');
        p(12, 8, 1, 6, '#332419');
        p(1, 1, 1, 1, '#8c6b4f');
        p(7, 8, 1, 1, '#8c6b4f');
        break;
      }
      case TileType.ROCK: {
        const rockTop = biome === 'Magma' ? '#854e41' : biome === 'Heladas' ? '#95bcd6' : biome === 'Sombrias' ? '#56477d' : '#657876';
        const rockMid = biome === 'Magma' ? '#63372e' : biome === 'Heladas' ? '#6e96b3' : biome === 'Sombrias' ? '#403460' : '#4b5a59';
        const rockDark = biome === 'Magma' ? '#3d1f19' : biome === 'Heladas' ? '#416178' : biome === 'Sombrias' ? '#251d3a' : '#2d3737';
        p(0, 0, 14, 14, rockDark);
        p(1, 1, 12, 10, rockMid);
        p(1, 1, 12, 3, rockTop);
        p(2, 2, 5, 1, 'rgba(255,255,255,0.22)');
        p(8, 5, 4, 2, rockDark);
        p(3, 8, 5, 1, rockDark);
        p(0, 11, 14, 3, 'rgba(0,0,0,0.34)');
        break;
      }
      case TileType.CRACKED_WALL: {
        p(0, 0, 14, 14, '#2a2236');
        p(1, 1, 12, 10, '#5a4e68');
        p(1, 1, 12, 2, '#736685');
        // Deep fissure with subtle cyan/amber hint
        p(6, 2, 1, 3, '#17121f');
        p(5, 5, 2, 2, '#17121f');
        p(7, 7, 1, 4, '#17121f');
        p(4, 8, 2, 1, '#17121f');
        p(6, 5, 1, 1, '#38bdf8');
        p(7, 9, 1, 1, '#38bdf8');
        break;
      }
      case TileType.ANCIENT_BRICK: {
        p(0, 0, 14, 14, '#252b3b');
        p(1, 1, 5, 5, '#46526b');
        p(7, 1, 6, 5, '#3d475e');
        p(1, 7, 7, 5, '#3d475e');
        p(9, 7, 4, 5, '#46526b');
        p(1, 1, 5, 1, '#637394');
        p(7, 1, 6, 1, '#586685');
        p(3, 3, 2, 1, '#38bdf8');
        p(10, 9, 2, 1, '#2dd4bf');
        break;
      }
      case TileType.WALL: {
        p(0, 0, 14, 14, '#1e2b34');
        p(1, 1, 12, 10, '#3e5666');
        p(1, 1, 12, 2, '#648396');
        p(2, 2, 3, 1, '#93b4c8');
        p(3, 5, 8, 1, '#2a3c47');
        p(6, 7, 2, 2, '#2dd4bf'); // ancient tech seam glow
        p(1, 11, 12, 3, '#18222a');
        break;
      }
      case TileType.WOOD_PILLAR: {
        p(3, 1, 8, 12, '#5c3b24');
        p(4, 2, 6, 10, '#855736');
        p(5, 2, 2, 9, '#ad7850');
        p(3, 4, 8, 1, '#3d2515');
        p(3, 9, 8, 1, '#3d2515');
        p(3, 12, 8, 1, '#2c190d');
        break;
      }
      case TileType.MUSHROOM: {
        p(6, 7, 2, 5, '#dfd5c3');
        p(6, 8, 1, 4, '#f3ece0');
        const cap = biome === 'Sombrias' ? '#a855f7' : biome === 'Heladas' ? '#38bdf8' : '#10b981';
        const capHi = biome === 'Sombrias' ? '#c084fc' : biome === 'Heladas' ? '#7dd3fc' : '#34d399';
        const spot = biome === 'Sombrias' ? '#fae8ff' : '#ecfdf5';
        p(3, 4, 8, 3, cap);
        p(4, 2, 6, 2, capHi);
        p(5, 3, 1, 1, spot);
        p(8, 5, 1, 1, spot);
        p(7, 2, 1, 1, spot);
        break;
      }
      case TileType.ORE: {
        p(1, 2, 12, 10, '#3f4552');
        p(2, 3, 10, 8, '#586070');
        p(3, 2, 8, 1, '#737d91');
        const oreCol =
          biome === 'Magma' ? '#fb923c' : biome === 'Heladas' ? '#67e8f9' : biome === 'Sombrias' ? '#c084fc' : '#facc15';
        p(3, 4, 3, 3, oreCol);
        p(8, 7, 3, 3, oreCol);
        p(6, 4, 2, 2, oreCol);
        p(4, 4, 1, 1, '#ffffff');
        p(9, 7, 1, 1, '#ffffff');
        break;
      }
      case TileType.ICE: {
        p(2, 2, 10, 10, '#38bdf8');
        p(3, 3, 8, 8, '#7dd3fc');
        p(4, 3, 6, 6, '#bae6fd');
        p(4, 4, 2, 5, '#f0f9ff');
        p(9, 7, 1, 2, '#e0f2fe');
        break;
      }
      case TileType.SHADOW_CRYSTAL: {
        p(4, 10, 6, 2, '#3b0764');
        p(6, 1, 2, 10, '#9333ea');
        p(4, 5, 2, 6, '#7e22ce');
        p(8, 6, 2, 5, '#a855f7');
        p(6, 2, 1, 5, '#f3e8ff');
        p(8, 7, 1, 2, '#e9d5ff');
        break;
      }
      case TileType.ENERGY_CRYSTAL: {
        p(4, 10, 6, 2, '#0f3f42');
        p(6, 1, 2, 10, '#14b8a6');
        p(4, 4, 2, 7, '#0d9488');
        p(8, 5, 2, 6, '#2dd4bf');
        p(6, 2, 1, 5, '#ccfbf1');
        p(8, 6, 1, 2, '#99f6e4');
        break;
      }
      case TileType.TORCH: {
        p(6, 6, 2, 7, '#6e4729');
        p(6, 6, 1, 6, '#8f5f3a');
        p(5, 5, 4, 2, '#ea580c');
        p(5, 3, 4, 2, '#f97316');
        p(6, 2, 2, 3, '#fde047');
        p(6, 2, 1, 1, '#ffffff');
        break;
      }
      case TileType.RECHARGE_STATION: {
        p(1, 2, 12, 10, '#142636');
        p(2, 2, 10, 9, '#1f3f54');
        p(3, 3, 8, 7, '#0e7490');
        p(4, 4, 6, 5, '#22d3ee');
        p(5, 5, 4, 3, '#a5f3fc');
        p(6, 6, 2, 1, '#ffffff');
        p(2, 11, 10, 1, '#091520');
        break;
      }
      case TileType.DOOR_CLOSED: {
        p(1, 1, 12, 12, '#3d2616');
        p(2, 2, 10, 10, '#784e2e');
        p(3, 3, 8, 8, '#96633d');
        p(2, 5, 10, 1, '#475569');
        p(2, 9, 10, 1, '#475569');
        p(9, 6, 2, 2, '#fbbf24');
        break;
      }
      case TileType.DOOR_OPEN: {
        p(1, 1, 2, 12, '#784e2e');
        p(11, 1, 2, 12, '#784e2e');
        p(1, 1, 2, 2, '#475569');
        p(11, 1, 2, 2, '#475569');
        break;
      }
      case TileType.CHEST_CLOSED: {
        p(2, 4, 10, 8, '#54331b');
        p(3, 5, 8, 6, '#925932');
        p(3, 5, 8, 2, '#b06d3f');
        p(2, 7, 10, 1, '#f59e0b');
        p(6, 6, 2, 3, '#fde047');
        p(6, 7, 2, 1, '#ffffff');
        break;
      }
      case TileType.CHEST_OPEN: {
        p(2, 5, 10, 7, '#472b17');
        p(3, 2, 8, 3, '#925932');
        p(4, 6, 6, 4, '#140c07');
        p(5, 7, 4, 2, '#28180e');
        break;
      }
      case TileType.ALTAR: {
        p(2, 3, 10, 9, '#2b2647');
        p(3, 4, 8, 7, '#494275');
        p(4, 4, 6, 1, '#7167ad');
        p(5, 5, 4, 4, '#38bdf8');
        p(6, 6, 2, 2, '#f0f9ff');
        break;
      }
      case TileType.VOLCANIC_ROCK: {
        p(0, 0, 14, 14, '#29100d');
        p(1, 1, 12, 10, '#52221a');
        p(2, 1, 10, 2, '#753126');
        p(3, 7, 4, 1, '#f97316');
        p(8, 4, 3, 1, '#ea580c');
        p(1, 11, 12, 3, '#1f0b08');
        break;
      }
      case TileType.MAGMA_COAL: {
        p(1, 2, 12, 10, '#241210');
        p(2, 3, 10, 8, '#3b1c18');
        p(3, 4, 3, 3, '#ea580c');
        p(8, 7, 3, 3, '#f97316');
        p(4, 5, 1, 1, '#fef08a');
        p(9, 8, 1, 1, '#fde047');
        break;
      }
      case TileType.THERMAL_COPPER: {
        p(1, 2, 12, 10, '#45261c');
        p(2, 3, 10, 8, '#663829');
        p(3, 4, 4, 3, '#d97706');
        p(7, 7, 4, 3, '#f59e0b');
        p(4, 4, 2, 1, '#fef3c7');
        p(8, 7, 1, 1, '#fef3c7');
        break;
      }
      case TileType.ICE_CRYSTAL: {
        p(4, 10, 6, 2, '#0c4a6e');
        p(5, 1, 4, 10, '#0ea5e9');
        p(3, 4, 2, 6, '#0284c7');
        p(9, 5, 2, 5, '#38bdf8');
        p(6, 2, 1, 6, '#f0f9ff');
        p(9, 6, 1, 2, '#bae6fd');
        break;
      }
      case TileType.BLUE_QUARTZ: {
        p(1, 2, 12, 10, '#32495c');
        p(2, 3, 10, 8, '#466782');
        p(3, 4, 3, 4, '#2563eb');
        p(8, 6, 3, 4, '#3b82f6');
        p(4, 4, 1, 2, '#dbeafe');
        p(9, 6, 1, 2, '#eff6ff');
        break;
      }
      case TileType.DARK_IRON: {
        p(1, 2, 12, 10, '#1f212e');
        p(2, 3, 10, 8, '#333647');
        p(3, 4, 3, 3, '#6366f1');
        p(8, 7, 3, 3, '#818cf8');
        p(4, 4, 1, 1, '#e0e7ff');
        p(9, 7, 1, 1, '#e0e7ff');
        break;
      }
      case TileType.NEON_MUSHROOM: {
        p(6, 7, 2, 5, '#cbd5e1');
        p(3, 3, 8, 4, '#06b6d4');
        p(4, 2, 6, 1, '#67e8f9');
        p(5, 4, 1, 1, '#ecfeff');
        p(8, 5, 1, 1, '#a5f3fc');
        break;
      }
      case TileType.KELP: {
        p(4, 5, 2, 7, '#059669');
        p(8, 4, 2, 8, '#10b981');
        p(3, 6, 2, 2, '#34d399');
        p(9, 5, 2, 2, '#6ee7b7');
        p(5, 4, 1, 1, '#a7f3d0');
        break;
      }
      case TileType.EVO_STONE_VEIN: {
        p(1, 2, 12, 10, '#332645');
        p(2, 3, 10, 8, '#483661');
        p(4, 4, 6, 6, '#f59e0b');
        p(5, 5, 4, 4, '#fde047');
        p(6, 6, 2, 2, '#ffffff');
        p(3, 3, 1, 1, '#f472b6');
        p(10, 9, 1, 1, '#f472b6');
        break;
      }
      default:
        break;
    }

    this.tileCache.set(key, c);
    return c;
  }

  public getExplorerSprite(facingX: number, facingY: number, frame: number): HTMLCanvasElement {
    const dir = Math.abs(facingX) > Math.abs(facingY) ? (facingX >= 0 ? 'R' : 'L') : facingY < 0 ? 'U' : 'D';
    const key = `explorer_${dir}_${frame % 2}`;
    const existing = this.charCache.get(key);
    if (existing) return existing;

    const [c, g] = makeCanvas(28, 28);
    const S = 2;
    const p = (gx: number, gy: number, gw: number, gh: number, col: string) =>
      px(g, gx * S, gy * S, gw * S, gh * S, col);

    const step = frame % 2 === 1 ? 1 : 0;

    // Boots / legs
    p(4, 10 + step, 2, 3 - step, '#1e293b');
    p(8, 10 + (1 - step), 2, 3 - (1 - step), '#1e293b');
    p(4, 12, 2, 1, '#475569');
    p(8, 12, 2, 1, '#475569');

    // Explorer armored cavern suit + cyan energy belt
    p(3, 5, 8, 6, '#0f3d4c');
    p(4, 5, 6, 5, '#165f75');
    p(4, 6, 6, 3, '#22d3ee');
    p(5, 6, 4, 3, '#0f172a');
    p(4, 9, 6, 1, '#f59e0b'); // slug canister belt!

    // Backpack canister when facing up or side
    if (dir === 'U') {
      p(4, 6, 6, 4, '#334155');
      p(5, 7, 4, 2, '#38bdf8');
    }

    // Head & Ranger Helmet + Goggles
    p(4, 1, 6, 5, '#f2cba2');
    p(3, 1, 8, 2, '#0284c7'); // helmet shell
    p(4, 0, 6, 1, '#38bdf8'); // helmet top sheen
    p(6, 1, 2, 1, '#fef08a'); // headlamp glow

    // Visor / Eyes by direction
    if (dir === 'D') {
      p(4, 3, 6, 1, '#0c4a6e');
      p(5, 4, 1, 1, '#0f172a');
      p(8, 4, 1, 1, '#0f172a');
    } else if (dir === 'L') {
      p(4, 3, 3, 1, '#38bdf8');
      p(4, 4, 1, 1, '#0f172a');
    } else if (dir === 'R') {
      p(7, 3, 3, 1, '#38bdf8');
      p(9, 4, 1, 1, '#0f172a');
    }

    // Blaster / Pickaxe holster
    if (dir === 'R') {
      p(11, 7, 2, 2, '#f59e0b');
      p(12, 7, 1, 1, '#fef08a');
    } else if (dir === 'L') {
      p(1, 7, 2, 2, '#f59e0b');
      p(1, 7, 1, 1, '#fef08a');
    }

    this.charCache.set(key, c);
    return c;
  }

  public getSlugPixelSprite(color: string, accent: string, mega: boolean): HTMLCanvasElement {
    const key = `slug_${color}_${accent}_${mega ? 1 : 0}`;
    const existing = this.charCache.get(key);
    if (existing) return existing;

    const [c, g] = makeCanvas(24, 24);
    const S = 2;
    const p = (gx: number, gy: number, gw: number, gh: number, col: string) =>
      px(g, gx * S, gy * S, gw * S, gh * S, col);

    if (mega) {
      p(2, 2, 8, 8, 'rgba(250, 204, 21, 0.28)');
    }
    // Crisp outline shadow
    p(3, 4, 6, 6, 'rgba(6, 12, 20, 0.72)');
    // Body
    p(3, 4, 5, 5, color);
    p(4, 3, 3, 1, color);
    p(4, 5, 3, 3, accent);
    p(3, 2, 1, 2, accent);
    p(7, 2, 1, 2, accent);
    p(4, 5, 1, 1, '#090d16');
    p(6, 5, 1, 1, '#090d16');
    p(2, 7, 2, 2, color);

    this.charCache.set(key, c);
    return c;
  }

  public getSpeciesSlugSprite(
    speciesId: string,
    mega: boolean,
    pose: SlugSpritePose = 'idle'
  ): HTMLCanvasElement {
    const key = `sp_slug_${speciesId}_${mega ? 1 : 0}_${pose}`;
    const existing = this.charCache.get(key);
    if (existing) return existing;

    const sp = getSpecies(speciesId);
    const [c, g] = makeCanvas(24, 24);
    const S = 2;
    const yOff = pose === 'rest' ? 1 : 0;
    const p = (gx: number, gy: number, gw: number, gh: number, col: string) =>
      px(g, gx * S, (gy + yOff) * S, gw * S, gh * S, col);

    if (mega) {
      // Megamorph golden-crystal aura & crown sparkles
      p(1, 2, 10, 8, 'rgba(251, 191, 36, 0.24)');
      p(4, 0, 1, 1, '#fde047');
      p(7, 0, 1, 1, '#fde047');
      p(5, 1, 2, 1, '#fef08a');
    }

    // Dark pixel rim for high contrast on all floors
    p(3, 3, 6, 7, '#060c14');
    p(2, 5, 8, 5, '#060c14');

    // Main slug silhouette (expressive torso + rounded head + tail)
    p(3, 4, 6, 5, sp.color);
    p(4, 3, 4, 2, sp.color);
    p(4, 6, 4, 3, sp.accent); // glowing belly
    p(2, 8, 2, 2, sp.color); // tail tip

    // Species-distinct anatomical traits
    switch (speciesId) {
      case 'infurnus':
      case 'piroclasto': {
        // Flame plume crest
        p(5, 1, 2, 2, '#fb923c');
        p(6, 0, 1, 2, '#fde047');
        p(3, 2, 1, 2, sp.accent);
        p(8, 2, 1, 2, sp.accent);
        if (speciesId === 'piroclasto') {
          p(3, 6, 1, 2, '#f97316');
          p(8, 6, 1, 2, '#f97316');
        }
        break;
      }
      case 'aquabeak': {
        // Streamlined fin + cute beak
        p(5, 1, 2, 2, '#38bdf8');
        p(2, 6, 1, 2, '#bae6fd');
        p(9, 6, 1, 2, '#bae6fd');
        p(5, 6, 2, 1, '#fef08a');
        break;
      }
      case 'tazerling':
      case 'voltrix': {
        // Lightning twin antennae
        p(3, 1, 1, 2, '#fef08a');
        p(8, 1, 1, 2, '#fef08a');
        p(2, 2, 1, 1, '#fde047');
        p(9, 2, 1, 1, '#fde047');
        p(3, 6, 1, 1, '#fef08a');
        p(8, 6, 1, 1, '#fef08a');
        break;
      }
      case 'frostcrawler':
      case 'glaciomita': {
        // Ice crystal crown spikes
        p(4, 1, 1, 2, '#e0f2fe');
        p(6, 1, 1, 2, '#f0f9ff');
        p(8, 2, 1, 1, '#bae6fd');
        p(9, 5, 1, 2, '#7dd3fc');
        break;
      }
      case 'doc': {
        // Healer halo & emerald-white gem
        p(4, 1, 4, 1, '#fef08a');
        p(5, 3, 2, 1, '#5eead4');
        p(3, 2, 1, 2, '#ffffff');
        p(8, 2, 1, 2, '#ffffff');
        break;
      }
      case 'darkfurnus':
      case 'umbrospect': {
        // Curved obsidian horns / abyssal third eye
        p(3, 1, 1, 2, '#d8b4fe');
        p(8, 1, 1, 2, '#d8b4fe');
        p(2, 2, 1, 1, '#a855f7');
        p(9, 2, 1, 1, '#a855f7');
        if (speciesId === 'umbrospect') {
          p(5, 3, 2, 1, '#f472b6');
        }
        break;
      }
      case 'flaringo': {
        // Tall coral crest feather
        p(5, 0, 2, 3, '#fb7185');
        p(6, 1, 2, 1, '#fef08a');
        p(3, 2, 1, 2, sp.accent);
        break;
      }
      case 'lariat': {
        // Stone brow & golden lasso band
        p(3, 3, 6, 1, '#78350f');
        p(3, 7, 6, 1, '#fbbf24');
        p(4, 2, 1, 1, '#d97706');
        p(7, 2, 1, 1, '#d97706');
        break;
      }
      case 'musgacorn': {
        // Mossy sprout & leaf collar
        p(5, 1, 2, 2, '#86efac');
        p(6, 0, 2, 1, '#4ade80');
        p(3, 6, 6, 1, '#16a34a');
        break;
      }
      case 'enigmo':
      case 'aetherion': {
        // Psychic prism / ancient crystal halo
        p(5, 0, 2, 2, speciesId === 'aetherion' ? '#fef08a' : '#5eead4');
        p(3, 2, 1, 2, '#99f6e4');
        p(8, 2, 1, 2, '#99f6e4');
        break;
      }
      default: {
        p(3, 2, 1, 2, sp.accent);
        p(8, 2, 1, 2, sp.accent);
        break;
      }
    }

    // Expressive eyes by pose
    if (pose === 'rest') {
      p(4, 5, 1, 1, '#090d16');
      p(7, 5, 1, 1, '#090d16');
    } else if (pose === 'happy') {
      p(4, 4, 1, 1, '#090d16');
      p(7, 4, 1, 1, '#090d16');
      p(4, 5, 1, 1, '#ffffff');
      p(7, 5, 1, 1, '#ffffff');
    } else {
      const eyeCol = speciesId === 'darkfurnus' || speciesId === 'umbrospect' ? '#fef08a' : '#090d16';
      p(4, 4, 1, 2, eyeCol);
      p(7, 4, 1, 2, eyeCol);
      p(4, 4, 1, 1, '#ffffff');
      p(7, 4, 1, 1, '#ffffff');
    }

    this.charCache.set(key, c);
    return c;
  }

  public getFurnitureSprite(kind: FurnitureKind): HTMLCanvasElement {
    const key = `furniture_${kind}`;
    const existing = this.charCache.get(key);
    if (existing) return existing;

    const [c, g] = makeCanvas(TILE_PX, TILE_PX);
    const S = 2;
    const p = (gx: number, gy: number, gw: number, gh: number, col: string) =>
      px(g, gx * S, gy * S, gw * S, gh * S, col);

    if (kind === 'nest') {
      p(2, 4, 10, 8, '#54351e');
      p(3, 3, 8, 8, '#8c603c');
      p(4, 4, 6, 6, '#22c55e');
      p(5, 5, 4, 4, '#86efac');
      p(6, 6, 2, 2, '#dcfce7');
      p(3, 11, 8, 1, '#3b2413');
    } else if (kind === 'bed') {
      p(2, 3, 10, 9, '#4c301c');
      p(3, 4, 8, 7, '#0f5266');
      p(3, 4, 8, 3, '#e0f2fe');
      p(4, 4, 6, 1, '#ffffff');
      p(3, 7, 8, 4, '#22d3ee');
      p(4, 8, 6, 1, '#67e8f9');
      p(2, 11, 2, 2, '#2d1b0f');
      p(10, 11, 2, 2, '#2d1b0f');
    } else if (kind === 'feeder') {
      p(2, 5, 10, 7, '#4c2e19');
      p(3, 6, 8, 4, '#854d27');
      p(4, 6, 2, 2, '#4ade80');
      p(6, 7, 2, 2, '#fb923c');
      p(8, 6, 2, 2, '#38bdf8');
      p(5, 6, 1, 1, '#fef08a');
      p(2, 10, 10, 2, '#362011');
    } else {
      // Crystal Lamp
      p(4, 11, 6, 2, '#1e293b');
      p(5, 9, 4, 3, '#475569');
      p(5, 4, 4, 5, '#14b8a6');
      p(6, 2, 2, 6, '#5eead4');
      p(6, 3, 1, 4, '#f0fdfa');
      p(4, 6, 1, 3, '#0d9488');
      p(9, 6, 1, 3, '#0d9488');
    }

    this.charCache.set(key, c);
    return c;
  }
}

export const sprites = new SpriteAtlas();
