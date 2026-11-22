export type ControlActionId =
  | 'moveUp'
  | 'moveDown'
  | 'moveLeft'
  | 'moveRight'
  | 'fire'
  | 'secondary'
  | 'interact'
  | 'cycleSlug'
  | 'slug1'
  | 'slug2'
  | 'slug3'
  | 'slug4'
  | 'dodge'
  | 'ability1'
  | 'ability2'
  | 'map'
  | 'inventory'
  | 'pause'
  | 'mecha'
  | 'pulse';

export type KeyBindingMap = Record<ControlActionId, string>;

export type ControlCategory = 'Movimiento' | 'Combate' | 'Babosas' | 'Sistema';

export interface ControlActionDef {
  id: ControlActionId;
  label: string;
  description: string;
  category: ControlCategory;
  defaultKey: string;
  rebindable: boolean;
}

export const CONTROL_ACTION_DEFS: ControlActionDef[] = [
  {
    id: 'moveUp',
    label: 'Mover Arriba',
    description: 'Desplazar hacia el norte en cavernas y duelos',
    category: 'Movimiento',
    defaultKey: 'w',
    rebindable: true,
  },
  {
    id: 'moveDown',
    label: 'Mover Abajo',
    description: 'Desplazar hacia el sur en cavernas y duelos',
    category: 'Movimiento',
    defaultKey: 's',
    rebindable: true,
  },
  {
    id: 'moveLeft',
    label: 'Mover Izquierda',
    description: 'Desplazar hacia el oeste en cavernas y duelos',
    category: 'Movimiento',
    defaultKey: 'a',
    rebindable: true,
  },
  {
    id: 'moveRight',
    label: 'Mover Derecha',
    description: 'Desplazar hacia el este en cavernas y duelos',
    category: 'Movimiento',
    defaultKey: 'd',
    rebindable: true,
  },
  {
    id: 'dodge',
    label: 'Esquivar / Impulso',
    description: 'Esquiva rápida con invulnerabilidad breve',
    category: 'Movimiento',
    defaultKey: ' ',
    rebindable: true,
  },
  {
    id: 'fire',
    label: 'Disparar Bláster',
    description: 'Apunta con el ratón y lanza babosa cargada',
    category: 'Combate',
    defaultKey: 'mouse0',
    rebindable: true,
  },
  {
    id: 'secondary',
    label: 'Acción Secundaria / Escudo',
    description: 'Activa Escudo Bláster o acción táctica disponible',
    category: 'Combate',
    defaultKey: 'mouse2',
    rebindable: true,
  },
  {
    id: 'ability1',
    label: 'Habilidad Especial 1',
    description: 'Lanza la primera técnica elemental de la babosa activa',
    category: 'Combate',
    defaultKey: 'z',
    rebindable: true,
  },
  {
    id: 'ability2',
    label: 'Habilidad Especial 2',
    description: 'Lanza la segunda técnica elemental de la babosa activa',
    category: 'Combate',
    defaultKey: 'x',
    rebindable: true,
  },
  {
    id: 'pulse',
    label: 'Pulso Escáner / Maestro',
    description: 'Escanea secretos al explorar o dispara Pulso Maestro en duelo',
    category: 'Combate',
    defaultKey: 'r',
    rebindable: true,
  },
  {
    id: 'interact',
    label: 'Interactuar',
    description: 'Hablar, abrir cofres/puertas, capturar o usar herramienta',
    category: 'Babosas',
    defaultKey: 'f',
    rebindable: true,
  },
  {
    id: 'cycleSlug',
    label: 'Cambiar Babosa',
    description: 'Rota a la siguiente babosa disponible del equipo',
    category: 'Babosas',
    defaultKey: 'q',
    rebindable: true,
  },
  {
    id: 'slug1',
    label: 'Babosa 1',
    description: 'Selecciona directamente la primera babosa del estuche',
    category: 'Babosas',
    defaultKey: '1',
    rebindable: true,
  },
  {
    id: 'slug2',
    label: 'Babosa 2',
    description: 'Selecciona directamente la segunda babosa del estuche',
    category: 'Babosas',
    defaultKey: '2',
    rebindable: true,
  },
  {
    id: 'slug3',
    label: 'Babosa 3',
    description: 'Selecciona directamente la tercera babosa del estuche',
    category: 'Babosas',
    defaultKey: '3',
    rebindable: true,
  },
  {
    id: 'slug4',
    label: 'Babosa 4',
    description: 'Selecciona directamente la cuarta babosa del estuche',
    category: 'Babosas',
    defaultKey: '4',
    rebindable: true,
  },
  {
    id: 'mecha',
    label: 'Montar / Desmontar Meca',
    description: 'Alterna tu montura Meca Shane al desbloquearla',
    category: 'Sistema',
    defaultKey: 'v',
    rebindable: true,
  },
  {
    id: 'map',
    label: 'Mapa del Mundo',
    description: 'Abre o cierra el mapa completo de Bajoterra',
    category: 'Sistema',
    defaultKey: 'm',
    rebindable: true,
  },
  {
    id: 'inventory',
    label: 'Inventario y Campaña',
    description: 'Abre el estuche, mochila, misiones, hogar y Babosapedia',
    category: 'Sistema',
    defaultKey: 'tab',
    rebindable: true,
  },
  {
    id: 'pause',
    label: 'Pausa / Opciones',
    description: 'Abre el menú de pausa y configuración',
    category: 'Sistema',
    defaultKey: 'escape',
    rebindable: false,
  },
];

