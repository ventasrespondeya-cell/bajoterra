import React, { useEffect, useState } from 'react';
import {
  Compass,
  Lock,
  MapPin,
  Navigation,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { HIDDEN_DISCOVERIES } from '../game/activities';
import { BIOME_INFO } from '../game/data';
import { gameEngine } from '../game/engine';
import {
  STORY_CHAPTERS_BY_ID,
  STORY_CHARACTERS,
  STORY_ROUTES,
  STORY_SCENARIOS,
} from '../game/storyData';
import { canAccessRoute } from '../game/storyEngine';
import type { HudSnapshot } from '../game/types';

interface FullMapModalProps {
  snap: HudSnapshot;
  fullMapRef: React.RefObject<HTMLCanvasElement | null>;
  onClose: () => void;
}

const SCENARIO_ORDER = [
  'esc_refugio_shane',
  'esc_caverna_descenso',
  'esc_pueblo_valle_verde',
  'esc_puesto_agua_oscura',
  'esc_caverna_helada',
  'esc_caverna_magma',
  'esc_taller_acelerador',
  'esc_ciudadela_sombria',
];

function formatCanonTag(tag: 'serie_canon' | 'adaptacion_juego' | 'pendiente_canon'): string {
  if (tag === 'serie_canon') return 'Canon de la serie';
  if (tag === 'adaptacion_juego') return 'Adaptación RPG';
  return 'Referencia abierta';
}

export const FullMapModal: React.FC<FullMapModalProps> = ({ snap, fullMapRef, onClose }) => {
  const [selectedId, setSelectedId] = useState<string>(snap.story.currentScenarioId || 'esc_refugio_shane');

  useEffect(() => {
    if (fullMapRef.current) {
      gameEngine.renderer.renderFullWorldMap(fullMapRef.current, gameEngine.state);
    }
  }, [fullMapRef, snap]);

  const exploredCount = Object.keys(gameEngine.state.exploredChunks).length;
  const totalChunks = 20 * 20;
  const exploredPct = Math.round((exploredCount / totalChunks) * 100);

  const selectedScenario = STORY_SCENARIOS[selectedId] || STORY_SCENARIOS['esc_refugio_shane'];
  const activeChapter = STORY_CHAPTERS_BY_ID[snap.story.currentChapterId];

  const getScenarioStatus = (scId: string) => {
    const isCurrent = snap.story.currentScenarioId === scId;
    const isVisited = snap.storyState.visitedScenarioIds.includes(scId);
    const isUnlocked = snap.storyState.unlockedScenarioIds.includes(scId);
    const isObjective = Boolean(activeChapter?.scenarioIds.includes(scId));

    const routeAccessList = (STORY_SCENARIOS[scId]?.connectedRouteIds || []).map((rId) => {
      const route = STORY_ROUTES[rId];
      const access = canAccessRoute(gameEngine.state, rId);
      return { route, access };
    });

    const hasOpenRoute = routeAccessList.some((r) => r.access.allowed);
    const canTravelNow = !isCurrent && (isUnlocked || isVisited || hasOpenRoute);
    const firstLockReason =
      routeAccessList.find((r) => !r.access.allowed)?.access.reason ||
      'Avanza en la campaña para abrir esta ruta.';

    return {
      isCurrent,
      isVisited,
      isUnlocked,
      isObjective,
      canTravelNow,
      firstLockReason,
      routeAccessList,
    };
  };

  const selStatus = getScenarioStatus(selectedScenario.id);
  const scenarioSecrets = (selectedScenario.secretIds || [])
    .map((secId) => HIDDEN_DISCOVERIES.find((d) => d.id === secId))
    .filter((d): d is NonNullable<typeof d> => Boolean(d));
  const discoveredInSelected = scenarioSecrets.filter((d) => snap.discoveredSecrets.includes(d.id));

  const discoveredSecretItems = HIDDEN_DISCOVERIES.filter((d) => snap.discoveredSecrets.includes(d.id));

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-2.5 sm:p-5 bg-[#03080e]/90 backdrop-blur-sm">
      <div className="bt-panel bt-animate-modal w-full max-w-5xl rounded-2xl p-4 sm:p-5 max-h-[94dvh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b border-cyan-400/20 pb-3 mb-3 shrink-0">
          <div>
            <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
              <Compass className="w-5 h-5 text-teal-300" />
              Mapa del Mundo Subterráneo de Bajoterra
            </h2>
            <p className="text-xs text-slate-300 tabular-nums mt-0.5">
              Ubicación: {snap.story.currentScenarioName} · Regiones: {snap.discoveries.length}/4 ·
              Explorado: {exploredPct}% ({Math.round(snap.player.x)}, {Math.round(snap.player.y)})
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar mapa"
            className="bt-btn-secondary w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main 2-column World Map Workspace */}
        <div className="flex-1 min-h-0 overflow-y-auto bt-scroll pr-1">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Left Column: Map Canvas + Geography Legend */}
            <div className="lg:col-span-6 space-y-3">
              <div className="flex justify-center bt-inset border-teal-400/30 rounded-xl p-2">
                <canvas
                  ref={fullMapRef}
                  width={440}
                  height={440}
                  className="w-full max-w-[440px] aspect-square rounded-lg pixelated"
                />
              </div>

              {/* Biomes & Map Legend */}
              <div className="bt-inset rounded-xl p-3 space-y-2 text-[11px] text-slate-200">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {(['Verdes', 'Heladas', 'Magma', 'Sombrias'] as const).map((b) => {
                    const found = snap.discoveries.includes(b);
                    return (
                      <div
                        key={b}
                        className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border ${
                          found
                            ? 'bg-slate-900/70 border-teal-400/30 text-white'
                            : 'bg-slate-950/50 border-white/10 text-slate-400'
                        }`}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-sm shrink-0 border border-white/25"
                          style={{ backgroundColor: BIOME_INFO[b].mapColor }}
                        />
                        <span className="truncate font-semibold">
                          {found ? BIOME_INFO[b].name : `${BIOME_INFO[b].name} (Sellado)`}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-slate-300 pt-1 border-t border-white/10">
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-400 inline-block" /> Actual
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-teal-400 inline-block" /> Visitado
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" /> Accesible / Objetivo
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-600 inline-block" /> Bloqueado
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rotate-45 bg-purple-400 inline-block" /> Secreto hallado
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> Jefe
                  </span>
                </div>
              </div>
            </div>

            {/* Right Column: Destinations Graph & Location Inspector */}
            <div className="lg:col-span-6 space-y-3">
              {/* Interconnected Underground Locations */}
              <div className="bt-inset rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-extrabold text-teal-300 uppercase tracking-wider">
                    Destinos del Subsuelo ({snap.storyState.visitedScenarioIds.length}/{SCENARIO_ORDER.length} visitados)
                  </h3>
                  <span className="text-[11px] text-amber-200 font-semibold truncate">
                    Cap. {snap.story.currentChapterOrder}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {SCENARIO_ORDER.map((scId) => {
                    const sc = STORY_SCENARIOS[scId];
                    if (!sc) return null;
                    const st = getScenarioStatus(scId);
                    const isSelected = selectedScenario.id === scId;
                    const statusLabel = st.isCurrent
                      ? 'Actual'
                      : st.isVisited
                      ? 'Visitado'
                      : st.isUnlocked || st.canTravelNow
                      ? 'Accesible'
                      : 'Bloqueado';
                    return (
                      <button
                        key={scId}
                        type="button"
                        onClick={() => setSelectedId(scId)}
                        className={`text-left rounded-xl px-2.5 py-2 border transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[#0d222c] border-teal-300'
                            : st.isCurrent || st.isVisited || st.canTravelNow
                            ? 'bt-card hover:border-cyan-400/55'
                            : 'bt-card opacity-65'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="text-xs font-extrabold text-white truncate">
                            {sc.name}
                          </span>
                          <span
                            className={`text-[10px] font-bold shrink-0 ${
                              st.isCurrent
                                ? 'text-sky-300'
                                : st.isVisited
                                ? 'text-teal-300'
                                : st.canTravelNow
                                ? 'text-amber-300'
                                : 'text-slate-400'
                            }`}
                          >
                            {statusLabel}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-1 text-[10px] text-slate-300 mt-0.5">
                          <span className="truncate">{sc.regionName}</span>
                          {st.isObjective && (
                            <span className="text-amber-300 font-extrabold shrink-0 flex items-center gap-0.5">
                              <Sparkles className="w-2.5 h-2.5" /> Objetivo
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Selected Destination Details & Travel Trigger */}
              <div className="bt-card rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-extrabold text-white">{selectedScenario.name}</div>
                    <div className="text-[11px] text-teal-300 font-semibold">
                      {selectedScenario.regionName} · {formatCanonTag(selectedScenario.canonStatus)}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={!selStatus.canTravelNow}
                    onClick={() => {
                      const ok = gameEngine.travelToStoryScenario(selectedScenario.id);
                      if (ok) onClose();
                    }}
                    className={`px-3.5 py-2 rounded-xl font-extrabold text-xs whitespace-nowrap min-h-[38px] flex items-center gap-1.5 cursor-pointer disabled:opacity-45 ${
                      selStatus.canTravelNow ? 'bt-btn-primary' : 'bt-btn-secondary'
                    }`}
                  >
                    {selStatus.isCurrent ? (
                      <>
                        <MapPin className="w-3.5 h-3.5" /> Estás aquí
                      </>
                    ) : selStatus.canTravelNow ? (
                      <>
                        <Navigation className="w-3.5 h-3.5" /> Viajar
                      </>
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5" /> Sellado
                      </>
                    )}
                  </button>
                </div>

                <p className="text-xs text-slate-200 leading-relaxed">
                  {selStatus.isUnlocked || selStatus.isVisited || selStatus.canTravelNow
                    ? selectedScenario.summary
                    : `Acceso bloqueado: ${selStatus.firstLockReason}`}
                </p>

                {/* Connected Routes */}
                <div className="space-y-1 pt-1 border-t border-white/10">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-300">
                    Rutas conectadas
                  </div>
                  <div className="space-y-1">
                    {selStatus.routeAccessList.map(({ route, access }) => {
                      if (!route) return null;
                      const otherId =
                        route.fromScenarioId === selectedScenario.id
                          ? route.toScenarioId
                          : route.fromScenarioId;
                      const otherName = STORY_SCENARIOS[otherId]?.name || otherId;
                      return (
                        <div
                          key={route.id}
                          className="flex items-center justify-between gap-2 text-[11px] text-slate-200"
                        >
                          <span className="truncate">
                            {route.name} → <strong className="text-white">{otherName}</strong>
                          </span>
                          <span
                            className={`text-[10px] font-bold shrink-0 ${
                              access.allowed ? 'text-emerald-300' : 'text-amber-300'
                            }`}
                          >
                            {access.allowed ? 'Abierta' : 'Cerrada'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* NPCs, Facilities & Secrets (masked if undiscovered) */}
                {(selStatus.isUnlocked || selStatus.isVisited || selStatus.canTravelNow) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1.5 border-t border-white/10 text-[11px]">
                    <div>
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-sky-300 flex items-center gap-1 mb-1">
                        <Users className="w-3 h-3" /> Personajes en zona
                      </div>
                      {selectedScenario.npcIds.length === 0 ? (
                        <span className="text-slate-400">Zona salvaje sin base permanente</span>
                      ) : (
                        <div className="text-slate-200">
                          {selectedScenario.npcIds
                            .map((id) => STORY_CHARACTERS[id]?.name || id)
                            .join(', ')}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-amber-300 mb-1">
                        Servicios y Secretos
                      </div>
                      <div className="text-slate-200 truncate">
                        {selectedScenario.facilities.join(' · ')}
                      </div>
                      {scenarioSecrets.length > 0 && (
                        <div className="text-[10px] text-purple-300 font-semibold mt-0.5 tabular-nums">
                          Secretos hallados: {discoveredInSelected.length}/{scenarioSecrets.length}
                          {discoveredInSelected.length === 0 && ' · Explora con Pulso [Espacio]'}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer: Quick Shelter Return + Discovered Landmarks & Secrets */}
          <div className="mt-3 pt-3 border-t border-cyan-400/15 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-extrabold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                Lugares y Secretos Descubiertos ({snap.discoveredPOIs.length + discoveredSecretItems.length})
              </div>
              {snap.story.currentScenarioId !== 'esc_refugio_shane' && (
                <button
                  type="button"
                  onClick={() => {
                    const ok = gameEngine.travelToStoryScenario('esc_refugio_shane');
                    if (ok) onClose();
                  }}
                  className="bt-btn-primary px-3.5 py-2 rounded-xl font-extrabold text-xs cursor-pointer flex items-center gap-1.5 min-h-[38px]"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  Volver al Refugio Shane
                </button>
              )}
            </div>

            {snap.discoveredPOIs.length === 0 && discoveredSecretItems.length === 0 ? (
              <p className="text-xs text-slate-400">
                Explora los túneles subterráneos y emite tu Pulso [Espacio] para revelar santuarios, puestos avanzados y vestigios ocultos.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 max-h-28 overflow-y-auto bt-scroll pr-1">
                {discoveredSecretItems.map((sec) => (
                  <div
                    key={sec.id}
                    className="bt-inset border-purple-400/35 px-2.5 py-1.5 rounded-lg text-[11px] text-purple-100 tabular-nums flex items-center justify-between gap-2"
                  >
                    <span className="truncate font-semibold">✦ {sec.title}</span>
                    <span className="text-purple-300 shrink-0">{BIOME_INFO[sec.biome].name}</span>
                  </div>
                ))}
                {snap.discoveredPOIs.map((poi) => (
                  <div
                    key={poi.id}
                    className="bt-inset px-2.5 py-1.5 rounded-lg text-[11px] text-slate-200 tabular-nums flex items-center justify-between gap-2"
                  >
                    <span className="truncate font-semibold text-white">◆ {poi.name}</span>
                    <span className="text-teal-300 shrink-0">
                      {BIOME_INFO[poi.biome].name} ({poi.x}, {poi.y})
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
