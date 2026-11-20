import React, { useState } from 'react';
import { X } from 'lucide-react';
import {
  BIOME_INFO,
  CRAFT_RECIPES,
  ELEMENT_CHART,
  QUEST_LIST,
  SPECIES_LIST,
  getSpecies,
} from '../game/data';
import { gameEngine } from '../game/engine';
import type { HudSnapshot, InventoryKey } from '../game/types';

interface ExpeditionModalProps {
  snap: HudSnapshot;
  onClose: () => void;
}

type TabKey = 'taller' | 'criaturas' | 'babosapedia' | 'misiones';

const INV_LABELS: Array<{ key: InventoryKey; label: string }> = [
  { key: 'ore', label: 'Minerales' },
  { key: 'wood', label: 'Madera' },
  { key: 'stone', label: 'Piedra' },
  { key: 'crystal', label: 'Cristal de Energía' },
  { key: 'shadowShard', label: 'Frag. Sombrío' },
  { key: 'berries', label: 'Bayas' },
  { key: 'core', label: 'Núcleos' },
  { key: 'capsules', label: 'Cilindros' },
  { key: 'masterCapsules', label: 'Cilindros Maestros' },
  { key: 'torches', label: 'Antorchas' },
  { key: 'walls', label: 'Paredes' },
  { key: 'floors', label: 'Suelos' },
  { key: 'doors', label: 'Puertas' },
  { key: 'stations', label: 'Estaciones' },
  { key: 'elixirs', label: 'Elixires Megamorph' },
  { key: 'relics', label: 'Reliquias Antiguas' },
];

