import { BIOME_INFO, TILE_PX } from './data';
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

class SpriteAtlas {
  private tileCache = new Map<string, HTMLCanvasElement>();
  private charCache = new Map<string, HTMLCanvasElement>();

  public getTileSprite(tile: TileType, biome: BiomeId, variant = 0): HTMLCanvasElement {
    const key = `${tile}_${biome}_${variant}`;
    const existing = this.tileCache.get(key);
    if (existing) return existing;

    const [c, g] = makeCanvas(TILE_PX, TILE_PX);
    const info = BIOME_INFO[biome];
    // Draw at 14x14 pixel grid scaled 2x -> crisp 28x28 pixel art
    const S = 2;
    const p = (gx: number, gy: number, gw: number, gh: number, col: string) =>
      px(g, gx * S, gy * S, gw * S, gh * S, col);

    // Base floor underneath
    p(0, 0, 14, 14, variant % 2 === 0 ? info.floorA : info.floorB);
    p(2, 3, 2, 1, 'rgba(255,255,255,0.05)');
    p(9, 10, 2, 1, 'rgba(0,0,0,0.14)');
    if (variant === 1) {
      p(5, 7, 1, 1, 'rgba(255,255,255,0.06)');
    }

    switch (tile) {
      case TileType.WATER: {
        p(0, 0, 14, 14, '#134e6f');
        p(1, 2, 12, 10, '#1a658f');
        p(2, 4, 4, 1, '#58c7f3');
        p(7, 9, 5, 1, '#7dd3fc');
        break;
      }
      case TileType.LAVA: {
        p(0, 0, 14, 14, '#7c200d');
        p(1, 1, 12, 12, '#c2410c');
        p(2, 3, 5, 2, '#f97316');
        p(7, 8, 4, 2, '#facc15');
        p(3, 10, 2, 1, '#fef08a');
        break;
      }
      case TileType.ICE_FLOOR: {
        p(0, 0, 14, 14, '#5489aa');
        p(1, 1, 12, 12, '#6ba4c6');
        p(2, 2, 5, 1, '#bae6fd');
        p(8, 9, 4, 1, '#e0f2fe');
        break;
      }
      case TileType.BUILT_FLOOR: {
        p(0, 0, 14, 14, '#4c3a2c');
        p(0, 0, 14, 1, '#68503c');
        p(0, 7, 14, 1, '#68503c');
        p(6, 1, 1, 6, '#3b2c21');
        p(12, 8, 1, 6, '#3b2c21');
        break;
      }
      case TileType.ROCK: {
        p(0, 0, 14, 14, info.wall);
        p(1, 1, 12, 10, biome === 'Magma' ? '#6c4236' : biome === 'Heladas' ? '#7aa1bd' : '#536264');
        p(2, 2, 4, 2, 'rgba(255,255,255,0.16)');
        p(1, 11, 12, 3, 'rgba(0,0,0,0.28)');
        break;
      }
      case TileType.CRACKED_WALL: {
        p(0, 0, 14, 14, '#564c5d');
        p(1, 1, 12, 11, '#6d6276');
        // Crack lines
        p(6, 2, 1, 3, '#1e1926');
        p(5, 5, 2, 2, '#1e1926');
        p(7, 7, 1, 4, '#1e1926');
        p(4, 8, 2, 1, '#1e1926');
        break;
      }
      case TileType.ANCIENT_BRICK: {
        p(0, 0, 14, 14, '#363c4d');
        p(1, 1, 5, 5, '#4b556b');
        p(7, 1, 6, 5, '#454f63');
        p(1, 7, 7, 5, '#454f63');
        p(9, 7, 4, 5, '#4b556b');
        p(4, 3, 2, 1, '#38bdf8');
        break;
      }
      case TileType.WALL: {
        p(0, 0, 14, 14, '#32424d');
        p(1, 1, 12, 10, '#4a6170');
        p(2, 2, 10, 2, '#698596');
        p(1, 11, 12, 3, '#232f37');
        break;
      }
      case TileType.WOOD_PILLAR: {
        p(3, 1, 8, 12, '#6b472d');
        p(4, 2, 6, 10, '#875b3b');
        p(5, 2, 2, 9, '#a5724c');
        p(3, 11, 8, 2, '#472e1d');
        break;
      }
      case TileType.MUSHROOM: {
        p(6, 7, 2, 5, '#d6cbb8');
        const cap = biome === 'Sombrias' ? '#a855f7' : biome === 'Heladas' ? '#38bdf8' : '#34d399';
        const spot = biome === 'Sombrias' ? '#f5d0fe' : '#ecfdf5';
        p(3, 3, 8, 4, cap);
        p(4, 2, 6, 1, cap);
        p(5, 4, 1, 1, spot);
        p(8, 5, 1, 1, spot);
        break;
      }
      case TileType.ORE: {
        p(1, 2, 12, 10, '#4f5561');
        p(2, 3, 10, 8, '#646b78');
        const oreCol =
          biome === 'Magma' ? '#fb923c' : biome === 'Heladas' ? '#67e8f9' : biome === 'Sombrias' ? '#c084fc' : '#facc15';
        p(3, 4, 3, 3, oreCol);
        p(8, 7, 3, 3, oreCol);
        p(4, 4, 1, 1, '#ffffff');
        p(9, 7, 1, 1, '#ffffff');
        break;
      }
      case TileType.ICE: {
        p(2, 2, 10, 10, '#7dd3fc');
        p(3, 3, 8, 8, '#bae6fd');
        p(4, 4, 3, 5, '#f0f9ff');
        break;
      }
      case TileType.SHADOW_CRYSTAL: {
        p(6, 2, 2, 10, '#9333ea');
        p(4, 5, 2, 7, '#7e22ce');
        p(8, 6, 2, 6, '#a855f7');
        p(6, 3, 1, 4, '#f3e8ff');
        break;
      }
      case TileType.ENERGY_CRYSTAL: {
        p(6, 1, 2, 11, '#14b8a6');
        p(4, 4, 2, 8, '#0d9488');
        p(8, 5, 2, 7, '#2dd4bf');
        p(6, 2, 1, 4, '#ccfbf1');
        break;
      }
      case TileType.TORCH: {
        p(6, 6, 2, 7, '#7c5333');
        p(5, 4, 4, 3, '#f97316');
        p(6, 2, 2, 3, '#fde047');
        break;
      }
      case TileType.RECHARGE_STATION: {
        p(2, 2, 10, 10, '#1e3a4c');
        p(3, 3, 8, 8, '#0e7490');
        p(5, 5, 4, 4, '#67e8f9');
        p(6, 6, 2, 2, '#ffffff');
        break;
      }
      case TileType.DOOR_CLOSED: {
        p(1, 2, 12, 10, '#5c3c24');
        p(2, 3, 10, 8, '#855836');
        p(9, 6, 2, 2, '#facc15');
        break;
      }
      case TileType.DOOR_OPEN: {
        p(1, 2, 2, 10, '#855836');
        p(11, 2, 2, 10, '#855836');
        break;
      }
      case TileType.CHEST_CLOSED: {
        p(2, 4, 10, 8, '#6b4226');
        p(3, 5, 8, 6, '#9a5f37');
        p(2, 7, 10, 1, '#facc15');
        p(6, 6, 2, 3, '#fde047');
        break;
      }
      case TileType.CHEST_OPEN: {
        p(2, 5, 10, 7, '#54341e');
        p(3, 3, 8, 2, '#9a5f37');
        p(4, 6, 6, 4, '#1f140c');
        break;
      }
      case TileType.ALTAR: {
        p(2, 3, 10, 9, '#3b3759');
        p(3, 4, 8, 7, '#585185');
        p(5, 5, 4, 4, '#38bdf8');
        p(6, 6, 2, 2, '#e0f2fe');
        break;
      }
      case TileType.VOLCANIC_ROCK: {
        p(0, 0, 14, 14, '#3a1a16');
        p(1, 1, 12, 10, '#5a261d');
        p(2, 2, 4, 2, '#7c3428');
        p(4, 8, 3, 1, '#ea580c');
        p(1, 11, 12, 3, '#260f0c');
        break;
      }
      case TileType.MAGMA_COAL: {
        p(1, 2, 12, 10, '#2a1614');
        p(2, 3, 10, 8, '#3c1e1a');
        p(3, 4, 3, 3, '#f97316');
        p(8, 7, 3, 3, '#fb923c');
        p(4, 5, 1, 1, '#fef08a');
        p(9, 8, 1, 1, '#fde047');
        break;
      }
      case TileType.THERMAL_COPPER: {
        p(1, 2, 12, 10, '#4c2b21');
        p(2, 3, 10, 8, '#693c2d');
        p(3, 4, 4, 3, '#d97706');
        p(7, 7, 4, 3, '#f59e0b');
        p(4, 4, 2, 1, '#fef3c7');
        break;
      }
      case TileType.ICE_CRYSTAL: {
        p(5, 1, 4, 11, '#38bdf8');
        p(3, 4, 2, 7, '#0ea5e9');
        p(9, 5, 2, 6, '#7dd3fc');
        p(6, 2, 1, 5, '#f0f9ff');
        break;
      }
      case TileType.BLUE_QUARTZ: {
        p(1, 2, 12, 10, '#3a556a');
        p(2, 3, 10, 8, '#4e718d');
        p(3, 4, 3, 4, '#2563eb');
        p(8, 6, 3, 4, '#3b82f6');
        p(4, 4, 1, 2, '#dbeafe');
        p(9, 6, 1, 2, '#eff6ff');
        break;
      }
      case TileType.DARK_IRON: {
        p(1, 2, 12, 10, '#272936');
        p(2, 3, 10, 8, '#383b4d');
        p(3, 4, 3, 3, '#6366f1');
        p(8, 7, 3, 3, '#818cf8');
        p(4, 4, 1, 1, '#e0e7ff');
        break;
      }
      case TileType.NEON_MUSHROOM: {
        p(6, 7, 2, 5, '#cbd5e1');
        p(3, 3, 8, 4, '#22d3ee');
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
        break;
      }
      case TileType.EVO_STONE_VEIN: {
        p(1, 2, 12, 10, '#3b2e4d');
        p(2, 3, 10, 8, '#4f3c68');
        p(4, 4, 6, 6, '#f59e0b');
        p(5, 5, 4, 4, '#fde047');
        p(6, 6, 2, 2, '#ffffff');
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

    // Legs (walk bob)
    const step = frame % 2 === 1 ? 1 : 0;
    p(4, 10 + step, 2, 3 - step, '#1e293b');
    p(8, 10 + (1 - step), 2, 3 - (1 - step), '#1e293b');

    // Explorer jacket
    p(3, 5, 8, 6, '#155e75');
    p(4, 6, 6, 4, '#22d3ee');
    p(5, 6, 4, 4, '#0f172a');

    // Head & Helmet
    p(4, 1, 6, 5, '#f5d0a9');
    p(3, 1, 8, 2, '#38bdf8'); // helmet rim
    p(6, 1, 2, 1, '#fef08a'); // headlamp!

    // Eyes by direction
    if (dir === 'D') {
      p(5, 4, 1, 1, '#0f172a');
      p(8, 4, 1, 1, '#0f172a');
    } else if (dir === 'L') {
      p(4, 4, 1, 1, '#0f172a');
    } else if (dir === 'R') {
      p(9, 4, 1, 1, '#0f172a');
    }

    // Blaster / Pickaxe arm
    if (dir === 'R') p(11, 7, 2, 2, '#f59e0b');
    else if (dir === 'L') p(1, 7, 2, 2, '#f59e0b');

    this.charCache.set(key, c);
    return c;
  }

  public getSlugPixelSprite(color: string, accent: string, mega: boolean): HTMLCanvasElement {
    const key = `slug_${color}_${accent}_${mega ? 1 : 0}`;
    const existing = this.charCache.get(key);
    if (existing) return existing;

    const [c, g] = makeCanvas(22, 22);
    const S = 2;
    const p = (gx: number, gy: number, gw: number, gh: number, col: string) =>
      px(g, gx * S, gy * S, gw * S, gh * S, col);

    if (mega) {
      p(2, 2, 7, 7, 'rgba(250, 204, 21, 0.35)');
    }
    // Cute pixel slug body
    p(3, 4, 5, 5, color);
    p(4, 3, 3, 1, color);
    p(4, 4, 3, 2, accent);
    // Antennae
    p(3, 2, 1, 2, accent);
    p(7, 2, 1, 2, accent);
    // Eyes
    p(4, 5, 1, 1, '#090d16');
    p(6, 5, 1, 1, '#090d16');
    // Tail
    p(2, 7, 2, 2, color);

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
      p(2, 4, 10, 7, '#7c5333');
      p(3, 3, 8, 9, '#9a6b44');
      p(4, 5, 6, 5, '#4ade80');
      p(5, 6, 4, 3, '#bbf7d0');
      p(3, 10, 8, 1, '#54351e');
    } else if (kind === 'bed') {
      p(2, 3, 10, 9, '#5c3c24');
      p(3, 4, 8, 7, '#0e7490');
      p(3, 4, 8, 3, '#e0f2fe');
      p(3, 7, 8, 4, '#22d3ee');
      p(2, 11, 2, 2, '#3b2514');
      p(10, 11, 2, 2, '#3b2514');
    } else if (kind === 'feeder') {
      p(2, 5, 10, 6, '#6b4226');
      p(3, 6, 8, 4, '#92400e');
      p(4, 6, 2, 2, '#4ade80');
      p(6, 7, 2, 2, '#fb923c');
      p(8, 6, 2, 2, '#38bdf8');
      p(2, 10, 10, 2, '#472b18');
    } else {
      // decor crystal lamp
      p(5, 9, 4, 4, '#475569');
      p(4, 11, 6, 2, '#334155');
      p(5, 4, 4, 5, '#2dd4bf');
      p(6, 3, 2, 5, '#ccfbf1');
      p(4, 6, 1, 3, '#14b8a6');
      p(9, 6, 1, 3, '#14b8a6');
    }

    this.charCache.set(key, c);
    return c;
  }
}

export const sprites = new SpriteAtlas();
