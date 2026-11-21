import React, { useState } from 'react';
import { Award, Backpack, BookOpen, Hammer, Heart, Home, Sparkles, X } from 'lucide-react';
import {
  BIOME_INFO,
  CRAFT_RECIPES,
  ELEMENT_CHART,
  FURNITURE_DEFS,
  HABITAT_DEFS,
  HOME_FOOD_DEFS,
  MAX_ACTIVE_HOME_SLUGS,
  MAX_SLUGS_PER_HABITAT,
  QUEST_LIST,
  SPECIES_LIST,
  getFavoriteFoodForSpecies,
  getSpecies,
  isSpeciesCompatibleWithHabitat,
} from '../game/data';
import { gameEngine } from '../game/engine';
import { getMoodLabel } from '../game/home';
import { checkMegamorphEligibility, getBondTierInfo } from '../game/progression';
import {
  ART_DIRECTION_GUIDE,
  STORY_ORDERED_SPECIES_IDS,
  getSlugDesignSheet,
} from '../game/slugArtDirection';
import type { FurnitureKind, GameState, HabitatId, HudSnapshot, InventoryKey } from '../game/types';
import { ResourceSwatch } from './GameIcons';
import { SlugDetailPanel } from './SlugDetailPanel';
import { SlugPortrait, type SlugPortraitMood } from './SlugPortrait';

export type ExpeditionTabKey = 'taller' | 'criaturas' | 'hogar' | 'babosapedia' | 'misiones';

interface ExpeditionModalProps {
  snap: HudSnapshot;
  initialTab?: ExpeditionTabKey;
  onClose: () => void;
}

const INV_LABELS: Array<{ key: InventoryKey; label: string }> = [
  { key: 'ore', label: 'Minerales' },
  { key: 'wood', label: 'Madera' },
  { key: 'stone', label: 'Piedra' },
  { key: 'crystal', label: 'Cristal de Energía' },
  { key: 'shadowShard', label: 'Frag. Sombrío' },
  { key: 'berries', label: 'Bayas' },
  { key: 'emberSnack', label: 'Bocado Ígneo' },
  { key: 'frostNectar', label: 'Néctar Glacial' },
  { key: 'core', label: 'Núcleos' },
  { key: 'capsules', label: 'Cilindros' },
  { key: 'masterCapsules', label: 'Cilindros Maestros' },
  { key: 'torches', label: 'Antorchas' },
  { key: 'walls', label: 'Paredes' },
  { key: 'floors', label: 'Suelos' },
  { key: 'doors', label: 'Puertas' },
  { key: 'stations', label: 'Estaciones' },
  { key: 'nest', label: 'Nidos' },
  { key: 'bed', label: 'Camas' },
  { key: 'feeder', label: 'Comederos' },
  { key: 'decor', label: 'Lámparas Cristal' },
  { key: 'elixirs', label: 'Elixires Megamorph' },
  { key: 'relics', label: 'Reliquias Antiguas' },
  { key: 'evoStone', label: 'Piedra Evolutiva' },
  { key: 'rootWood', label: 'Madera Raíz' },
  { key: 'magmaCoal', label: 'Carbón Magma' },
  { key: 'thermalCopper', label: 'Cobre Térmico' },
  { key: 'iceCrystal', label: 'Cristal Hielo' },
  { key: 'blueQuartz', label: 'Cuarzo Azul' },
  { key: 'darkIron', label: 'Hierro Oscuro' },
  { key: 'neonMushroom', label: 'Hongo Neón' },
];

