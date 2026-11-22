import React, { useEffect, useRef, useState } from 'react';
import { Award, Flag, Gauge, Shield, Target, Timer, Zap } from 'lucide-react';
import { SLUG_RACES, TRAINING_CHALLENGES, getMechaSpeedMultiplier } from '../game/activities';
import { gameEngine } from '../game/engine';
import type { GameState, HudSnapshot } from '../game/types';
import type { SlugRaceDef, TrainingChallengeDef } from '../game/storyTypes';

interface TrainingAndRacePanelProps {
  snap: HudSnapshot;
}

export const TrainingAndRacePanel: React.FC<TrainingAndRacePanelProps> = ({ snap }) => {
  // Active training drill state
  const [activeDrill, setActiveDrill] = useState<TrainingChallengeDef | null>(null);
  const [drillTimeLeft, setDrillTimeLeft] = useState<number>(0);
  const [drillScore, setDrillScore] = useState<number>(0);
  const [drillLastFeedback, setDrillLastFeedback] = useState<string>('');
  // Precision state
  const [targetPos, setTargetPos] = useState<{ x: number; y: number }>({ x: 50, y: 50 });
  // Velocity 100 MPH gauge state (0..100)
  const [gaugeVal, setGaugeVal] = useState<number>(20);
  const gaugeDirRef = useRef<number>(1);
  // Interception 3-lane state
  const [incomingLane, setIncomingLane] = useState<number>(1);
  const [interceptStreak, setInterceptStreak] = useState<number>(0);

  // Active race state
  const [activeRace, setActiveRace] = useState<SlugRaceDef | null>(null);
  const [raceDistance, setRaceDistance] = useState<number>(0);
  const [raceElapsed, setRaceElapsed] = useState<number>(0);
  const [raceLane, setRaceLane] = useState<number>(1);
  const [hazardLane, setHazardLane] = useState<number>(0);
  const [turboLane, setTurboLane] = useState<number>(2);
  const [raceSpeedBoost, setRaceSpeedBoost] = useState<number>(0);
  const [raceFeedback, setRaceFeedback] = useState<string>('');

  const drillScoreRef = useRef<number>(0);
  drillScoreRef.current = drillScore;

  const raceStateRef = useRef({
    distance: 0,
    elapsed: 0,
    lane: 1,
    hazardLane: 0,
    turboLane: 2,
    speedBoost: 0,
  });
  raceStateRef.current = {
    distance: raceDistance,
    elapsed: raceElapsed,
    lane: raceLane,
    hazardLane,
    turboLane,
    speedBoost: raceSpeedBoost,
  };

  const mechaMult = getMechaSpeedMultiplier({ mecha: snap.mecha } as GameState);

  // Training Drill Timer & Physics
  useEffect(() => {
    if (!activeDrill) return;
    const stepMs = 80;
    const timer = setInterval(() => {
      setDrillTimeLeft((prev) => {
        const next = Math.max(0, +(prev - stepMs / 1000).toFixed(2));
        if (next <= 0) {
          clearInterval(timer);
          const finishedDrill = activeDrill;
          const finalScore = drillScoreRef.current;
          setActiveDrill(null);
          const res = gameEngine.completeTrainingChallenge(finishedDrill.id, finalScore);
          setDrillLastFeedback(res.message);
          return 0;
        }
        return next;
      });

      if (activeDrill.kind === 'velocity') {
        setGaugeVal((v) => {
          let next = v + gaugeDirRef.current * 5.2;
          if (next >= 100) {
            next = 100;
            gaugeDirRef.current = -1;
          } else if (next <= 0) {
            next = 0;
            gaugeDirRef.current = 1;
          }
          return next;
        });
      }
    }, stepMs);

    return () => clearInterval(timer);
  }, [activeDrill]);

  // Race Loop Timer
  useEffect(() => {
    if (!activeRace) return;
    const stepMs = 100;
    let tickCount = 0;
    const timer = setInterval(() => {
      tickCount++;
      const cur = raceStateRef.current;
      const baseMps = 28 * Math.max(1.18, mechaMult);
      const boostMps = cur.speedBoost > 0 ? 18 : 0;
      const hazardPenalty = cur.lane === cur.hazardLane ? 0.52 : 1;
      const deltaMeters = ((baseMps + boostMps) * hazardPenalty * stepMs) / 1000;
      const nextDist = Math.min(activeRace.distanceMeters, cur.distance + deltaMeters);
      const nextElapsed = +(cur.elapsed + stepMs / 1000).toFixed(1);

      setRaceDistance(nextDist);
      setRaceElapsed(nextElapsed);
      setRaceSpeedBoost((b) => Math.max(0, b - stepMs / 1000));

      if (tickCount % 12 === 0) {
        const newHazard = Math.floor(Math.random() * 3);
        const newTurbo = (newHazard + 1 + Math.floor(Math.random() * 2)) % 3;
        setHazardLane(newHazard);
        setTurboLane(newTurbo);
      }

      if (nextDist >= activeRace.distanceMeters) {
        clearInterval(timer);
        const finishedRace = activeRace;
        const won = nextElapsed <= finishedRace.parTimeSec;
        setActiveRace(null);
        const res = gameEngine.completeSlugRace(finishedRace.id, nextElapsed, won);
        setRaceFeedback(res.message);
      }
    }, stepMs);

    return () => clearInterval(timer);
  }, [activeRace, mechaMult]);

  const startDrill = (def: TrainingChallengeDef) => {
    setActiveRace(null);
    setActiveDrill(def);
    setDrillTimeLeft(def.durationSec);
    setDrillScore(0);
    setInterceptStreak(0);
    setTargetPos({ x: 25 + Math.random() * 55, y: 25 + Math.random() * 55 });
    setGaugeVal(15);
    gaugeDirRef.current = 1;
    setIncomingLane(Math.floor(Math.random() * 3));
    setDrillLastFeedback(`¡Prueba "${def.title}" en marcha!`);
  };

  const handlePrecisionHit = () => {
    setDrillScore((s) => s + 1);
    setTargetPos({
      x: 16 + Math.random() * 68,
      y: 18 + Math.random() * 64,
    });
  };

  const handleVelocityShot = () => {
    if (gaugeVal >= 72 && gaugeVal <= 90) {
      setDrillScore((s) => s + 2);
      setDrillLastFeedback('¡100 MPH Perfecto! (+2 pts)');
    } else if (gaugeVal >= 55) {
      setDrillScore((s) => s + 1);
      setDrillLastFeedback('Buen impulso (+1 pt)');
    } else {
      setDrillLastFeedback('Carga insuficiente — apunta a la franja dorada');
    }
  };

  const handleInterceptLane = (lane: number) => {
    if (lane === incomingLane) {
      const nextStreak = interceptStreak + 1;
      setInterceptStreak(nextStreak);
      setDrillScore((s) => s + (nextStreak >= 3 ? 2 : 1));
      setDrillLastFeedback(nextStreak >= 3 ? '¡Bloqueo en racha! (+2 pts)' : '¡Proyectil interceptado!');
    } else {
      setInterceptStreak(0);
      setDrillLastFeedback('Carril equivocado — reajusta tu guardia');
    }
    setIncomingLane(Math.floor(Math.random() * 3));
  };

  const startRace = (race: SlugRaceDef) => {
    if (!snap.mecha.unlocked) {
      gameEngine.notify('Desbloquea tu Meca Shane en el Capítulo 2 para competir en carreras.');
      return;
    }
    setActiveDrill(null);
    setActiveRace(race);
    setRaceDistance(0);
    setRaceElapsed(0);
    setRaceLane(1);
    setHazardLane(0);
    setTurboLane(2);
    setRaceSpeedBoost(0);
    setRaceFeedback(`¡Compitiendo en ${race.name}!`);
  };

  const selectRaceLane = (lane: number) => {
    setRaceLane(lane);
    if (lane === turboLane) {
      setRaceSpeedBoost(1.6);
      setTurboLane((lane + 1) % 3);
    }
  };

  return (
    <div className="space-y-4">
      {/* Training Drills Section */}
      <div className="bt-inset rounded-xl p-3.5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-extrabold text-teal-300 uppercase tracking-wider flex items-center gap-1.5">
              <Target className="w-4 h-4" />
              Pruebas de Entrenamiento de Bláster
            </h3>
            <p className="text-[11px] text-slate-300 mt-0.5">
              Entrena tu puntería, cadencia de 100 MPH e intercepción para ganar Maestría, Amistad y Fichas de Caverna.
            </p>
          </div>
          {drillLastFeedback && (
            <span className="text-xs font-bold text-amber-200">{drillLastFeedback}</span>
          )}
        </div>

        {/* Active Interactive Drill Arena */}
        {activeDrill && (
          <div className="bt-card rounded-xl p-3.5 border-teal-400/50 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="font-extrabold text-white flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-300" />
                <span>{activeDrill.title}</span>
              </div>
              <div className="flex items-center gap-4 tabular-nums font-bold">
                <span className="text-teal-300">Puntos: {drillScore}</span>
                <span className="text-amber-300 flex items-center gap-1">
                  <Timer className="w-3.5 h-3.5" />
                  {drillTimeLeft.toFixed(1)}s
                </span>
              </div>
            </div>

            {activeDrill.kind === 'precision' && (
              <div className="relative h-44 rounded-xl bg-[#050d16] border border-cyan-500/25 overflow-hidden select-none">
                <button
                  type="button"
                  onClick={handlePrecisionHit}
                  style={{
                    left: `${targetPos.x}%`,
                    top: `${targetPos.y}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                  className="absolute w-12 h-12 rounded-full bg-amber-400/90 border-2 border-white text-[#060c13] font-black text-xs shadow-[0_0_16px_rgba(251,191,36,0.6)] cursor-pointer flex items-center justify-center"
                >
                  DIANA
                </button>
              </div>
            )}

            {activeDrill.kind === 'velocity' && (
              <div className="space-y-3">
                <div className="relative h-8 rounded-xl bg-[#050d16] border border-cyan-500/30 overflow-hidden">
                  <div
                    className="absolute top-0 bottom-0 bg-amber-400/25 border-x border-amber-300/70"
                    style={{ left: '72%', width: '18%' }}
                  />
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 via-teal-400 to-amber-300"
                    style={{ width: `${gaugeVal}%` }}
                  />
                </div>
                <div className="flex items-center justify-between gap-2 text-[11px] text-slate-300">
                  <span>Zona óptima: 72–90% (100 MPH)</span>
                  <button
                    type="button"
                    onClick={handleVelocityShot}
                    className="bt-btn-amber px-4 py-2 rounded-xl font-extrabold text-xs cursor-pointer whitespace-nowrap min-h-[40px]"
                  >
                    ¡Disparar Ahora!
                  </button>
                </div>
              </div>
            )}

            {activeDrill.kind === 'interception' && (
              <div className="grid grid-cols-3 gap-2">
                {[0, 1, 2].map((lane) => {
                  const hasProj = incomingLane === lane;
                  return (
                    <button
                      key={lane}
                      type="button"
                      onClick={() => handleInterceptLane(lane)}
                      className={`h-24 rounded-xl border text-xs font-extrabold flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors ${
                        hasProj
                          ? 'bg-rose-500/25 border-rose-400 text-rose-100'
                          : 'bt-inset border-cyan-400/20 text-slate-300'
                      }`}
                    >
                      <Shield className="w-5 h-5" />
                      <span>Carril {lane + 1}</span>
                      <span className="text-[11px]">{hasProj ? '¡IMPACTO!' : 'Despejado'}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Drill Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          {TRAINING_CHALLENGES.map((tr) => {
            const rec = snap.trainingRecords[tr.id];
            return (
              <div key={tr.id} className="bt-card rounded-xl p-3 flex flex-col justify-between gap-2.5">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-extrabold text-sm text-white">{tr.title}</span>
                    {rec && (
                      <span className="text-xs font-black text-amber-300 tabular-nums">
                        Rango {rec.bestRank}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-teal-300 font-semibold mt-0.5">{tr.subtitle}</div>
                  <p className="text-[11px] text-slate-300 mt-1">{tr.description}</p>
                  <div className="text-[11px] text-slate-400 tabular-nums mt-1.5">
                    Metas: Rango A {tr.targetScoreA} · Rango S {tr.targetScoreS} · +{tr.rewardTokens} Fichas
                  </div>
                  {rec && (
                    <div className="text-[11px] text-emerald-300 tabular-nums mt-1 font-semibold">
                      Mejor marca: {rec.bestScore} pts · {rec.completions} sesiones
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  disabled={Boolean(activeDrill)}
                  onClick={() => startDrill(tr)}
                  className="bt-btn-primary w-full py-2 rounded-xl font-extrabold text-xs disabled:opacity-40 cursor-pointer whitespace-nowrap min-h-[38px]"
                >
                  {activeDrill?.id === tr.id ? 'En curso...' : 'Iniciar Prueba (15s)'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Slug Races on Mecha */}
      <div className="bt-inset rounded-xl p-3.5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-extrabold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
              <Flag className="w-4 h-4" />
              Carreras de Meca en las Cavernas
            </h3>
            <p className="text-[11px] text-slate-300 mt-0.5">
              Esquiva grietas y captura carriles Turbo con tu Meca ({snap.mecha.name} · Velocidad ×{mechaMult.toFixed(2)}).
            </p>
          </div>
          {raceFeedback && (
            <span className="text-xs font-bold text-emerald-300">{raceFeedback}</span>
          )}
        </div>

        {activeRace && (
          <div className="bt-card rounded-xl p-3.5 border-amber-400/50 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="font-extrabold text-white flex items-center gap-1.5">
                <Gauge className="w-4 h-4 text-amber-300" />
                <span>{activeRace.name}</span>
              </div>
              <div className="tabular-nums font-bold flex items-center gap-4">
                <span className="text-teal-300">
                  {Math.round(raceDistance)} / {activeRace.distanceMeters} m
                </span>
                <span className="text-amber-300">
                  {raceElapsed.toFixed(1)}s (Meta {activeRace.parTimeSec}s)
                </span>
              </div>
            </div>

            <div className="h-3 rounded-full bg-[#050d16] border border-cyan-500/25 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-teal-400 to-amber-300"
                style={{ width: `${Math.min(100, (raceDistance / activeRace.distanceMeters) * 100)}%` }}
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[0, 1, 2].map((lane) => {
                const isPlayer = raceLane === lane;
                const isHazard = hazardLane === lane;
                const isTurbo = turboLane === lane;
                return (
                  <button
                    key={lane}
                    type="button"
                    onClick={() => selectRaceLane(lane)}
                    className={`py-3 px-2 rounded-xl border text-xs font-extrabold cursor-pointer min-h-[60px] flex flex-col items-center justify-center gap-1 ${
                      isPlayer
                        ? 'bt-btn-primary border-teal-200'
                        : isHazard
                        ? 'bg-rose-500/20 border-rose-400/60 text-rose-200'
                        : isTurbo
                        ? 'bg-amber-500/20 border-amber-300/60 text-amber-100'
                        : 'bt-btn-secondary'
                    }`}
                  >
                    <span>Carril {lane + 1}</span>
                    <span className="text-[11px]">
                      {isPlayer ? 'Tu Meca' : isHazard ? 'Grieta' : isTurbo ? 'Turbo +' : 'Libre'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          {SLUG_RACES.map((race) => {
            const rec = snap.raceRecords[race.id];
            return (
              <div key={race.id} className="bt-card rounded-xl p-3 flex flex-col justify-between gap-2.5">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-extrabold text-sm text-white">{race.name}</span>
                    {rec?.cleared && (
                      <Award className="w-4 h-4 text-emerald-300 shrink-0" />
                    )}
                  </div>
                  <div className="text-[11px] text-slate-300 mt-0.5">{race.subtitle}</div>
                  <div className="text-[11px] text-amber-200/90 tabular-nums mt-1.5 font-semibold">
                    Distancia {race.distanceMeters} m · Meta ≤ {race.parTimeSec}s
                  </div>
                  <div className="text-[11px] text-emerald-300 mt-0.5">{race.rewardSummary}</div>
                  {rec && (
                    <div className="text-[11px] text-cyan-200 tabular-nums mt-1">
                      Récord: {rec.bestTimeSec.toFixed(1)}s · Victorias: {rec.wins}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  disabled={!snap.mecha.unlocked || Boolean(activeRace)}
                  onClick={() => startRace(race)}
                  className="bt-btn-amber w-full py-2 rounded-xl font-extrabold text-xs disabled:opacity-40 cursor-pointer whitespace-nowrap min-h-[38px]"
                >
                  {!snap.mecha.unlocked
                    ? 'Requiere Meca (Cap. 2)'
                    : activeRace?.id === race.id
                    ? 'Corriendo...'
                    : 'Correr Circuito'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
