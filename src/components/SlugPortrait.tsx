import React, { useId } from 'react';
import { getSpecies } from '../game/data';

export type SlugPortraitMood = 'idle' | 'happy' | 'attack' | 'hit' | 'ko' | 'sleep';

interface SlugPortraitProps {
  speciesId: string;
  mega?: boolean;
  mood?: SlugPortraitMood;
  size?: number;
  flipX?: boolean;
  className?: string;
}

/**
 * Crisp expressive pixel-inspired vector portrait for each of the 15 Bajoterra slug species.
 * Renders cleanly at any resolution with zero external image dependencies (works offline & file://).
 */
export const SlugPortrait: React.FC<SlugPortraitProps> = ({
  speciesId,
  mega = false,
  mood = 'idle',
  size = 44,
  flipX = false,
  className = '',
}) => {
  const reactId = useId();
  const sp = getSpecies(speciesId);
  const bodyColor = sp.color;
  const accentColor = sp.accent;
  const isShadow = speciesId === 'darkfurnus' || speciesId === 'umbrospect';
  const eyeColor = isShadow ? '#fde047' : '#061018';
  const uid = `${speciesId}_${mega ? 'm' : 'n'}_${reactId.replace(/:/g, '')}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={`shrink-0 select-none ${className}`}
      style={{
        transform: flipX ? 'scaleX(-1)' : undefined,
        filter:
          mood === 'ko'
            ? 'grayscale(0.75) opacity(0.65)'
            : mega
            ? `drop-shadow(0 0 5px rgba(251, 191, 36, 0.6))`
            : `drop-shadow(0 2px 4px rgba(2, 6, 12, 0.55))`,
      }}
      role="img"
      aria-label={sp.name}
    >
      <defs>
        <radialGradient id={`glow_${uid}`} cx="50%" cy="55%" r="50%">
          <stop offset="0%" stopColor={mega ? '#fde047' : accentColor} stopOpacity="0.38" />
          <stop offset="100%" stopColor={bodyColor} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Ambient Elemental Halo */}
      <circle cx="16" cy="17" r="14" fill={`url(#glow_${uid})`} />

      {/* Ground Shadow */}
      <ellipse cx="16" cy="27.5" rx="8.5" ry="2.2" fill="rgba(2, 6, 12, 0.5)" />

      {/* Megamorph Golden Aura Ring */}
      {mega && (
        <g>
          <circle
            cx="16"
            cy="16.5"
            r="12.5"
            fill="none"
            stroke="#fbbf24"
            strokeOpacity="0.45"
            strokeWidth="0.9"
            strokeDasharray="3 2"
          />
          <path
            d="M11 4.5 L13.5 7 L16 3 L18.5 7 L21 4.5 L20 8.5 L12 8.5 Z"
            fill="#fbbf24"
            stroke="#fef08a"
            strokeWidth="0.9"
          />
          <circle cx="7" cy="10" r="1" fill="#fef08a" />
          <circle cx="25" cy="9" r="1" fill="#fef08a" />
        </g>
      )}

      {/* Species Anatomical Silhouette Back Layer (Crests / Fins / Horns) */}
      {(speciesId === 'infurnus' || speciesId === 'piroclasto') && (
        <g>
          <path
            d="M12 10 Q14 3 16 6 Q18 2 20 8 Q22 5 21 11 Z"
            fill="#f97316"
            stroke="#fde047"
            strokeWidth="0.9"
          />
          {speciesId === 'piroclasto' && (
            <path d="M9 17 L12 15 M20 15 L23 17" stroke="#fb923c" strokeWidth="1.4" strokeLinecap="round" />
          )}
        </g>
      )}

      {speciesId === 'flaringo' && (
        <path
          d="M14 9 Q15 2 20 5 Q18 8 21 10 Z"
          fill="#fb7185"
          stroke="#fef08a"
          strokeWidth="0.9"
        />
      )}

      {speciesId === 'aquabeak' && (
        <g>
          <path d="M14 9 Q16 3 19 8" fill="#38bdf8" stroke="#bae6fd" strokeWidth="1" />
          <path d="M8 18 L11 16 L11 21 Z" fill="#38bdf8" stroke="#bae6fd" strokeWidth="0.8" />
          <path d="M24 18 L21 16 L21 21 Z" fill="#38bdf8" stroke="#bae6fd" strokeWidth="0.8" />
        </g>
      )}

      {(speciesId === 'tazerling' || speciesId === 'voltrix') && (
        <g stroke="#fef08a" strokeWidth="1.5" strokeLinecap="round" fill="none">
          <polyline points="12,10 10,6 12.5,5.5 11,3" />
          <polyline points="20,10 22,6 19.5,5.5 21,3" />
          {speciesId === 'voltrix' && (
            <path d="M9 15.5 L11 15.5 M21 15.5 L23 15.5" stroke="#60a5fa" strokeWidth="1.4" />
          )}
        </g>
      )}

      {(speciesId === 'frostcrawler' || speciesId === 'glaciomita') && (
        <g fill="#e0f2fe" stroke="#38bdf8" strokeWidth="0.8">
          <polygon points="12,10 10.5,4.5 14.5,8.5" />
          <polygon points="16,8.5 16,3 18.5,8.5" />
          <polygon points="19.5,9.5 22,5 21,11" />
        </g>
      )}

      {(speciesId === 'darkfurnus' || speciesId === 'umbrospect') && (
        <g>
          <path d="M12 11 Q9 6 11 4 Q13 7 14 10" fill="#a855f7" stroke="#f3e8ff" strokeWidth="0.8" />
          <path d="M20 11 Q23 6 21 4 Q19 7 18 10" fill="#a855f7" stroke="#f3e8ff" strokeWidth="0.8" />
        </g>
      )}

      {speciesId === 'musgacorn' && (
        <g>
          <path d="M16 9 L16 4" stroke="#4ade80" strokeWidth="1.8" strokeLinecap="round" />
          <ellipse cx="18.2" cy="4.5" rx="2.4" ry="1.3" fill="#86efac" transform="rotate(-15 18.2 4.5)" />
        </g>
      )}

      {speciesId === 'lariat' && (
        <g fill="#d97706" stroke="#fde68a" strokeWidth="0.8">
          <polygon points="13,10 11.5,5.5 15,9" />
          <polygon points="19,10 20.5,5.5 17,9" />
        </g>
      )}

      {(speciesId === 'enigmo' || speciesId === 'aetherion') && (
        <g>
          <polygon
            points="16,3 18.5,7.2 16,10 13.5,7.2"
            fill={speciesId === 'aetherion' ? '#fef08a' : '#5eead4'}
            stroke="#ffffff"
            strokeWidth="0.8"
          />
          {speciesId === 'aetherion' && (
            <g fill="none" stroke="#99f6e4" strokeWidth="1" opacity="0.8">
              <path d="M9.5 17 Q6.5 14 8.5 11.5" strokeLinecap="round" />
              <path d="M22.5 17 Q25.5 14 23.5 11.5" strokeLinecap="round" />
            </g>
          )}
        </g>
      )}

      {speciesId === 'doc' && (
        <ellipse
          cx="16"
          cy="6.2"
          rx="5.5"
          ry="1.7"
          fill="none"
          stroke="#fef08a"
          strokeWidth="1.4"
        />
      )}

      {/* Antennae (for classic slug species) */}
      {(speciesId === 'infurnus' ||
        speciesId === 'doc' ||
        speciesId === 'lariat' ||
        speciesId === 'enigmo' ||
        speciesId === 'flaringo' ||
        speciesId === 'aetherion') && (
        <g stroke={accentColor} strokeWidth="1.5" strokeLinecap="round">
          <line x1="12.5" y1="10.5" x2="10.5" y2="6.8" />
          <line x1="19.5" y1="10.5" x2="21.5" y2="6.8" />
          <circle cx="10.5" cy="6.6" r="1.1" fill={accentColor} stroke="none" />
          <circle cx="21.5" cy="6.6" r="1.1" fill={accentColor} stroke="none" />
        </g>
      )}

      {/* Tail */}
      <path
        d="M11 22 Q7 23.5 7.5 26 Q10 27 13 25.5 Z"
        fill={bodyColor}
        stroke="#071018"
        strokeWidth="1.2"
      />

      {/* Torso + Rounded Slug Head */}
      <path
        d="M10.5 16.5 C10.5 11.2 12.8 9 16 9 C19.2 9 21.5 11.2 21.5 16.5 C21.5 21.5 22.5 25.5 19.5 26.5 C17.5 27 14.5 27 12.5 26.5 C9.5 25.5 10.5 21.5 10.5 16.5 Z"
        fill={bodyColor}
        stroke="#071018"
        strokeWidth="1.4"
      />

      {/* Specular Rim Highlight */}
      <path
        d="M12.5 13 C12.8 11 14.2 10.3 15.8 10.3"
        fill="none"
        stroke="rgba(255,255,255,0.45)"
        strokeWidth="1.2"
        strokeLinecap="round"
      />

      {/* Belly Plate */}
      <path
        d="M12.5 18.5 C12.5 16.5 19.5 16.5 19.5 18.5 C19.5 23 18.5 25.8 16 25.8 C13.5 25.8 12.5 23 12.5 18.5 Z"
        fill={accentColor}
        opacity="0.88"
      />

      {/* Lariat Lasso Belt / Musgacorn Leaf Collar */}
      {speciesId === 'lariat' && (
        <path d="M10.8 20.5 Q16 22 21.2 20.5" fill="none" stroke="#fbbf24" strokeWidth="1.8" strokeLinecap="round" />
      )}
      {speciesId === 'musgacorn' && (
        <path d="M11 17.5 Q16 19.5 21 17.5" fill="none" stroke="#16a34a" strokeWidth="1.8" strokeLinecap="round" />
      )}

      {/* Aquabeak Beak / Umbrospect Third Eye */}
      {speciesId === 'aquabeak' && (
        <polygon points="14.5,16.5 17.5,16.5 16,18.2" fill="#fde047" stroke="#071018" strokeWidth="0.6" />
      )}
      {speciesId === 'umbrospect' && (
        <ellipse cx="16" cy="11.8" rx="1.6" ry="1" fill="#f472b6" stroke="#fdf4ff" strokeWidth="0.5" />
      )}
      {speciesId === 'doc' && (
        <circle cx="16" cy="11.5" r="1.2" fill="#2dd4bf" stroke="#ffffff" strokeWidth="0.5" />
      )}

      {/* Expressive Eyes by Mood */}
      {mood === 'sleep' ? (
        <g stroke="#09111a" strokeWidth="1.3" strokeLinecap="round">
          <path d="M12.6 14.5 Q13.7 15.4 14.8 14.5" fill="none" />
          <path d="M17.2 14.5 Q18.3 15.4 19.4 14.5" fill="none" />
        </g>
      ) : mood === 'ko' ? (
        <g stroke="#09111a" strokeWidth="1.3" strokeLinecap="round">
          <line x1="12.6" y1="13.5" x2="14.6" y2="15.5" />
          <line x1="14.6" y1="13.5" x2="12.6" y2="15.5" />
          <line x1="17.4" y1="13.5" x2="19.4" y2="15.5" />
          <line x1="19.4" y1="13.5" x2="17.4" y2="15.5" />
        </g>
      ) : mood === 'happy' ? (
        <g>
          <path d="M12.4 15 Q13.7 13.3 15 15" fill="none" stroke={eyeColor} strokeWidth="1.5" strokeLinecap="round" />
          <path d="M17 15 Q18.3 13.3 19.6 15" fill="none" stroke={eyeColor} strokeWidth="1.5" strokeLinecap="round" />
          <path d="M14.6 17 Q16 18.2 17.4 17" fill="none" stroke="#09111a" strokeWidth="1" strokeLinecap="round" />
        </g>
      ) : mood === 'attack' ? (
        <g>
          <ellipse cx="13.7" cy="14.5" rx="1.2" ry="1.4" fill={eyeColor} />
          <ellipse cx="18.3" cy="14.5" rx="1.2" ry="1.4" fill={eyeColor} />
          <circle cx="13.3" cy="14" r="0.45" fill="#ffffff" />
          <circle cx="17.9" cy="14" r="0.45" fill="#ffffff" />
          <line x1="12.2" y1="12.4" x2="14.9" y2="13.3" stroke="#071018" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="19.8" y1="12.4" x2="17.1" y2="13.3" stroke="#071018" strokeWidth="1.2" strokeLinecap="round" />
        </g>
      ) : mood === 'hit' ? (
        <g>
          <path d="M12.4 13.6 L14.8 14.5 L12.4 15.4" fill="none" stroke={eyeColor} strokeWidth="1.3" strokeLinecap="round" />
          <path d="M19.6 13.6 L17.2 14.5 L19.6 15.4" fill="none" stroke={eyeColor} strokeWidth="1.3" strokeLinecap="round" />
        </g>
      ) : (
        <g>
          <ellipse cx="13.7" cy="14.5" rx="1.25" ry="1.5" fill={eyeColor} />
          <ellipse cx="18.3" cy="14.5" rx="1.25" ry="1.5" fill={eyeColor} />
          <circle cx="13.3" cy="13.9" r="0.5" fill="#ffffff" />
          <circle cx="17.9" cy="13.9" r="0.5" fill="#ffffff" />
        </g>
      )}
    </svg>
  );
};
