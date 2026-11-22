import React, { useEffect, useRef, useState } from 'react';
import {
  Backpack,
  ChevronUp,
  Compass,
  DoorOpen,
  Hand,
  Heart,
  Home,
  MessageCircle,
  PackageOpen,
  Pause,
  Pickaxe,
  Radar,
  Sparkles,
  Swords,
  Volume2,
  VolumeX,
  Wrench,
  Zap,
} from 'lucide-react';
import { BIOME_INFO, HOME_FOOD_DEFS, HOTBAR_SLOTS, QUEST_LIST, getFavoriteFoodForSpecies } from '../game/data';
import { getMoodLabel } from '../game/home';
import { getBondTierInfo, getSlugDisplayName } from '../game/progression';
import type { ExplorationActionKind, HudSnapshot, InventoryKey } from '../game/types';
import { ToolIcon } from './GameIcons';
import { SlugColumn } from './SlugColumn';
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
  onToggleMecha: () => void;
  onAction: () => void;
  onPulse: () => void;
  onPetHomeSlug: (uid: string) => void;
  onFeedHomeSlug: (uid: string, foodKey: InventoryKey) => void;
  onPlayHomeSlug: (uid: string) => void;
  onJoystick: (x: number, y: number) => void;
  onTouchSprint: (active: boolean) => void;
}