export const VALID_CONTROL_ACTION_IDS = new Set<ControlActionId>(
  CONTROL_ACTION_DEFS.map((d) => d.id)
);

const RESERVED_SYSTEM_KEYS = new Set([
  'control',
  'alt',
  'meta',
  'os',
  'capslock',
  'numlock',
  'scrolllock',
  'dead',
  'unidentified',
  'e', // Kept clear from residual E interaction shortcuts
]);

export function createDefaultKeyBindings(): KeyBindingMap {
  const map = {} as KeyBindingMap;
  for (const def of CONTROL_ACTION_DEFS) {
    map[def.id] = def.defaultKey;
  }
  return map;
}

export const DEFAULT_KEY_BINDINGS: KeyBindingMap = createDefaultKeyBindings();

export function normalizeInputKey(rawKey: string): string {
  if (typeof rawKey !== 'string') return '';
  if (rawKey === ' ') return ' ';
  const trimmed = rawKey.trim().toLowerCase();
  if (trimmed === 'space' || trimmed === 'spacebar' || trimmed === 'espacio') {
    return ' ';
  }
  if (trimmed === 'esc') return 'escape';
  return trimmed;
}

export function isAssignableInputKey(rawKey: string): boolean {
  const norm = normalizeInputKey(rawKey);
  if (!norm) return false;
  if (RESERVED_SYSTEM_KEYS.has(norm)) return false;
  if (norm === 'escape') return false; // Reserved for pause/back
  return norm.length <= 16;
}

export function resolveEffectiveBindings(
  partial?: Partial<Record<string, string>>
): KeyBindingMap {
  const out = createDefaultKeyBindings();
  if (!partial) return out;
  const usedKeys = new Set<string>();
  for (const def of CONTROL_ACTION_DEFS) {
    const raw = partial[def.id];
    const norm = raw ? normalizeInputKey(raw) : '';
    if (norm && !usedKeys.has(norm) && (def.id === 'pause' ? norm === 'escape' : isAssignableInputKey(norm))) {
      out[def.id] = norm;
      usedKeys.add(norm);
    } else {
      usedKeys.add(out[def.id]);
    }
  }
  return out;
}

export function findConflictingAction(
  bindings: KeyBindingMap,
  actionId: ControlActionId,
  candidateKey: string
): ControlActionId | null {
  const norm = normalizeInputKey(candidateKey);
  if (!norm) return null;
  for (const def of CONTROL_ACTION_DEFS) {
    if (def.id === actionId) continue;
    if (normalizeInputKey(bindings[def.id]) === norm) {
      return def.id;
    }
  }
  return null;
}

export function getControlActionLabel(actionId: ControlActionId): string {
  return CONTROL_ACTION_DEFS.find((d) => d.id === actionId)?.label || actionId;
}

export interface RebindResult {
  ok: boolean;
  bindings: KeyBindingMap;
  conflictAction?: ControlActionId;
  error?: string;
}

