const canvasStub = () => ({
  width: 800,
  height: 600,
  parentElement: { getBoundingClientRect: () => ({ width: 800, height: 600 }) },
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
  getContext: () => ({
    fillRect: () => {},
    clearRect: () => {},
    drawImage: () => {},
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    quadraticCurveTo: () => {},
    bezierCurveTo: () => {},
    arc: () => {},
    fill: () => {},
    stroke: () => {},
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
    save: () => {},
    restore: () => {},
    translate: () => {},
    rotate: () => {},
    scale: () => {},
    setTransform: () => {},
    fillText: () => {},
    strokeRect: () => {},
    ellipse: () => {},
    setLineDash: () => {},
    measureText: () => ({ width: 40 }),
  }),
});

(globalThis as Record<string, unknown>).document = {
  createElement: canvasStub,
  visibilityState: 'visible',
};
if (typeof (globalThis as Record<string, unknown>).window === 'undefined') {
  (globalThis as Record<string, unknown>).window = {
    location: { protocol: 'http:' },
    devicePixelRatio: 1,
  };
}

class MemoryStorage {
  private map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  setItem(key: string, val: string): void {
    this.map.set(key, String(val));
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  clear(): void {
    this.map.clear();
  }
}

export const memStorage = new MemoryStorage();
(globalThis as Record<string, unknown>).localStorage = memStorage;
