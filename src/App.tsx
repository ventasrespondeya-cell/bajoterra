import React, { useEffect, useRef, useState } from 'react';
import { BattleModal } from './components/BattleModal';
import { CinematicDirector } from './components/CinematicDirector';
import { DialogueModal } from './components/DialogueModal';
import { ExpeditionModal, type ExpeditionTabKey } from './components/ExpeditionModal';
import { FullMapModal } from './components/FullMapModal';
import { GameHUD } from './components/GameHUD';
import { PauseModal } from './components/PauseModal';
import { TitleScreen } from './components/TitleScreen';
import { gameEngine } from './game/engine';
import type { HudSnapshot } from './game/types';

export default function App() {
  const [snap, setSnap] = useState<HudSnapshot>(() => gameEngine.getSnapshot());
  const [expeditionTab, setExpeditionTab] = useState<ExpeditionTabKey>('campana');
  const [battleIntroActive, setBattleIntroActive] = useState(false);
  const [osReducedMotion, setOsReducedMotion] = useState<boolean>(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  );
  const mainCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const minimapRef = useRef<HTMLCanvasElement | null>(null);
  const fullMapRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (e: MediaQueryListEvent) => setOsReducedMotion(e.matches);
    setOsReducedMotion(mq.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  useEffect(() => {
    const unsub = gameEngine.subscribe(setSnap);
    gameEngine.attachCanvases(mainCanvasRef.current, minimapRef.current, fullMapRef.current);
    gameEngine.startLoop();

    const onKeyDown = (e: KeyboardEvent) => gameEngine.handleKeyDown(e);
    const onKeyUp = (e: KeyboardEvent) => gameEngine.handleKeyUp(e);
    const onBlur = () => gameEngine.clearInputs();
    const onResize = () => gameEngine.resizeCanvas();
    const onPageHide = () => {
      gameEngine.handleLifecycleSave('pagehide');
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        gameEngine.clearInputs();
        gameEngine.handleLifecycleSave('visibility-hidden');
      } else if (document.visibilityState === 'visible') {
        void gameEngine.handleTabReturn();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    window.addEventListener('resize', onResize);
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      unsub();
      gameEngine.stopLoop();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pagehide', onPageHide);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  useEffect(() => {
    gameEngine.attachCanvases(mainCanvasRef.current, minimapRef.current, fullMapRef.current);
  }, [snap.screen, snap.options.showMinimap]);

  const effectiveReducedMotion = Boolean(snap.options.reducedMotion || osReducedMotion);

  return (
    <div
      className={`relative w-full h-[100dvh] overflow-hidden bg-[#060c13]${
        effectiveReducedMotion ? ' bt-reduced-motion' : ''
      }`}
    >
      {/* Isolated 60fps Canvas Viewport */}
      <canvas
        ref={mainCanvasRef}
        onClick={(e) => gameEngine.handleCanvasClick(e.clientX, e.clientY)}
        className="w-full h-full block pixelated cursor-crosshair"
      />

      {snap.screen === 'TITLE' && (
        <TitleScreen
          snap={snap}
          onNewGame={() => gameEngine.startNewGame()}
          onContinue={() => gameEngine.continueSavedGame()}
          onImportV3Detected={() => gameEngine.importDetectedV3Save()}
          onImportJsonFile={(txt) => {
            gameEngine.importJsonText(txt);
          }}
        />
      )}

      {snap.screen !== 'TITLE' && !snap.battle && (
        <GameHUD
          snap={snap}
          minimapRef={minimapRef}
          onSelectHotbar={(idx) => gameEngine.setHotbar(idx)}
          onSelectParty={(idx) => gameEngine.setActivePartyIndex(idx)}
          onOpenExpedition={() => {
            setExpeditionTab('campana');
            gameEngine.setScreen('EXPEDITION');
          }}
          onOpenHome={() => {
            setExpeditionTab('hogar');
            gameEngine.setScreen('EXPEDITION');
          }}
          onOpenMap={() => gameEngine.setScreen('FULL_MAP')}
          onOpenPause={() => gameEngine.setScreen('PAUSED')}
          onToggleSound={() =>
            gameEngine.updateOptions({ soundEnabled: !snap.options.soundEnabled })
          }
          onToggleMecha={() => gameEngine.toggleMecha()}
          onAction={() => gameEngine.performPrimaryAction()}
          onPulse={() => gameEngine.triggerExplorationPulse()}
          onPetHomeSlug={(uid) => gameEngine.petHomeSlug(uid)}
          onFeedHomeSlug={(uid, foodKey) => gameEngine.feedHomeSlug(uid, foodKey)}
          onPlayHomeSlug={(uid) => gameEngine.playWithHomeSlug(uid)}
          onJoystick={(x, y) => gameEngine.setJoystick(x, y)}
          onTouchSprint={(active) => gameEngine.setTouchSprint(active)}
        />
      )}

      {snap.battle && (
        <BattleModal
          battle={snap.battle}
          state={gameEngine.state}
          combat={gameEngine.combat}
          introPaused={battleIntroActive}
          reducedMotion={effectiveReducedMotion}
          onSync={() => gameEngine.emitHud(true)}
        />
      )}

      {snap.screen === 'EXPEDITION' && !snap.battle && (
        <ExpeditionModal
          snap={snap}
          initialTab={expeditionTab}
          onClose={() => gameEngine.setScreen('PLAYING')}
        />
      )}

      {snap.screen === 'FULL_MAP' && !snap.battle && (
        <FullMapModal
          snap={snap}
          fullMapRef={fullMapRef}
          onClose={() => gameEngine.setScreen('PLAYING')}
        />
      )}

      {snap.screen === 'PAUSED' && !snap.battle && (
        <PauseModal
          snap={snap}
          onResume={() => gameEngine.setScreen('PLAYING')}
          onTitle={() => gameEngine.setScreen('TITLE')}
        />
      )}

      {snap.activeDialogueId && !snap.battle && (
        <DialogueModal
          dialogueId={snap.activeDialogueId}
          snap={snap}
          onClose={() => gameEngine.closeDialogue()}
        />
      )}

      <CinematicDirector
        snap={snap}
        reducedMotion={effectiveReducedMotion}
        onBattleIntroActiveChange={setBattleIntroActive}
      />
    </div>
  );
}
