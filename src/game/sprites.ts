import { BIOME_INFO, TILE_PX, getSpecies } from './data';
import { TileType, type BiomeId, type FurnitureKind, type MechaTheme } from './types';

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

export type SlugSpritePose = 'idle' | 'rest' | 'happy' | 'walk' | 'play' | 'eat' | 'react';

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
    } else if (biome === 'Acuaticas') {
      p(1, 3, 4, 1, 'rgba(34, 211, 238, 0.16)');
      p(7, 9, 5, 1, 'rgba(8, 51, 68, 0.25)');
      if (v === 1) {
        p(3, 6, 3, 1, 'rgba(103, 232, 249, 0.2)');
        p(9, 3, 2, 1, 'rgba(255, 255, 255, 0.08)');
      } else if (v === 2) {
        p(2, 10, 2, 1, 'rgba(56, 189, 248, 0.18)');
        p(10, 5, 2, 2, 'rgba(14, 116, 144, 0.2)');
      } else if (v === 3) {
        p(5, 8, 3, 1, 'rgba(165, 243, 252, 0.16)');
      }
    } else if (biome === 'Cristalinas') {
      p(2, 2, 3, 1, 'rgba(167, 139, 250, 0.18)');
      p(8, 10, 4, 1, 'rgba(15, 23, 42, 0.24)');
      if (v === 1) {
        p(4, 6, 2, 2, 'rgba(129, 140, 248, 0.22)');
        p(10, 3, 1, 1, 'rgba(233, 213, 255, 0.28)');
      } else if (v === 2) {
        p(2, 9, 2, 1, 'rgba(56, 189, 248, 0.2)');
        p(8, 4, 2, 1, 'rgba(255, 255, 255, 0.12)');
      } else if (v === 3) {
        p(6, 8, 2, 1, 'rgba(196, 181, 253, 0.24)');
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
        const rockTop =
          biome === 'Magma'
            ? '#854e41'
            : biome === 'Heladas'
            ? '#95bcd6'
            : biome === 'Acuaticas'
            ? '#478b9c'
            : biome === 'Cristalinas'
            ? '#6c73b8'
            : biome === 'Sombrias'
            ? '#56477d'
            : '#657876';
        const rockMid =
          biome === 'Magma'
            ? '#63372e'
            : biome === 'Heladas'
            ? '#6e96b3'
            : biome === 'Acuaticas'
            ? '#2f6573'
            : biome === 'Cristalinas'
            ? '#494e87'
            : biome === 'Sombrias'
            ? '#403460'
            : '#4b5a59';
        const rockDark =
          biome === 'Magma'
            ? '#3d1f19'
            : biome === 'Heladas'
            ? '#416178'
            : biome === 'Acuaticas'
            ? '#1b3c47'
            : biome === 'Cristalinas'
            ? '#292d54'
            : biome === 'Sombrias'
            ? '#251d3a'
            : '#2d3737';
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
        p(0, 0, 14, 14, '#241e33');
        p(1, 1, 12, 10, '#5a4e6b');
        p(1, 1, 12, 2, '#7c6f91');
        // Deep fissure with luminous cyan ancient seam so breakable passages stand out cleanly
        p(6, 1, 2, 4, '#130f1c');
        p(4, 5, 3, 2, '#130f1c');
        p(7, 7, 2, 4, '#130f1c');
        p(3, 8, 3, 1, '#130f1c');
        p(6, 2, 1, 2, '#67e8f9');
        p(5, 5, 2, 1, '#2dd4bf');
        p(7, 8, 1, 2, '#67e8f9');
        p(1, 11, 12, 3, '#1a1426');
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
        p(1, 2, 12, 11, '#0d1b29');
        p(2, 2, 10, 9, '#1c4259');
        p(2, 2, 10, 2, '#38bdf8');
        p(3, 4, 8, 6, '#0e7490');
        p(4, 5, 6, 4, '#22d3ee');
        p(5, 5, 4, 3, '#ccfbf1');
        p(6, 6, 2, 1, '#ffffff');
        p(2, 11, 10, 1, '#08131d');
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
        p(1, 4, 12, 9, '#381e0d');
        p(2, 4, 10, 8, '#6e4122');
        p(3, 5, 8, 6, '#a16236');
        p(3, 4, 8, 2, '#d97706');
        p(2, 7, 10, 1, '#fbbf24');
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
        p(1, 3, 12, 10, '#1e1b38');
        p(2, 3, 10, 9, '#312b57');
        p(3, 4, 8, 7, '#514785');
        p(4, 4, 6, 1, '#93c5fd');
        p(5, 5, 4, 4, '#2dd4bf');
        p(6, 6, 2, 2, '#f0fdfa');
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
      case TileType.WATERFALL: {
        p(0, 0, 14, 14, '#0c3b52');
        p(2, 0, 10, 14, '#0ea5e9');
        p(3, 0, 8, 12, '#38bdf8');
        p(4, 1, 2, 9, '#bae6fd');
        p(8, 2, 2, 8, '#e0f2fe');
        p(2, 11, 10, 3, '#cffafe');
        p(4, 12, 6, 1, '#ffffff');
        break;
      }
      case TileType.CRYSTAL_SPIRE: {
        p(3, 10, 8, 3, '#1e1b4b');
        p(5, 1, 4, 10, '#8b5cf6');
        p(3, 4, 2, 7, '#6366f1');
        p(9, 5, 2, 6, '#38bdf8');
        p(6, 2, 2, 6, '#ddd6fe');
        p(6, 1, 1, 3, '#ffffff');
        p(9, 6, 1, 3, '#bae6fd');
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
    const key = `explorer_eli_${dir}_${frame % 2}`;
    const existing = this.charCache.get(key);
    if (existing) return existing;

    const [c, g] = makeCanvas(28, 28);
    const S = 2;
    const p = (gx: number, gy: number, gw: number, gh: number, col: string) =>
      px(g, gx * S, gy * S, gw * S, gh * S, col);

    const step = frame % 2 === 1 ? 1 : 0;

    // Boots / tactical pants
    p(4, 10 + step, 2, 3 - step, '#1e293b');
    p(8, 10 + (1 - step), 2, 3 - (1 - step), '#1e293b');
    p(4, 12, 2, 1, '#334155');
    p(8, 12, 2, 1, '#334155');

    // Eli Shane dark tactical vest + orange shoulder pauldrons + dual glowing cyan chest canisters (Ref 3)
    p(2, 5, 10, 6, '#0f172a');
    p(2, 5, 2, 2, '#f97316'); // left orange pauldron trim
    p(10, 5, 2, 2, '#f97316'); // right orange pauldron trim
    p(4, 6, 6, 4, '#1e293b');
    if (dir !== 'U') {
      p(5, 6, 1, 3, '#38bdf8'); // left cyan canister
      p(8, 6, 1, 3, '#22d3ee'); // right cyan canister
      p(5, 6, 1, 1, '#e0f2fe');
      p(8, 6, 1, 1, '#e0f2fe');
    } else {
      p(4, 6, 6, 4, '#334155');
      p(5, 7, 4, 2, '#38bdf8');
    }
    p(4, 9, 6, 1, '#ea580c'); // orange utility belt

    // Head & spiky navy/indigo Eli Shane hair (Ref 3)
    p(4, 2, 6, 4, '#f4c7a1');
    p(3, 0, 8, 2, '#1e1b4b');
    p(4, 0, 6, 1, '#4338ca');
    p(3, 1, 2, 2, '#1e1b4b');
    p(9, 1, 2, 2, '#1e1b4b');
    p(2, 1, 1, 1, '#312e81'); // hair spikes
    p(11, 1, 1, 1, '#312e81');

    // Expressive eyes by direction
    if (dir === 'D') {
      p(5, 3, 1, 1, '#090d16');
      p(8, 3, 1, 1, '#090d16');
    } else if (dir === 'L') {
      p(4, 3, 1, 1, '#090d16');
      p(9, 2, 2, 3, '#1e1b4b');
    } else if (dir === 'R') {
      p(9, 3, 1, 1, '#090d16');
      p(3, 2, 2, 3, '#1e1b4b');
    } else {
      p(4, 2, 6, 4, '#1e1b4b');
    }

    // Orange & silver Shane Blaster at side
    if (dir === 'R') {
      p(11, 7, 3, 2, '#f97316');
      p(12, 7, 2, 1, '#38bdf8');
    } else if (dir === 'L') {
      p(0, 7, 3, 2, '#f97316');
      p(0, 7, 2, 1, '#38bdf8');
    } else {
      p(11, 7, 2, 2, '#f97316');
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
    p(3, 4, 6, 6, 'rgba(6, 12, 20, 0.72)');
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
    pose: SlugSpritePose = 'idle',
    frame = 0
  ): HTMLCanvasElement {
    const f4 = frame & 3;
    const f = f4 & 1;
    const key = `sp_slug_v3_${speciesId}_${mega ? 1 : 0}_${pose}_${f4}`;
    const existing = this.charCache.get(key);
    if (existing) return existing;

    const sp = getSpecies(speciesId);
    const [c, g] = makeCanvas(24, 24);
    const isMovingPose = pose === 'walk' || pose === 'play' || pose === 'happy';
    const yShift =
      pose === 'rest'
        ? 2
        : isMovingPose
        ? f4 === 1
          ? -1
          : f4 === 3
          ? -2
          : 0
        : pose === 'react'
        ? f4 === 1 || f4 === 2
          ? -1
          : 0
        : 0;
    const bob = (gx: number, gy: number, gw: number, gh: number, col: string) =>
      px(g, gx, gy + yShift, gw, gh, col);

    // Late-game Megamorph Aura & Crown (strictly when mega === true)
    if (mega) {
      bob(3, 5, 18, 15, 'rgba(251, 191, 36, 0.22)');
      bob(8, 1, 2, 2, '#fde047');
      bob(11, 0, 2, 3, '#fef08a');
      bob(14, 1, 2, 2, '#fde047');
    }

    // Helper: crisp dark silhouette border + -45deg rim highlight
    const rim = 'rgba(255,255,255,0.44)';
    const outline = '#060c14';
    const stepA = pose === 'walk' || pose === 'play' ? (f4 === 1 ? -1 : f4 === 3 ? 1 : 0) : 0;
    const stepB = -stepA;

    switch (speciesId) {
      // ---- PROTOTYPE 1: INFURNUS (Slender Agile Flame Creature) ----
      case 'infurnus': {
        // Tall slender outline + curled flame tail + athletic grounded feet
        bob(7, 7, 10, 14, outline);
        bob(8, 6, 8, 15, outline);
        bob(3, 14, 5, 6, outline);
        // Stubby grounded stride feet
        bob(8 + stepA, 20, 3, 2, '#7f1d1d');
        bob(13 + stepB, 20, 3, 2, '#7f1d1d');
        // Multi-tongue asymmetrical flame crest (4-frame flicker)
        const crestShift = f4 === 1 ? -1 : f4 === 3 ? 1 : 0;
        bob(10 + crestShift, 1, 3, 4, '#fef08a');
        bob(9, 3, 6, 4, '#f97316');
        bob(7, 4 + f, 2, 3, '#fb923c'); // left ear-horn
        bob(15, 4 + (1 - f), 2, 3, '#fb923c'); // right ear-horn
        // Body + shadow bottom-right + -45deg top-left highlight
        bob(8, 7, 8, 13, sp.color);
        bob(14, 9, 2, 11, '#991b1b');
        bob(9, 8, 2, 4, '#fecaca');
        // Fiery golden belly & scorch seams
        bob(10, 14, 4, 6, '#fde047');
        bob(10, 16, 4, 1, '#ea580c');
        bob(10, 18, 4, 1, '#ea580c');
        // Sweeping flame tail
        bob(4, 16 - (f4 & 1), 4, 3, '#f97316');
        bob(2, 14 + (f4 === 2 ? 1 : 0), 3, 2, '#fde047');
        // Floating ember spark on active states
        if (pose === 'happy' || pose === 'play' || pose === 'react' || f4 === 2) {
          bob(16, 2 - (f4 & 1), 1, 1, '#fef08a');
        }
        break;
      }

      // ---- PROTOTYPE 2: FROSTCRAWLER (Wide Heavy Armored Beetle Crawler) ----
      case 'frostcrawler': {
        const heave = pose === 'rest' ? 0 : f4 === 2 ? 1 : 0;
        // Wide low hexagonal outline hugging ground
        bob(3, 10 + heave, 18, 11, outline);
        bob(5, 8 + heave, 14, 13, outline);
        bob(1, 16, 4, 5, outline);
        // 4 chunky armored feet planted firmly
        bob(5 + stepA, 20, 3, 2, '#164e63');
        bob(10 + stepB, 20, 2, 2, '#164e63');
        bob(13 + stepA, 20, 2, 2, '#164e63');
        bob(16 + stepB, 20, 3, 2, '#164e63');
        // Three jagged crystal horns
        bob(5, 5 + heave, 2, 4, '#bae6fd');
        bob(11, 2 + heave, 2, 7, '#f0f9ff');
        bob(17, 5 + heave, 2, 4, '#bae6fd');
        // Wide armored cryo carapace + segmented dorsal bevel
        bob(4, 11 + heave, 16, 9, '#0891b2');
        bob(6, 9 + heave, 12, 11, '#06b6d4');
        // Heavy shoulder ice shields
        bob(3, 14 + heave, 2, 4, '#67e8f9');
        bob(19, 14 + heave, 2, 4, '#67e8f9');
        // -45deg frosty specular top shell & right-side plate shadow
        bob(6, 10 + heave, 6, 2, '#e0f2fe');
        bob(15, 12 + heave, 5, 8, '#164e63');
        // Armored belly & lower mandible ridge
        bob(8, 16, 8, 4, '#e0f2fe');
        bob(8, 18, 8, 1, '#0e7490');
        bob(6, 16, 2, 2, '#bae6fd');
        bob(16, 16, 2, 2, '#bae6fd');
        // Clubbed frost mace tail
        bob(1, 17, 3, 3, '#38bdf8');
        bob(1, 15, 2, 2, '#e0f2fe');
        break;
      }

      // ---- PROTOTYPE 3: TAZERLING (Agile Hyper Lightning Sprinter) ----
      case 'tazerling': {
        const zapJitter = f4 === 1 ? -1 : f4 === 3 ? 1 : 0;
        // Lean silhouette + puff electric cheeks + forked tail
        bob(7, 8, 10, 13, outline);
        bob(5, 12, 14, 5, outline);
        // Quick sprinter feet
        bob(8 + stepA, 20, 3, 2, '#854d0e');
        bob(13 + stepB, 20, 3, 2, '#854d0e');
        // Twin dramatic zigzag lightning antennae (3 bends!)
        bob(8, 5, 2, 3, '#fef08a');
        bob(6 + f, 3, 3, 2, '#fde047');
        bob(7 + zapJitter, 1, 2, 2, '#38bdf8');
        bob(14, 5, 2, 3, '#fef08a');
        bob(15 - f, 3, 3, 2, '#fde047');
        bob(15 - zapJitter, 1, 2, 2, '#38bdf8');
        // Lean bright yellow body + -45deg highlight
        bob(8, 9, 8, 11, '#eab308');
        bob(6, 13, 12, 4, '#eab308');
        bob(9, 10, 2, 3, '#fef9c3');
        bob(14, 12, 2, 8, '#a16207');
        // Swollen glowing blue conductive cheek sacs
        bob(6, 14, 3, 2, f4 === 2 ? '#7dd3fc' : '#38bdf8');
        bob(15, 14, 3, 2, f4 === 2 ? '#7dd3fc' : '#38bdf8');
        bob(7, 14, 1, 1, '#ffffff');
        bob(16, 14, 1, 1, '#ffffff');
        // Belly
        bob(10, 15, 4, 5, '#fef9c3');
        // Forked lightning tail
        bob(3, 15, 4, 2, '#fef08a');
        bob(1, 13 + f, 3, 2, '#38bdf8');
        bob(1, 17 - f, 3, 2, '#fde047');
        // Intermittent spark crackle around antennae
        if (pose === 'react' || pose === 'play' || f4 === 1 || f4 === 3) {
          bob(11, 2, 2, 1, '#7dd3fc');
        }
        break;
      }

      case 'aquabeak': {
        bob(7, 8, 10, 14, outline);
        bob(5, 14, 14, 4, outline);
        bob(11, 3, 2, 5, '#38bdf8');
        bob(8, 9, 8, 12, '#0284c7');
        bob(9, 10, 3, 2, '#bae6fd');
        bob(5, 14, 3, 3, '#38bdf8');
        bob(16, 14, 3, 3, '#38bdf8');
        bob(10, 15, 4, 6, '#bae6fd');
        bob(11, 14, 2, 2, '#fde047'); // Beak!
        bob(3, 17, 4, 3, '#0284c7');
        break;
      }

      case 'musgacorn': {
        bob(6, 9, 12, 13, outline);
        bob(11, 4, 2, 5, '#15803d');
        bob(9, 3, 3, 2, '#4ade80');
        bob(13, 4, 3, 2, '#86efac');
        bob(7, 10, 10, 11, '#16a34a');
        bob(8, 11, 3, 2, '#bbf7d0');
        bob(9, 15, 6, 6, '#dcfce7');
        bob(7, 14, 10, 2, '#22c55e'); // leaf collar
        bob(4, 17, 3, 3, '#15803d');
        break;
      }

      case 'doc': {
        bob(8, 8, 8, 13, outline);
        // Floating healer halo
        bob(8, 3, 8, 2, '#fef08a');
        bob(11, 9, 2, 2, '#2dd4bf');
        bob(9, 9, 6, 11, '#eab308');
        bob(10, 10, 2, 2, '#ffffff');
        bob(10, 14, 4, 5, '#fefce8');
        bob(6, 14, 3, 2, '#5eead4');
        bob(15, 14, 3, 2, '#5eead4');
        break;
      }

      case 'glaciomita': {
        bob(7, 8, 10, 14, outline);
        bob(9, 3, 2, 5, '#e0f2fe');
        bob(11, 1, 2, 7, '#ffffff');
        bob(13, 3, 2, 5, '#bae6fd');
        bob(8, 9, 8, 12, '#0ea5e9');
        bob(9, 10, 2, 3, '#f0f9ff');
        bob(10, 15, 4, 6, '#f8fafc');
        bob(4, 17, 3, 3, '#7dd3fc');
        break;
      }

      case 'voltrix': {
        bob(8, 7, 8, 15, outline);
        bob(11, 2, 2, 5, '#fde047');
        bob(5, 12, 3, 4, '#fef08a');
        bob(16, 12, 3, 4, '#fef08a');
        bob(9, 8, 6, 13, '#2563eb');
        bob(10, 9, 2, 3, '#93c5fd');
        bob(10, 14, 4, 7, '#dbeafe');
        bob(4, 16, 4, 2, '#fde047');
        break;
      }

      case 'flaringo': {
        bob(8, 7, 8, 15, outline);
        bob(11, 2, 3, 6, '#fb7185');
        bob(14, 3, 2, 2, '#fef08a');
        bob(9, 8, 6, 13, '#e11d48');
        bob(10, 9, 2, 3, '#ffe4e6');
        bob(10, 15, 4, 6, '#fef08a');
        bob(4, 16, 4, 3, '#fb7185');
        break;
      }

      case 'lariat': {
        bob(4, 9, 16, 13, outline);
        bob(5, 10, 14, 11, '#b45309');
        bob(7, 8, 10, 3, '#78350f'); // stone brow
        bob(11, 6, 2, 3, '#fef3c7'); // front horn
        bob(6, 15, 12, 2, '#fbbf24'); // golden lasso belt
        bob(8, 17, 8, 4, '#fde68a');
        bob(2, 17, 3, 3, '#78350f');
        break;
      }

      case 'piroclasto': {
        bob(4, 9, 16, 13, outline);
        bob(9, 5, 6, 4, '#451a03'); // volcanic crater
        bob(10, 3 - f, 4, 3, '#f97316');
        bob(5, 10, 14, 11, '#991b1b');
        bob(7, 11, 3, 2, '#fca5a5');
        bob(8, 15, 8, 6, '#fdba74');
        bob(6, 17, 3, 2, '#fb923c'); // magma fissure
        bob(15, 16, 3, 2, '#fb923c');
        bob(2, 17, 3, 3, '#451a03');
        break;
      }

      case 'enigmo': {
        bob(6, 6, 12, 13, outline);
        bob(11, 2, 2, 4, '#5eead4');
        bob(7, 7, 10, 11, '#0d9488');
        bob(8, 8, 3, 2, '#f0fdfa');
        bob(10, 9, 4, 2, '#fef08a'); // psychic third eye
        bob(9, 16, 6, 4, '#ccfbf1');
        bob(8, 19, 2, 3, '#0d9488'); // twin tentacles
        bob(14, 19, 2, 3, '#0d9488');
        break;
      }

      case 'darkfurnus': {
        bob(7, 7, 10, 15, outline);
        bob(6, 3, 2, 5, '#c084fc');
        bob(16, 3, 2, 5, '#c084fc');
        bob(4, 13, 4, 4, '#3b0764'); // winglet
        bob(16, 13, 4, 4, '#3b0764');
        bob(8, 8, 8, 13, '#581c87');
        bob(9, 9, 2, 2, '#e9d5ff');
        bob(10, 15, 4, 6, '#d8b4fe');
        bob(3, 16, 4, 3, '#a855f7');
        break;
      }

      case 'umbrospect': {
        bob(7, 7, 10, 14, outline);
        bob(7, 3, 2, 4, '#a855f7');
        bob(15, 3, 2, 4, '#a855f7');
        bob(8, 8, 8, 12, '#4c1d95');
        bob(11, 10, 2, 2, '#f472b6'); // lunar eye
        bob(10, 15, 4, 4, '#ddd6fe');
        bob(7, 19, 2, 2 + f, '#4c1d95'); // ghostly hem
        bob(11, 19, 2, 3 - f, '#4c1d95');
        bob(15, 19, 2, 2 + f, '#4c1d95');
        break;
      }

      case 'arachnet': {
        bob(6, 9, 12, 12, outline);
        bob(10, 4, 4, 5, '#34d399'); // spinneret crest
        bob(7, 10, 10, 10, '#10b981');
        bob(8, 11, 3, 2, '#ecfdf5');
        bob(9, 15, 6, 5, '#d1fae5');
        // 4 nimble spider legs
        bob(3 + stepA, 14, 3, 2, '#065f46');
        bob(2 + stepA, 16, 2, 3, '#065f46');
        bob(18 + stepB, 14, 3, 2, '#065f46');
        bob(20 + stepB, 16, 2, 3, '#065f46');
        bob(4, 18, 3, 2, '#047857');
        bob(17, 18, 3, 2, '#047857');
        break;
      }

      case 'bubbaleone': {
        bob(5, 8, 14, 13, outline);
        bob(8, 3, 8, 5, '#a5f3fc'); // translucent dorsal bubble
        bob(9, 4, 3, 2, '#ffffff');
        bob(6, 9, 12, 11, '#06b6d4');
        bob(7, 10, 3, 2, '#ffffff');
        bob(8, 15, 8, 5, '#cffafe');
        bob(5, 14, 2, 2, '#67e8f9'); // foamy cheek
        bob(17, 14, 2, 2, '#67e8f9');
        bob(3, 17, 3, 3, '#0891b2');
        break;
      }

      case 'rammstone': {
        bob(4, 9, 16, 13, outline);
        // Twin curved granite ram horns
        bob(4, 4, 3, 5, '#78350f');
        bob(2, 6, 2, 3, '#fbbf24');
        bob(17, 4, 3, 5, '#78350f');
        bob(20, 6, 2, 3, '#fbbf24');
        bob(5, 10, 14, 11, '#d97706');
        bob(7, 11, 3, 2, '#fffbeb');
        bob(8, 16, 8, 5, '#fef3c7');
        // Heavy granite fists
        bob(3, 17, 3, 3, '#92400e');
        bob(18, 17, 3, 3, '#92400e');
        break;
      }

      case 'fandango': {
        bob(7, 7, 10, 14, outline);
        bob(9, 2, 6, 4, '#fef08a'); // harmonic crown
        bob(4, 12, 3, 4, '#fef08a'); // glowing wing-nodes
        bob(17, 12, 3, 4, '#fef08a');
        bob(8, 8, 8, 12, '#10b981');
        bob(9, 9, 2, 3, '#ffffff');
        bob(10, 14, 4, 6, '#fef9c3');
        bob(4, 16, 3, 2, '#34d399');
        break;
      }

      case 'armashelt': {
        bob(4, 9, 16, 13, outline);
        // Segmented bronze mortar shell plates
        bob(5, 8, 14, 4, '#b45309');
        bob(6, 7, 12, 2, '#fb923c');
        bob(5, 11, 14, 10, '#92400e');
        bob(7, 11, 3, 2, '#ffedd5');
        bob(8, 16, 8, 5, '#fed7aa');
        bob(2, 16, 3, 4, '#78350f');
        bob(19, 16, 3, 4, '#78350f');
        break;
      }

      case 'aetherion':
      default: {
        bob(7, 7, 10, 14, outline);
        bob(11, 2, 2, 4, '#fef08a');
        bob(5, 13, 14, 2, 'rgba(94, 234, 212, 0.55)'); // harmonic ring
        bob(8, 8, 8, 12, '#0f766e');
        bob(9, 9, 2, 3, rim);
        bob(10, 14, 4, 6, '#fef08a');
        bob(4, 16, 3, 3, '#2dd4bf');
        break;
      }
    }

    // Expressive eyes & mouth aligned cleanly per species proportions
    const isLow =
      speciesId === 'frostcrawler' ||
      speciesId === 'lariat' ||
      speciesId === 'piroclasto' ||
      speciesId === 'rammstone' ||
      speciesId === 'armashelt';
    const eyeY = isLow ? 13 : 11;
    const eyeLX = isLow ? 8 : 9;
    const eyeRX = isLow ? 14 : 13;
    const lookShift = pose === 'react' ? (f4 === 1 ? -1 : f4 === 3 ? 1 : 0) : 0;
    const eyeDark =
      speciesId === 'darkfurnus' ||
      speciesId === 'umbrospect' ||
      speciesId === 'piroclasto' ||
      speciesId === 'frostcrawler' ||
      speciesId === 'armashelt'
        ? '#fde047'
        : '#060c14';

    if (pose === 'rest') {
      bob(eyeLX, eyeY + 1, 2, 1, '#060c14');
      bob(eyeRX, eyeY + 1, 2, 1, '#060c14');
    } else if (pose === 'happy' || pose === 'play') {
      bob(eyeLX, eyeY, 2, 1, eyeDark);
      bob(eyeRX, eyeY, 2, 1, eyeDark);
      bob(11, eyeY + 3, 2, 1, '#450a0a');
    } else if (pose === 'eat') {
      bob(eyeLX, eyeY, 2, 1, eyeDark);
      bob(eyeRX, eyeY, 2, 1, eyeDark);
      bob(10, eyeY + 3, 4, f === 1 ? 2 : 1, '#450a0a');
    } else if (speciesId === 'frostcrawler') {
      // Heavy brow & gleaming amber slit eyes
      bob(eyeLX - 1, eyeY - 1, 3, 1, '#060c14');
      bob(eyeRX, eyeY - 1, 3, 1, '#060c14');
      bob(eyeLX, eyeY, 2, 1, '#fde047');
      bob(eyeRX, eyeY, 2, 1, '#fde047');
    } else {
      bob(eyeLX + lookShift, eyeY, 2, 2, eyeDark);
      bob(eyeRX + lookShift, eyeY, 2, 2, eyeDark);
      bob(eyeLX + lookShift, eyeY, 1, 1, '#ffffff');
      bob(eyeRX + lookShift, eyeY, 1, 1, '#ffffff');
      if (speciesId === 'tazerling') {
        bob(eyeLX + 1 + lookShift, eyeY + 1, 1, 1, '#38bdf8');
        bob(eyeRX + 1 + lookShift, eyeY + 1, 1, 1, '#38bdf8');
      }
      if (speciesId === 'infurnus' && (pose === 'react' || pose === 'walk')) {
        bob(11, eyeY + 3, 2, 1, '#450a0a');
      }
    }

    this.charCache.set(key, c);
    return c;
  }

  /**
   * Articulated pixel-art RPG characters for Bajoterra NPCs & Cave Warlord Bosses
   * (replaces generic canvas emojis in world exploration).
   */
  public getNpcCharacterSprite(
    kind: 'merchant' | 'mercenary' | 'boss',
    bossId?: string,
    frame = 0
  ): HTMLCanvasElement {
    const f = frame & 1;
    const key = `npc_${kind}_${bossId || 'std'}_${f}`;
    const existing = this.charCache.get(key);
    if (existing) return existing;

    const [c, g] = makeCanvas(28, 28);
    const S = 2;
    const p = (gx: number, gy: number, gw: number, gh: number, col: string) =>
      px(g, gx * S, gy * S, gw * S, gh * S, col);

    const step = f === 1 ? 1 : 0;

    if (kind === 'merchant') {
      // Hooded subterranean trader with crystal pack & warm lantern
      p(4, 11 + step, 2, 2, '#1e293b');
      p(8, 12 - step, 2, 2, '#1e293b');
      p(3, 5, 8, 7, '#065f46'); // cloak
      p(4, 6, 6, 5, '#10b981'); // scarf trim
      p(10, 6, 3, 4, '#0f766e'); // crystal backpack
      p(11, 5, 2, 2, '#5eead4');
      p(4, 1, 6, 5, '#047857'); // hood
      p(5, 3, 4, 2, '#f3cba4'); // face
      p(5, 3, 1, 1, '#060c14');
      p(8, 3, 1, 1, '#060c14');
      p(1, 7, 2, 3, '#f59e0b'); // glowing lantern
      p(1, 8, 2, 1, '#fef08a');
    } else if (kind === 'mercenary') {
      // Dark tactical cavern duelist with purple visor & hip blaster
      p(4, 10 + step, 2, 3 - step, '#0f172a');
      p(8, 10 + (1 - step), 2, 3 - (1 - step), '#0f172a');
      p(3, 5, 8, 6, '#3b0764'); // armor
      p(4, 6, 6, 4, '#581c87');
      p(4, 9, 6, 1, '#c084fc'); // slug bandolier
      p(4, 1, 6, 5, '#1e1b4b'); // helmet
      p(4, 3, 6, 1, '#e879f9'); // visor glow
      p(11, 7, 2, 2, '#64748b'); // blaster
      p(12, 7, 1, 1, '#f43f5e');
    } else {
      // Boss Warlords (Dr. Blakk / Leviatan Abisal / Oraculo Prisma / Ignis / Glacius / Sombra)
      const isBlakk = bossId === 'boss_blakk';
      const isIce = bossId?.includes('ice') || bossId?.includes('glacius');
      const isAquatic = bossId?.includes('aquatic');
      const isCrystal = bossId?.includes('crystal');
      const isShadow = bossId?.includes('shadow') || bossId?.includes('sombra');
      const armor = isBlakk
        ? '#18181b'
        : isIce
        ? '#0369a1'
        : isAquatic
        ? '#0e7490'
        : isCrystal
        ? '#4c1d95'
        : isShadow
        ? '#4c1d95'
        : '#991b1b';
      const trim = isBlakk
        ? '#dc2626'
        : isIce
        ? '#7dd3fc'
        : isAquatic
        ? '#22d3ee'
        : isCrystal
        ? '#a78bfa'
        : isShadow
        ? '#c084fc'
        : '#fb923c';
      const eye = isBlakk
        ? '#ef4444'
        : isIce
        ? '#e0f2fe'
        : isAquatic
        ? '#a5f3fc'
        : isCrystal
        ? '#fef08a'
        : isShadow
        ? '#f472b6'
        : '#fde047';

      p(4, 11 + step, 2, 3 - step, '#0f172a');
      p(8, 11 + (1 - step), 2, 3 - (1 - step), '#0f172a');
      // Broad armored cape & pauldrons
      p(2, 5, 10, 7, '#090d16');
      p(3, 5, 8, 6, armor);
      p(2, 5, 2, 3, trim);
      p(10, 5, 2, 3, trim);
      if (isBlakk) {
        // High crimson collar + olive face + dark swept hair + goatee + purple/crimson gatling blaster
        p(4, 5, 6, 2, '#991b1b');
        p(5, 7, 4, 3, '#ef4444');
        p(4, 1, 6, 4, '#9ab094');
        p(3, 0, 8, 2, '#26231f');
        p(6, 4, 2, 2, '#26231f'); // goatee
        p(5, 2, 1, 1, '#dc2626');
        p(8, 2, 1, 1, '#dc2626');
        p(11, 7, 3, 3, '#6b21a8');
        p(12, 8, 2, 1, '#ef4444');
      } else {
        p(5, 7, 4, 3, trim);
        p(4, 1, 6, 5, armor);
        p(3, 0, 2, 2, trim);
        p(9, 0, 2, 2, trim);
        p(6, 0, 2, 2, '#fde047');
        p(5, 3, 4, 1, eye);
        p(12, 7, 2, 3, trim);
      }
    }

    this.charCache.set(key, c);
    return c;
  }

  /**
   * Individual pixel-art sprites for Bajoterra story characters (Pronto, Trixie, Kord, Will Shane, etc.).
   */
  public getStoryCharacterSprite(characterId: string, frame = 0): HTMLCanvasElement {
    const f = frame & 1;
    const key = `story_npc_${characterId}_${f}`;
    const existing = this.charCache.get(key);
    if (existing) return existing;

    if (characterId === 'mercader_subterraneo') {
      return this.getNpcCharacterSprite('merchant', undefined, f);
    }

    const [c, g] = makeCanvas(28, 28);
    const S = 2;
    const p = (gx: number, gy: number, gw: number, gh: number, col: string) =>
      px(g, gx * S, gy * S, gw * S, gh * S, col);
    const step = f === 1 ? 1 : 0;

    p(4, 11 + step, 2, 2, '#0f172a');
    p(8, 12 - step, 2, 2, '#0f172a');

    switch (characterId) {
      case 'pronto': {
        p(3, 5, 8, 6, '#3f2e21');
        p(4, 6, 6, 4, '#dc2626');
        p(4, 1, 6, 5, '#65a30d'); // green Molenoid head
        p(5, 4, 4, 2, '#84cc16'); // snout
        p(4, 2, 2, 2, '#38bdf8'); // brass goggles
        p(8, 2, 2, 2, '#38bdf8');
        p(6, 2, 2, 1, '#f59e0b');
        break;
      }
      case 'trixie': {
        p(3, 5, 8, 6, '#064e3b');
        p(4, 6, 6, 4, '#10b981');
        p(4, 1, 6, 5, '#f5ccb0');
        p(3, 0, 8, 3, '#dc2626'); // fiery red bob
        p(4, 1, 6, 1, '#34d399'); // headband
        p(5, 3, 1, 1, '#090d16');
        p(8, 3, 1, 1, '#090d16');
        p(11, 7, 2, 2, '#2dd4bf');
        break;
      }
      case 'kord': {
        p(2, 5, 10, 6, '#452b1a'); // wide Troll shoulders
        p(3, 6, 8, 4, '#f97316');
        p(3, 1, 8, 5, '#477694'); // blue Troll face
        p(4, 1, 2, 2, '#38bdf8');
        p(8, 1, 2, 2, '#38bdf8');
        p(5, 3, 1, 1, '#fbbf24');
        p(8, 3, 1, 1, '#fbbf24');
        p(12, 7, 2, 3, '#b45309');
        break;
      }
      case 'will_shane': {
        p(3, 5, 8, 6, '#0c4a6e');
        p(4, 6, 6, 4, '#0284c7');
        p(5, 6, 4, 2, '#67e8f9');
        p(4, 1, 6, 5, '#e8bc96');
        p(3, 0, 8, 2, '#1e293b');
        p(3, 1, 2, 1, '#cbd5e1'); // silver streak
        p(5, 3, 1, 1, '#0f172a');
        p(8, 3, 1, 1, '#0f172a');
        break;
      }
      case 'red_hook': {
        p(3, 5, 8, 6, '#450a0a');
        p(4, 6, 6, 4, '#b91c1c');
        p(4, 1, 6, 5, '#d4a37c');
        p(3, 0, 8, 2, '#451a03');
        p(5, 3, 1, 1, '#f59e0b');
        p(8, 3, 2, 1, '#090d16'); // eyepatch
        p(11, 6, 3, 3, '#94a3b8'); // iron hook arm
        break;
      }
      case 'twist': {
        p(3, 5, 8, 6, '#1f2937');
        p(4, 6, 6, 4, '#16a34a');
        p(4, 1, 6, 5, '#111827'); // dark hood
        p(5, 2, 4, 3, '#e2b89b');
        p(5, 3, 1, 1, '#4ade80');
        p(8, 3, 1, 1, '#4ade80');
        p(11, 7, 2, 2, '#166534');
        break;
      }
      case 'dr_blakk':
      case 'comandante_blakk':
      default: {
        p(3, 5, 8, 6, '#18181b');
        p(4, 5, 6, 2, '#991b1b'); // high red collar
        p(4, 1, 6, 5, '#9ab094');
        p(3, 0, 8, 2, '#26231f');
        p(6, 4, 2, 2, '#26231f');
        p(5, 3, 1, 1, '#ef4444');
        p(8, 3, 1, 1, '#ef4444');
        p(11, 7, 3, 2, '#6b21a8');
        break;
      }
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

  public getMechaOverlaySprite(
    theme: MechaTheme,
    tier: number,
    facingX: number,
    facingY: number
  ): HTMLCanvasElement {
    const dir = Math.abs(facingX) > Math.abs(facingY) ? (facingX >= 0 ? 'R' : 'L') : facingY < 0 ? 'U' : 'D';
    const safeTier = Math.max(1, Math.min(3, Math.floor(tier)));
    const key = `mecha_${theme}_${safeTier}_${dir}`;
    const existing = this.charCache.get(key);
    if (existing) return existing;

    const [c, g] = makeCanvas(34, 34);
    const S = 2;
    const p = (gx: number, gy: number, gw: number, gh: number, col: string) =>
      px(g, gx * S, gy * S, gw * S, gh * S, col);

    const chassis =
      theme === 'molten_core'
        ? '#b91c1c'
        : theme === 'shadow_stealth'
        ? '#581c87'
        : theme === 'frost_pulse'
        ? '#0284c7'
        : '#1d4ed8';
    const trim =
      theme === 'molten_core'
        ? '#fb923c'
        : theme === 'shadow_stealth'
        ? '#c084fc'
        : theme === 'frost_pulse'
        ? '#67e8f9'
        : '#38bdf8';

    // Mechanical legs & stabilizer claws
    p(3, 12, 3, 4, '#0f172a');
    p(11, 12, 3, 4, '#0f172a');
    p(2, 15, 4, 1, trim);
    p(11, 15, 4, 1, trim);

    // Armored chassis platform beneath rider
    p(4, 7, 9, 6, '#060c14');
    p(5, 8, 7, 4, chassis);
    p(5, 8, 7, 1, trim);

    // Tier 2/3 shoulder thrusters & visor
    if (safeTier >= 2) {
      p(2, 9, 2, 3, '#334155');
      p(13, 9, 2, 3, '#334155');
    }
    if (safeTier >= 3) {
      p(1, 10, 1, 2, trim);
      p(15, 10, 1, 2, trim);
    }

    // Directional headlight / thruster glow
    if (dir === 'R') {
      p(13, 10, 2, 1, '#fef08a');
    } else if (dir === 'L') {
      p(2, 10, 2, 1, '#fef08a');
    } else if (dir === 'D') {
      p(7, 12, 3, 1, '#fef08a');
    } else {
      p(7, 13, 3, 2, trim);
    }

    this.charCache.set(key, c);
    return c;
  }
}

export const sprites = new SpriteAtlas();
