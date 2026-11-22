import React, { useState } from 'react';
import { BookOpen, MessageCircle, Sparkles, X } from 'lucide-react';
import { gameEngine } from '../game/engine';
import { getDialogueById } from '../game/progressionManager';
import { STORY_CHARACTERS } from '../game/storyData';
import type { HudSnapshot } from '../game/types';
import { CharacterPortrait } from './CharacterPortrait';

interface DialogueModalProps {
  dialogueId: string;
  snap: HudSnapshot;
  onClose: () => void;
}

export const DialogueModal: React.FC<DialogueModalProps> = ({
  dialogueId,
  snap,
  onClose,
}) => {
  const dialogue = getDialogueById(dialogueId);
  const [lineIndex, setLineIndex] = useState(0);
  const [replyText, setReplyText] = useState<string | null>(null);

  if (!dialogue) return null;

  const lines = dialogue.lines || [];
  const isLastLine = lineIndex >= Math.max(0, lines.length - 1);
  const currentLine = lines[Math.min(lineIndex, Math.max(0, lines.length - 1))];
  const activeSpeakerId = replyText ? dialogue.characterId : currentLine?.speakerId || dialogue.characterId;
  const speaker = STORY_CHARACTERS[activeSpeakerId] || STORY_CHARACTERS[dialogue.characterId];
  const alreadyCompleted = snap.completedDialogues.includes(dialogue.id);
  const hasChoices = Boolean(dialogue.choices && dialogue.choices.length > 0);

  const handleFinishSimple = () => {
    gameEngine.submitDialogueChoice(dialogue.id);
    onClose();
  };

  const handlePickChoice = (choiceId: string, reply: string) => {
    gameEngine.submitDialogueChoice(dialogue.id, choiceId);
    setReplyText(reply);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-5 bg-[#03080e]/82 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={dialogue.title}
        className="bt-panel bt-animate-modal w-full max-w-xl rounded-2xl p-4 sm:p-5 space-y-3.5"
      >
        <div className="flex items-start justify-between gap-3 border-b border-cyan-400/20 pb-3">
          <div className="flex items-center gap-3 min-w-0">
            <CharacterPortrait
              characterId={activeSpeakerId}
              mood={replyText ? 'alegre' : currentLine?.mood}
              size={54}
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11px] font-bold text-teal-300">
                <MessageCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{currentLine?.speakerName || speaker?.name || 'Compañero'}</span>
                {speaker?.role && <span className="text-slate-400 font-normal">· {speaker.role}</span>}
              </div>
              <h3 className="text-base sm:text-lg font-extrabold text-white truncate">
                {dialogue.title}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar diálogo"
            className="bt-btn-secondary w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Dialogue Content */}
        {replyText ? (
          <div className="bt-inset rounded-xl p-4 space-y-2.5">
            <div className="text-xs font-extrabold text-amber-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Respuesta de {speaker?.name || 'Interlocutor'}
            </div>
            <p className="text-sm text-slate-100 leading-relaxed">{replyText}</p>
            {dialogue.onCompleteJournalId && (
              <div className="text-[11px] text-teal-300 flex items-center gap-1.5 pt-1">
                <BookOpen className="w-3.5 h-3.5" />
                <span>Entrada añadida al Diario de Aventura</span>
              </div>
            )}
          </div>
        ) : (
          <div className="bt-inset rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="font-bold text-teal-300">
                {currentLine?.speakerName || speaker?.name}
                {currentLine?.mood ? ` · ${currentLine.mood}` : ''}
              </span>
              <span className="tabular-nums">
                {Math.min(lineIndex + 1, lines.length)}/{Math.max(1, lines.length)}
              </span>
            </div>
            <p className="text-sm text-slate-100 leading-relaxed min-h-[3.5rem]">
              {currentLine?.text}
            </p>
          </div>
        )}

        {/* Footer Actions / Choices */}
        {replyText ? (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="bt-btn-primary px-5 py-2.5 rounded-xl font-extrabold text-xs cursor-pointer min-h-[44px] whitespace-nowrap"
            >
              Continuar aventura
            </button>
          </div>
        ) : !isLastLine ? (
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-slate-400">
              {alreadyCompleted ? 'Repasando conversación' : dialogue.rewardSummary || ''}
            </span>
            <button
              type="button"
              onClick={() => setLineIndex((i) => Math.min(lines.length - 1, i + 1))}
              className="bt-btn-primary px-5 py-2.5 rounded-xl font-extrabold text-xs cursor-pointer min-h-[44px] whitespace-nowrap"
            >
              Siguiente
            </button>
          </div>
        ) : hasChoices ? (
          <div className="space-y-2">
            <div className="text-[11px] font-bold text-slate-300">Elige tu respuesta:</div>
            <div className="grid grid-cols-1 gap-2">
              {dialogue.choices!.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handlePickChoice(c.id, c.replyText)}
                  className="bt-btn-secondary w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-100 hover:border-teal-300 cursor-pointer min-h-[44px]"
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-emerald-300 font-semibold">
              {alreadyCompleted ? 'Diálogo completado' : dialogue.rewardSummary || ''}
            </span>
            <button
              type="button"
              onClick={handleFinishSimple}
              className="bt-btn-primary px-5 py-2.5 rounded-xl font-extrabold text-xs cursor-pointer min-h-[44px] whitespace-nowrap"
            >
              {alreadyCompleted ? 'Cerrar' : 'Completar diálogo'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
