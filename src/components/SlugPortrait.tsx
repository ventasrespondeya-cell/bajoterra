import React, { useId } from 'react';
import { getSpecies } from '../game/data';
import { getSlugDesignSheet } from '../game/slugArtDirection';

export type SlugPortraitMood =
  | 'idle'
  | 'happy'
  | 'play'
  | 'eat'
  | 'rest'
  | 'sleep'
  | 'react'
  | 'charge'
  | 'transform'
  | 'attack'
  | 'hit'
  | 'ko'
  | 'victory';

interface SlugPortraitProps {
  speciesId: string;
  mega?: boolean;
  mood?: SlugPortraitMood;
  size?: number;
  flipX?: boolean;
  animated?: boolean;
  className?: string;
}

interface AnatomySpec {
  torsoPath: string;
  bellyPath: string;
  tailPath: string;
  rimHighlight: string;
  eyeLeft: [number, number];
  eyeRight: [number, number];
  mouthY: number;
  shadowRx: number;
}

/**
 * Distinct per-species SVG anatomical geometry calibrated against Art Direction sheets.
 * Guarantees each creature has its own silhouette, width/height ratio, jaw/shoulder posture and tail.
 */
function getAnatomyGeometry(speciesId: string): AnatomySpec {
  switch (speciesId) {
    // ---- PROTOTYPE TRIO ----
    case 'infurnus':
      return {
        // Tall slender upright flame torso tapering gracefully to a fierce brow
        torsoPath:
          'M11.6 15.2 C11.4 10.6 13.3 8.4 16 8.4 C18.7 8.4 20.6 10.6 20.4 15.2 C20.3 20.2 21.2 24.8 18.8 26.2 C17.1 26.9 14.9 26.9 13.2 26.2 C10.8 24.8 11.7 20.2 11.6 15.2 Z',
        bellyPath:
          'M13.3 18.2 C13.5 16.3 18.5 16.3 18.7 18.2 C18.8 22.6 17.8 25.6 16 25.6 C14.2 25.6 13.2 22.6 13.3 18.2 Z',
        tailPath: 'M12 22.5 Q6.8 21.8 6.2 25.2 Q9.5 27.6 13.5 25.5 Z',
        rimHighlight: 'M12.9 12.6 C13.1 10.4 14.3 9.6 15.9 9.5',
        eyeLeft: [13.9, 13.9],
        eyeRight: [18.1, 13.9],
        mouthY: 16.7,
        shadowRx: 7.8,
      };
    case 'frostcrawler':
      return {
        // Wide low-slung armored beetle crawler hugging the cavern ground
        torsoPath:
          'M7.8 18.6 C7.6 13.4 10.8 10.4 16 10.4 C21.2 10.4 24.4 13.4 24.2 18.6 C24.1 22.8 23.6 26.2 19.6 26.7 C17.3 27 14.7 27 12.4 26.7 C8.4 26.2 7.9 22.8 7.8 18.6 Z',
        bellyPath:
          'M10.4 19.4 C10.8 17.4 21.2 17.4 21.6 19.4 C21.6 23.2 19.8 25.9 16 25.9 C12.2 25.9 10.4 23.2 10.4 19.4 Z',
        tailPath: 'M9 22.6 Q5 23.6 5.4 26.4 Q8.4 27.4 11.4 25.8 Z',
        rimHighlight: 'M9.8 14.4 C10.6 12.1 12.6 11.3 15.6 11.3',
        eyeLeft: [13.0, 15.2],
        eyeRight: [19.0, 15.2],
        mouthY: 17.8,
        shadowRx: 10.4,
      };
    case 'tazerling':
      return {
        // Agile sprinter with oversized expressive cheeks and tapered base
        torsoPath:
          'M11.2 15.4 C10.8 11.1 12.9 9.3 16 9.3 C19.1 9.3 21.2 11.1 20.8 15.4 C21.8 17.2 21.8 19.6 20.2 21.4 C20 24.2 19.2 26.2 16 26.5 C12.8 26.2 12 24.2 11.8 21.4 C10.2 19.6 10.2 17.2 11.2 15.4 Z',
        bellyPath:
          'M13.1 18.2 C13.3 16.5 18.7 16.5 18.9 18.2 C18.9 22.4 17.9 25.4 16 25.4 C14.1 25.4 13.1 22.4 13.1 18.2 Z',
        tailPath: 'M12.1 23.2 L6.5 21.4 L8.6 23.8 L5.8 25.9 L12.4 25.6 Z',
        rimHighlight: 'M12.3 12.8 C12.8 10.9 14.1 10.3 15.6 10.3',
        eyeLeft: [13.5, 14.1],
        eyeRight: [18.5, 14.1],
        mouthY: 16.8,
        shadowRx: 7.5,
      };

    // ---- ACTO I: CUEVAS VERDES ----
    case 'aquabeak':
      return {
        // Streamlined teardrop diver with subtle flipper hips
        torsoPath:
          'M10.4 16.2 C10.4 11.2 12.8 9.2 16 9.2 C19.2 9.2 21.6 11.2 21.6 16.2 C22 20.6 21.2 25.6 18.4 26.6 L13.6 26.6 C10.8 25.6 10 20.6 10.4 16.2 Z',
        bellyPath:
          'M12.4 18.6 C12.6 16.8 19.4 16.8 19.6 18.6 C19.6 22.8 18.3 25.8 16 25.8 C13.7 25.8 12.4 22.8 12.4 18.6 Z',
        tailPath: 'M11.6 23.2 Q6.6 21.8 6.4 24.4 Q6.6 27 12.4 25.8 Z',
        rimHighlight: 'M12.2 13 C12.6 11 14 10.4 15.8 10.4',
        eyeLeft: [13.6, 14.2],
        eyeRight: [18.4, 14.2],
        mouthY: 16.8,
        shadowRx: 8.6,
      };
    case 'musgacorn':
      return {
        // Plump botanical guardian with sturdy moss shell hips
        torsoPath:
          'M9.6 16.8 C9.8 11.6 12.5 9.6 16 9.6 C19.5 9.6 22.2 11.6 22.4 16.8 C22.8 21.8 22 26.1 19 26.7 C17 27.1 15 27.1 13 26.7 C10 26.1 9.2 21.8 9.6 16.8 Z',
        bellyPath:
          'M12.1 19 C12.4 17.2 19.6 17.2 19.9 19 C19.9 23.2 18.5 25.9 16 25.9 C13.5 25.9 12.1 23.2 12.1 19 Z',
        tailPath: 'M10.5 22.8 Q6.6 22.4 7.2 25.6 Q9.6 27.2 12.8 25.8 Z',
        rimHighlight: 'M11.6 13.6 C12.1 11.5 13.8 10.8 15.8 10.8',
        eyeLeft: [13.5, 14.6],
        eyeRight: [18.5, 14.6],
        mouthY: 17.2,
        shadowRx: 9.2,
      };
    case 'doc':
      return {
        // Graceful buoyant healer tapering delicately toward its hovering tail
        torsoPath:
          'M11.5 15.2 C11.5 10.4 13.5 8.8 16 8.8 C18.5 8.8 20.5 10.4 20.5 15.2 C20.4 19.8 19.8 24.4 17.8 25.8 C16.7 26.4 15.3 26.4 14.2 25.8 C12.2 24.4 11.6 19.8 11.5 15.2 Z',
        bellyPath:
          'M13.2 17.8 C13.4 16.2 18.6 16.2 18.8 17.8 C18.8 21.8 17.7 24.8 16 24.8 C14.3 24.8 13.2 21.8 13.2 17.8 Z',
        tailPath: 'M12.8 22.2 Q8.4 22.8 8.8 25.2 Q11.4 26.2 14.2 24.8 Z',
        rimHighlight: 'M12.9 12.6 C13.2 10.6 14.4 9.8 16 9.8',
        eyeLeft: [13.9, 14.0],
        eyeRight: [18.1, 14.0],
        mouthY: 16.4,
        shadowRx: 7.0,
      };

    // ---- ACTO II: CUEVAS HELADAS ----
    case 'glaciomita':
      return {
        // Faceted angular crystal stalagmite body
        torsoPath:
          'M11 16 L12.2 10.4 L16 8.6 L19.8 10.4 L21 16 L20.4 24.6 L18 26.6 L14 26.6 L11.6 24.6 Z',
        bellyPath:
          'M13.2 17.8 L16 16.6 L18.8 17.8 L18.2 25 L16 25.8 L13.8 25 Z',
        tailPath: 'M11.6 22.6 L6.4 23.4 L7.8 26.2 L12.6 25.5 Z',
        rimHighlight: 'M12.6 13.8 L13.4 10.8 L15.8 9.8',
        eyeLeft: [13.7, 14.4],
        eyeRight: [18.3, 14.4],
        mouthY: 16.8,
        shadowRx: 8.2,
      };
    case 'voltrix':
      return {
        // Razor-sleek rail viper posture with flared conductive shoulders
        torsoPath:
          'M11.8 14.6 C11.4 10.4 13.3 8.8 16 8.8 C18.7 8.8 20.6 10.4 20.2 14.6 L21.4 18.8 L19.4 25.8 L16 26.8 L12.6 25.8 L10.6 18.8 Z',
        bellyPath:
          'M13.4 17.6 L18.6 17.6 L17.8 25.2 L16 26 L14.2 25.2 Z',
        tailPath: 'M12.4 22.8 L6.2 21.8 L8.5 24.6 L12.8 25.6 Z',
        rimHighlight: 'M12.8 12.6 C13.2 10.6 14.2 9.9 15.8 9.9',
        eyeLeft: [13.9, 13.8],
        eyeRight: [18.1, 13.8],
        mouthY: 16.2,
        shadowRx: 7.4,
      };

    // ---- ACTO III: CAVERNAS DE MAGMA ----
    case 'flaringo':
      return {
        // Tall curved acrobat silhouette
        torsoPath:
          'M11.4 15 C11.2 10.2 13.2 8.4 16 8.4 C18.8 8.4 20.8 10.2 20.6 15 C20.6 20.4 20.8 24.8 18.6 26.3 L13.4 26.3 C11.2 24.8 11.4 20.4 11.4 15 Z',
        bellyPath:
          'M13.2 18.2 C13.5 16.2 18.5 16.2 18.8 18.2 C18.8 22.5 17.8 25.4 16 25.4 C14.2 25.4 13.2 22.5 13.2 18.2 Z',
        tailPath: 'M11.8 22.4 Q6.4 20.2 6.8 24.2 Q9.5 27.2 13.2 25.6 Z',
        rimHighlight: 'M12.7 12.4 C13 10.3 14.3 9.5 15.8 9.5',
        eyeLeft: [13.8, 13.9],
        eyeRight: [18.2, 13.9],
        mouthY: 16.4,
        shadowRx: 7.8,
      };
    case 'lariat':
      return {
        // Broad boulder-shouldered basalt brute
        torsoPath:
          'M8.2 16.8 C8.2 11.4 11.4 9.6 16 9.6 C20.6 9.6 23.8 11.4 23.8 16.8 C23.8 22.2 22.6 26 19.6 26.7 L12.4 26.7 C9.4 26 8.2 22.2 8.2 16.8 Z',
        bellyPath:
          'M10.8 18.8 L21.2 18.8 L19.8 25.8 L12.2 25.8 Z',
        tailPath: 'M9.2 22.4 L5.4 24.4 L7.2 26.6 L11.8 25.6 Z',
        rimHighlight: 'M10.2 13.6 C11 11.4 13 10.6 15.8 10.6',
        eyeLeft: [13.1, 14.6],
        eyeRight: [18.9, 14.6],
        mouthY: 17.4,
        shadowRx: 10.2,
      };
    case 'piroclasto':
      return {
        // Massive jagged obsidian volcanic titan
        torsoPath:
          'M8.4 17.4 L9.6 11.4 L13.4 9.6 L18.6 9.6 L22.4 11.4 L23.6 17.4 L22 25.6 L19 26.8 L13 26.8 L10 25.6 Z',
        bellyPath:
          'M11.6 18.4 L20.4 18.4 L19.4 25.8 L12.6 25.8 Z',
        tailPath: 'M9.6 22.4 L5.4 23.6 L6.8 26.4 L11.4 25.8 Z',
        rimHighlight: 'M10.5 14 L11.4 11.2 L14.8 10.6',
        eyeLeft: [13.2, 14.6],
        eyeRight: [18.8, 14.6],
        mouthY: 17.3,
        shadowRx: 10.0,
      };

    // ---- ACTO IV: CAVERNAS SOMBRÍAS ----
    case 'enigmo':
      return {
        // Oversized psychic cranium with narrow tapered floating base
        torsoPath:
          'M9.4 14.4 C9.4 9.4 12.2 7.8 16 7.8 C19.8 7.8 22.6 9.4 22.6 14.4 C22.6 18.2 20.6 21.4 18.8 24.8 C17.6 26.4 14.4 26.4 13.2 24.8 C11.4 21.4 9.4 18.2 9.4 14.4 Z',
        bellyPath:
          'M13 18.6 C13.2 17 18.8 17 19 18.6 C18.8 22 17.6 24.8 16 24.8 C14.4 24.8 13.2 22 13 18.6 Z',
        tailPath: 'M12.2 22.8 Q7.6 23.4 8.2 26 Q11 26.8 14 25.2 Z',
        rimHighlight: 'M11.2 12 C11.8 9.8 13.4 8.9 15.8 8.9',
        eyeLeft: [13.2, 14.8],
        eyeRight: [18.8, 14.8],
        mouthY: 17.2,
        shadowRx: 7.4,
      };
    case 'darkfurnus':
      return {
        // Jagged abyss wyvern posture
        torsoPath:
          'M10.6 15.2 L11.8 9.6 L16 8.4 L20.2 9.6 L21.4 15.2 L20.8 24.8 L18.4 26.6 L13.6 26.6 L11.2 24.8 Z',
        bellyPath:
          'M12.8 18 L19.2 18 L18.4 25.6 L16 26.2 L13.6 25.6 Z',
        tailPath: 'M11.2 22.6 L5.6 21.6 L7.6 24.8 L12.4 25.8 Z',
        rimHighlight: 'M12.2 13.4 L13 10.4 L15.6 9.5',
        eyeLeft: [13.6, 14.0],
        eyeRight: [18.4, 14.0],
        mouthY: 16.6,
        shadowRx: 8.4,
      };
    case 'umbrospect':
      return {
        // Ghostly tattered shroud silhouette floating above ground
        torsoPath:
          'M10.4 14.6 C10.4 10 12.8 8.4 16 8.4 C19.2 8.4 21.6 10 21.6 14.6 L22.6 24.4 L19.8 22.8 L18 25.8 L16 23.8 L14 25.8 L12.2 22.8 L9.4 24.4 Z',
        bellyPath:
          'M13 17.4 C13.2 15.8 18.8 15.8 19 17.4 L18.4 23.2 L16 22.2 L13.6 23.2 Z',
        tailPath: 'M10.5 21.5 Q6.8 22.6 7.4 25.2 Q10 25.2 12 23.6 Z',
        rimHighlight: 'M12 12.5 C12.4 10.4 13.9 9.5 15.8 9.5',
        eyeLeft: [13.6, 14.6],
        eyeRight: [18.4, 14.6],
        mouthY: 17.2,
        shadowRx: 7.2,
      };
    case 'aetherion':
    default:
      return {
        // Regal floating crystalline guardian
        torsoPath:
          'M11 14.8 C11 10 13 8.2 16 8.2 C19 8.2 21 10 21 14.8 C21 19.6 20 24 18 25.8 L16 26.6 L14 25.8 C12 24 11 19.6 11 14.8 Z',
        bellyPath:
          'M13.2 17.6 L16 16.2 L18.8 17.6 L18 24.6 L16 25.6 L14 24.6 Z',
        tailPath: 'M12 21.6 L6.8 20.6 L8.6 23.6 L13 24.8 Z',
        rimHighlight: 'M12.4 12.2 C12.8 10 14.2 9.2 16 9.2',
        eyeLeft: [13.7, 13.8],
        eyeRight: [18.3, 13.8],
        mouthY: 16.4,
        shadowRx: 7.6,
      };
  }
}

