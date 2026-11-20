import React, { useEffect, useRef, useState } from 'react';
import { Backpack, Compass, Heart, Home, Pause, Sparkles, Volume2, VolumeX, Zap } from 'lucide-react';
import { BIOME_INFO, HOME_FOOD_DEFS, HOTBAR_SLOTS, QUEST_LIST, getFavoriteFoodForSpecies } from '../game/data';
import { getMoodLabel } from '../game/home';
import { getBondTierInfo } from '../game/progression';
import type { HudSnapshot, InventoryKey } from '../game/types';
import { ToolIcon } from './GameIcons';
import { SlugPortrait } from './SlugPortrait';

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

  const hpPct = Math.max(0, Math.min(100, (snap.player.hp / Math.max(1, snap.player.maxHp)) * 100));
  const staminaPct = Math.max(
    0,
    Math.min(100, (snap.player.stamina / Math.max(1, snap.player.maxStamina)) * 100)
  );

  return (
    <div
      className="pointer-events-none fixed inset-0 z-10 flex flex-col justify-between p-2 sm:p-3.5 md:p-4"
      style={{
        paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
      }}
    >
      {/* Top Row: Explorer Telemetry + Command Cluster & Minimap */}
      <div className="flex items-start justify-between gap-2">
        <div className="pointer-events-auto bt-hud-panel rounded-xl px-3 py-2 w-[200px] sm:w-[264px] md:w-[280px]">
          <div className="flex items-center justify-between text-xs font-bold mb-1.5 gap-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: biomeInfo.accent, boxShadow: `0 0 8px ${biomeInfo.accent}` }}
              />
              <span className="text-white truncate">{biomeInfo.name}</span>
            </div>
            <span className="text-[11px] text-teal-300 font-bold tabular-nums shrink-0">
              Nv.{snap.player.level} · {Math.round(snap.player.x)},{Math.round(snap.player.y)}
            </span>
          </div>

          {/* HP Gauge */}
          <div className="flex items-center gap-1.5 text-[11px] mb-1">
            <span className="w-6 text-emerald-300 font-extrabold tracking-tight">PS</span>
            <div className="flex-1 h-2 bg-[#060d14] border border-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-300 transition-all duration-150"
                style={{ width: `${hpPct}%` }}
              />
            </div>
            <span className="tabular-nums text-slate-100 font-semibold w-12 text-right">
              {Math.ceil(snap.player.hp)}/{snap.player.maxHp}
            </span>
          </div>

          {/* Stamina Gauge */}
          <div className="flex items-center gap-1.5 text-[11px] mb-1.5">
            <span className="w-6 text-amber-300 font-extrabold tracking-tight">EN</span>
            <div className="flex-1 h-1.5 bg-[#060d14] border border-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-yellow-300 transition-all duration-100"
                style={{ width: `${staminaPct}%` }}
              />
            </div>
            <span className="tabular-nums text-slate-300 w-12 text-right">
              {Math.round(snap.player.stamina)}%
            </span>
          </div>

          {/* Compact Resource Ticker */}
          <div className="grid grid-cols-4 gap-1 text-[10px] sm:text-[11px] text-slate-200 border-t border-cyan-400/15 pt-1.5 tabular-nums">
            <span title="Minerales">
              <span className="text-amber-300 font-bold">M</span> {snap.inventory.ore}
            </span>
            <span title="Madera">
              <span className="text-orange-300 font-bold">Md</span> {snap.inventory.wood}
            </span>
            <span title="Cristales">
              <span className="text-teal-300 font-bold">Cr</span> {snap.inventory.crystal}
            </span>
            <span title="Cilindros">
              <span className="text-sky-300 font-bold">Cil</span> {snap.inventory.capsules}
            </span>
          </div>

          {activeQuest && (
            <div className="mt-1.5 text-[10px] sm:text-[11px] text-amber-200/95 truncate border-t border-cyan-400/15 pt-1 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-300 shrink-0" />
              <span className="truncate">{activeQuest.title}</span>
            </div>
          )}
        </div>

        {/* Top-Right: Command Bar + Minimap */}
        <div className="pointer-events-auto flex flex-col items-end gap-2">
          <div className="flex items-center gap-1.5">
            <button
              onClick={onToggleSound}
              aria-label={snap.options.soundEnabled ? 'Silenciar sonido' : 'Activar sonido'}
              title={snap.options.soundEnabled ? 'Silenciar sonido' : 'Activar sonido'}
              className="bt-btn-secondary w-11 h-11 rounded-xl flex items-center justify-center cursor-pointer"
            >
              {snap.options.soundEnabled ? (
                <Volume2 className="w-4 h-4 text-teal-300" />
              ) : (
                <VolumeX className="w-4 h-4 text-slate-400" />
              )}
            </button>
            <button
              onClick={onOpenMap}
              title="Mapa completo (M)"
              className="bt-btn-secondary h-11 px-3 rounded-xl flex items-center gap-1.5 text-xs font-bold cursor-pointer"
            >
              <Compass className="w-4 h-4 text-cyan-300" />
              <span className="hidden sm:inline">Mapa</span>
            </button>
            <button
              onClick={onOpenExpedition}
              title="Estuche, Inventario y Misiones (I)"
              className="bt-btn-secondary h-11 px-3 rounded-xl flex items-center gap-1.5 text-xs font-bold cursor-pointer"
            >
              <Backpack className="w-4 h-4 text-amber-300" />
              <span className="hidden sm:inline">Estuche</span>
            </button>
            <button
              onClick={onOpenPause}
              aria-label="Pausa y Opciones"
              title="Pausa y Opciones (Esc)"
              className="bt-btn-secondary w-11 h-11 rounded-xl flex items-center justify-center cursor-pointer"
            >
              <Pause className="w-4 h-4 text-slate-100" />
            </button>
          </div>

          {snap.options.showMinimap && (
            <button
              onClick={onOpenMap}
              title="Abrir mapa completo"
              className="bt-hud-panel rounded-xl p-1 cursor-pointer hover:border-teal-300/70 transition-colors"
            >
              <canvas
                ref={minimapRef}
                width={120}
                height={120}
                className="w-[84px] h-[84px] sm:w-[116px] sm:h-[116px] block rounded-lg pixelated"
              />
            </button>
          )}
        </div>
      </div>

      {/* Central Toast Notification */}
      {snap.toast && (
        <div className="mx-auto px-4 py-2 rounded-xl bt-hud-panel border-teal-300/50 text-xs sm:text-sm font-bold text-teal-100 shadow-2xl max-w-[92vw] text-center">
          {snap.toast}
        </div>
      )}

      {/* Bottom Dock: Nearby Home Slug Prompt + Touch Controls + Party Strip & Hotbar */}
      <div className="flex flex-col gap-2">
        {snap.nearbyHomeSlug &&
          (() => {
            const near = snap.nearbyHomeSlug;
            const fav = getFavoriteFoodForSpecies(near.slug.id);
            const bestFood =
              (snap.inventory[fav.key] || 0) > 0
                ? fav
                : HOME_FOOD_DEFS.find((f) => (snap.inventory[f.key] || 0) > 0) || fav;
            const bestQty = snap.inventory[bestFood.key] || 0;
            const bondTier = getBondTierInfo(near.slug.bond);
            return (
              <div className="pointer-events-auto mx-auto bt-hud-panel rounded-xl px-3 py-2 flex flex-wrap items-center justify-center gap-2 max-w-full">
                <div className="flex items-center gap-2 mr-1">
                  <SlugPortrait speciesId={near.slug.id} mega={near.slug.mega} mood="happy" size={34} />
                  <div className="leading-tight text-xs">
                    <div className="font-extrabold text-white flex items-center gap-1.5">
                      <span>{near.slug.name}</span>
                      <span className="text-[11px] font-semibold text-teal-300">· {getMoodLabel(near.mood)}</span>
                    </div>
                    <div className="text-[11px] text-amber-300 tabular-nums flex items-center gap-1">
                      <Heart className="w-3 h-3 fill-current text-pink-400" />
                      <span>
                        {near.slug.bond}/100 · {bondTier.label}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => onPetHomeSlug(near.slug.uid)}
                  className="min-h-[40px] px-3 py-1.5 rounded-lg bg-pink-500/20 border border-pink-400/55 text-pink-100 text-xs font-bold hover:bg-pink-500/35 cursor-pointer"
                >
                  Acariciar
                </button>
                <button
                  disabled={bestQty <= 0}
                  onClick={() => onFeedHomeSlug(near.slug.uid, bestFood.key)}
                  className="min-h-[40px] px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-400/55 text-emerald-100 text-xs font-bold hover:bg-emerald-500/35 disabled:opacity-40 cursor-pointer"
                >
                  Dar {bestFood.label} ({bestQty})
                </button>
                <button
                  onClick={() => onPlayHomeSlug(near.slug.uid)}
                  className="min-h-[40px] px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-400/55 text-amber-100 text-xs font-bold hover:bg-amber-500/35 cursor-pointer"
                >
                  Jugar
                </button>
                <button
                  onClick={onOpenHome}
                  className="bt-btn-secondary min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Home className="w-3.5 h-3.5 text-teal-300" />
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
              className="pointer-events-auto relative w-28 h-28 rounded-full border-2 border-teal-300/45 bg-[#08131ecc] touch-none shadow-lg"
            >
              <div className="absolute inset-3 rounded-full border border-white/10 pointer-events-none" />
              <div
                className="absolute w-11 h-11 rounded-full bg-gradient-to-b from-teal-300 to-cyan-500 border-2 border-white/90 left-1/2 top-1/2 -ml-[22px] -mt-[22px] shadow-md"
                style={{ transform: `translate(${nubPos.x}px, ${nubPos.y}px)` }}
              />
            </div>

            {/* Mobile Action Buttons (>= 52px touch targets) */}
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
                    ? 'bt-btn-amber'
                    : 'bt-btn-secondary'
                }`}
              >
                <span>Correr</span>
              </button>
              <button
                onClick={onPulse}
                className="w-14 h-14 rounded-2xl bt-btn-secondary border-teal-400/60 text-teal-200 font-bold text-xs flex flex-col items-center justify-center"
              >
                <Zap className="w-4 h-4 mb-0.5 text-teal-300" />
                <span>Pulso</span>
              </button>
              <button
                onClick={onOpenExpedition}
                className="w-14 h-14 rounded-2xl bt-btn-secondary font-bold text-xs flex items-center justify-center"
              >
                Estuche
              </button>
              <button
                onClick={onAction}
                className="w-14 h-14 rounded-2xl bt-btn-primary font-extrabold text-xs flex items-center justify-center"
              >
                Usar
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-end justify-between gap-2">
          {/* Active Party Strip */}
          <div className="pointer-events-auto bt-hud-panel flex items-center gap-1.5 rounded-xl p-1.5">
            {snap.party.map((s, idx) => {
              const active = idx === snap.activePartyIndex;
              const slugHpPct = Math.max(0, Math.min(100, (s.hp / Math.max(1, s.maxHp)) * 100));
              return (
                <button
                  key={s.uid}
                  onClick={() => onSelectParty(idx)}
                  title={`${s.name} Nv.${s.level} (${s.type}) · ${s.hp}/${s.maxHp} PS`}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-left transition-colors cursor-pointer min-h-[44px] ${
                    active
                      ? 'bg-teal-400/20 border-teal-300 text-white shadow-[0_0_12px_rgba(45,212,191,0.25)]'
                      : 'bg-[#08121d]/80 border-slate-700/70 text-slate-300 hover:border-cyan-400/50'
                  } ${s.hp <= 0 ? 'opacity-45' : ''}`}
                >
                  <SlugPortrait
                    speciesId={s.id}
                    mega={s.mega}
                    mood={s.hp <= 0 ? 'ko' : active ? 'happy' : 'idle'}
                    size={30}
                  />
                  <div className="hidden md:block leading-tight min-w-[66px]">
                    <div className="text-[11px] font-extrabold truncate max-w-[78px] flex items-center gap-1">
                      <span className="truncate">{s.name}</span>
                      {s.mega && <span className="text-amber-300">★</span>}
                    </div>
                    <div className="text-[10px] text-slate-300 tabular-nums">
                      Nv.{s.level} · {s.hp}/{s.maxHp}
                    </div>
                    <div className="h-1 bg-slate-800 rounded-full overflow-hidden mt-0.5">
                      <div
                        className="h-full bg-emerald-400"
                        style={{ width: `${slugHpPct}%` }}
                      />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* 8-Slot Hotbar */}
          <div className="pointer-events-auto bt-hud-panel flex items-center gap-1 rounded-xl p-1.5 overflow-x-auto max-w-full bt-scroll">
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
                  className={`relative flex flex-col items-center justify-center min-w-[46px] h-[48px] px-1.5 rounded-lg border transition-colors cursor-pointer shrink-0 ${
                    selected
                      ? 'bg-teal-400/20 border-teal-300 text-white shadow-[0_0_12px_rgba(45,212,191,0.22)]'
                      : 'bg-[#08121d]/85 border-slate-700/70 text-slate-300 hover:border-cyan-400/50'
                  }`}
                >
                  <span className="absolute top-0.5 left-1 text-[9px] font-bold text-slate-400 tabular-nums">
                    {slot.keyHint}
                  </span>
                  <div className="mt-1">
                    <ToolIcon action={slot.id} className="w-4 h-4" />
                  </div>
                  <span className="text-[9px] font-bold mt-0.5 truncate max-w-[44px]">{slot.label}</span>
                  {qty !== null && (
                    <span className="absolute top-0.5 right-1 text-[10px] font-extrabold text-amber-300 tabular-nums">
                      {qty}
                    </span>
                  )}
                  {slot.id === 'pulse' && snap.pulseCooldownPct < 1 && (
                    <span
                      className="absolute inset-x-0 bottom-0 h-1 bg-teal-400/85 rounded-b"
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