function renderContextualIcon(kind: ExplorationActionKind, activeToolId: string) {
  switch (kind) {
    case 'talk':
      return <MessageCircle className="w-5 h-5" />;
    case 'combat':
      return <Swords className="w-5 h-5" />;
    case 'open_door':
    case 'close_door':
      return <DoorOpen className="w-5 h-5" />;
    case 'open_chest':
      return <PackageOpen className="w-5 h-5" />;
    case 'recharge':
      return <Zap className="w-5 h-5" />;
    case 'altar':
      return <Sparkles className="w-5 h-5" />;
    case 'interact_slug':
      return <Heart className="w-5 h-5" />;
    case 'pickup_furniture':
    case 'gather':
      return <Hand className="w-5 h-5" />;
    case 'pulse':
      return <Radar className="w-5 h-5" />;
    case 'mine':
    case 'extract':
      return <Pickaxe className="w-5 h-5" />;
    case 'place':
    case 'berry':
      return <ToolIcon action={activeToolId as never} className="w-5 h-5" />;
    default:
      return <ToolIcon action={activeToolId as never} className="w-5 h-5 opacity-70" />;
  }
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
  onToggleMecha,
  onAction,
  onPulse,
  onPetHomeSlug,
  onFeedHomeSlug,
  onPlayHomeSlug,
  onJoystick,
  onTouchSprint,
}) => {
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [toolMenuOpen, setToolMenuOpen] = useState(false);
  const [nubPos, setNubPos] = useState({ x: 0, y: 0 });
  const stickRef = useRef<HTMLDivElement | null>(null);
  const stickPointerIdRef = useRef<number | null>(null);
  const toolSelectorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!toolMenuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (toolSelectorRef.current && !toolSelectorRef.current.contains(e.target as Node)) {
        setToolMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setToolMenuOpen(false);
      }
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [toolMenuOpen]);

  useEffect(() => {
    const check = () => {
      const coarse =
        window.matchMedia('(pointer: coarse)').matches ||
        window.innerWidth < 860 ||
        navigator.maxTouchPoints > 0;
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
  const activeSlot = HOTBAR_SLOTS[snap.selectedHotbar] || HOTBAR_SLOTS[0];
  const activeQty = activeSlot.itemKey ? snap.inventory[activeSlot.itemKey] : null;
  const ctxAction = snap.contextualAction;

  const updateStick = (clientX: number, clientY: number) => {
    const el = stickRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let dx = clientX - (rect.left + rect.width / 2);
    let dy = clientY - (rect.top + rect.height / 2);
    const maxR = Math.max(28, rect.width * 0.34);
    const dist = Math.hypot(dx, dy);
    const sprintActive = dist >= maxR * 0.88;
    if (dist > maxR) {
      dx = (dx / dist) * maxR;
      dy = (dy / dist) * maxR;
    }
    setNubPos({ x: dx, y: dy });
    onTouchSprint(sprintActive);
    if (dist < 4) {
      onJoystick(0, 0);
    } else {
      onJoystick(dx / maxR, dy / maxR);
    }
  };

  const resetStick = () => {
    stickPointerIdRef.current = null;
    setNubPos({ x: 0, y: 0 });
    onTouchSprint(false);
    onJoystick(0, 0);
  };

  const hpPct = Math.max(0, Math.min(100, (snap.player.hp / Math.max(1, snap.player.maxHp)) * 100));
  const staminaPct = Math.max(
    0,
    Math.min(100, (snap.player.stamina / Math.max(1, snap.player.maxStamina)) * 100)
  );

  return (
    <div
      className="pointer-events-none fixed inset-0 z-10 flex flex-col justify-between p-2.5 sm:p-3.5 md:p-4"
      style={{
        paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
        paddingLeft: 'max(0.5rem, env(safe-area-inset-left))',
        paddingRight: 'max(0.5rem, env(safe-area-inset-right))',
      }}
    >
      {/* TOP BAR: Compact Telemetry Left | Grouped Command Icons & Minimap Right */}
      <div className="flex items-start justify-between gap-1.5 sm:gap-2">
        {/* Top-Left: Explorer Vital Telemetry */}
        <div className="pointer-events-auto bt-hud-panel rounded-xl px-2 py-2 sm:px-3 flex-1 min-w-0 max-w-[172px] min-[420px]:max-w-[196px] sm:flex-none sm:w-[248px] sm:max-w-none">
          <div className="flex items-center justify-between text-[11px] sm:text-xs font-bold mb-1.5 gap-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: biomeInfo.accent, boxShadow: `0 0 8px ${biomeInfo.accent}` }}
              />
              <span className="text-white truncate">{biomeInfo.name}</span>
            </div>
            <span className="text-[10px] sm:text-[11px] text-teal-300 font-bold tabular-nums shrink-0">
              Nv.{snap.player.level}
            </span>
          </div>

          {/* HP Gauge */}
          <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] mb-1">
            <span className="w-5 text-emerald-300 font-extrabold">PS</span>
            <div className="flex-1 h-2 bg-[#050b12] border border-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-300 transition-all duration-150"
                style={{ width: `${hpPct}%` }}
              />
            </div>
            <span className="tabular-nums text-slate-100 font-semibold w-11 text-right">
              {Math.ceil(snap.player.hp)}/{snap.player.maxHp}
            </span>
          </div>

          {/* Stamina Gauge */}
          <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] mb-1.5">
            <span className="w-5 text-amber-300 font-extrabold">EN</span>
            <div className="flex-1 h-1.5 bg-[#050b12] border border-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-yellow-300 transition-all duration-100"
                style={{ width: `${staminaPct}%` }}
              />
            </div>
            <span className="tabular-nums text-slate-300 w-11 text-right">
              {Math.round(snap.player.stamina)}%
            </span>
          </div>

          {/* Minimal Campaign & Supply Ticker */}
          <div className="grid grid-cols-4 gap-1 text-[10px] text-slate-200 border-t border-cyan-400/15 pt-1 tabular-nums">
            <span title="Fichas de Caverna">
              <span className="text-amber-300 font-bold">Fch</span> {snap.cavernTokens}
            </span>
            <span title="Cilindros de Captura">
              <span className="text-sky-300 font-bold">Cil</span> {snap.inventory.capsules}
            </span>
            <span title="Bayas">
              <span className="text-emerald-300 font-bold">Bay</span> {snap.inventory.berries}
            </span>
            <span title="Cristales de Energía">
              <span className="text-teal-300 font-bold">Cr</span> {snap.inventory.crystal}
            </span>
          </div>

          {(snap.story || activeQuest) && (
            <div className="mt-1 text-[10px] text-amber-200/95 truncate border-t border-cyan-400/15 pt-1 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-300 shrink-0" />
              <span className="truncate">
                {snap.story
                  ? `Cap.${snap.story.currentChapterOrder} · ${snap.story.mainObjectiveText}`
                  : activeQuest?.title}
              </span>
            </div>
          )}
        </div>

        {/* Top-Right: Grouped Menu Access + Compact Minimap */}
        <div className="pointer-events-auto flex flex-col items-end gap-2 shrink-0">
          <div className="bt-hud-panel rounded-xl p-1 flex items-center gap-0.5 min-[420px]:gap-1">
            <button
              onClick={onOpenExpedition}
              title="Campaña, Estuche y Babosas (I)"
              aria-label="Campaña y Estuche"
              className="bt-btn-secondary w-8 h-8 min-[420px]:w-9 min-[420px]:h-9 md:w-auto md:px-2.5 rounded-lg flex items-center justify-center gap-1.5 text-xs font-bold cursor-pointer whitespace-nowrap"
            >
              <Backpack className="w-4 h-4 text-amber-300" />
              <span className="hidden md:inline">Campaña</span>
            </button>
            <button
              onClick={onOpenHome}
              title="Hogar y Hábitats"
              aria-label="Hogar y Hábitats"
              className="bt-btn-secondary w-8 h-8 min-[420px]:w-9 min-[420px]:h-9 md:w-auto md:px-2.5 rounded-lg flex items-center justify-center gap-1.5 text-xs font-bold cursor-pointer whitespace-nowrap"
            >
              <Home className="w-4 h-4 text-emerald-300" />
              <span className="hidden md:inline">Hogar</span>
            </button>
            {snap.mecha.unlocked && (
              <button
                onClick={onToggleMecha}
                title={snap.mecha.active ? 'Desmontar Meca' : 'Montar Meca'}
                aria-label={snap.mecha.active ? 'Desmontar Meca' : 'Montar Meca'}
                className={`w-8 h-8 min-[420px]:w-9 min-[420px]:h-9 md:w-auto md:px-2.5 rounded-lg flex items-center justify-center gap-1.5 text-xs font-bold cursor-pointer whitespace-nowrap ${
                  snap.mecha.active ? 'bt-btn-amber' : 'bt-btn-secondary'
                }`}
              >
                <Zap className="w-4 h-4 shrink-0" />
                <span className="hidden md:inline">{snap.mecha.active ? 'Meca ON' : 'Meca'}</span>
              </button>
            )}
            <button
              onClick={onOpenMap}
              title="Mapa del subsuelo (M)"
              aria-label="Mapa"
              className="bt-btn-secondary w-8 h-8 min-[420px]:w-9 min-[420px]:h-9 md:w-auto md:px-2.5 rounded-lg flex items-center justify-center gap-1.5 text-xs font-bold cursor-pointer whitespace-nowrap"
            >
              <Compass className="w-4 h-4 text-cyan-300" />
              <span className="hidden md:inline">Mapa</span>
            </button>
            <button
              onClick={onToggleSound}
              aria-label={snap.options.soundEnabled ? 'Silenciar sonido' : 'Activar sonido'}
              title={snap.options.soundEnabled ? 'Silenciar sonido' : 'Activar sonido'}
              className="bt-btn-secondary w-8 h-8 min-[420px]:w-9 min-[420px]:h-9 rounded-lg flex items-center justify-center cursor-pointer"
            >
              {snap.options.soundEnabled ? (
                <Volume2 className="w-4 h-4 text-teal-300" />
              ) : (
                <VolumeX className="w-4 h-4 text-slate-400" />
              )}
            </button>
            <button
              onClick={onOpenPause}
              aria-label="Opciones y Pausa"
              title="Opciones y Pausa (Esc)"
              className="bt-btn-secondary w-8 h-8 min-[420px]:w-9 min-[420px]:h-9 rounded-lg flex items-center justify-center cursor-pointer"
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
                className="w-[74px] h-[74px] sm:w-[104px] sm:h-[104px] block rounded-lg pixelated"
              />
            </button>
          )}
        </div>
      </div>

      {/* MIDDLE AREA: Toast + Right-Side Vertical Slug Column */}
      <div className="flex-1 min-h-0 flex items-center justify-between gap-2 my-1">
        <div className="flex-1 flex flex-col items-center justify-start self-start pt-1">
          {snap.toast && (
            <div className="px-3.5 py-1.5 rounded-xl bt-hud-panel border-teal-300/50 text-xs sm:text-sm font-bold text-teal-100 shadow-2xl max-w-[82vw] text-center">
              {snap.toast}
            </div>
          )}
        </div>

        {/* Right Edge: Slug It Out 2 Inspired Vertical Slug Case */}
        <SlugColumn
          party={snap.party}
          activeIndex={snap.activePartyIndex}
          onSelectSlug={onSelectParty}
          className="my-auto"
        />
      </div>

      {/* BOTTOM AREA: Home Slug Contextual Care + Virtual Joystick (Left) + Action & Tool Selector (Right) */}
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
              <div className="pointer-events-auto mx-auto bt-hud-panel rounded-xl px-3 py-1.5 flex flex-wrap items-center justify-center gap-2 max-w-full">
                <div className="flex items-center gap-2">
                  <SlugPortrait speciesId={near.slug.id} mega={near.slug.mega} mood="happy" size={32} />
                  <div className="leading-tight text-xs">
                    <div className="font-extrabold text-white flex items-center gap-1.5">
                      <span>{getSlugDisplayName(near.slug)}</span>
                      <span className="text-[11px] font-semibold text-teal-300">
                        · {getMoodLabel(near.mood)}
                      </span>
                    </div>
                    <div className="text-[10px] text-amber-300 tabular-nums flex items-center gap-1">
                      <Heart className="w-3 h-3 fill-current text-pink-400" />
                      <span>
                        {near.slug.bond}/100 · {bondTier.label}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={() => onPetHomeSlug(near.slug.uid)}
                    className="min-h-[38px] px-2.5 py-1 rounded-lg bg-pink-500/20 border border-pink-400/55 text-pink-100 text-xs font-bold hover:bg-pink-500/35 cursor-pointer"
                  >
                    Acariciar
                  </button>
                  <button
                    disabled={bestQty <= 0}
                    onClick={() => onFeedHomeSlug(near.slug.uid, bestFood.key)}
                    className="min-h-[38px] px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/55 text-emerald-100 text-xs font-bold hover:bg-emerald-500/35 disabled:opacity-40 cursor-pointer"
                  >
                    {bestFood.label} ({bestQty})
                  </button>
                  <button
                    onClick={() => onPlayHomeSlug(near.slug.uid)}
                    className="min-h-[38px] px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-400/55 text-amber-100 text-xs font-bold hover:bg-amber-500/35 cursor-pointer"
                  >
                    Jugar
                  </button>
                </div>
              </div>
            );
          })()}

        <div className="flex items-end justify-between gap-2">
          {/* Bottom-Left: Translucent Discrete Virtual Joystick (Touch) */}
          <div>
            {showTouch && (
              <div
                ref={stickRef}
                onPointerDown={(e) => {
                  e.preventDefault();
                  stickPointerIdRef.current = e.pointerId;
                  e.currentTarget.setPointerCapture?.(e.pointerId);
                  updateStick(e.clientX, e.clientY);
                }}
                onPointerMove={(e) => {
                  if (stickPointerIdRef.current !== e.pointerId) return;
                  updateStick(e.clientX, e.clientY);
                }}
                onPointerUp={(e) => {
                  if (stickPointerIdRef.current === e.pointerId) resetStick();
                }}
                onPointerCancel={(e) => {
                  if (stickPointerIdRef.current === e.pointerId) resetStick();
                }}
                onLostPointerCapture={(e) => {
                  if (stickPointerIdRef.current === e.pointerId) resetStick();
                }}
                aria-label="Joystick de movimiento"
                className="pointer-events-auto relative w-24 h-24 sm:w-28 sm:h-28 rounded-full border border-teal-300/35 bg-[#06101a]/55 backdrop-blur-sm touch-none shadow-lg"
              >
                <div className="absolute inset-3 rounded-full border border-white/10 pointer-events-none" />
                <div
                  className="absolute w-10 h-10 rounded-full bg-gradient-to-b from-teal-300/90 to-cyan-500/90 border border-white/80 left-1/2 top-1/2 -ml-5 -mt-5 shadow-md pointer-events-none"
                  style={{ transform: `translate(${nubPos.x}px, ${nubPos.y}px)` }}
                />
              </div>
            )}
          </div>

          {/* Bottom-Right: Single Compact Tool Selector + Single Contextual Primary Action */}
          <div ref={toolSelectorRef} className="pointer-events-auto relative flex items-end gap-2">
            {/* Compact Tool Wheel / Menu Popover (opens only on tap/click, closes on pick) */}
            {toolMenuOpen && (
              <div
                role="menu"
                aria-label="Selector de herramientas"
                className="bt-panel bt-animate-modal absolute bottom-full right-0 mb-2.5 w-[min(92vw,312px)] rounded-2xl p-2.5 z-30 shadow-2xl"
              >
                <div className="flex items-center justify-between px-1 pb-2 mb-2 border-b border-cyan-400/15">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-teal-300 flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5" />
                    Herramientas
                  </span>
                  <span className="text-[10px] text-slate-400">Elige una para usar</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {HOTBAR_SLOTS.map((slot, idx) => {
                    const selected = snap.selectedHotbar === idx;
                    const qty = slot.itemKey ? snap.inventory[slot.itemKey] : null;
                    return (
                      <button
                        key={slot.id}
                        role="menuitem"
                        onClick={() => {
                          onSelectHotbar(idx);
                          if (slot.id === 'pulse') onPulse();
                          setToolMenuOpen(false);
                        }}
                        className={`relative flex flex-col items-center justify-center rounded-xl px-1 py-2 min-h-[58px] border cursor-pointer transition-colors ${
                          selected
                            ? 'bg-teal-500/25 border-teal-300 text-white shadow-[0_0_12px_rgba(45,212,191,0.28)]'
                            : 'bt-btn-secondary border-slate-700/70'
                        }`}
                      >
                        <ToolIcon action={slot.id} className="w-4 h-4" />
                        <span className="text-[10px] font-bold mt-1 whitespace-nowrap">
                          {slot.label}
                        </span>
                        {qty !== null && (
                          <span className="text-[9px] font-extrabold text-amber-300 tabular-nums leading-none mt-0.5">
                            {qty}
                          </span>
                        )}
                        {slot.id === 'pulse' && snap.pulseCooldownPct < 1 && (
                          <span
                            className="absolute inset-x-1 bottom-0.5 h-1 bg-teal-400/85 rounded-full"
                            style={{ width: `${Math.max(8, snap.pulseCooldownPct * 90)}%` }}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Compact Tool Selector Trigger Button (NO 1-8 numbers) */}
            <button
              type="button"
              onClick={() => setToolMenuOpen((v) => !v)}
              aria-expanded={toolMenuOpen}
              aria-label={`Herramienta activa: ${activeSlot.label}`}
              title={`Herramienta activa: ${activeSlot.label}`}
              className={`relative bt-hud-panel h-14 min-w-[60px] px-2.5 rounded-2xl border flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-colors ${
                toolMenuOpen
                  ? 'border-teal-300 bg-teal-950/70'
                  : 'border-cyan-400/35 hover:border-teal-300/75'
              }`}
            >
              <div className="flex items-center gap-1">
                <ToolIcon action={activeSlot.id} className="w-4 h-4" />
                <ChevronUp
                  className={`w-3 h-3 text-slate-300 transition-transform duration-150 ${
                    toolMenuOpen ? 'rotate-180' : ''
                  }`}
                />
              </div>
              <span className="text-[10px] font-extrabold text-slate-100 leading-none truncate max-w-[58px]">
                {activeSlot.label}
              </span>
              {activeQty !== null && (
                <span className="text-[9px] font-extrabold text-amber-300 tabular-nums leading-none">
                  ×{activeQty}
                </span>
              )}
              {activeSlot.id === 'pulse' && snap.pulseCooldownPct < 1 && (
                <span
                  className="absolute inset-x-1.5 bottom-1 h-0.5 bg-teal-300 rounded-full"
                  style={{ width: `${snap.pulseCooldownPct * 86}%` }}
                />
              )}
            </button>

            {/* Single Smart Contextual Primary Action Button (powered by performPrimaryAction) */}
            <button
              type="button"
              onClick={() => {
                setToolMenuOpen(false);
                onAction();
              }}
              aria-label={`${ctxAction.label}: ${ctxAction.detail}`}
              title={`${ctxAction.label} (${ctxAction.detail}) · E / Clic`}
              className={`h-14 min-w-[116px] sm:min-w-[132px] px-3.5 rounded-2xl border flex items-center justify-center gap-2.5 cursor-pointer transition-all ${
                ctxAction.canAct
                  ? ctxAction.kind === 'combat' || ctxAction.kind === 'open_chest'
                    ? 'bt-btn-amber'
                    : 'bt-btn-primary'
                  : 'bt-hud-panel border-slate-700/70 text-slate-400 opacity-75'
              }`}
            >
              {renderContextualIcon(ctxAction.kind, activeSlot.id)}
              <div className="text-left leading-tight">
                <div className="text-xs sm:text-sm font-extrabold">{ctxAction.label}</div>
                <div
                  className={`text-[10px] font-semibold truncate max-w-[78px] ${
                    ctxAction.canAct ? 'opacity-85' : 'text-slate-400'
                  }`}
                >
                  {ctxAction.detail}
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