export const SlugPortrait: React.FC<SlugPortraitProps> = ({
  speciesId,
  mega = false,
  mood = 'idle',
  size = 44,
  flipX = false,
  animated = true,
  className = '',
}) => {
  const reactId = useId();
  const sp = getSpecies(speciesId);
  const sheet = getSlugDesignSheet(speciesId);
  const geo = getAnatomyGeometry(speciesId);

  const primary = sheet.palette.primary;
  const secondary = sheet.palette.secondary;
  const belly = sheet.palette.belly;
  const shadow = sheet.palette.shadow;
  const highlight = sheet.palette.highlight;
  const isShadowType = speciesId === 'darkfurnus' || speciesId === 'umbrospect' || speciesId === 'piroclasto';
  const irisColor = isShadowType ? sheet.palette.eyeIris : '#061018';
  const uid = `${speciesId}_${mega ? 'm' : 'n'}_${reactId.replace(/:/g, '')}`;

  const poseAnimClass =
    !animated || mood === 'ko' || mood === 'hit'
      ? ''
      : mood === 'happy' || mood === 'victory' || mood === 'react'
      ? 'bt-slug-pose-happy'
      : mood === 'play'
      ? 'bt-slug-pose-play'
      : mood === 'eat'
      ? 'bt-slug-pose-eat'
      : mood === 'sleep' || mood === 'rest'
      ? 'bt-slug-pose-sleep'
      : mood === 'attack' || mood === 'charge' || mood === 'transform'
      ? 'bt-slug-pose-attack'
      : 'bt-slug-pose-idle';

  const canBlink =
    animated && mood !== 'sleep' && mood !== 'rest' && mood !== 'ko' && mood !== 'hit';

  const [lx, ly] = geo.eyeLeft;
  const [rx, ry] = geo.eyeRight;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={`shrink-0 select-none overflow-visible ${className}`}
      style={{
        transform: flipX ? 'scaleX(-1)' : undefined,
        filter:
          mood === 'ko'
            ? 'grayscale(0.78) opacity(0.65)'
            : mega
            ? 'drop-shadow(0 0 6px rgba(251, 191, 36, 0.65))'
            : `drop-shadow(0 2px 4px rgba(2, 6, 12, 0.58))`,
      }}
      role="img"
      aria-label={sp.name}
    >
      <defs>
        <radialGradient id={`glow_${uid}`} cx="50%" cy="55%" r="52%">
          <stop offset="0%" stopColor={mega ? '#fde047' : sheet.palette.energyCore} stopOpacity="0.4" />
          <stop offset="100%" stopColor={primary} stopOpacity="0" />
        </radialGradient>
        {/* Unified -45deg top-left lighting gradient */}
        <linearGradient id={`body_${uid}`} x1="15%" y1="10%" x2="88%" y2="95%">
          <stop offset="0%" stopColor={highlight} stopOpacity="0.34" />
          <stop offset="32%" stopColor={primary} stopOpacity="1" />
          <stop offset="100%" stopColor={shadow} stopOpacity="1" />
        </linearGradient>
      </defs>

      {/* Ambient Elemental Halo */}
      <circle cx="16" cy="17" r="14" fill={`url(#glow_${uid})`} />

      {/* Ground Contact Shadow */}
      <ellipse cx="16" cy="27.6" rx={geo.shadowRx} ry="2.2" fill="rgba(2, 6, 12, 0.52)" />

      {/* Animated Creature Group */}
      <g className={poseAnimClass}>
        {/* Late-game Megamorph Aura Ring + Crown */}
        {mega && (
          <g>
            <circle
              cx="16"
              cy="16.5"
              r="12.8"
              fill="none"
              stroke="#fbbf24"
              strokeOpacity="0.52"
              strokeWidth="1"
              strokeDasharray="3 2"
            />
            <path
              d="M11.2 4.4 L13.5 6.8 L16 2.6 L18.5 6.8 L20.8 4.4 L19.8 8.2 L12.2 8.2 Z"
              fill="#fbbf24"
              stroke="#fef08a"
              strokeWidth="0.85"
            />
          </g>
        )}

        {/* Tail Layer */}
        <path
          d={geo.tailPath}
          fill={shadow}
          stroke="#060c14"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />

        {/* Back Anatomical Layer (Crests / Wings / Horns / Spikes / Aura) */}
        {speciesId === 'infurnus' && (
          <g>
            <path
              d="M12.2 9.4 Q13.8 2.4 16.2 5.8 Q18.4 1.6 19.9 7.6 Q21.5 4.8 20.3 10.6 Z"
              fill={secondary}
              stroke="#060c14"
              strokeWidth="1.0"
              strokeLinejoin="round"
            />
            <path d="M14.2 8.8 Q16 4.4 17.8 8.6 Z" fill={belly} />
            <line x1="12.6" y1="10.2" x2="10.6" y2="6.2" stroke={secondary} strokeWidth="1.2" strokeLinecap="round" />
            <line x1="19.4" y1="10.2" x2="21.4" y2="6.2" stroke={secondary} strokeWidth="1.2" strokeLinecap="round" />
            <circle cx="10.5" cy="6.1" r="1.0" fill={belly} />
            <circle cx="21.5" cy="6.1" r="1.0" fill={belly} />
          </g>
        )}

        {speciesId === 'frostcrawler' && (
          <g>
            {/* Three jagged crystal frost spikes + heavy side frost plates */}
            <polygon points="9.8,12.5 8.1,6.8 12.4,10.5" fill="#bae6fd" stroke="#060c14" strokeWidth="1.0" />
            <polygon points="14.2,10.8 16,4.2 17.8,10.8" fill="#f0f9ff" stroke="#060c14" strokeWidth="1.0" />
            <polygon points="19.6,10.5 23.9,6.8 22.2,12.5" fill="#bae6fd" stroke="#060c14" strokeWidth="1.0" />
            <path d="M6.4 19 L9.2 17.6 L9.2 21.8 Z" fill="#67e8f9" stroke="#060c14" strokeWidth="0.9" />
            <path d="M25.6 19 L22.8 17.6 L22.8 21.8 Z" fill="#67e8f9" stroke="#060c14" strokeWidth="0.9" />
          </g>
        )}

        {speciesId === 'tazerling' && (
          <g>
            {/* Twin high-voltage zigzag antennae */}
            <polyline
              points="12.6,10 10.4,6.4 12.7,5.8 10.2,2.6"
              fill="none"
              stroke="#060c14"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <polyline
              points="12.6,10 10.4,6.4 12.7,5.8 10.2,2.6"
              fill="none"
              stroke="#fef08a"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <polyline
              points="19.4,10 21.6,6.4 19.3,5.8 21.8,2.6"
              fill="none"
              stroke="#060c14"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <polyline
              points="19.4,10 21.6,6.4 19.3,5.8 21.8,2.6"
              fill="none"
              stroke="#fef08a"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        )}

        {speciesId === 'aquabeak' && (
          <g>
            <path d="M14.2 9.4 Q16.2 3.2 19.2 9.2 Z" fill={secondary} stroke="#060c14" strokeWidth="1" />
            <path d="M7.2 18.6 L10.8 15.8 L10.8 21.4 Z" fill={secondary} stroke="#060c14" strokeWidth="0.9" />
            <path d="M24.8 18.6 L21.2 15.8 L21.2 21.4 Z" fill={secondary} stroke="#060c14" strokeWidth="0.9" />
          </g>
        )}

        {speciesId === 'musgacorn' && (
          <g>
            <path d="M16 10 L16 4.4" stroke="#15803d" strokeWidth="2.2" strokeLinecap="round" />
            <ellipse cx="13.2" cy="5.2" rx="2.6" ry="1.3" fill="#4ade80" stroke="#060c14" strokeWidth="0.8" transform="rotate(20 13.2 5.2)" />
            <ellipse cx="18.8" cy="4.6" rx="2.8" ry="1.4" fill="#86efac" stroke="#060c14" strokeWidth="0.8" transform="rotate(-18 18.8 4.6)" />
          </g>
        )}

        {speciesId === 'doc' && (
          <g>
            <ellipse cx="16" cy="5.4" rx="5.4" ry="1.6" fill="none" stroke="#fef08a" strokeWidth="1.5" />
            <path d="M8.6 17.5 Q10.2 14.5 12 17.2" fill="none" stroke={secondary} strokeWidth="1.6" strokeLinecap="round" />
            <path d="M23.4 17.5 Q21.8 14.5 20 17.2" fill="none" stroke={secondary} strokeWidth="1.6" strokeLinecap="round" />
          </g>
        )}

        {speciesId === 'glaciomita' && (
          <g fill="#e0f2fe" stroke="#060c14" strokeWidth="0.95" strokeLinejoin="round">
            <polygon points="12.2,10.6 10.6,5 14.4,9" />
            <polygon points="14.5,9.4 16,2.8 17.5,9.4" fill="#ffffff" />
            <polygon points="19.8,10.6 21.4,5 17.6,9" />
          </g>
        )}

        {speciesId === 'voltrix' && (
          <g>
            <path d="M9.6 15.2 L7.2 13.6 L8.8 17.6 Z" fill="#fef08a" stroke="#060c14" strokeWidth="0.9" />
            <path d="M22.4 15.2 L24.8 13.6 L23.2 17.6 Z" fill="#fef08a" stroke="#060c14" strokeWidth="0.9" />
            <polyline points="14,9.2 16,3.4 18,9.2" fill="none" stroke="#fde047" strokeWidth="1.6" strokeLinejoin="round" />
          </g>
        )}

        {speciesId === 'flaringo' && (
          <g>
            <path d="M13.5 9.2 Q15.5 1.8 21.2 4.8 Q18.4 7.8 20.2 10.2 Z" fill={secondary} stroke="#060c14" strokeWidth="1" />
            <line x1="12.6" y1="9.8" x2="10.8" y2="6.2" stroke="#fef08a" strokeWidth="1.2" strokeLinecap="round" />
          </g>
        )}

        {speciesId === 'lariat' && (
          <g>
            {/* Basalt shoulder horns + nose horn silhouette */}
            <polygon points="10.2,11.8 8.2,7.2 12.6,10.2" fill="#d97706" stroke="#060c14" strokeWidth="0.9" />
            <polygon points="21.8,11.8 23.8,7.2 19.4,10.2" fill="#d97706" stroke="#060c14" strokeWidth="0.9" />
          </g>
        )}

        {speciesId === 'piroclasto' && (
          <g>
            {/* Volcanic dorsal crater + glowing magma plume */}
            <polygon points="12.2,10 13.2,6.4 18.8,6.4 19.8,10" fill="#451a03" stroke="#060c14" strokeWidth="1" />
            <path d="M13.8 6.6 Q16 2.8 18.2 6.6 Z" fill="#fb923c" />
            <circle cx="9.2" cy="18.2" r="2.2" fill="#7f1d1d" stroke="#060c14" strokeWidth="0.9" />
            <circle cx="22.8" cy="18.2" r="2.2" fill="#7f1d1d" stroke="#060c14" strokeWidth="0.9" />
          </g>
        )}

        {speciesId === 'enigmo' && (
          <g>
            <polygon points="16,2.8 18.2,6.4 16,8.6 13.8,6.4" fill="#5eead4" stroke="#060c14" strokeWidth="0.9" />
            <path d="M11 23 Q9.4 26.8 11.4 27.6" fill="none" stroke={primary} strokeWidth="2.1" strokeLinecap="round" />
            <path d="M21 23 Q22.6 26.8 20.6 27.6" fill="none" stroke={primary} strokeWidth="2.1" strokeLinecap="round" />
          </g>
        )}

        {speciesId === 'darkfurnus' && (
          <g>
            <path d="M12.2 10.6 Q8.2 5.4 10.8 3.2 Q13.2 6.4 14.2 9.4 Z" fill={secondary} stroke="#060c14" strokeWidth="0.95" />
            <path d="M19.8 10.6 Q23.8 5.4 21.2 3.2 Q18.8 6.4 17.8 9.4 Z" fill={secondary} stroke="#060c14" strokeWidth="0.95" />
            <path d="M7.6 16.5 L11 14 L11 20 Z" fill="#3b0764" stroke="#060c14" strokeWidth="0.9" />
            <path d="M24.4 16.5 L21 14 L21 20 Z" fill="#3b0764" stroke="#060c14" strokeWidth="0.9" />
          </g>
        )}

        {speciesId === 'umbrospect' && (
          <g>
            <path d="M11.6 10.2 Q8.8 5.2 11.4 4 Q13.6 7 14.5 9.6" fill="#a855f7" stroke="#060c14" strokeWidth="0.9" />
            <path d="M20.4 10.2 Q23.2 5.2 20.6 4 Q18.4 7 17.5 9.6" fill="#a855f7" stroke="#060c14" strokeWidth="0.9" />
          </g>
        )}

        {speciesId === 'aetherion' && (
          <g>
            <ellipse cx="16" cy="17.2" rx="11.2" ry="3.4" fill="none" stroke="#99f6e4" strokeWidth="1" opacity="0.72" transform="rotate(-14 16 17.2)" />
            <polygon points="16,2.4 18.6,6.8 16,9.4 13.4,6.8" fill="#fef08a" stroke="#060c14" strokeWidth="0.9" />
          </g>
        )}

        {/* Main Differentiated Anatomical Body */}
        <path
          d={geo.torsoPath}
          fill={primary}
          stroke="#060c14"
          strokeWidth="1.35"
          strokeLinejoin="round"
        />
        <path d={geo.torsoPath} fill={`url(#body_${uid})`} />

        {/* Differentiated Belly Plate */}
        <path d={geo.bellyPath} fill={belly} opacity="0.92" />

        {/* Unified -45deg Specular Rim Light */}
        <path
          d={geo.rimHighlight}
          fill="none"
          stroke="rgba(255,255,255,0.52)"
          strokeWidth="1.25"
          strokeLinecap="round"
        />

        {/* Species Surface Material Details & Distinct Markings */}
        {speciesId === 'infurnus' && (
          <g>
            <line x1="14.2" y1="20.4" x2="17.8" y2="20.4" stroke="#f97316" strokeWidth="1" strokeLinecap="round" />
            <line x1="14.6" y1="22.8" x2="17.4" y2="22.8" stroke="#f97316" strokeWidth="1" strokeLinecap="round" />
          </g>
        )}
        {speciesId === 'frostcrawler' && (
          <g stroke="#155e75" strokeWidth="1.05" strokeLinecap="round">
            {/* Heavy armored carapace plate seams & brow ridge */}
            <path d="M9.6 13.2 Q16 11.4 22.4 13.2" fill="none" stroke="#e0f2fe" strokeWidth="1.2" />
            <path d="M11 20.6 L21 20.6" fill="none" />
            <path d="M11.8 23.2 L20.2 23.2" fill="none" />
          </g>
        )}
        {speciesId === 'tazerling' && (
          <g>
            {/* Electric glowing cheek sacs */}
            <circle cx="11.8" cy="16.4" r="1.6" fill="#38bdf8" opacity="0.88" />
            <circle cx="20.2" cy="16.4" r="1.6" fill="#38bdf8" opacity="0.88" />
            <circle cx="11.5" cy="16.0" r="0.55" fill="#ffffff" />
            <circle cx="19.9" cy="16.0" r="0.55" fill="#ffffff" />
          </g>
        )}
        {speciesId === 'lariat' && (
          <g>
            <path d="M9.4 20.2 Q16 22 22.6 20.2" fill="none" stroke="#fbbf24" strokeWidth="1.9" strokeLinecap="round" />
            <polygon points="15.2,17.2 16.8,17.2 16,14.8" fill="#fef3c7" stroke="#060c14" strokeWidth="0.65" />
          </g>
        )}
        {speciesId === 'musgacorn' && (
          <path d="M10.4 17.8 Q16 20 21.6 17.8" fill="none" stroke="#15803d" strokeWidth="1.8" strokeLinecap="round" />
        )}
        {speciesId === 'aquabeak' && (
          <polygon points="14.6,16.2 17.4,16.2 16,18.2" fill="#fde047" stroke="#060c14" strokeWidth="0.65" />
        )}
        {speciesId === 'piroclasto' && (
          <path d="M11.6 19.6 L14 21 L18 20.6 L20.4 19.2" fill="none" stroke="#fb923c" strokeWidth="1.2" strokeLinecap="round" />
        )}
        {speciesId === 'doc' && (
          <circle cx="16" cy="11.2" r="1.3" fill="#2dd4bf" stroke="#ffffff" strokeWidth="0.6" />
        )}
        {(speciesId === 'enigmo' || speciesId === 'umbrospect') && (
          <ellipse
            cx="16"
            cy="11.5"
            rx="1.8"
            ry="1.15"
            fill={speciesId === 'umbrospect' ? '#f472b6' : '#fef08a'}
            stroke="#ffffff"
            strokeWidth="0.55"
          />
        )}

        {/* Expressive Eyes & Brows (Species Style + Live Mood) */}
        {mood === 'sleep' || mood === 'rest' ? (
          <g stroke="#060c14" strokeWidth="1.35" strokeLinecap="round" fill="none">
            <path d={`M${lx - 1.2} ${ly} Q${lx} ${ly + 1} ${lx + 1.2} ${ly}`} />
            <path d={`M${rx - 1.2} ${ry} Q${rx} ${ry + 1} ${rx + 1.2} ${ry}`} />
          </g>
        ) : mood === 'ko' ? (
          <g stroke="#060c14" strokeWidth="1.35" strokeLinecap="round">
            <line x1={lx - 1} y1={ly - 1} x2={lx + 1} y2={ly + 1} />
            <line x1={lx + 1} y1={ly - 1} x2={lx - 1} y2={ly + 1} />
            <line x1={rx - 1} y1={ry - 1} x2={rx + 1} y2={ry + 1} />
            <line x1={rx + 1} y1={ry - 1} x2={rx - 1} y2={ry + 1} />
          </g>
        ) : mood === 'hit' ? (
          <g stroke={irisColor} strokeWidth="1.35" strokeLinecap="round" fill="none">
            <path d={`M${lx - 1.2} ${ly - 0.9} L${lx + 1.1} ${ly} L${lx - 1.2} ${ly + 0.9}`} />
            <path d={`M${rx + 1.2} ${ry - 0.9} L${rx - 1.1} ${ry} L${rx + 1.2} ${ry + 0.9}`} />
          </g>
        ) : mood === 'happy' || mood === 'victory' ? (
          <g>
            <path
              d={`M${lx - 1.3} ${ly + 0.4} Q${lx} ${ly - 1.4} ${lx + 1.3} ${ly + 0.4}`}
              fill="none"
              stroke={irisColor}
              strokeWidth="1.55"
              strokeLinecap="round"
            />
            <path
              d={`M${rx - 1.3} ${ry + 0.4} Q${rx} ${ry - 1.4} ${rx + 1.3} ${ry + 0.4}`}
              fill="none"
              stroke={irisColor}
              strokeWidth="1.55"
              strokeLinecap="round"
            />
          </g>
        ) : (
          <g className={canBlink ? 'bt-slug-blink-eyes' : ''}>
            {sheet.eyeStyle === 'heavy_amber_slit' || sheet.eyeStyle === 'stoic_brow' ? (
              <>
                <ellipse cx={lx} cy={ly} rx="1.45" ry="0.95" fill={irisColor} stroke="#060c14" strokeWidth="0.6" />
                <ellipse cx={rx} cy={ry} rx="1.45" ry="0.95" fill={irisColor} stroke="#060c14" strokeWidth="0.6" />
                <line x1={lx - 1.7} y1={ly - 1.3} x2={lx + 1.4} y2={ly - 0.7} stroke="#060c14" strokeWidth="1.25" strokeLinecap="round" />
                <line x1={rx + 1.7} y1={ry - 1.3} x2={rx - 1.4} y2={ry - 0.7} stroke="#060c14" strokeWidth="1.25" strokeLinecap="round" />
              </>
            ) : sheet.eyeStyle === 'wide_hyper_spark' ? (
              <>
                <circle cx={lx} cy={ly} r="1.65" fill="#ffffff" stroke="#060c14" strokeWidth="0.65" />
                <circle cx={rx} cy={ry} r="1.65" fill="#ffffff" stroke="#060c14" strokeWidth="0.65" />
                <circle cx={lx + 0.25} cy={ly} r="0.95" fill="#060c14" />
                <circle cx={rx - 0.25} cy={ry} r="0.95" fill="#060c14" />
                <circle cx={lx - 0.35} cy={ly - 0.55} r="0.5" fill="#ffffff" />
                <circle cx={rx - 0.35} cy={ry - 0.55} r="0.5" fill="#ffffff" />
              </>
            ) : (
              <>
                <ellipse
                  cx={lx}
                  cy={ly}
                  rx="1.25"
                  ry={sheet.eyeStyle === 'determined_slanted' || sheet.eyeStyle === 'fierce_glowing' ? '1.35' : '1.5'}
                  fill={irisColor}
                  stroke={isShadowType ? '#060c14' : 'none'}
                  strokeWidth="0.5"
                />
                <ellipse
                  cx={rx}
                  cy={ry}
                  rx="1.25"
                  ry={sheet.eyeStyle === 'determined_slanted' || sheet.eyeStyle === 'fierce_glowing' ? '1.35' : '1.5'}
                  fill={irisColor}
                  stroke={isShadowType ? '#060c14' : 'none'}
                  strokeWidth="0.5"
                />
                <circle cx={lx - 0.4} cy={ly - 0.5} r="0.52" fill="#ffffff" />
                <circle cx={rx - 0.4} cy={ry - 0.5} r="0.52" fill="#ffffff" />
                {(mood === 'attack' ||
                  mood === 'charge' ||
                  mood === 'transform' ||
                  sheet.eyeStyle === 'determined_slanted' ||
                  sheet.eyeStyle === 'fierce_glowing' ||
                  sheet.eyeStyle === 'sly_angular') && (
                  <>
                    <line x1={lx - 1.5} y1={ly - 1.8} x2={lx + 1.2} y2={ly - 1.1} stroke="#060c14" strokeWidth="1.15" strokeLinecap="round" />
                    <line x1={rx + 1.5} y1={ry - 1.8} x2={rx - 1.2} y2={ry - 1.1} stroke="#060c14" strokeWidth="1.15" strokeLinecap="round" />
                  </>
                )}
              </>
            )}
          </g>
        )}

        {/* Expressive Mouth (Distinct by species & mood) */}
        {mood !== 'sleep' && mood !== 'ko' && speciesId !== 'aquabeak' && (
          <g>
            {mood === 'eat' || mood === 'happy' || mood === 'play' || mood === 'victory' || sheet.mouthStyle === 'cheerful_open' ? (
              <path
                d={`M14.3 ${geo.mouthY - 0.2} Q16 ${geo.mouthY + 1.9} 17.7 ${geo.mouthY - 0.2} Z`}
                fill="#450a0a"
                stroke="#060c14"
                strokeWidth="0.7"
              />
            ) : sheet.mouthStyle === 'armored_jaw' || sheet.mouthStyle === 'fierce_scowl' ? (
              <path
                d={`M13.6 ${geo.mouthY + 0.5} L15 ${geo.mouthY - 0.4} L17 ${geo.mouthY - 0.4} L18.4 ${geo.mouthY + 0.5}`}
                fill="none"
                stroke="#060c14"
                strokeWidth="1.05"
                strokeLinecap="round"
              />
            ) : sheet.mouthStyle === 'fang_grin' ? (
              <g>
                <path d={`M14.2 ${geo.mouthY} Q16 ${geo.mouthY + 1.1} 17.9 ${geo.mouthY - 0.3}`} fill="none" stroke="#060c14" strokeWidth="0.95" strokeLinecap="round" />
                <polygon points={`17,${geo.mouthY + 0.1} 17.6,${geo.mouthY + 0.1} 17.3,${geo.mouthY + 1.0}`} fill="#ffffff" />
              </g>
            ) : (
              <path
                d={`M14.7 ${geo.mouthY} Q16 ${geo.mouthY + 1.1} 17.3 ${geo.mouthY}`}
                fill="none"
                stroke="#060c14"
                strokeWidth="0.9"
                strokeLinecap="round"
              />
            )}
          </g>
        )}

        {/* Mood Signifiers (Sleep Zzz, Eat crumb, React sparkle) */}
        {(mood === 'sleep' || mood === 'rest') && (
          <g className={animated ? 'bt-slug-zzz' : ''} fill="#bae6fd" fontSize="5" fontWeight="bold">
            <text x="22" y="9">z</text>
          </g>
        )}
        {(mood === 'react' || mood === 'charge' || mood === 'transform') && (
          <circle cx="24" cy="7.5" r="1.4" fill={sheet.palette.energyCore} stroke="#ffffff" strokeWidth="0.5" />
        )}
      </g>
    </svg>
  );
};
