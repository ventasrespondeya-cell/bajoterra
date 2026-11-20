import React, { useEffect, useRef, useState } from 'react';
import { Compass, Backpack, Pause, Volume2, VolumeX, Zap } from 'lucide-react';
import { BIOME_INFO, HOME_FOOD_DEFS, HOTBAR_SLOTS, QUEST_LIST, getFavoriteFoodForSpecies } from '../game/data';
import { getMoodLabel } from '../game/home';
import type { HudSnapshot, InventoryKey } from '../game/types';

interface GameHUDProps {
  snap: HudSnapshot;
  minimapRef: React.RefObject<HTMLCanvasElement | null>;
  onSelectHotbar: (idx: number) => void;
  onSelectParty: (idx: number) => void;
  onOpenExpedition: () => void;
  onOpenHome: () => void;
  onOpenMap: () => void;
  onOpenPause: () => void;
  onToggleSound: () => void;
  onAction: () => void;
  onPulse: () => void;
  onPetHomeSlug: (uid: string) => void;
  onFeedHomeSlug: (uid: string, foodKey: InventoryKey) => void;
  onPlayHomeSlug: (uid: string) => void;
  onJoystick: (x: number, y: number) => void;
  onTouchSprint: (active: boolean) => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  snap,
  minimapRef,
  onSelectHotbar,
  onSelectParty,
  onOpenExpedition,
  onOpenHome,
  onOpenMap,
  onOpenPause,
  onToggleSound,
  onAction,
  onPulse,
  onPetHomeSlug,
  onFeedHomeSlug,
  onPlayHomeSlug,
  onJoystick,
  onTouchSprint,
}) => {
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const stickRef = useRef<HTMLDivElement | null>(null);
  const [nubPos, setNubPos] = useState({ x: 0, y: 0 });
  const [sprintHeld, setSprintHeld] = useState(false);

  useEffect(() => {
    const check = () => {
      const coarse = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 860;
      setIsTouchDevice(coarse);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const showTouch =
    snap.options.touchControls === 'on' || (snap.options.touchControls === 'auto' && isTouchDevice);

  const biomeInfo = BIOME_INFO[snap.biome];
  const activeQuest = QUEST_LIST.find((q) => !snap.claimedQuests.includes(q.id));

  const updateStick = (clientX: number, clientY: number) => {
    const el = stickRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let dx = clientX - (rect.left + rect.width / 2);
    let dy = clientY - (rect.top + rect.height / 2);
    const maxR = 36;
    const dist = Math.hypot(dx, dy);
    if (dist > maxR) {
      dx = (dx / dist) * maxR;
      dy = (dy / dist) * maxR;
    }
    setNubPos({ x: dx, y: dy });
    onJoystick(dx / maxR, dy / maxR);
  };

  const resetStick = () => {
    setNubPos({ x: 0, y: 0 });
    onJoystick(0, 0);
  };

  const toolIcons: Record<string, string> = {
    mine: '⛏',
    torch: '🔥',
    wall: '🧱',
    floor: '🪵',
    door: '🚪',
    station: '⚡',
    berry: '🍓',
    pulse: '📡',
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-10 flex flex-col justify-between p-2.5 md:p-4">
      {/* Top Row: Compact Explorer Status + Minimap & Controls */}
      <div className="flex items-start justify-between gap-2">
        <div className="pointer-events-auto bg-[#0b151fd9] border border-slate-700/80 rounded-xl px-3 py-2 w-[235px] md:w-[270px]">
          <div className="flex items-center justify-between text-xs font-bold mb-1">
            <span className="text-cyan-300 truncate">{biomeInfo.name}</span>
            <span className="text-slate-300 tabular-nums">
              Nv.{snap.player.level} · {Math.round(snap.player.x)},{Math.round(snap.player.y)}
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px] mb-1">
            <span className="w-7 text-rose-300 font-semibold">PS</span>
            <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-400 transition-all duration-150"
                style={{ width: `${(snap.player.hp / snap.player.maxHp) * 100}%` }}
              />
            </div>
            <span className="tabular-nums text-slate-200 w-12 text-right">
              {Math.ceil(snap.player.hp)}/{snap.player.maxHp}
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px] mb-1.5">
            <span className="w-7 text-amber-300 font-semibold">EN</span>
            <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-400 transition-all duration-100"
                style={{ width: `${(snap.player.stamina / snap.player.maxStamina) * 100}%` }}
              />
            </div>
            <span className="tabular-nums text-slate-300 w-12 text-right">
              {Math.round(snap.player.stamina)}%
            </span>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-300 border-t border-white/10 pt-1 tabular-nums">
            <span>Min: {snap.inventory.ore}</span>
            <span>Mad: {snap.inventory.wood}</span>
            <span>Cris: {snap.inventory.crystal}</span>
            <span>Cil: {snap.inventory.capsules}</span>
          </div>

          {activeQuest && (
            <div className="mt-1.5 text-[11px] text-cyan-200/90 truncate border-t border-white/10 pt-1">
              Misión: {activeQuest.title}
            </div>
          )}
        </div>

        {/* Top-Right: Minimap + Action Icons */}
        <div className="pointer-events-auto flex flex-col items-end gap-2">
          <div className="flex items-center gap-1.5">
            <button
              onClick={onToggleSound}
              title={snap.options.soundEnabled ? 'Silenciar sonido' : 'Activar sonido'}
              className="w-10 h-10 rounded-xl bg-[#0b151fd9] border border-slate-700 hover:border-cyan-400 flex items-center justify-center text-slate-200 cursor-pointer"
            >
              {snap.options.soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
            </button>
            <button
              onClick={onOpenMap}
              title="Mapa completo (M)"
              className="h-10 px-3 rounded-xl bg-[#0b151fd9] border border-slate-700 hover:border-cyan-400 flex items-center gap-1.5 text-xs font-bold text-slate-100 cursor-pointer"
            >
              <Compass className="w-4 h-4 text-cyan-300" />
              <span className="hidden sm:inline">Mapa</span>
            </button>
            <button
              onClick={onOpenExpedition}
              title="Estuche, Inventario y Misiones (I)"
              className="h-10 px-3 rounded-xl bg-[#0b151fd9] border border-slate-700 hover:border-cyan-400 flex items-center gap-1.5 text-xs font-bold text-slate-100 cursor-pointer"
            >
              <Backpack className="w-4 h-4 text-amber-300" />
              <span className="hidden sm:inline">Estuche</span>
            </button>
            <button
              onClick={onOpenPause}
              title="Pausa y Opciones (Esc)"
              className="w-10 h-10 rounded-xl bg-[#0b151fd9] border border-slate-700 hover:border-cyan-400 flex items-center justify-center text-slate-100 cursor-pointer"
            >
              <Pause className="w-4 h-4" />
            </button>
          </div>

          {snap.options.showMinimap && (
            <button
              onClick={onOpenMap}
              title="Abrir mapa completo"
              className="rounded-xl overflow-hidden border border-cyan-400/40 bg-[#07111a] shadow-lg cursor-pointer hover:border-cyan-300 transition-colors"
            >
              <canvas
                ref={minimapRef}
                width={120}
                height={120}
                className="w-[96px] h-[96px] md:w-[120px] md:h-[120px] block pixelated"
              />
            </button>
          )}
        </div>
      </div>

      {/* Toast message */}
      {snap.toast && (
        <div className="mx-auto px-4 py-2 rounded-lg bg-[#09131ee8] border border-cyan-400/50 text-xs md:text-sm font-semibold text-cyan-100 shadow-xl">
          {snap.toast}
        </div>
      )}

      {/* Bottom Row: Optional Nearby Home Slug Prompt + Party Strip + Hotbar + Optional Touch Controls */}
      <div className="flex flex-col gap-2">
        {snap.nearbyHomeSlug && (() => {
          const near = snap.nearbyHomeSlug;
          const fav = getFavoriteFoodForSpecies(near.slug.id);
          const bestFood =
            (snap.inventory[fav.key] || 0) > 0
              ? fav
              : HOME_FOOD_DEFS.find((f) => (snap.inventory[f.key] || 0) > 0) || fav;
          const bestQty = snap.inventory[bestFood.key] || 0;
          return (
            <div className="pointer-events-auto mx-auto bg-[#0b151fe8] border border-cyan-400/50 rounded-xl px-3 py-2 flex flex-wrap items-center justify-center gap-2 shadow-lg">
              <div className="text-xs font-bold text-white flex items-center gap-1.5 mr-1">
                <span>{near.slug.icon}</span>
                <span>{near.slug.name}</span>
                <span className="text-[11px] text-cyan-300">({getMoodLabel(near.mood)})</span>
                <span className="text-[11px] text-amber-300 tabular-nums">♥ {near.slug.bond}/100</span>
              </div>
              <button
                onClick={() => onPetHomeSlug(near.slug.uid)}
                className="min-h-[38px] px-3 py-1.5 rounded-lg bg-pink-500/25 border border-pink-400/60 text-pink-100 text-xs font-bold hover:bg-pink-500/35 cursor-pointer"
              >
                Acariciar
              </button>
              <button
                disabled={bestQty <= 0}
                onClick={() => onFeedHomeSlug(near.slug.uid, bestFood.key)}
                className="min-h-[38px] px-3 py-1.5 rounded-lg bg-emerald-500/25 border border-emerald-400/60 text-emerald-100 text-xs font-bold hover:bg-emerald-500/35 disabled:opacity-40 cursor-pointer"
              >
                Dar {bestFood.label} ({bestQty})
              </button>
              <button
                onClick={() => onPlayHomeSlug(near.slug.uid)}
                className="min-h-[38px] px-3 py-1.5 rounded-lg bg-amber-500/25 border border-amber-400/60 text-amber-100 text-xs font-bold hover:bg-amber-500/35 cursor-pointer"
              >
                Jugar
              </button>
              <button
                onClick={onOpenHome}
                className="min-h-[38px] px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-600 text-slate-200 text-xs font-bold hover:text-white cursor-pointer"
              >
                Hogar
              </button>
            </div>
          );
        })()}

        {showTouch && (
          <div className="flex items-end justify-between px-1 mb-1">
            {/* Virtual Joystick */}
            <div
              ref={stickRef}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                updateStick(e.clientX, e.clientY);
              }}
              onPointerMove={(e) => {
                if (e.buttons > 0) updateStick(e.clientX, e.clientY);
              }}
              onPointerUp={resetStick}
              onPointerCancel={resetStick}
              className="pointer-events-auto relative w-28 h-28 rounded-full border-2 border-cyan-300/40 bg-[#0b1824a8] touch-none"
            >
              <div
                className="absolute w-11 h-11 rounded-full bg-cyan-300/75 border-2 border-white left-1/2 top-1/2 -ml-[22px] -mt-[22px]"
                style={{ transform: `translate(${nubPos.x}px, ${nubPos.y}px)` }}
              />
            </div>

            {/* Mobile Action Buttons (>= 48px touch targets) */}
            <div className="pointer-events-auto grid grid-cols-2 gap-2">
              <button
                onPointerDown={() => {
                  setSprintHeld(true);
                  onTouchSprint(true);
                }}
                onPointerUp={() => {
                  setSprintHeld(false);
                  onTouchSprint(false);
                }}
                onPointerCancel={() => {
                  setSprintHeld(false);
                  onTouchSprint(false);
                }}
                className={`w-14 h-14 rounded-2xl border font-bold text-xs flex flex-col items-center justify-center ${
                  sprintHeld
                    ? 'bg-amber-400 text-slate-950 border-white'
                    : 'bg-[#0b1824d9] text-slate-100 border-slate-600'
                }`}
              >
                <span>Correr</span>
              </button>
              <button
                onClick={onPulse}
                className="w-14 h-14 rounded-2xl bg-[#0b1824d9] border border-cyan-400/70 text-cyan-200 font-bold text-xs flex flex-col items-center justify-center"
              >
                <Zap className="w-4 h-4 mb-0.5" />
                <span>Pulso</span>
              </button>
              <button
                onClick={onOpenExpedition}
                className="w-14 h-14 rounded-2xl bg-[#0b1824d9] border border-slate-600 text-slate-100 font-bold text-xs flex items-center justify-center"
              >
                Estuche
              </button>
              <button
                onClick={onAction}
                className="w-14 h-14 rounded-2xl bg-cyan-400 text-slate-950 border border-white font-extrabold text-xs flex items-center justify-center shadow-lg"
              >
                Usar
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-end justify-between gap-2">
          {/* Active Party Strip */}
          <div className="pointer-events-auto flex items-center gap-1.5 bg-[#0b151fd9] border border-slate-700/80 rounded-xl p-1.5">
            {snap.party.map((s, idx) => {
              const active = idx === snap.activePartyIndex;
              return (
                <button
                  key={s.uid}
                  onClick={() => onSelectParty(idx)}
                  title={`${s.name} Nv.${s.level} (${s.type}) · ${s.hp}/${s.maxHp} PS`}
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-left transition-colors cursor-pointer min-h-[40px] ${
                    active
                      ? 'bg-cyan-500/20 border-cyan-400 text-white'
                      : 'bg-slate-900/70 border-slate-700/70 text-slate-300 hover:border-slate-500'
                  } ${s.hp <= 0 ? 'opacity-45' : ''}`}
                >
                  <span className="text-base leading-none">{s.icon}</span>
                  <div className="hidden md:block leading-tight">
                    <div className="text-[11px] font-bold truncate max-w-[74px]">
                      {s.name}
                      {s.mega ? ' ★' : ''}
                    </div>
                    <div className="text-[10px] text-slate-300 tabular-nums">
                      Nv.{s.level} · {s.hp}/{s.maxHp}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* 8-Slot Hotbar */}
          <div className="pointer-events-auto flex items-center gap-1 bg-[#0b151fd9] border border-slate-700/80 rounded-xl p-1.5 overflow-x-auto max-w-full">
            {HOTBAR_SLOTS.map((slot, idx) => {
              const selected = snap.selectedHotbar === idx;
              const qty = slot.itemKey ? snap.inventory[slot.itemKey] : null;
              return (
                <button
                  key={slot.id}
                  onClick={() => {
                    onSelectHotbar(idx);
                    if (slot.id === 'pulse') onPulse();
                  }}
                  title={`${slot.label} (${slot.keyHint})`}
                  className={`relative flex flex-col items-center justify-center min-w-[46px] h-[46px] px-1.5 rounded-lg border transition-colors cursor-pointer ${
                    selected
                      ? 'bg-cyan-400/25 border-cyan-300 text-white'
                      : 'bg-slate-900/75 border-slate-700/70 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  <span className="absolute top-0.5 left-1 text-[9px] text-slate-400 tabular-nums">
                    {slot.keyHint}
                  </span>
                  <span className="text-base leading-none mt-1">{toolIcons[slot.id]}</span>
                  <span className="text-[9px] font-semibold mt-0.5 truncate max-w-[44px]">{slot.label}</span>
                  {qty !== null && (
                    <span className="absolute top-0.5 right-1 text-[10px] font-bold text-amber-300 tabular-nums">
                      {qty}
                    </span>
                  )}
                  {slot.id === 'pulse' && snap.pulseCooldownPct < 1 && (
                    <span
                      className="absolute inset-x-0 bottom-0 h-1 bg-cyan-400/80 rounded-b"
                      style={{ width: `${snap.pulseCooldownPct * 100}%` }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
