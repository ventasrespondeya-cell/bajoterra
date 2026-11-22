import React, { useId } from 'react';
import { getCharacterVisualProfile, normalizeCharacterMood } from '../game/characterArt';
import { SlugPortrait } from './SlugPortrait';

interface CharacterPortraitProps {
  characterId: string;
  mood?: string;
  size?: number;
  className?: string;
}

export const CharacterPortrait: React.FC<CharacterPortraitProps> = ({
  characterId,
  mood,
  size = 56,
  className = '',
}) => {
  const uid = useId().replace(/:/g, '');
  if (characterId === 'burpy') {
    return (
      <div
        className={`rounded-xl bt-inset flex items-center justify-center shrink-0 border border-orange-400/40 bg-[#20120c] ${className}`}
        style={{ width: size, height: size }}
      >
        <SlugPortrait speciesId="infurnus" mood="happy" size={Math.round(size * 0.86)} />
      </div>
    );
  }

  const p = getCharacterVisualProfile(characterId);
  const normMood = normalizeCharacterMood(mood);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={`shrink-0 rounded-xl border select-none ${className}`}
      style={{
        borderColor: p.accentColor,
        backgroundColor: p.auraBg,
        boxShadow: `0 0 14px ${p.accentColor}30`,
      }}
      role="img"
      aria-label={p.name}
    >
      <defs>
        <radialGradient id={`bg_${uid}`} cx="50%" cy="42%" r="60%">
          <stop offset="0%" stopColor={p.accentColor} stopOpacity={p.isGhostEcho ? '0.35' : '0.22'} />
          <stop offset="100%" stopColor={p.auraBg} stopOpacity="1" />
        </radialGradient>
        <linearGradient id={`suit_${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={p.outfitPrimary} />
          <stop offset="100%" stopColor="#050a12" />
        </linearGradient>
      </defs>

      <rect width="64" height="64" rx="10" fill={`url(#bg_${uid})`} />

      {/* Tactical armor / jacket + shoulders */}
      <path
        d="M10 64 L14 45 Q22 40 32 40 Q42 40 50 45 L54 64 Z"
        fill={`url(#suit_${uid})`}
        stroke="#05080f"
        strokeWidth="2"
      />

      {/* Character-distinctive collar, pauldrons, or chest gear (Ref 3 inspired) */}
      {characterId === 'eli_shane' && (
        <>
          {/* Orange Shane pauldrons */}
          <path d="M11 47 Q17 40 24 44 L21 51 L12 52 Z" fill="#1e293b" stroke="#f97316" strokeWidth="1.8" />
          <path d="M53 47 Q47 40 40 44 L43 51 L52 52 Z" fill="#1e293b" stroke="#f97316" strokeWidth="1.8" />
          {/* Dual glowing cyan chest canisters */}
          <rect x="25" y="45" width="5.5" height="11" rx="2" fill="#38bdf8" stroke="#0f172a" strokeWidth="1.2" />
          <rect x="33.5" y="45" width="5.5" height="11" rx="2" fill="#22d3ee" stroke="#0f172a" strokeWidth="1.2" />
          <rect x="26.5" y="47" width="2" height="6" fill="#e0f2fe" />
          <rect x="35" y="47" width="2" height="6" fill="#e0f2fe" />
        </>
      )}

      {(characterId === 'dr_blakk' || characterId === 'comandante_blakk') && (
        <>
          {/* High crimson collar + armored shoulder trim + bandolier */}
          <path d="M18 42 L23 32 L28 45 Z" fill={p.outfitSecondary} stroke="#090d16" strokeWidth="1.4" />
          <path d="M46 42 L41 32 L36 45 Z" fill={p.outfitSecondary} stroke="#090d16" strokeWidth="1.4" />
          <path d="M20 43 L44 62" stroke="#991b1b" strokeWidth="4" strokeLinecap="round" />
          <circle cx="27" cy="49" r="2.2" fill="#ef4444" stroke="#090d16" strokeWidth="0.9" />
          <circle cx="34" cy="54" r="2.2" fill="#a855f7" stroke="#090d16" strokeWidth="0.9" />
        </>
      )}

      {characterId !== 'eli_shane' &&
        characterId !== 'dr_blakk' &&
        characterId !== 'comandante_blakk' && (
          <>
            <path d="M22 42 L32 50 L42 42" fill="none" stroke={p.outfitSecondary} strokeWidth="3.5" strokeLinecap="round" />
            <circle cx="32" cy="52" r="2.6" fill={p.accentColor} />
          </>
        )}

      {/* Neck */}
      <rect x="27" y="34" width="10" height="9" rx="3" fill={p.skinTone} />

      {/* Head shape */}
      {p.isMolenoid ? (
        <>
          {/* Snout & Molenoid ears */}
          <ellipse cx="32" cy="27" rx="14" ry="13" fill={p.skinTone} stroke="#060c14" strokeWidth="1.8" />
          <ellipse cx="32" cy="31" rx="8" ry="5.5" fill="#84cc16" stroke="#060c14" strokeWidth="1.2" />
          <circle cx="29.5" cy="30.5" r="1.1" fill="#1a2e05" />
          <circle cx="34.5" cy="30.5" r="1.1" fill="#1a2e05" />
        </>
      ) : p.isTroll ? (
        <>
          {/* Broad rugged Kord jaw + pointed troll ears */}
          <polygon points="15,24 11,20 17,30" fill={p.skinTone} stroke="#060c14" strokeWidth="1.4" />
          <polygon points="49,24 53,20 47,30" fill={p.skinTone} stroke="#060c14" strokeWidth="1.4" />
          <rect x="17" y="13" width="30" height="26" rx="11" fill={p.skinTone} stroke="#060c14" strokeWidth="1.8" />
        </>
      ) : (
        <>
          {/* Stylized anime head (angular for villains, crisp oval for heroes) */}
          <path
            d={
              p.isVillain
                ? 'M18 22 Q18 11 32 11 Q46 11 46 22 L43 34 L32 40 L21 34 Z'
                : 'M18 23 Q18 11 32 11 Q46 11 46 23 Q45 36 32 39 Q19 36 18 23 Z'
            }
            fill={p.skinTone}
            stroke="#060c14"
            strokeWidth="1.8"
          />
          {characterId === 'red_hook' && (
            <path d="M36 27 L41 33" stroke="#7f1d1d" strokeWidth="1.4" strokeLinecap="round" />
          )}
        </>
      )}

      {/* Hair / Helmet / Hood */}
      {characterId === 'eli_shane' && (
        <g>
          {/* Spiky navy-indigo Eli Shane hair */}
          <path
            d="M15 26 C13 15 20 6 32 6 C44 6 51 15 48 25 L45 18 L40 21 L35 14 L29 20 L23 15 L18 23 Z"
            fill={p.hairColor}
            stroke="#05080f"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path d="M22 12 Q31 8 40 12" fill="none" stroke={p.hairHighlight} strokeWidth="2" strokeLinecap="round" />
          <polygon points="45,16 52,19 46,23" fill={p.hairColor} stroke="#05080f" strokeWidth="1.2" />
        </g>
      )}

      {characterId === 'dr_blakk' && (
        <g>
          {/* Swept-back sharp widows-peak hair + goatee */}
          <path
            d="M17 24 L15 12 L23 15 L26 8 L32 15 L38 8 L41 15 L49 12 L47 24 L43 17 L32 19 L21 17 Z"
            fill={p.hairColor}
            stroke="#060c14"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <polygon points="29,37 32,45 35,37" fill={p.hairColor} stroke="#060c14" strokeWidth="1" />
        </g>
      )}

      {characterId === 'comandante_blakk' && (
        <g>
          <path d="M16 24 Q18 7 32 7 Q46 7 48 24 Z" fill="#18181b" stroke="#be123c" strokeWidth="1.8" />
          <rect x="20" y="21" width="24" height="5" rx="2" fill="#f43f5e" />
        </g>
      )}

      {characterId === 'trixie' && (
        <g>
          <path
            d="M16 28 Q16 8 32 8 Q48 8 48 28 L44 21 Q38 14 32 17 Q26 14 20 21 Z"
            fill={p.hairColor}
            stroke="#060c14"
            strokeWidth="1.6"
          />
          <rect x="20" y="13" width="24" height="3.5" rx="1.5" fill="#10b981" />
        </g>
      )}

      {characterId === 'will_shane' && (
        <g>
          <path
            d="M16 25 Q16 7 32 7 Q48 7 48 25 L43 16 L32 14 L21 16 Z"
            fill={p.hairColor}
            stroke="#060c14"
            strokeWidth="1.6"
          />
          <path d="M18 19 L23 15 M46 19 L41 15" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
        </g>
      )}

      {characterId === 'red_hook' && (
        <path
          d="M17 22 Q18 9 32 9 Q46 9 47 22 L42 15 L22 15 Z"
          fill={p.hairColor}
          stroke="#060c14"
          strokeWidth="1.6"
        />
      )}

      {characterId === 'twist' && (
        <path
          d="M14 30 Q14 6 32 6 Q50 6 50 30 L45 19 L32 16 L19 19 Z"
          fill={p.outfitPrimary}
          stroke="#4ade80"
          strokeWidth="1.6"
        />
      )}

      {characterId === 'mercader_subterraneo' && (
        <path
          d="M14 32 Q14 7 32 7 Q50 7 50 32 L44 20 Q32 16 20 20 Z"
          fill="#047857"
          stroke="#5eead4"
          strokeWidth="1.6"
        />
      )}

      {/* Goggles on brow for Pronto / Kord */}
      {p.hasGoggles && (
        <g>
          <rect x="18" y="14" width="28" height="6" rx="3" fill="#334155" stroke="#060c14" strokeWidth="1.2" />
          <circle cx="26" cy="17" r="4.5" fill="#38bdf8" stroke="#f59e0b" strokeWidth="1.6" />
          <circle cx="38" cy="17" r="4.5" fill="#38bdf8" stroke="#f59e0b" strokeWidth="1.6" />
          <circle cx="24.5" cy="15.5" r="1.3" fill="#ffffff" />
          <circle cx="36.5" cy="15.5" r="1.3" fill="#ffffff" />
        </g>
      )}

      {/* Expressive Eyes & Eyebrows */}
      {characterId !== 'comandante_blakk' && (
        <g>
          {/* Eyebrows */}
          {normMood === 'alerta' || normMood === 'decidido' || p.isVillain ? (
            <>
              <line x1="21" y1="22" x2="29" y2="24" stroke="#090d16" strokeWidth="2.1" strokeLinecap="round" />
              <line x1="43" y1="22" x2="35" y2="24" stroke="#090d16" strokeWidth="2.1" strokeLinecap="round" />
            </>
          ) : normMood === 'alegre' || normMood === 'sorpresa' ? (
            <>
              <path d="M21 22 Q25 19.5 29 22" fill="none" stroke="#090d16" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M35 22 Q39 19.5 43 22" fill="none" stroke="#090d16" strokeWidth="1.8" strokeLinecap="round" />
            </>
          ) : (
            <>
              <line x1="22" y1="22.5" x2="29" y2="22.5" stroke="#090d16" strokeWidth="1.7" strokeLinecap="round" />
              <line x1="35" y1="22.5" x2="42" y2="22.5" stroke="#090d16" strokeWidth="1.7" strokeLinecap="round" />
            </>
          )}

          {/* Eyes */}
          <ellipse cx="25.5" cy="26.5" rx="3.4" ry={normMood === 'sorpresa' ? '3.8' : '2.9'} fill="#ffffff" stroke="#060c14" strokeWidth="1.1" />
          <circle cx="26" cy="26.5" r="1.9" fill={p.eyeColor} />
          <circle cx="25" cy="25.5" r="0.8" fill="#ffffff" />

          {characterId === 'red_hook' ? (
            <>
              <line x1="34" y1="23" x2="44" y2="29" stroke="#090d16" strokeWidth="1.6" />
              <ellipse cx="38.5" cy="26.5" rx="3.8" ry="3.0" fill="#18181b" stroke="#090d16" strokeWidth="1.2" />
            </>
          ) : (
            <>
              <ellipse cx="38.5" cy="26.5" rx="3.4" ry={normMood === 'sorpresa' ? '3.8' : '2.9'} fill="#ffffff" stroke="#060c14" strokeWidth="1.1" />
              <circle cx="38" cy="26.5" r="1.9" fill={p.eyeColor} />
              <circle cx="37" cy="25.5" r="0.8" fill="#ffffff" />
            </>
          )}
        </g>
      )}

      {/* Expressive Mouth */}
      {normMood === 'alegre' || normMood === 'decidido' ? (
        <path
          d={p.isVillain ? 'M26 34 Q32 37 39 32.5' : 'M26 33 Q32 37.5 38 33 Z'}
          fill={p.isVillain ? 'none' : '#ffffff'}
          stroke="#060c14"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      ) : normMood === 'alerta' ? (
        <path d="M26 35 L30 33 L34 33 L38 35" fill="none" stroke="#060c14" strokeWidth="1.4" strokeLinecap="round" />
      ) : normMood === 'sorpresa' ? (
        <ellipse cx="32" cy="34.5" rx="2.4" ry="2.2" fill="#7f1d1d" stroke="#060c14" strokeWidth="1.1" />
      ) : (
        <path d="M27 33.8 Q32 35.8 37 33.8" fill="none" stroke="#060c14" strokeWidth="1.3" strokeLinecap="round" />
      )}

      {/* Ghostly Echo hologram scanlines for Will Shane */}
      {p.isGhostEcho && (
        <g opacity="0.22" stroke="#67e8f9" strokeWidth="1">
          <line x1="6" y1="16" x2="58" y2="16" />
          <line x1="6" y1="30" x2="58" y2="30" />
          <line x1="6" y1="44" x2="58" y2="44" />
        </g>
      )}
    </svg>
  );
};