export const ExpeditionModal: React.FC<ExpeditionModalProps> = ({
  snap,
  initialTab = 'taller',
  onClose,
}) => {
  const [tab, setTab] = useState<ExpeditionTabKey>(initialTab);
  const [parentA, setParentA] = useState<string>('');
  const [parentB, setParentB] = useState<string>('');
  const [swapTargetPartyIdx, setSwapTargetPartyIdx] = useState<number>(0);
  const [assignPick, setAssignPick] = useState<Partial<Record<HabitatId, string>>>({});
  const [inspectedSlugUid, setInspectedSlugUid] = useState<string | null>(null);
  const [catalogMood, setCatalogMood] = useState<SlugPortraitMood>('happy');
  const [showArtGuide, setShowArtGuide] = useState<boolean>(false);
  const [catalogSilhouette, setCatalogSilhouette] = useState<boolean>(false);

  const allSlugs = [...snap.party, ...snap.storage];
  const capturedCount = Object.keys(snap.capturedSpecies).length;

  const inspectedEntry = inspectedSlugUid
    ? (() => {
        const p = snap.party.find((s) => s.uid === inspectedSlugUid);
        if (p) return { slug: p, location: 'Estuche Activo' };
        const st = snap.storage.find((s) => s.uid === inspectedSlugUid);
        if (st) return { slug: st, location: 'Reserva del Refugio' };
        const hm = snap.home.residents.find((r) => r.slug.uid === inspectedSlugUid);
        if (hm) return { slug: hm.slug, location: 'Hogar Viviente' };
        return null;
      })()
    : null;

  const tabs: Array<{ id: ExpeditionTabKey; label: string; icon: React.ReactNode }> = [
    { id: 'taller', label: 'Inventario y Taller', icon: <Hammer className="w-3.5 h-3.5" /> },
    { id: 'criaturas', label: 'Babosas y Crianza', icon: <Sparkles className="w-3.5 h-3.5" /> },
    {
      id: 'hogar',
      label: `Hogar y Hábitats (${snap.home.residents.length}/${MAX_ACTIVE_HOME_SLUGS})`,
      icon: <Home className="w-3.5 h-3.5" />,
    },
    { id: 'babosapedia', label: 'Babosapedia', icon: <BookOpen className="w-3.5 h-3.5" /> },
    { id: 'misiones', label: 'Misiones y Refugio', icon: <Award className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-2.5 sm:p-5 bg-[#03080e]/86 backdrop-blur-sm">
      <div className="bt-panel bt-animate-modal w-full max-w-4xl rounded-2xl p-3.5 sm:p-5 md:p-6 max-h-[94dvh] flex flex-col">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-400/20 pb-3 mb-3.5">
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold text-white flex items-center gap-2">
              <Backpack className="w-5 h-5 text-amber-300" />
              Estuche, Taller y Expedición
            </h2>
            <p className="text-xs text-slate-300 tabular-nums mt-0.5">
              Refugio Nivel {snap.shelterTier} · Biomas {snap.discoveries.length}/4 · Babosapedia{' '}
              {capturedCount}/{SPECIES_LIST.length}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="bt-btn-secondary w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-colors cursor-pointer flex items-center gap-1.5 min-h-[38px] ${
                tab === t.id ? 'bt-btn-primary' : 'bt-btn-secondary'
              }`}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto pr-1 bt-scroll">
          {tab === 'taller' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="bt-inset rounded-xl p-3.5">
                <h3 className="text-xs font-extrabold text-teal-300 uppercase tracking-wider mb-3">
                  Mochila de Recursos
                </h3>
                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  {INV_LABELS.map((item) => {
                    const qty = snap.inventory[item.key];
                    return (
                      <div
                        key={item.key}
                        className={`bt-card flex items-center justify-between px-2.5 py-1.5 rounded-lg ${
                          qty > 0 ? 'opacity-100' : 'opacity-55'
                        }`}
                      >
                        <span className="text-slate-200 truncate flex items-center gap-1.5">
                          <ResourceSwatch itemKey={item.key} />
                          <span className="truncate">{item.label}</span>
                        </span>
                        <span className="font-extrabold text-white tabular-nums ml-1">{qty}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="lg:col-span-2 bt-inset rounded-xl p-3.5">
                <h3 className="text-xs font-extrabold text-amber-300 uppercase tracking-wider mb-3">
                  Mesa de Fabricación
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {CRAFT_RECIPES.map((rec) => {
                    const canCraft = Object.entries(rec.cost).every(
                      ([k, v]) => (snap.inventory[k as InventoryKey] || 0) >= (v || 0)
                    );
                    const costText = Object.entries(rec.cost)
                      .map(([k, v]) => `${v} ${INV_LABELS.find((x) => x.key === k)?.label || k}`)
                      .join(' · ');
                    return (
                      <div
                        key={rec.id}
                        className={`bt-card rounded-xl p-3 flex flex-col justify-between gap-2.5 ${
                          canCraft ? 'border-teal-400/35' : 'opacity-80'
                        }`}
                      >
                        <div>
                          <div className="text-sm font-extrabold text-white flex items-center gap-2">
                            <ResourceSwatch itemKey={rec.outputKey} />
                            <span>{rec.name}</span>
                          </div>
                          <div className="text-[11px] text-slate-300 mt-1">{rec.description}</div>
                          <div className="text-[11px] text-amber-200/95 mt-1.5 font-semibold">
                            Costo: {costText}
                          </div>
                        </div>
                        <button
                          disabled={!canCraft}
                          onClick={() => gameEngine.craftItem(rec.id)}
                          className="bt-btn-primary w-full py-2 rounded-xl font-extrabold text-xs disabled:opacity-35 cursor-pointer min-h-[38px]"
                        >
                          Fabricar
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {tab === 'criaturas' && (
            <div className="space-y-4">
              {/* Active Party */}
              <div className="bt-inset rounded-xl p-3.5">
                <h3 className="text-xs font-extrabold text-teal-300 uppercase tracking-wider mb-2.5">
                  Estuche Activo (Máx. 4) — Haz clic para marcar ranura de intercambio
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {snap.party.map((s, idx) => {
                    const bondTier = getBondTierInfo(s.bond);
                    const megaCheck = checkMegamorphEligibility(
                      { inventory: snap.inventory } as unknown as GameState,
                      s
                    );
                    const selected = swapTargetPartyIdx === idx;
                    return (
                      <div
                        key={s.uid}
                        onClick={() => setSwapTargetPartyIdx(idx)}
                        className={`bt-card p-3 rounded-xl border cursor-pointer transition-colors ${
                          selected
                            ? 'border-teal-300 shadow-[0_0_16px_rgba(45,212,191,0.2)]'
                            : 'hover:border-cyan-400/45'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <SlugPortrait
                              speciesId={s.id}
                              mega={s.mega}
                              mood={s.hp <= 0 ? 'ko' : 'idle'}
                              size={42}
                            />
                            <div className="min-w-0">
                              <div className="font-extrabold text-sm text-white truncate">
                                {s.name}{' '}
                                {s.mega ? <span className="text-amber-300 text-xs">★ Megamorph</span> : null}
                              </div>
                              <div className="text-[11px] text-slate-300 tabular-nums">
                                Nv.{s.level} ·{' '}
                                <span className="font-bold" style={{ color: ELEMENT_CHART[s.type]?.color }}>
                                  {s.type}
                                </span>{' '}
                                · {s.rarity}
                              </div>
                            </div>
                          </div>
                          <div className="text-right text-[11px] tabular-nums text-slate-200 shrink-0">
                            <div className="font-bold text-emerald-300">PS {s.hp}/{s.maxHp}</div>
                            <div className="text-slate-400">ATQ {s.atk} · DEF {s.def}</div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-1.5 mt-2.5 pt-2 border-t border-white/10 text-[11px]">
                          <span className="font-semibold flex items-center gap-1" style={{ color: bondTier.color }}>
                            <Heart className="w-3 h-3 fill-current" />
                            {s.bond}/100 ({bondTier.label})
                            {s.bonusTrait ? ` · ${s.bonusTrait}` : ''}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {megaCheck.eligible && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  gameEngine.evolveSlugToMegamorph(s.uid);
                                }}
                                className="bt-btn-amber px-2.5 py-1 rounded-lg font-extrabold text-[11px] cursor-pointer"
                              >
                                Megamorph
                              </button>
                            )}
                            {snap.inventory.elixirs > 0 && !s.mega && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  gameEngine.useElixirOnSlug(s.uid);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-purple-500/80 border border-purple-300/60 text-white font-bold text-[11px] hover:bg-purple-500 cursor-pointer"
                              >
                                Elixir ({snap.inventory.elixirs})
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setInspectedSlugUid(s.uid);
                              }}
                              className="bt-btn-secondary px-2.5 py-1 rounded-lg text-teal-200 font-bold text-[11px] cursor-pointer"
                            >
                              Ficha
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[11px] text-slate-400 mt-2.5">
                  Evolución Megamorph intencional desde la Ficha de babosa: requiere Nivel 5+, Amistad 60+ y 1 Elixir, Reliquia o Piedra Evolutiva.
                </p>
              </div>

              {/* Breeding Incubator */}
              <div className="bt-inset rounded-xl p-3.5">
                <h3 className="text-xs font-extrabold text-emerald-300 uppercase tracking-wider mb-2.5">
                  Incubadora y Crianza del Refugio
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
                  <select
                    value={parentA}
                    onChange={(e) => setParentA(e.target.value)}
                    className="bt-card rounded-xl px-3 py-2 text-xs text-white min-h-[40px]"
                  >
                    <option value="">Selecciona Progenitor 1</option>
                    {allSlugs.map((s) => (
                      <option key={s.uid} value={s.uid}>
                        {s.name} ({s.type} · Nv.{s.level} · Amistad {s.bond})
                      </option>
                    ))}
                  </select>

                  <select
                    value={parentB}
                    onChange={(e) => setParentB(e.target.value)}
                    className="bt-card rounded-xl px-3 py-2 text-xs text-white min-h-[40px]"
                  >
                    <option value="">Selecciona Progenitor 2</option>
                    {allSlugs.map((s) => (
                      <option key={s.uid} value={s.uid}>
                        {s.name} ({s.type} · Nv.{s.level} · Amistad {s.bond})
                      </option>
                    ))}
                  </select>

                  <button
                    disabled={!parentA || !parentB || parentA === parentB}
                    onClick={() => {
                      if (gameEngine.startBreeding(parentA, parentB)) {
                        setParentA('');
                        setParentB('');
                      }
                    }}
                    className="bt-btn-primary py-2 px-4 rounded-xl font-extrabold text-xs disabled:opacity-40 cursor-pointer min-h-[40px]"
                  >
                    Incubar Nuevo Huevo
                  </button>
                </div>

                {snap.eggs.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {snap.eggs.map((egg) => (
                      <div key={egg.id} className="bt-card border-emerald-400/45 rounded-xl p-3 text-xs flex items-center gap-2.5">
                        <SlugPortrait speciesId={egg.speciesId} mood="sleep" size={36} />
                        <div className="min-w-0">
                          <div className="font-extrabold text-white truncate">
                            Huevo de {getSpecies(egg.speciesId).name}
                          </div>
                          <div className="text-slate-300 mt-0.5 text-[11px]">Rasgo: {egg.bonusTrait}</div>
                          <div className="text-emerald-300 tabular-nums mt-0.5 font-bold">
                            Faltan {Math.ceil(egg.stepsRemaining)} pasos
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">
                    Empareja 2 babosas con al menos 25 de amistad para criar una cría con rasgo genético mejorado.
                  </p>
                )}
              </div>

              {/* Storage Reserve */}
              <div className="bt-inset rounded-xl p-3.5">
                <h3 className="text-xs font-extrabold text-slate-200 uppercase tracking-wider mb-2.5">
                  Reserva en el Refugio ({snap.storage.length})
                </h3>
                {snap.storage.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    Captura más babosas o eclosiona huevos para llenar la reserva.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {snap.storage.map((s) => (
                      <div key={s.uid} className="bt-card rounded-xl p-2.5 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <SlugPortrait speciesId={s.id} mega={s.mega} size={34} />
                          <div className="text-xs min-w-0">
                            <div className="font-bold text-white truncate">
                              {s.name} Nv.{s.level}
                            </div>
                            <div className="text-slate-400 truncate text-[11px]">
                              {s.type} · ♥{s.bond} {s.bonusTrait ? `· ${s.bonusTrait}` : ''}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => setInspectedSlugUid(s.uid)}
                            className="bt-btn-secondary px-2 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer"
                          >
                            Ficha
                          </button>
                          <button
                            onClick={() =>
                              gameEngine.swapPartyAndStorage(
                                snap.party.length < 4 ? -1 : swapTargetPartyIdx,
                                s.uid
                              )
                            }
                            className="bt-btn-primary px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold cursor-pointer"
                          >
                            {snap.party.length < 4 ? 'Añadir' : 'Cambiar'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'hogar' && (
            <div className="space-y-4">
              {/* Room Validation & Furniture Controls */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div className="bt-inset rounded-xl p-3.5">
                  <div className="flex items-center justify-between mb-2.5">
                    <h3 className="text-xs font-extrabold text-teal-300 uppercase tracking-wider">
                      Habitaciones del Refugio
                    </h3>
                    <span className="text-[11px] text-slate-300 tabular-nums">
                      Muebles: {snap.home.furniture.length}
                    </span>
                  </div>
                  {snap.rooms.length === 0 ? (
                    <p className="text-xs text-slate-400">
                      No se detectan estancias construidas cerca del Refugio Central.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {snap.rooms.map((rm) => (
                        <div
                          key={rm.id}
                          className={`rounded-xl border p-3 text-xs ${
                            rm.closed && rm.issues.length === 0
                              ? 'bg-[#0c2128] border-emerald-500/45'
                              : 'bg-[#191b28] border-amber-500/45'
                          }`}
                        >
                          <div className="flex items-center justify-between font-bold text-white">
                            <span>
                              {rm.label} · {rm.closed ? 'Cerrada' : 'Abierta'}
                            </span>
                            <span className="text-amber-300 tabular-nums">
                              Comodidad {rm.comfortScore}/100
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-300 mt-1">
                            Suelo libre: {rm.walkableCount} · Puerta: {rm.hasDoor ? 'Sí' : 'No'} · Luz:{' '}
                            {rm.hasLight ? 'Sí' : 'No'} · Muebles: {rm.furnitureCount}
                          </div>
                          {rm.issues.length > 0 ? (
                            <div className="text-[11px] text-amber-300 mt-1">
                              Pendiente: {rm.issues.join(' · ')}
                            </div>
                          ) : (
                            <div className="text-[11px] text-emerald-300 mt-1">
                              Habitación apta y acogedora para tus babosas.
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bt-inset rounded-xl p-3.5">
                  <h3 className="text-xs font-extrabold text-amber-300 uppercase tracking-wider mb-2.5">
                    Mobiliario del Hogar
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(Object.keys(FURNITURE_DEFS) as FurnitureKind[]).map((kind) => {
                      const def = FURNITURE_DEFS[kind];
                      const count = snap.inventory[kind] || 0;
                      return (
                        <div
                          key={kind}
                          className="bt-card rounded-xl p-2.5 flex flex-col justify-between gap-2 text-xs"
                        >
                          <div>
                            <div className="flex items-center justify-between font-bold text-white">
                              <span className="flex items-center gap-1.5">
                                <ResourceSwatch itemKey={kind} />
                                {def.name}
                              </span>
                              <span className="text-teal-300 tabular-nums">×{count}</span>
                            </div>
                            <p className="text-[11px] text-slate-300 mt-0.5">{def.description}</p>
                          </div>
                          <button
                            disabled={count <= 0}
                            onClick={() => gameEngine.placeFurnitureInFront(kind)}
                            className="bt-btn-primary w-full py-1.5 rounded-lg font-extrabold text-[11px] disabled:opacity-35 cursor-pointer min-h-[34px]"
                          >
                            Colocar frente a ti
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  {snap.home.furniture.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-white/10">
                      <div className="text-[11px] font-bold text-slate-300 mb-1.5">
                        Colocados en el refugio (también puedes recogerlos con el Pico):
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {snap.home.furniture.map((f) => (
                          <button
                            key={f.id}
                            onClick={() => gameEngine.pickupFurnitureById(f.id)}
                            className="bt-btn-secondary px-2.5 py-1 rounded-lg text-[11px] cursor-pointer"
                          >
                            {FURNITURE_DEFS[f.kind].name} ({f.x},{f.y}) · Recoger
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Habitats & Residents */}
              <div className="bt-inset rounded-xl p-3.5 space-y-3">
                <div>
                  <h3 className="text-xs font-extrabold text-emerald-300 uppercase tracking-wider">
                    Hábitats del Refugio ({snap.home.residents.length}/{MAX_ACTIVE_HOME_SLUGS} Babosas en Hogar)
                  </h3>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    Asigna babosas compatibles desde tu reserva para que vivan libres, descansen y fortalezcan su vínculo.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {HABITAT_DEFS.map((hab) => {
                    const residents = snap.home.residents.filter((r) => r.habitatId === hab.id);
                    const compatibleReserve = snap.storage.filter((s) =>
                      isSpeciesCompatibleWithHabitat(s.id, hab.id)
                    );
                    const selectedUid =
                      assignPick[hab.id] && compatibleReserve.some((s) => s.uid === assignPick[hab.id])
                        ? assignPick[hab.id]!
                        : compatibleReserve[0]?.uid || '';
                    const canAssign =
                      residents.length < MAX_SLUGS_PER_HABITAT &&
                      snap.home.residents.length < MAX_ACTIVE_HOME_SLUGS &&
                      Boolean(selectedUid);

                    return (
                      <div
                        key={hab.id}
                        className="bt-card rounded-xl p-3 flex flex-col gap-2.5"
                        style={{ borderColor: `${hab.accentColor}44` }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-sm font-extrabold text-white flex items-center gap-1.5">
                              <span
                                className="inline-block w-2.5 h-2.5 rounded-full"
                                style={{
                                  backgroundColor: hab.accentColor,
                                  boxShadow: `0 0 8px ${hab.accentColor}`,
                                }}
                              />
                              {hab.name}
                            </div>
                            <div className="text-[11px] text-teal-300 font-semibold">
                              Elementos: {hab.acceptedTypes.join(' · ')}
                            </div>
                            <p className="text-[11px] text-slate-300 mt-0.5">{hab.description}</p>
                          </div>
                          <span className="text-xs font-extrabold text-slate-200 tabular-nums whitespace-nowrap">
                            {residents.length}/{MAX_SLUGS_PER_HABITAT}
                          </span>
                        </div>

                        {/* Assign control */}
                        <div className="flex items-center gap-2">
                          <select
                            value={selectedUid}
                            onChange={(e) => setAssignPick((prev) => ({ ...prev, [hab.id]: e.target.value }))}
                            disabled={compatibleReserve.length === 0}
                            className="bt-inset flex-1 rounded-xl px-2.5 py-2 text-xs text-white disabled:opacity-50"
                          >
                            {compatibleReserve.length === 0 ? (
                              <option value="">Sin babosas compatibles en reserva</option>
                            ) : (
                              compatibleReserve.map((s) => (
                                <option key={s.uid} value={s.uid}>
                                  {s.name} ({s.type} · Nv.{s.level})
                                </option>
                              ))
                            )}
                          </select>
                          <button
                            disabled={!canAssign}
                            onClick={() => {
                              if (selectedUid) gameEngine.assignSlugToHome(selectedUid, hab.id);
                            }}
                            className="bt-btn-primary px-3 py-2 rounded-xl font-extrabold text-xs disabled:opacity-35 cursor-pointer whitespace-nowrap min-h-[36px]"
                          >
                            Asignar
                          </button>
                        </div>

                        {/* Resident cards */}
                        {residents.length > 0 && (
                          <div className="space-y-2 pt-1">
                            {residents.map((res) => {
                              const fav = getFavoriteFoodForSpecies(res.slug.id);
                              const bondTier = getBondTierInfo(res.slug.bond);
                              const moodPose: SlugPortraitMood =
                                res.visualActivity === 'eat'
                                  ? 'eat'
                                  : res.visualActivity === 'look'
                                  ? 'react'
                                  : res.visualActivity === 'play' || res.visualActivity === 'social'
                                  ? 'play'
                                  : res.visualActivity === 'sleep' || res.behavior === 'descansar'
                                  ? 'sleep'
                                  : res.mood === 'contenta'
                                  ? 'happy'
                                  : 'idle';
                              return (
                                <div key={res.slug.uid} className="bt-inset rounded-xl p-2.5 text-xs space-y-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <SlugPortrait
                                        speciesId={res.slug.id}
                                        mega={res.slug.mega}
                                        mood={moodPose}
                                        size={42}
                                      />
                                      <div className="min-w-0">
                                        <div className="font-extrabold text-white truncate">
                                          {res.slug.name} · Nv.{res.slug.level}
                                        </div>
                                        <div className="text-[11px] font-semibold" style={{ color: bondTier.color }}>
                                          ♥ {res.slug.bond}/100 ({bondTier.label}) · {getMoodLabel(res.mood)}
                                        </div>
                                      </div>
                                    </div>
                                    <button
                                      onClick={() => setInspectedSlugUid(res.slug.uid)}
                                      className="bt-btn-secondary px-2.5 py-1 rounded-lg text-[11px] font-bold text-teal-200 cursor-pointer shrink-0"
                                    >
                                      Ficha
                                    </button>
                                  </div>

                                  <div className="grid grid-cols-3 gap-2 text-[10px]">
                                    <div>
                                      <div className="flex justify-between text-slate-300 mb-0.5">
                                        <span>Saciedad</span>
                                        <span className="tabular-nums">{Math.round(res.hunger)}%</span>
                                      </div>
                                      <div className="h-1.5 bg-[#050b12] rounded-full overflow-hidden">
                                        <div
                                          className="h-full bg-emerald-400"
                                          style={{ width: `${Math.round(res.hunger)}%` }}
                                        />
                                      </div>
                                    </div>
                                    <div>
                                      <div className="flex justify-between text-slate-300 mb-0.5">
                                        <span>Energía</span>
                                        <span className="tabular-nums">{Math.round(res.energy)}%</span>
                                      </div>
                                      <div className="h-1.5 bg-[#050b12] rounded-full overflow-hidden">
                                        <div
                                          className="h-full bg-cyan-400"
                                          style={{ width: `${Math.round(res.energy)}%` }}
                                        />
                                      </div>
                                    </div>
                                    <div>
                                      <div className="flex justify-between text-slate-300 mb-0.5">
                                        <span>Alegría</span>
                                        <span className="tabular-nums">{Math.round(res.happiness)}%</span>
                                      </div>
                                      <div className="h-1.5 bg-[#050b12] rounded-full overflow-hidden">
                                        <div
                                          className="h-full bg-amber-400"
                                          style={{ width: `${Math.round(res.happiness)}%` }}
                                        />
                                      </div>
                                    </div>
                                  </div>

                                  <div className="text-[11px] text-slate-400">
                                    Alimento favorito: <span className="text-amber-200 font-semibold">{fav.label}</span>
                                  </div>

                                  <div className="flex flex-wrap gap-1.5">
                                    <button
                                      onClick={() => gameEngine.petHomeSlug(res.slug.uid)}
                                      className="px-2.5 py-1.5 rounded-lg bg-pink-500/20 border border-pink-400/50 text-pink-100 font-bold text-[11px] hover:bg-pink-500/35 cursor-pointer"
                                    >
                                      Acariciar
                                    </button>
                                    <button
                                      onClick={() => gameEngine.playWithHomeSlug(res.slug.uid)}
                                      className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 border border-amber-400/50 text-amber-100 font-bold text-[11px] hover:bg-amber-500/35 cursor-pointer"
                                    >
                                      Jugar
                                    </button>
                                    {HOME_FOOD_DEFS.map((food) => {
                                      const qty = snap.inventory[food.key] || 0;
                                      const isFav =
                                        Array.isArray(food.favoriteFor) &&
                                        food.favoriteFor.includes(res.slug.type);
                                      return (
                                        <button
                                          key={food.key}
                                          disabled={qty <= 0}
                                          onClick={() => gameEngine.feedHomeSlug(res.slug.uid, food.key)}
                                          className={`px-2 py-1.5 rounded-lg border text-[11px] font-bold cursor-pointer disabled:opacity-35 ${
                                            isFav
                                              ? 'bg-emerald-500/25 border-emerald-400 text-emerald-100'
                                              : 'bt-btn-secondary'
                                          }`}
                                        >
                                          {food.label} ({qty})
                                        </button>
                                      );
                                    })}
                                    <button
                                      onClick={() => gameEngine.withdrawSlugFromHome(res.slug.uid)}
                                      className="bt-btn-secondary ml-auto px-2.5 py-1.5 rounded-lg font-bold text-[11px] cursor-pointer"
                                    >
                                      A cápsula
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {tab === 'babosapedia' && (
            <div className="space-y-3.5">
              {/* Expression Switcher & Style Guide Bar */}
              <div className="bt-inset rounded-xl p-3 flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-extrabold text-teal-300 uppercase tracking-wider mr-1">
                    Animación en catálogo:
                  </span>
                  {(
                    [
                      { id: 'happy', label: 'Feliz' },
                      { id: 'idle', label: 'Tranquila' },
                      { id: 'walk', label: 'Pasear' },
                      { id: 'play', label: 'Jugar' },
                      { id: 'eat', label: 'Comer' },
                      { id: 'react', label: 'Reacción' },
                      { id: 'attack', label: 'Ataque' },
                      { id: 'hit', label: 'Impacto' },
                      { id: 'sleep', label: 'Descanso' },
                    ] as Array<{ id: SlugPortraitMood; label: string }>
                  ).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setCatalogMood(m.id)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer whitespace-nowrap ${
                        catalogMood === m.id ? 'bt-btn-primary' : 'bt-btn-secondary'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCatalogSilhouette((v) => !v)}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-extrabold cursor-pointer whitespace-nowrap ${
                      catalogSilhouette ? 'bt-btn-amber' : 'bt-btn-secondary'
                    }`}
                  >
                    {catalogSilhouette ? 'Ver Color' : 'Silueta'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowArtGuide((v) => !v)}
                    className="bt-btn-secondary border-cyan-400/50 px-3 py-1.5 rounded-xl text-[11px] font-extrabold text-cyan-200 cursor-pointer whitespace-nowrap"
                  >
                    {showArtGuide ? 'Ocultar Guía y Prototipos' : 'Guía Artística y Prototipos'}
                  </button>
                </div>
              </div>

              {showArtGuide && (
                <div className="bt-inset border-cyan-400/40 rounded-xl p-3.5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-xs font-extrabold text-amber-300 uppercase tracking-wider">
                      {ART_DIRECTION_GUIDE.title}
                    </h4>
                    <span className="text-[11px] text-slate-300">
                      Luz {ART_DIRECTION_GUIDE.lightDirectionDeg}° · Contorno {ART_DIRECTION_GUIDE.outlineHex} · Megamorph exclusivo en progreso avanzado
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                    {ART_DIRECTION_GUIDE.prototypePriorityIds.map((pid) => {
                      const psp = getSpecies(pid);
                      const psheet = getSlugDesignSheet(pid);
                      return (
                        <div key={pid} className="bt-card rounded-xl p-3 space-y-1.5 border-amber-400/35">
                          <div className="flex items-center gap-2.5">
                            <SlugPortrait
                              speciesId={pid}
                              mood={catalogMood}
                              size={58}
                              silhouette={catalogSilhouette}
                            />
                            <div className="min-w-0">
                              <div className="text-xs font-extrabold text-white">{psp.name}</div>
                              <div className="text-[10px] font-bold text-amber-300">
                                Prototipo · {psheet.vfxSignature.transformLabel}
                              </div>
                            </div>
                          </div>
                          <div className="text-[11px] text-slate-300">{psheet.silhouetteHooks.join(' · ')}</div>
                          <div className="text-[10px] text-teal-200 italic">{psheet.personalityQuote}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Story-Ordered Species Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {STORY_ORDERED_SPECIES_IDS.map((id) => getSpecies(id)).map((sp) => {
                  const seen = !!snap.seenSpecies[sp.id];
                  const caught = snap.capturedSpecies[sp.id] || 0;
                  const known = seen || caught > 0;
                  const sheet = getSlugDesignSheet(sp.id);
                  return (
                    <div
                      key={sp.id}
                      className={`bt-card rounded-xl p-3.5 flex flex-col justify-between ${
                        caught > 0
                          ? 'border-teal-400/50'
                          : known
                          ? 'border-slate-600/80'
                          : 'opacity-70 border-slate-800'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1 text-[10px] text-slate-400 mb-1.5">
                          <span>#{sheet.storyOrder} · {sheet.storyChapter}</span>
                          {sheet.prototypeTier === 'prototype_trio' && (
                            <span className="text-amber-300 font-bold">Prototipo</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2.5 mb-2">
                          <div className="w-14 h-14 rounded-xl bt-inset flex items-center justify-center shrink-0">
                            {known ? (
                              <SlugPortrait
                                speciesId={sp.id}
                                size={48}
                                mood={caught > 0 ? catalogMood : 'idle'}
                                silhouette={catalogSilhouette}
                              />
                            ) : (
                              <span className="text-base font-extrabold text-slate-500">?</span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-extrabold text-sm text-white truncate">
                                {known ? sp.name : 'Especie desconocida'}
                              </span>
                              <span className="text-[10px] font-bold text-amber-300 shrink-0">{sp.rarity}</span>
                            </div>
                            <div className="text-[11px] text-slate-300 mt-0.5">
                              <span className="font-bold" style={{ color: ELEMENT_CHART[sp.type]?.color }}>
                                {sp.type}
                              </span>{' '}
                              · {BIOME_INFO[sp.habitat].name}
                            </div>
                          </div>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-relaxed">
                          {known
                            ? sp.lore
                            : `Explora ${BIOME_INFO[sp.habitat].name} para descubrir esta especie.`}
                        </p>
                        {known && (
                          <div className="text-[10px] text-cyan-200/85 mt-1.5 leading-snug">
                            Rasgos: {sheet.silhouetteHooks.slice(0, 2).join(' · ')}
                          </div>
                        )}
                      </div>
                      <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-teal-200 tabular-nums font-semibold">
                        <span>Capturadas: {caught}</span>
                        {known && <span className="text-amber-200/85 text-[10px]">{sheet.vfxSignature.transformLabel}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'misiones' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Shelter Upgrade & Perks */}
              <div className="bt-inset rounded-xl p-3.5 space-y-3">
                <h3 className="text-xs font-extrabold text-amber-300 uppercase tracking-wider">
                  Refugio Subterráneo · Nivel {snap.shelterTier}/3
                </h3>
                <p className="text-xs text-slate-200 leading-relaxed">
                  {snap.shelterTier === 1 &&
                    'Siguiente mejora (Nv.2): Aura de curación pasiva e incubación +50% más rápida. Costo: 10 Mineral, 8 Madera, 2 Cristal.'}
                  {snap.shelterTier === 2 &&
                    'Siguiente mejora (Nv.3): Desbloquea Baliza de Retorno Rápido al Refugio desde cualquier bioma. Costo: 18 Mineral, 14 Madera, 5 Cristal.'}
                  {snap.shelterTier >= 3 &&
                    'Refugio al máximo nivel. Aura curativa activa, incubación veloz y Retorno Rápido disponible.'}
                </p>

                {snap.shelterTier < 3 ? (
                  <button
                    onClick={() => gameEngine.upgradeShelter()}
                    className="bt-btn-amber w-full py-2.5 rounded-xl font-extrabold text-xs cursor-pointer min-h-[42px]"
                  >
                    Mejorar Refugio al Nivel {snap.shelterTier + 1}
                  </button>
                ) : (
                  <button
                    onClick={() => gameEngine.warpToShelter()}
                    className="bt-btn-primary w-full py-2.5 rounded-xl font-extrabold text-xs cursor-pointer min-h-[42px]"
                  >
                    Teletransportar al Refugio
                  </button>
                )}

                <div className="border-t border-cyan-400/15 pt-3">
                  <div className="text-xs font-extrabold text-teal-300 mb-1.5">Habilidades Desbloqueadas</div>
                  {snap.player.perks.length === 0 ? (
                    <p className="text-xs text-slate-400">
                      Completa misiones principales y de colección para desbloquear mejoras permanentes.
                    </p>
                  ) : (
                    <ul className="space-y-1 text-xs text-emerald-300 font-semibold">
                      {snap.player.perks.map((p) => (
                        <li key={p}>✦ {p}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Quests List */}
              <div className="lg:col-span-2 space-y-2.5">
                {QUEST_LIST.map((q) => {
                  const prog = gameEngine.getQuestProgress(q);
                  const claimed = snap.claimedQuests.includes(q.id);
                  const ready = !claimed && gameEngine.isQuestComplete(q);
                  return (
                    <div
                      key={q.id}
                      className={`bt-card rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        claimed
                          ? 'border-emerald-500/35 opacity-65'
                          : ready
                          ? 'border-teal-300 shadow-[0_0_18px_rgba(45,212,191,0.16)]'
                          : ''
                      }`}
                    >
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300 mb-0.5">
                          <span className={q.category === 'principal' ? 'text-amber-300 font-extrabold' : 'text-teal-300 font-extrabold'}>
                            {q.category === 'principal' ? 'Principal' : 'Secundaria'}
                          </span>
                          <span>·</span>
                          <span className="tabular-nums font-semibold">
                            {Math.min(prog, q.goal)} / {q.goal}
                          </span>
                          {q.extraConditions?.map((cond) => {
                            const extraVal = gameEngine.getQuestMetricValue(cond.metric);
                            return (
                              <span key={cond.metric} className="tabular-nums font-semibold">
                                · {cond.label}: {Math.min(extraVal, cond.goal)}/{cond.goal}
                              </span>
                            );
                          })}
                        </div>
                        <div className="text-sm font-extrabold text-white">{q.title}</div>
                        <div className="text-xs text-slate-300 mt-0.5">{q.description}</div>
                        <div className="text-[11px] text-emerald-300 mt-1 font-semibold">
                          Recompensa: {q.rewardText}
                        </div>
                      </div>

                      <button
                        disabled={!ready}
                        onClick={() => gameEngine.claimQuest(q.id)}
                        className={`px-4 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap cursor-pointer min-h-[40px] ${
                          claimed
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : ready
                            ? 'bt-btn-primary'
                            : 'bt-btn-secondary opacity-60'
                        }`}
                      >
                        {claimed ? 'Completada' : ready ? 'Reclamar' : 'En curso'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {inspectedEntry && (
        <SlugDetailPanel
          slug={inspectedEntry.slug}
          snap={snap}
          locationLabel={inspectedEntry.location}
          onClose={() => setInspectedSlugUid(null)}
        />
      )}
    </div>
  );
};