export const ExpeditionModal: React.FC<ExpeditionModalProps> = ({ snap, onClose }) => {
  const [tab, setTab] = useState<TabKey>('taller');
  const [parentA, setParentA] = useState<string>('');
  const [parentB, setParentB] = useState<string>('');
  const [swapTargetPartyIdx, setSwapTargetPartyIdx] = useState<number>(0);

  const allSlugs = [...snap.party, ...snap.storage];
  const capturedCount = Object.keys(snap.capturedSpecies).length;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-3 md:p-6 bg-[#040a10]/85">
      <div className="w-full max-w-4xl bg-[#0e1b26] border border-slate-700 rounded-2xl p-4 md:p-6 shadow-2xl max-h-[92dvh] flex flex-col">
        {/* Header + Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3 mb-4">
          <div>
            <h2 className="text-lg md:text-xl font-extrabold text-white">Estuche, Taller y Expedición</h2>
            <p className="text-xs text-slate-400">
              Refugio Nivel {snap.shelterTier} · Biomas {snap.discoveries.length}/4 · Babosapedia {capturedCount}/{SPECIES_LIST.length}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-4">
          {(
            [
              ['taller', 'Inventario y Taller'],
              ['criaturas', 'Babosas y Crianza'],
              ['babosapedia', 'Babosapedia'],
              ['misiones', 'Misiones y Refugio'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                tab === id
                  ? 'bg-cyan-400 text-slate-950'
                  : 'bg-[#142534] text-slate-300 hover:text-white border border-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto pr-1">
          {tab === 'taller' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="bg-[#09131c] border border-slate-700/80 rounded-xl p-3.5">
                <h3 className="text-xs font-extrabold text-cyan-300 uppercase tracking-wider mb-3">
                  Mochila de Recursos
                </h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {INV_LABELS.map((item) => (
                    <div
                      key={item.key}
                      className="flex items-center justify-between bg-[#0f1f2d] px-2.5 py-1.5 rounded-lg"
                    >
                      <span className="text-slate-300 truncate">{item.label}</span>
                      <span className="font-bold text-white tabular-nums ml-1">{snap.inventory[item.key]}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-2 bg-[#09131c] border border-slate-700/80 rounded-xl p-3.5">
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
                        className="bg-[#0f1f2d] border border-slate-700/70 rounded-xl p-3 flex flex-col justify-between gap-2"
                      >
                        <div>
                          <div className="text-sm font-bold text-white">{rec.name}</div>
                          <div className="text-[11px] text-slate-400 mt-0.5">{rec.description}</div>
                          <div className="text-[11px] text-amber-200/90 mt-1.5">Costo: {costText}</div>
                        </div>
                        <button
                          disabled={!canCraft}
                          onClick={() => gameEngine.craftItem(rec.id)}
                          className="w-full py-2 rounded-lg bg-cyan-400 text-slate-950 font-extrabold text-xs hover:bg-cyan-300 disabled:opacity-35 cursor-pointer"
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
              <div className="bg-[#09131c] border border-slate-700/80 rounded-xl p-3.5">
                <h3 className="text-xs font-extrabold text-cyan-300 uppercase tracking-wider mb-2.5">
                  Estuche Activo (Máx. 4) — Haz clic para marcar ranura de intercambio
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {snap.party.map((s, idx) => (
                    <div
                      key={s.uid}
                      onClick={() => setSwapTargetPartyIdx(idx)}
                      className={`p-3 rounded-xl border cursor-pointer transition-colors ${
                        swapTargetPartyIdx === idx
                          ? 'bg-cyan-500/15 border-cyan-400'
                          : 'bg-[#0f1f2d] border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-bold text-sm text-white">
                          {s.icon} {s.name} {s.mega ? '★ Megamorph' : ''}
                        </div>
                        <span className="text-xs text-slate-300 tabular-nums">Nv.{s.level}</span>
                      </div>
                      <div className="text-[11px] text-slate-300 mt-1 tabular-nums">
                        {s.type} · {s.rarity} · PS {s.hp}/{s.maxHp} · ATQ {s.atk} · DEF {s.def} · VEL {s.spd}
                      </div>
                      <div className="flex items-center justify-between mt-2 text-[11px]">
                        <span className="text-amber-300">Amistad: {s.bond}/100 {s.bonusTrait ? `· ${s.bonusTrait}` : ''}</span>
                        {snap.inventory.elixirs > 0 && !s.mega && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              gameEngine.useElixirOnSlug(s.uid);
                            }}
                            className="px-2.5 py-1 rounded bg-purple-500 text-white font-bold text-[11px] hover:bg-purple-400 cursor-pointer"
                          >
                            Usar Elixir ({snap.inventory.elixirs})
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-slate-400 mt-2">
                  Evolución Megamorph automática al alcanzar Nivel 5 y 60 de Amistad.
                </p>
              </div>

              {/* Breeding Incubator */}
              <div className="bg-[#09131c] border border-slate-700/80 rounded-xl p-3.5">
                <h3 className="text-xs font-extrabold text-emerald-300 uppercase tracking-wider mb-2.5">
                  Incubadora y Crianza del Refugio
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
                  <select
                    value={parentA}
                    onChange={(e) => setParentA(e.target.value)}
                    className="bg-[#0f1f2d] border border-slate-600 rounded-lg px-3 py-2 text-xs text-white"
                  >
                    <option value="">Selecciona Progenitor 1</option>
                    {allSlugs.map((s) => (
                      <option key={s.uid} value={s.uid}>
                        {s.icon} {s.name} (Nv.{s.level} · Amistad {s.bond})
                      </option>
                    ))}
                  </select>

                  <select
                    value={parentB}
                    onChange={(e) => setParentB(e.target.value)}
                    className="bg-[#0f1f2d] border border-slate-600 rounded-lg px-3 py-2 text-xs text-white"
                  >
                    <option value="">Selecciona Progenitor 2</option>
                    {allSlugs.map((s) => (
                      <option key={s.uid} value={s.uid}>
                        {s.icon} {s.name} (Nv.{s.level} · Amistad {s.bond})
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
                    className="py-2 px-4 rounded-lg bg-emerald-400 text-slate-950 font-extrabold text-xs hover:bg-emerald-300 disabled:opacity-40 cursor-pointer"
                  >
                    Incubar Nuevo Huevo
                  </button>
                </div>

                {snap.eggs.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {snap.eggs.map((egg) => (
                      <div key={egg.id} className="bg-[#0f1f2d] border border-emerald-400/40 rounded-lg p-2.5 text-xs">
                        <div className="font-bold text-white">🥚 Huevo de {getSpecies(egg.speciesId).name}</div>
                        <div className="text-slate-300 mt-0.5">Rasgo: {egg.bonusTrait}</div>
                        <div className="text-emerald-300 tabular-nums mt-1">
                          Faltan {Math.ceil(egg.stepsRemaining)} pasos
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
              <div className="bg-[#09131c] border border-slate-700/80 rounded-xl p-3.5">
                <h3 className="text-xs font-extrabold text-slate-300 uppercase tracking-wider mb-2">
                  Reserva en el Refugio ({snap.storage.length})
                </h3>
                {snap.storage.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    Captura más babosas o eclosiona huevos para llenar la reserva.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {snap.storage.map((s) => (
                      <div key={s.uid} className="bg-[#0f1f2d] border border-slate-700 rounded-lg p-2.5 flex items-center justify-between">
                        <div className="text-xs">
                          <div className="font-bold text-white">
                            {s.icon} {s.name} Nv.{s.level}
                          </div>
                          <div className="text-slate-400">
                            {s.type} · {s.bonusTrait || s.rarity}
                          </div>
                        </div>
                        <button
                          onClick={() =>
                            gameEngine.swapPartyAndStorage(
                              snap.party.length < 4 ? -1 : swapTargetPartyIdx,
                              s.uid
                            )
                          }
                          className="px-2.5 py-1.5 rounded bg-cyan-500/20 border border-cyan-400/50 text-cyan-200 text-[11px] font-bold cursor-pointer"
                        >
                          {snap.party.length < 4 ? 'Añadir' : 'Cambiar'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'babosapedia' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {SPECIES_LIST.map((sp) => {
                const seen = !!snap.seenSpecies[sp.id];
                const caught = snap.capturedSpecies[sp.id] || 0;
                return (
                  <div
                    key={sp.id}
                    className={`rounded-xl border p-3 ${
                      caught > 0
                        ? 'bg-[#0f1f2d] border-cyan-500/40'
                        : seen
                        ? 'bg-[#0b151e] border-slate-700'
                        : 'bg-[#080f16] border-slate-800 opacity-65'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-bold text-sm text-white">
                        {seen || caught > 0 ? `${sp.icon} ${sp.name}` : '❓ Especie desconocida'}
                      </div>
                      <span className="text-[11px] font-semibold text-amber-300">{sp.rarity}</span>
                    </div>
                    <div className="text-[11px] text-slate-300 mb-1.5">
                      <span style={{ color: ELEMENT_CHART[sp.type]?.color }}>{sp.type}</span> ·{' '}
                      {BIOME_INFO[sp.habitat].name}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      {seen || caught > 0
                        ? sp.lore
                        : `Explora ${BIOME_INFO[sp.habitat].name} para descubrir esta especie.`}
                    </p>
                    <div className="mt-2 text-[11px] text-cyan-200 tabular-nums">
                      Capturadas: {caught}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'misiones' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Shelter Upgrade & Perks */}
              <div className="bg-[#09131c] border border-slate-700/80 rounded-xl p-3.5 space-y-3">
                <h3 className="text-xs font-extrabold text-amber-300 uppercase tracking-wider">
                  Refugio Subterráneo · Nivel {snap.shelterTier}/3
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {snap.shelterTier === 1 && 'Siguiente mejora (Nv.2): Aura de curación pasiva e incubación +50% más rápida. Costo: 10 Mineral, 8 Madera, 2 Cristal.'}
                  {snap.shelterTier === 2 && 'Siguiente mejora (Nv.3): Desbloquea Baliza de Retorno Rápido al Refugio desde cualquier bioma. Costo: 18 Mineral, 14 Madera, 5 Cristal.'}
                  {snap.shelterTier >= 3 && 'Refugio al máximo nivel. Aura curativa activa, incubación veloz y Retorno Rápido disponible.'}
                </p>

                {snap.shelterTier < 3 ? (
                  <button
                    onClick={() => gameEngine.upgradeShelter()}
                    className="w-full py-2.5 rounded-xl bg-amber-400 text-slate-950 font-extrabold text-xs hover:bg-amber-300 cursor-pointer"
                  >
                    Mejorar Refugio al Nivel {snap.shelterTier + 1}
                  </button>
                ) : (
                  <button
                    onClick={() => gameEngine.warpToShelter()}
                    className="w-full py-2.5 rounded-xl bg-cyan-400 text-slate-950 font-extrabold text-xs hover:bg-cyan-300 cursor-pointer"
                  >
                    Teletransportar al Refugio
                  </button>
                )}

                <div className="border-t border-white/10 pt-3">
                  <div className="text-xs font-bold text-cyan-300 mb-1.5">Habilidades Desbloqueadas</div>
                  {snap.player.perks.length === 0 ? (
                    <p className="text-xs text-slate-400">Completa misiones principales y de colección para desbloquear mejoras permanentes.</p>
                  ) : (
                    <ul className="space-y-1 text-xs text-emerald-300">
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
                      className={`rounded-xl border p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        claimed
                          ? 'bg-[#091319] border-emerald-500/30 opacity-65'
                          : ready
                          ? 'bg-[#10242e] border-cyan-400'
                          : 'bg-[#0c1823] border-slate-700/80'
                      }`}
                    >
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mb-0.5">
                          <span className={q.category === 'principal' ? 'text-amber-300 font-bold' : 'text-cyan-300 font-bold'}>
                            {q.category === 'principal' ? 'Principal' : 'Secundaria'}
                          </span>
                          <span>·</span>
                          <span className="tabular-nums">
                            {Math.min(prog, q.goal)} / {q.goal}
                          </span>
                          {q.extraConditions?.map((cond) => {
                            const extraVal = gameEngine.getQuestMetricValue(cond.metric);
                            return (
                              <span key={cond.metric} className="tabular-nums">
                                · {cond.label}: {Math.min(extraVal, cond.goal)}/{cond.goal}
                              </span>
                            );
                          })}
                        </div>
                        <div className="text-sm font-bold text-white">{q.title}</div>
                        <div className="text-xs text-slate-300 mt-0.5">{q.description}</div>
                        <div className="text-[11px] text-emerald-300 mt-1">Recompensa: {q.rewardText}</div>
                      </div>

                      <button
                        disabled={!ready}
                        onClick={() => gameEngine.claimQuest(q.id)}
                        className={`px-4 py-2 rounded-lg text-xs font-extrabold whitespace-nowrap cursor-pointer ${
                          claimed
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : ready
                            ? 'bg-cyan-400 text-slate-950 hover:bg-cyan-300'
                            : 'bg-slate-800 text-slate-400'
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
    </div>
  );
};