export function rebindControlKey(
  current: Partial<Record<string, string>> | undefined,
  actionId: ControlActionId,
  rawKey: string
): RebindResult {
  const def = CONTROL_ACTION_DEFS.find((d) => d.id === actionId);
  const resolved = resolveEffectiveBindings(current);
  if (!def || !def.rebindable) {
    return {
      ok: false,
      bindings: resolved,
      error: 'Esta acción de sistema no se puede reasignar.',
    };
  }
  const norm = normalizeInputKey(rawKey);
  if (!isAssignableInputKey(norm)) {
    return {
      ok: false,
      bindings: resolved,
      error: 'Tecla no permitida o reservada del sistema.',
    };
  }
  const conflict = findConflictingAction(resolved, actionId, norm);
  if (conflict) {
    return {
      ok: false,
      bindings: resolved,
      conflictAction: conflict,
      error: `Conflicto: "${formatControlKeyLabel(norm)}" ya está asignada a ${getControlActionLabel(conflict)}.`,
    };
  }
  return {
    ok: true,
    bindings: {
      ...resolved,
      [actionId]: norm,
    },
  };
}

export function findActionForKey(
  rawKey: string,
  bindings?: Partial<Record<string, string>>
): ControlActionId | null {
  const norm = normalizeInputKey(rawKey);
  if (!norm) return null;
  const eff = resolveEffectiveBindings(bindings);
  for (const def of CONTROL_ACTION_DEFS) {
    if (normalizeInputKey(eff[def.id]) === norm) {
      return def.id;
    }
  }
  return null;
}

export function isKeyBound(
  rawKey: string,
  bindings?: Partial<Record<string, string>>
): boolean {
  return findActionForKey(rawKey, bindings) !== null;
}

export function isMovementHeld(
  keysHeld: Set<string>,
  bindings?: Partial<Record<string, string>>
): { x: number; y: number } {
  const eff = resolveEffectiveBindings(bindings);
  const up = keysHeld.has(eff.moveUp) || keysHeld.has('arrowup');
  const down = keysHeld.has(eff.moveDown) || keysHeld.has('arrowdown');
  const left = keysHeld.has(eff.moveLeft) || keysHeld.has('arrowleft');
  const right = keysHeld.has(eff.moveRight) || keysHeld.has('arrowright');
  return {
    x: (right ? 1 : 0) - (left ? 1 : 0),
    y: (down ? 1 : 0) - (up ? 1 : 0),
  };
}

export function formatControlKeyLabel(rawKey: string): string {
  const norm = normalizeInputKey(rawKey);
  switch (norm) {
    case ' ':
      return 'Espacio';
    case 'mouse0':
      return 'Clic Izq.';
    case 'mouse1':
      return 'Clic Central';
    case 'mouse2':
      return 'Clic Der.';
    case 'tab':
      return 'Tab';
    case 'escape':
      return 'Esc';
    case 'shift':
      return 'Shift';
    case 'arrowup':
      return '↑';
    case 'arrowdown':
      return '↓';
    case 'arrowleft':
      return '←';
    case 'arrowright':
      return '→';
    case 'enter':
      return 'Enter';
    default:
      return norm.length === 1 ? norm.toUpperCase() : norm;
  }
}

export function validatePartialKeyBindings(raw: unknown): {
  ok: boolean;
  value?: Partial<Record<ControlActionId, string>>;
  error?: string;
} {
  if (raw === undefined) return { ok: true, value: undefined };
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'Configuración de controles inválida.' };
  }
  const out: Partial<Record<ControlActionId, string>> = {};
  const seenKeys = new Map<string, ControlActionId>();
  const resolvedBase = createDefaultKeyBindings();

  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!VALID_CONTROL_ACTION_IDS.has(k as ControlActionId)) {
      return { ok: false, error: `Acción de control desconocida: ${k}.` };
    }
    if (typeof v !== 'string') {
      return { ok: false, error: `Tecla inválida para control ${k}.` };
    }
    const norm = normalizeInputKey(v);
    if (!norm || norm.length > 16) {
      return { ok: false, error: `Valor de tecla inválido en ${k}.` };
    }
    if (k !== 'pause' && !isAssignableInputKey(norm)) {
      return { ok: false, error: `Tecla reservada no válida en ${k}.` };
    }
    out[k as ControlActionId] = norm;
  }

  for (const def of CONTROL_ACTION_DEFS) {
    const finalKey = out[def.id] ?? resolvedBase[def.id];
    const prev = seenKeys.get(finalKey);
    if (prev) {
      return {
        ok: false,
        error: `Conflicto de controles entre ${prev} y ${def.id} (${finalKey}).`,
      };
    }
    seenKeys.set(finalKey, def.id);
  }

  return { ok: true, value: out };
}
