import React, { useId } from 'react';
import { getSpecies } from '../game/data';
import { getSlugDesignSheet } from '../game/slugArtDirection';

export type SlugPortraitMood =
  | 'idle'
  | 'walk'
  | 'happy'
  | 'play'
  | 'eat'
  | 'rest'
  | 'sleep'
  | 'react'
  | 'charge'
  | 'fire'
  | 'flight'
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
  silhouette?: boolean;
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
        // Tall slender agile flame runner with tapered chest and athletic posture
        torsoPath:
          'M11.7 14.8 C11.4 10.2 13.4 8.2 16.2 8.2 C19.0 8.2 20.8 10.4 20.5 14.8 C20.3 18.8 21.3 23.6 19.3 25.9 C17.6 26.8 14.8 26.8 13.1 25.9 C11.1 23.8 12.0 18.8 11.7 14.8 Z',
        bellyPath:
          'M13.3 17.6 C13.6 15.8 18.6 15.8 18.9 17.6 C19.0 22.0 17.9 25.3 16.1 25.3 C14.3 25.3 13.2 22.0 13.3 17.6 Z',
        tailPath:
          'M12.6 22.2 Q7.8 20.6 5.6 17.4 Q6.6 22.0 4.6 23.8 Q7.6 26.8 13.4 25.2 Z',
        rimHighlight: 'M12.8 12.4 C13.1 10.1 14.4 9.2 16.1 9.2',
        eyeLeft: [14.1, 13.5],
        eyeRight: [18.5, 13.5],
        mouthY: 16.3,
        shadowRx: 8.2,
      };
    case 'frostcrawler':
      return {
        // Wide low-slung armored glacial beetle hugging the cavern ground
        torsoPath:
          'M6.8 19.0 C6.6 13.6 10.2 10.2 16.0 10.2 C21.8 10.2 25.4 13.6 25.2 19.0 C25.0 23.2 23.8 26.2 19.8 26.6 C17.4 26.9 14.6 26.9 12.2 26.6 C8.2 26.2 7.0 23.2 6.8 19.0 Z',
        bellyPath:
          'M10.2 19.6 C10.6 17.6 21.4 17.6 21.8 19.6 C21.8 23.4 19.9 25.9 16.0 25.9 C12.1 25.9 10.2 23.4 10.2 19.6 Z',
        tailPath: 'M8.2 22.4 L4.2 22.0 L3.6 25.2 L6.8 26.6 L10.6 25.6 Z',
        rimHighlight: 'M9.2 14.6 C10.2 12.0 12.4 11.2 15.6 11.2',
        eyeLeft: [12.9, 15.1],
        eyeRight: [19.1, 15.1],
        mouthY: 17.9,
        shadowRx: 11.2,
      };
    case 'tazerling':
      return {
        // Compact forward-leaning electric sprinter with oversized puffed cheeks & sleek waist
        torsoPath:
          'M11.0 14.8 C10.6 10.5 12.8 8.9 16.0 8.9 C19.2 8.9 21.4 10.5 21.0 14.8 C22.5 16.5 22.6 19.2 20.5 20.8 C20.1 23.7 19.0 25.8 16.0 26.2 C13.0 25.8 11.9 23.7 11.5 20.8 C9.4 19.2 9.5 16.5 11.0 14.8 Z',
        bellyPath:
          'M13.2 18.0 C13.4 16.3 18.6 16.3 18.8 18.0 C18.7 22.1 17.7 25.1 16.0 25.1 C14.3 25.1 13.3 22.1 13.2 18.0 Z',
        tailPath: 'M12.2 22.8 L6.2 20.2 L8.3 23.0 L4.8 25.2 L12.3 25.1 Z',
        rimHighlight: 'M12.1 12.4 C12.7 10.5 14.0 9.9 15.6 9.9',
        eyeLeft: [13.5, 13.8],
        eyeRight: [18.5, 13.8],
        mouthY: 16.6,
        shadowRx: 7.9,
      };

    // ---- ACTO I: CUEVAS VERDES ----
    case 'aquabeak':
      return {
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
    case 'arachnet':
      return {
        torsoPath:
          'M10.2 15.8 C10.0 10.8 12.6 9.0 16.0 9.0 C19.4 9.0 22.0 10.8 21.8 15.8 C22.0 20.6 20.6 25.4 18.0 26.3 L14.0 26.3 C11.4 25.4 10.0 20.6 10.2 15.8 Z',
        bellyPath:
          'M12.8 18.4 C13.2 16.8 18.8 16.8 19.2 18.4 C19.2 22.4 17.8 25.2 16.0 25.2 C14.2 25.2 12.8 22.4 12.8 18.4 Z',
        tailPath: 'M11.6 22.6 Q6.4 21.2 7.2 24.4 Q10.0 26.6 13.0 25.4 Z',
        rimHighlight: 'M11.8 13.0 C12.4 10.8 14.0 10.0 15.8 10.0',
        eyeLeft: [13.6, 14.2],
        eyeRight: [18.4, 14.2],
        mouthY: 16.8,
        shadowRx: 9.0,
      };
    case 'bubbaleone':
      return {
        torsoPath:
          'M8.6 16.4 C8.4 11.0 11.4 9.2 16.0 9.2 C20.6 9.2 23.6 11.0 23.4 16.4 C23.6 21.6 21.8 25.8 18.8 26.6 C17.0 27.0 15.0 27.0 13.2 26.6 C10.2 25.8 8.4 21.6 8.6 16.4 Z',
        bellyPath:
          'M11.2 18.4 C11.6 16.6 20.4 16.6 20.8 18.4 C20.8 22.8 19.0 25.8 16.0 25.8 C13.0 25.8 11.2 22.8 11.2 18.4 Z',
        tailPath: 'M10.4 22.8 Q6.2 21.8 6.6 24.8 Q9.0 26.8 12.6 25.6 Z',
        rimHighlight: 'M10.4 13.4 C11.2 11.0 13.2 10.2 15.8 10.2',
        eyeLeft: [13.2, 14.4],
        eyeRight: [18.8, 14.4],
        mouthY: 17.0,
        shadowRx: 9.6,
      };
    case 'rammstone':
      return {
        torsoPath:
          'M8.0 16.8 C8.0 11.2 11.2 9.4 16.0 9.4 C20.8 9.4 24.0 11.2 24.0 16.8 C24.0 22.0 22.4 26.0 19.4 26.8 L12.6 26.8 C9.6 26.0 8.0 22.0 8.0 16.8 Z',
        bellyPath:
          'M11.0 18.8 L21.0 18.8 L19.8 25.8 L12.2 25.8 Z',
        tailPath: 'M9.4 22.8 L5.8 24.4 L7.4 26.4 L11.8 25.6 Z',
        rimHighlight: 'M10.2 13.4 C11.0 11.2 13.0 10.4 15.8 10.4',
        eyeLeft: [13.2, 14.6],
        eyeRight: [18.8, 14.6],
        mouthY: 17.4,
        shadowRx: 10.4,
      };
    case 'fandango':
      return {
        torsoPath:
          'M11.2 15.0 C11.0 10.2 13.2 8.6 16.0 8.6 C18.8 8.6 21.0 10.2 20.8 15.0 C20.8 19.8 20.0 24.4 18.0 26.0 L14.0 26.0 C12.0 24.4 11.2 19.8 11.2 15.0 Z',
        bellyPath:
          'M13.2 17.8 C13.4 16.0 18.6 16.0 18.8 17.8 C18.8 22.0 17.7 25.0 16.0 25.0 C14.3 25.0 13.2 22.0 13.2 17.8 Z',
        tailPath: 'M12.2 22.4 Q7.4 21.4 7.8 24.6 Q10.6 26.4 13.6 25.0 Z',
        rimHighlight: 'M12.4 12.6 C12.9 10.4 14.2 9.6 16.0 9.6',
        eyeLeft: [13.8, 13.9],
        eyeRight: [18.2, 13.9],
        mouthY: 16.4,
        shadowRx: 7.6,
      };
    case 'armashelt':
      return {
        torsoPath:
          'M7.4 17.4 L9.0 11.2 L13.0 9.4 L19.0 9.4 L23.0 11.2 L24.6 17.4 L22.8 25.6 L19.6 26.8 L12.4 26.8 L9.2 25.6 Z',
        bellyPath:
          'M11.2 18.8 L20.8 18.8 L19.6 25.8 L12.4 25.8 Z',
        tailPath: 'M8.8 22.8 L4.6 23.4 L6.0 26.2 L10.8 25.8 Z',
        rimHighlight: 'M9.8 13.8 L11.0 11.0 L15.2 10.4',
        eyeLeft: [13.0, 14.8],
        eyeRight: [19.0, 14.8],
        mouthY: 17.4,
        shadowRx: 10.8,
      };
    case 'aetherion':
    default:
      return {
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
  silhouette = false,
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
  const isShadowType =
    speciesId === 'darkfurnus' ||
    speciesId === 'umbrospect' ||
    speciesId === 'piroclasto' ||
    speciesId === 'arachnet';
  const irisColor = isShadowType ? sheet.palette.eyeIris : '#061018';
  const uid = `${speciesId}_${mega ? 'm' : 'n'}_${reactId.replace(/:/g, '')}`;

  const isActiveEnergy =
    mood === 'charge' || mood === 'transform' || mood === 'attack' || mood === 'fire' || mood === 'flight';
  const isPlayful = mood === 'happy' || mood === 'victory' || mood === 'react' || mood === 'play';

  const poseAnimClass =
    !animated || mood === 'ko'
      ? ''
      : mood === 'walk'
      ? 'bt-slug-pose-walk'
      : mood === 'hit'
      ? 'bt-slug-pose-hit'
      : mood === 'fire' || mood === 'flight'
      ? 'bt-slug-pose-fire'
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
    animated && !silhouette && mood !== 'sleep' && mood !== 'rest' && mood !== 'ko' && mood !== 'hit';
  const canSaccade =
    animated &&
    !silhouette &&
    mood !== 'sleep' &&
    mood !== 'rest' &&
    mood !== 'ko' &&
    mood !== 'hit' &&
    (mood === 'idle' || mood === 'react' || mood === 'play' || mood === 'walk');

  const tailAnimClass = animated && mood !== 'ko' && mood !== 'sleep' && mood !== 'rest' ? 'bt-part-tail-wag' : '';
  const sparkAnimClass = animated && mood !== 'ko' && mood !== 'sleep' && mood !== 'rest' ? 'bt-part-spark-pulse' : '';

  const [lx, ly] = geo.eyeLeft;
  const [rx, ry] = geo.eyeRight;

  // High-contrast silhouette palette override when testing or revealing silhouettes
  const silInk = '#080e17';
  const silOutline = silhouette ? sheet.palette.energyCore : '#060c14';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={`shrink-0 select-none overflow-visible ${className}`}
      style={{
        transform: flipX ? 'scaleX(-1)' : undefined,
        filter: silhouette
          ? `drop-shadow(0 0 5px ${sheet.palette.energyCore}88)`
          : mood === 'ko'
          ? 'grayscale(0.78) opacity(0.65)'
          : mega
          ? 'drop-shadow(0 0 6px rgba(251, 191, 36, 0.65))'
          : `drop-shadow(0 2px 4px rgba(2, 6, 12, 0.58))`,
      }}
      role="img"
      aria-label={silhouette ? `Silueta de ${sp.name}` : sp.name}
    >
      <defs>
        <radialGradient id={`glow_${uid}`} cx="50%" cy="55%" r="52%">
          <stop offset="0%" stopColor={mega ? '#fde047' : sheet.palette.energyCore} stopOpacity={silhouette ? '0.26' : '0.42'} />
          <stop offset="100%" stopColor={primary} stopOpacity="0" />
        </radialGradient>
        {/* Unified -45deg top-left lighting volumetric body gradient */}
        <linearGradient id={`body_${uid}`} x1="15%" y1="8%" x2="88%" y2="96%">
          <stop offset="0%" stopColor={highlight} stopOpacity="0.46" />
          <stop offset="30%" stopColor={primary} stopOpacity="1" />
          <stop offset="78%" stopColor={primary} stopOpacity="0.98" />
          <stop offset="100%" stopColor={shadow} stopOpacity="1" />
        </linearGradient>
        {/* Inner translucent elemental crest / core gradient */}
        <linearGradient id={`crest_${uid}`} x1="25%" y1="0%" x2="75%" y2="100%">
          <stop offset="0%" stopColor={highlight} stopOpacity="0.96" />
          <stop offset="48%" stopColor={belly} stopOpacity="0.95" />
          <stop offset="100%" stopColor={secondary} stopOpacity="1" />
        </linearGradient>
      </defs>

      {/* Ambient Elemental Halo */}
      <circle cx="16" cy="17" r="14.2" fill={`url(#glow_${uid})`} />

      {/* Ground Contact Shadow */}
      <ellipse cx="16" cy="27.6" rx={geo.shadowRx} ry="2.2" fill="rgba(2, 6, 12, 0.56)" />

      {/* Animated Creature Group */}
      <g className={poseAnimClass}>
        {/* Late-game Megamorph Aura Ring + Crown */}
        {mega && (
          <g>
            <circle
              cx="16"
              cy="16.5"
              r="13.0"
              fill="none"
              stroke="#fbbf24"
              strokeOpacity="0.56"
              strokeWidth="1"
              strokeDasharray="3 2"
            />
            <path
              d="M11.2 4.4 L13.5 6.8 L16 2.6 L18.5 6.8 L20.8 4.4 L19.8 8.2 L12.2 8.2 Z"
              fill={silhouette ? silInk : '#fbbf24'}
              stroke={silhouette ? silOutline : '#fef08a'}
              strokeWidth="0.85"
            />
          </g>
        )}

        {/* Articulated Tail Layer */}
        <g className={tailAnimClass}>
          <path
            d={geo.tailPath}
            fill={silhouette ? silInk : speciesId === 'tazerling' ? '#fde047' : speciesId === 'frostcrawler' ? '#0ea5e9' : shadow}
            stroke={silOutline}
            strokeWidth={silhouette ? '0.9' : '1.2'}
            strokeLinejoin="round"
          />
          {!silhouette && speciesId === 'infurnus' && (
            <path
              d="M10.4 23.0 Q6.8 22.0 5.9 19.2 Q7.8 22.2 6.0 23.6 Q8.6 25.0 12.1 24.4 Z"
              fill="#fb923c"
            />
          )}
          {!silhouette && speciesId === 'frostcrawler' && (
            <polygon points="4.0,22.2 2.4,23.5 4.2,25.0 5.4,23.6" fill="#e0f2fe" stroke="#060c14" strokeWidth="0.65" />
          )}
          {!silhouette && speciesId === 'tazerling' && (
            <polyline
              points="11.2,23.8 7.5,22.2 8.8,23.8 5.6,24.8"
              fill="none"
              stroke="#ffffff"
              strokeWidth="0.85"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </g>

        {/* Back Anatomical Layer (Crests / Wings / Horns / Spikes / Antennae) */}
        {speciesId === 'infurnus' && (
          <g className={animated && mood !== 'sleep' && mood !== 'rest' ? 'bt-part-crest-flame' : ''}>
            {/* Twin sleek horn-antennas framing the blazing 3-tongue crest */}
            <path
              d="M12.6 10.6 Q10.6 7.8 9.2 5.4 Q11.4 7.0 13.4 9.5 Z"
              fill={silhouette ? silInk : '#f97316'}
              stroke={silOutline}
              strokeWidth="0.95"
              strokeLinejoin="round"
            />
            <path
              d="M19.6 10.6 Q21.6 7.8 23.0 5.4 Q20.8 7.0 18.8 9.5 Z"
              fill={silhouette ? silInk : '#f97316'}
              stroke={silOutline}
              strokeWidth="0.95"
              strokeLinejoin="round"
            />
            {/* Multi-tongue volumetric flame crest */}
            <path
              d="M11.6 10.2 C10.9 6.6 12.2 3.2 14.2 5.2 C14.9 2.2 16.8 0.8 18.2 4.6 C19.5 2.0 21.4 4.0 20.6 8.6 C21.8 6.8 22.0 9.6 20.2 11.2 Z"
              fill={silhouette ? silInk : `url(#crest_${uid})`}
              stroke={silOutline}
              strokeWidth="1.05"
              strokeLinejoin="round"
            />
            {!silhouette && (
              <path
                d="M14.0 9.4 Q16.1 3.6 18.4 9.0 Q16.2 7.6 14.0 9.4 Z"
                fill="#fef9c3"
                opacity="0.94"
              />
            )}
            {/* Ember spark motes + explosive flame-burst particles on Infurnus transformation */}
            {!silhouette && (mood === 'transform' || mood === 'fire' || mood === 'flight') && animated ? (
              <>
                <g className="bt-part-flame-burst">
                  <polygon points="16.0,0.4 17.0,2.7 15.0,2.7" fill="#fef08a" />
                  <circle cx="9.2" cy="5.0" r="0.95" fill="#fb923c" />
                  <circle cx="22.8" cy="5.2" r="0.95" fill="#fde047" />
                  <polygon points="7.5,11.2 9.8,10.2 9.2,12.2" fill="#f97316" />
                  <polygon points="24.5,11.2 22.2,10.2 22.8,12.2" fill="#fbbf24" />
                  <circle cx="11.0" cy="21.0" r="0.82" fill="#ef4444" />
                  <circle cx="21.4" cy="20.6" r="0.82" fill="#fb923c" />
                </g>
                <g className="bt-part-flame-burst" style={{ animationDelay: '180ms' }}>
                  <circle cx="12.2" cy="2.0" r="0.78" fill="#ffffff" />
                  <circle cx="20.2" cy="2.2" r="0.78" fill="#fef08a" />
                  <circle cx="8.0" cy="15.8" r="0.72" fill="#fb923c" />
                  <circle cx="24.0" cy="15.6" r="0.72" fill="#fde047" />
                </g>
              </>
            ) : (
              !silhouette &&
              (isActiveEnergy || isPlayful || mood === 'idle') && (
                <g className={sparkAnimClass}>
                  <circle cx="11.2" cy="3.2" r="0.72" fill="#fde047" />
                  <circle cx="21.2" cy="3.8" r="0.65" fill="#fb923c" />
                  {isActiveEnergy && <circle cx="16.4" cy="0.9" r="0.82" fill="#ffffff" />}
                </g>
              )
            )}
          </g>
        )}

        {speciesId === 'frostcrawler' && (
          <g className={animated && mood !== 'sleep' && mood !== 'rest' ? 'bt-part-heavy-breathe' : ''}>
            {/* Three jagged faceted crystal frost horns + heavy lateral ice shoulder plates */}
            <polygon
              points="9.6,12.8 6.9,6.0 11.8,9.8 12.8,11.8"
              fill={silhouette ? silInk : '#7dd3fc'}
              stroke={silOutline}
              strokeWidth="1.05"
              strokeLinejoin="round"
            />
            <polygon
              points="13.8,11.0 16.0,3.4 18.2,11.0"
              fill={silhouette ? silInk : `url(#crest_${uid})`}
              stroke={silOutline}
              strokeWidth="1.1"
              strokeLinejoin="round"
            />
            <polygon
              points="22.4,12.8 25.1,6.0 20.2,9.8 19.2,11.8"
              fill={silhouette ? silInk : '#7dd3fc'}
              stroke={silOutline}
              strokeWidth="1.05"
              strokeLinejoin="round"
            />
            {/* Faceted highlight lines on center horn */}
            {!silhouette && (
              <polyline points="16.0,4.2 16.0,10.2 14.6,10.8" fill="none" stroke="#ffffff" strokeWidth="0.7" opacity="0.8" />
            )}
            {/* Heavy armor shoulder shields */}
            <path
              d="M5.2 19.0 L8.4 15.8 L9.2 21.8 L6.2 21.4 Z"
              fill={silhouette ? silInk : '#22d3ee'}
              stroke={silOutline}
              strokeWidth="1.0"
              strokeLinejoin="round"
            />
            <path
              d="M26.8 19.0 L23.6 15.8 L22.8 21.8 L25.8 21.4 Z"
              fill={silhouette ? silInk : '#22d3ee'}
              stroke={silOutline}
              strokeWidth="1.0"
              strokeLinejoin="round"
            />
          </g>
        )}

        {speciesId === 'tazerling' && (
          <g className={animated && mood !== 'sleep' && mood !== 'rest' ? 'bt-part-antennae-zap' : ''}>
            {/* Twin unmistakable multi-bend zigzag lightning antennae */}
            <polyline
              points="12.6,10.2 10.6,7.0 12.9,6.1 9.6,2.2 11.4,1.2"
              fill="none"
              stroke={silOutline}
              strokeWidth="2.55"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <polyline
              points="12.6,10.2 10.6,7.0 12.9,6.1 9.6,2.2 11.4,1.2"
              fill="none"
              stroke={silhouette ? silInk : '#fef08a'}
              strokeWidth="1.45"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <polyline
              points="19.4,10.2 21.4,7.0 19.1,6.1 22.4,2.2 20.6,1.2"
              fill="none"
              stroke={silOutline}
              strokeWidth="2.55"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <polyline
              points="19.4,10.2 21.4,7.0 19.1,6.1 22.4,2.2 20.6,1.2"
              fill="none"
              stroke={silhouette ? silInk : '#fef08a'}
              strokeWidth="1.45"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Conductive tip nodes + crackle arcs */}
            <circle cx="11.4" cy="1.2" r="1.0" fill={silhouette ? silInk : '#38bdf8'} stroke={silOutline} strokeWidth="0.45" />
            <circle cx="20.6" cy="1.2" r="1.0" fill={silhouette ? silInk : '#38bdf8'} stroke={silOutline} strokeWidth="0.45" />
            {!silhouette && mood !== 'ko' && mood !== 'sleep' && mood !== 'rest' && (
              <g className={sparkAnimClass}>
                <path d="M14.2 3.2 L16.0 1.8 L15.5 3.6 L17.6 2.4" fill="none" stroke="#7dd3fc" strokeWidth="0.85" strokeLinecap="round" />
                {isActiveEnergy && (
                  <>
                    <path d="M7.2 13.5 L8.8 14.4 L7.7 15.8" fill="none" stroke="#38bdf8" strokeWidth="0.9" strokeLinecap="round" />
                    <path d="M24.8 13.5 L23.2 14.4 L24.3 15.8" fill="none" stroke="#38bdf8" strokeWidth="0.9" strokeLinecap="round" />
                  </>
                )}
              </g>
            )}
          </g>
        )}

        {speciesId === 'aquabeak' && (
          <g>
            <path d="M14.2 9.4 Q16.2 3.2 19.2 9.2 Z" fill={silhouette ? silInk : secondary} stroke={silOutline} strokeWidth="1" />
            <path d="M7.2 18.6 L10.8 15.8 L10.8 21.4 Z" fill={silhouette ? silInk : secondary} stroke={silOutline} strokeWidth="0.9" />
            <path d="M24.8 18.6 L21.2 15.8 L21.2 21.4 Z" fill={silhouette ? silInk : secondary} stroke={silOutline} strokeWidth="0.9" />
          </g>
        )}

        {speciesId === 'musgacorn' && (
          <g>
            <path d="M16 10 L16 4.4" stroke={silhouette ? silOutline : '#15803d'} strokeWidth="2.2" strokeLinecap="round" />
            <ellipse cx="13.2" cy="5.2" rx="2.6" ry="1.3" fill={silhouette ? silInk : '#4ade80'} stroke={silOutline} strokeWidth="0.8" transform="rotate(20 13.2 5.2)" />
            <ellipse cx="18.8" cy="4.6" rx="2.8" ry="1.4" fill={silhouette ? silInk : '#86efac'} stroke={silOutline} strokeWidth="0.8" transform="rotate(-18 18.8 4.6)" />
          </g>
        )}

        {speciesId === 'doc' && (
          <g>
            <ellipse cx="16" cy="5.4" rx="5.4" ry="1.6" fill="none" stroke={silhouette ? silOutline : '#fef08a'} strokeWidth="1.5" />
            <path d="M8.6 17.5 Q10.2 14.5 12 17.2" fill="none" stroke={silhouette ? silOutline : secondary} strokeWidth="1.6" strokeLinecap="round" />
            <path d="M23.4 17.5 Q21.8 14.5 20 17.2" fill="none" stroke={silhouette ? silOutline : secondary} strokeWidth="1.6" strokeLinecap="round" />
          </g>
        )}

        {speciesId === 'glaciomita' && (
          <g fill={silhouette ? silInk : '#e0f2fe'} stroke={silOutline} strokeWidth="0.95" strokeLinejoin="round">
            <polygon points="12.2,10.6 10.6,5 14.4,9" />
            <polygon points="14.5,9.4 16,2.8 17.5,9.4" fill={silhouette ? silInk : '#ffffff'} />
            <polygon points="19.8,10.6 21.4,5 17.6,9" />
          </g>
        )}

        {speciesId === 'voltrix' && (
          <g>
            <path d="M9.6 15.2 L7.2 13.6 L8.8 17.6 Z" fill={silhouette ? silInk : '#fef08a'} stroke={silOutline} strokeWidth="0.9" />
            <path d="M22.4 15.2 L24.8 13.6 L23.2 17.6 Z" fill={silhouette ? silInk : '#fef08a'} stroke={silOutline} strokeWidth="0.9" />
            <polyline points="14,9.2 16,3.4 18,9.2" fill="none" stroke={silhouette ? silOutline : '#fde047'} strokeWidth="1.6" strokeLinejoin="round" />
          </g>
        )}

        {speciesId === 'flaringo' && (
          <g>
            <path d="M13.5 9.2 Q15.5 1.8 21.2 4.8 Q18.4 7.8 20.2 10.2 Z" fill={silhouette ? silInk : secondary} stroke={silOutline} strokeWidth="1" />
            <line x1="12.6" y1="9.8" x2="10.8" y2="6.2" stroke={silhouette ? silOutline : '#fef08a'} strokeWidth="1.2" strokeLinecap="round" />
          </g>
        )}

        {speciesId === 'lariat' && (
          <g>
            <polygon points="10.2,11.8 8.2,7.2 12.6,10.2" fill={silhouette ? silInk : '#d97706'} stroke={silOutline} strokeWidth="0.9" />
            <polygon points="21.8,11.8 23.8,7.2 19.4,10.2" fill={silhouette ? silInk : '#d97706'} stroke={silOutline} strokeWidth="0.9" />
          </g>
        )}

        {speciesId === 'piroclasto' && (
          <g>
            <polygon points="12.2,10 13.2,6.4 18.8,6.4 19.8,10" fill={silhouette ? silInk : '#451a03'} stroke={silOutline} strokeWidth="1" />
            <path d="M13.8 6.6 Q16 2.8 18.2 6.6 Z" fill={silhouette ? silInk : '#fb923c'} />
            <circle cx="9.2" cy="18.2" r="2.2" fill={silhouette ? silInk : '#7f1d1d'} stroke={silOutline} strokeWidth="0.9" />
            <circle cx="22.8" cy="18.2" r="2.2" fill={silhouette ? silInk : '#7f1d1d'} stroke={silOutline} strokeWidth="0.9" />
          </g>
        )}

        {speciesId === 'enigmo' && (
          <g>
            <polygon points="16,2.8 18.2,6.4 16,8.6 13.8,6.4" fill={silhouette ? silInk : '#5eead4'} stroke={silOutline} strokeWidth="0.9" />
            <path d="M11 23 Q9.4 26.8 11.4 27.6" fill="none" stroke={silhouette ? silOutline : primary} strokeWidth="2.1" strokeLinecap="round" />
            <path d="M21 23 Q22.6 26.8 20.6 27.6" fill="none" stroke={silhouette ? silOutline : primary} strokeWidth="2.1" strokeLinecap="round" />
          </g>
        )}

        {speciesId === 'darkfurnus' && (
          <g>
            <path d="M12.2 10.6 Q8.2 5.4 10.8 3.2 Q13.2 6.4 14.2 9.4 Z" fill={silhouette ? silInk : secondary} stroke={silOutline} strokeWidth="0.95" />
            <path d="M19.8 10.6 Q23.8 5.4 21.2 3.2 Q18.8 6.4 17.8 9.4 Z" fill={silhouette ? silInk : secondary} stroke={silOutline} strokeWidth="0.95" />
            <path d="M7.6 16.5 L11 14 L11 20 Z" fill={silhouette ? silInk : '#3b0764'} stroke={silOutline} strokeWidth="0.9" />
            <path d="M24.4 16.5 L21 14 L21 20 Z" fill={silhouette ? silInk : '#3b0764'} stroke={silOutline} strokeWidth="0.9" />
          </g>
        )}

        {speciesId === 'umbrospect' && (
          <g>
            <path d="M11.6 10.2 Q8.8 5.2 11.4 4 Q13.6 7 14.5 9.6" fill={silhouette ? silInk : '#a855f7'} stroke={silOutline} strokeWidth="0.9" />
            <path d="M20.4 10.2 Q23.2 5.2 20.6 4 Q18.4 7 17.5 9.6" fill={silhouette ? silInk : '#a855f7'} stroke={silOutline} strokeWidth="0.9" />
          </g>
        )}

        {speciesId === 'aetherion' && (
          <g>
            <ellipse cx="16" cy="17.2" rx="11.2" ry="3.4" fill="none" stroke={silhouette ? silOutline : '#99f6e4'} strokeWidth="1" opacity="0.72" transform="rotate(-14 16 17.2)" />
            <polygon points="16,2.4 18.6,6.8 16,9.4 13.4,6.8" fill={silhouette ? silInk : '#fef08a'} stroke={silOutline} strokeWidth="0.9" />
          </g>
        )}

        {speciesId === 'arachnet' && (
          <g>
            <path d="M10.4 15.0 L5.8 13.2 L4.8 18.2" fill="none" stroke={silOutline} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M21.6 15.0 L26.2 13.2 L27.2 18.2" fill="none" stroke={silOutline} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M10.0 18.8 L5.6 18.8 L4.8 23.0" fill="none" stroke={silhouette ? silOutline : secondary} strokeWidth="1.5" strokeLinecap="round" />
            <path d="M22.0 18.8 L26.4 18.8 L27.2 23.0" fill="none" stroke={silhouette ? silOutline : secondary} strokeWidth="1.5" strokeLinecap="round" />
            <polygon points="13.8,9.6 16,4.2 18.2,9.6" fill={silhouette ? silInk : secondary} stroke={silOutline} strokeWidth="0.9" />
          </g>
        )}

        {speciesId === 'bubbaleone' && (
          <g>
            <circle cx="16" cy="6.6" r="3.4" fill={silhouette ? silInk : '#a5f3fc'} fillOpacity="0.82" stroke={silOutline} strokeWidth="0.95" />
            {!silhouette && <circle cx="14.8" cy="5.4" r="1.0" fill="#ffffff" />}
            <circle cx="8.8" cy="18.0" r="1.8" fill={silhouette ? silInk : secondary} stroke={silOutline} strokeWidth="0.8" />
            <circle cx="23.2" cy="18.0" r="1.8" fill={silhouette ? silInk : secondary} stroke={silOutline} strokeWidth="0.8" />
          </g>
        )}

        {speciesId === 'rammstone' && (
          <g>
            <path d="M11.6 11.4 Q7.2 8.0 6.2 11.6 Q7.8 13.8 9.8 12.6" fill={silhouette ? silInk : '#78350f'} stroke={silOutline} strokeWidth="1.15" strokeLinejoin="round" />
            <path d="M20.4 11.4 Q24.8 8.0 25.8 11.6 Q24.2 13.8 22.2 12.6" fill={silhouette ? silInk : '#78350f'} stroke={silOutline} strokeWidth="1.15" strokeLinejoin="round" />
            <circle cx="7.6" cy="20.4" r="2.2" fill={silhouette ? silInk : '#b45309'} stroke={silOutline} strokeWidth="0.95" />
            <circle cx="24.4" cy="20.4" r="2.2" fill={silhouette ? silInk : '#b45309'} stroke={silOutline} strokeWidth="0.95" />
          </g>
        )}

        {speciesId === 'fandango' && (
          <g>
            <polygon points="12.8,9.2 16,3.0 19.2,9.2" fill={silhouette ? silInk : '#fef08a'} stroke={silOutline} strokeWidth="0.95" />
            <ellipse cx="7.8" cy="16.4" rx="2.0" ry="3.2" fill={silhouette ? silInk : '#fef08a'} stroke={silOutline} strokeWidth="0.9" />
            <ellipse cx="24.2" cy="16.4" rx="2.0" ry="3.2" fill={silhouette ? silInk : '#fef08a'} stroke={silOutline} strokeWidth="0.9" />
          </g>
        )}

        {speciesId === 'armashelt' && (
          <g>
            <path d="M8.6 12.6 Q16 6.8 23.4 12.6 L21.6 14.4 L10.4 14.4 Z" fill={silhouette ? silInk : '#b45309'} stroke={silOutline} strokeWidth="1.05" strokeLinejoin="round" />
            <polygon points="14.2,9.2 16,5.2 17.8,9.2" fill={silhouette ? silInk : secondary} stroke={silOutline} strokeWidth="0.9" />
          </g>
        )}

        {/* Main Differentiated Anatomical Body */}
        <path
          d={geo.torsoPath}
          fill={silhouette ? silInk : primary}
          stroke={silOutline}
          strokeWidth={silhouette ? '1.15' : '1.35'}
          strokeLinejoin="round"
        />
        {!silhouette && <path d={geo.torsoPath} fill={`url(#body_${uid})`} />}

        {/* Differentiated Belly Plate */}
        {!silhouette && <path d={geo.bellyPath} fill={belly} opacity="0.94" />}

        {/* Unified -45deg Specular Rim Light */}
        {!silhouette && (
          <path
            d={geo.rimHighlight}
            fill="none"
            stroke="rgba(255,255,255,0.58)"
            strokeWidth="1.25"
            strokeLinecap="round"
          />
        )}

        {/* Grounded Stubby Limbs / Fore-Feet for Priority Trio */}
        {speciesId === 'infurnus' && (
          <g>
            <ellipse cx="13.1" cy="25.9" rx="1.6" ry="1.0" fill={silhouette ? silInk : shadow} stroke={silOutline} strokeWidth="0.9" />
            <ellipse cx="19.1" cy="25.9" rx="1.6" ry="1.0" fill={silhouette ? silInk : shadow} stroke={silOutline} strokeWidth="0.9" />
            <path d="M11.6 18.6 Q10.0 19.6 10.6 21.0" fill="none" stroke={silOutline} strokeWidth="1.35" strokeLinecap="round" />
            <path d="M20.6 18.6 Q22.2 19.6 21.6 21.0" fill="none" stroke={silOutline} strokeWidth="1.35" strokeLinecap="round" />
          </g>
        )}
        {speciesId === 'frostcrawler' && (
          <g>
            <rect x="8.8" y="24.8" width="2.8" height="2.0" rx="0.8" fill={silhouette ? silInk : '#164e63'} stroke={silOutline} strokeWidth="0.9" />
            <rect x="13.0" y="25.2" width="2.4" height="1.9" rx="0.8" fill={silhouette ? silInk : '#164e63'} stroke={silOutline} strokeWidth="0.9" />
            <rect x="16.8" y="25.2" width="2.4" height="1.9" rx="0.8" fill={silhouette ? silInk : '#164e63'} stroke={silOutline} strokeWidth="0.9" />
            <rect x="20.6" y="24.8" width="2.8" height="2.0" rx="0.8" fill={silhouette ? silInk : '#164e63'} stroke={silOutline} strokeWidth="0.9" />
          </g>
        )}
        {speciesId === 'tazerling' && (
          <g>
            <ellipse cx="13.2" cy="25.7" rx="1.7" ry="1.0" fill={silhouette ? silInk : '#ca8a04'} stroke={silOutline} strokeWidth="0.9" />
            <ellipse cx="18.8" cy="25.7" rx="1.7" ry="1.0" fill={silhouette ? silInk : '#ca8a04'} stroke={silOutline} strokeWidth="0.9" />
            <path d="M11.2 19.8 Q9.6 20.6 10.4 21.8" fill="none" stroke={silOutline} strokeWidth="1.25" strokeLinecap="round" />
            <path d="M20.8 19.8 Q22.4 20.6 21.6 21.8" fill="none" stroke={silOutline} strokeWidth="1.25" strokeLinecap="round" />
          </g>
        )}

        {/* Species Surface Material Details & Distinct Markings (Hidden in pure silhouette test mode) */}
        {!silhouette && speciesId === 'infurnus' && (
          <g>
            {/* Volumetric fire chest seams + glowing core diamond */}
            <path d="M13.8 19.6 Q16.1 20.8 18.4 19.6" fill="none" stroke="#ea580c" strokeWidth="1.1" strokeLinecap="round" />
            <path d="M14.3 22.3 Q16.1 23.3 17.9 22.3" fill="none" stroke="#ea580c" strokeWidth="1.05" strokeLinecap="round" />
            <polygon points="16.1,16.8 17.1,18.0 16.1,19.1 15.1,18.0" fill="#fb923c" opacity="0.82" />
          </g>
        )}
        {!silhouette && speciesId === 'frostcrawler' && (
          <g stroke="#155e75" strokeWidth="1.05" strokeLinecap="round">
            {/* Heavy hexagonal dorsal carapace bevel, brow rim & lateral mandibles */}
            <path d="M8.6 13.4 Q16 11.1 23.4 13.4" fill="none" stroke="#e0f2fe" strokeWidth="1.3" />
            <path d="M11.2 10.9 L13.4 12.8 L18.6 12.8 L20.8 10.9" fill="none" stroke="#155e75" strokeWidth="0.95" />
            <path d="M10.5 20.6 L21.5 20.6" fill="none" />
            <path d="M11.6 23.3 L20.4 23.3" fill="none" />
            {/* Frost pincer mandibles framing mouth */}
            <path d="M11.0 17.4 Q12.4 19.0 13.9 18.2" fill="none" stroke="#bae6fd" strokeWidth="1.35" />
            <path d="M21.0 17.4 Q19.6 19.0 18.1 18.2" fill="none" stroke="#bae6fd" strokeWidth="1.35" />
          </g>
        )}
        {!silhouette && speciesId === 'tazerling' && (
          <g>
            {/* Swollen glowing cyan cheek sacs + subtle electric gleam */}
            <circle cx="11.2" cy="16.7" r="2.0" fill="#0ea5e9" stroke="#060c14" strokeWidth="0.65" />
            <circle cx="20.8" cy="16.7" r="2.0" fill="#0ea5e9" stroke="#060c14" strokeWidth="0.65" />
            <circle cx="11.2" cy="16.7" r="1.35" fill="#7dd3fc" opacity={isActiveEnergy ? '0.98' : '0.85'} />
            <circle cx="20.8" cy="16.7" r="1.35" fill="#7dd3fc" opacity={isActiveEnergy ? '0.98' : '0.85'} />
            <circle cx="10.7" cy="16.1" r="0.55" fill="#ffffff" />
            <circle cx="20.3" cy="16.1" r="0.55" fill="#ffffff" />
            <polyline points="14.5,20.4 16.2,19.4 15.6,21.8 17.4,20.8" fill="none" stroke="#0ea5e9" strokeWidth="0.95" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        )}
        {!silhouette && speciesId === 'lariat' && (
          <g>
            <path d="M9.4 20.2 Q16 22 22.6 20.2" fill="none" stroke="#fbbf24" strokeWidth="1.9" strokeLinecap="round" />
            <polygon points="15.2,17.2 16.8,17.2 16,14.8" fill="#fef3c7" stroke="#060c14" strokeWidth="0.65" />
          </g>
        )}
        {!silhouette && speciesId === 'musgacorn' && (
          <path d="M10.4 17.8 Q16 20 21.6 17.8" fill="none" stroke="#15803d" strokeWidth="1.8" strokeLinecap="round" />
        )}
        {!silhouette && speciesId === 'aquabeak' && (
          <polygon points="14.6,16.2 17.4,16.2 16,18.2" fill="#fde047" stroke="#060c14" strokeWidth="0.65" />
        )}
        {!silhouette && speciesId === 'piroclasto' && (
          <path d="M11.6 19.6 L14 21 L18 20.6 L20.4 19.2" fill="none" stroke="#fb923c" strokeWidth="1.2" strokeLinecap="round" />
        )}
        {!silhouette && speciesId === 'doc' && (
          <circle cx="16" cy="11.2" r="1.3" fill="#2dd4bf" stroke="#ffffff" strokeWidth="0.6" />
        )}
        {!silhouette && (speciesId === 'enigmo' || speciesId === 'umbrospect') && (
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
        {!silhouette && speciesId === 'arachnet' && (
          <path d="M12.5 21.4 L19.5 21.4 M16 18.8 L16 24.0" stroke="#064e3b" strokeWidth="0.9" strokeLinecap="round" />
        )}
        {!silhouette && speciesId === 'bubbaleone' && (
          <>
            <circle cx="10.8" cy="17.0" r="1.4" fill="#a5f3fc" opacity="0.9" />
            <circle cx="21.2" cy="17.0" r="1.4" fill="#a5f3fc" opacity="0.9" />
          </>
        )}
        {!silhouette && speciesId === 'armashelt' && (
          <path d="M9.6 19.6 L22.4 19.6 M10.6 22.8 L21.4 22.8" stroke="#451a03" strokeWidth="1.05" strokeLinecap="round" />
        )}

        {/* Expressive Eyes & Brows (Hidden during silhouette check) */}
        {!silhouette && (
          <>
            {mood === 'sleep' || mood === 'rest' ? (
              <g stroke="#060c14" strokeWidth="1.35" strokeLinecap="round" fill="none">
                <path d={`M${lx - 1.3} ${ly} Q${lx} ${ly + 1.1} ${lx + 1.3} ${ly}`} />
                <path d={`M${rx - 1.3} ${ry} Q${rx} ${ry + 1.1} ${rx + 1.3} ${ry}`} />
              </g>
            ) : mood === 'ko' ? (
              <g stroke="#060c14" strokeWidth="1.35" strokeLinecap="round">
                <line x1={lx - 1} y1={ly - 1} x2={lx + 1} y2={ly + 1} />
                <line x1={lx + 1} y1={ly - 1} x2={lx - 1} y2={ly + 1} />
                <line x1={rx - 1} y1={ry - 1} x2={rx + 1} y2={ry + 1} />
                <line x1={rx + 1} y1={ry - 1} x2={rx - 1} y2={ry + 1} />
              </g>
            ) : mood === 'hit' ? (
              <g stroke={irisColor} strokeWidth="1.4" strokeLinecap="round" fill="none">
                <path d={`M${lx - 1.2} ${ly - 0.9} L${lx + 1.1} ${ly} L${lx - 1.2} ${ly + 0.9}`} />
                <path d={`M${rx + 1.2} ${ry - 0.9} L${rx - 1.1} ${ry} L${rx + 1.2} ${ry + 0.9}`} />
              </g>
            ) : mood === 'happy' || mood === 'victory' ? (
              <g>
                <path
                  d={`M${lx - 1.3} ${ly + 0.4} Q${lx} ${ly - 1.5} ${lx + 1.3} ${ly + 0.4}`}
                  fill="none"
                  stroke={irisColor}
                  strokeWidth="1.55"
                  strokeLinecap="round"
                />
                <path
                  d={`M${rx - 1.3} ${ry + 0.4} Q${rx} ${ry - 1.5} ${rx + 1.3} ${ry + 0.4}`}
                  fill="none"
                  stroke={irisColor}
                  strokeWidth="1.55"
                  strokeLinecap="round"
                />
              </g>
            ) : (
              <g className={canBlink ? 'bt-slug-blink-eyes' : ''}>
                <g className={canSaccade ? 'bt-part-eye-saccade' : ''}>
                  {sheet.eyeStyle === 'heavy_amber_slit' || sheet.eyeStyle === 'stoic_brow' ? (
                    <>
                      <ellipse cx={lx} cy={ly} rx="1.55" ry="1.0" fill="#fde047" stroke="#060c14" strokeWidth="0.7" />
                      <ellipse cx={rx} cy={ry} rx="1.55" ry="1.0" fill="#fde047" stroke="#060c14" strokeWidth="0.7" />
                      <line x1={lx} y1={ly - 0.75} x2={lx} y2={ly + 0.75} stroke="#060c14" strokeWidth="0.85" strokeLinecap="round" />
                      <line x1={rx} y1={ry - 0.75} x2={rx} y2={ry + 0.75} stroke="#060c14" strokeWidth="0.85" strokeLinecap="round" />
                      <line x1={lx - 1.8} y1={ly - 1.4} x2={lx + 1.5} y2={ly - 0.75} stroke="#060c14" strokeWidth="1.35" strokeLinecap="round" />
                      <line x1={rx + 1.8} y1={ry - 1.4} x2={rx - 1.5} y2={ry - 0.75} stroke="#060c14" strokeWidth="1.35" strokeLinecap="round" />
                    </>
                  ) : sheet.eyeStyle === 'wide_hyper_spark' ? (
                    <>
                      <circle cx={lx} cy={ly} r="1.8" fill="#ffffff" stroke="#060c14" strokeWidth="0.72" />
                      <circle cx={rx} cy={ry} r="1.8" fill="#ffffff" stroke="#060c14" strokeWidth="0.72" />
                      <circle cx={lx + 0.28} cy={ly} r="1.05" fill="#0ea5e9" stroke="#060c14" strokeWidth="0.35" />
                      <circle cx={rx - 0.28} cy={ry} r="1.05" fill="#0ea5e9" stroke="#060c14" strokeWidth="0.35" />
                      <circle cx={lx + 0.3} cy={ly + 0.05} r="0.55" fill="#060c14" />
                      <circle cx={rx - 0.3} cy={ry + 0.05} r="0.55" fill="#060c14" />
                      <circle cx={lx - 0.42} cy={ly - 0.6} r="0.58" fill="#ffffff" />
                      <circle cx={rx - 0.42} cy={ry - 0.6} r="0.58" fill="#ffffff" />
                    </>
                  ) : (
                    <>
                      <ellipse
                        cx={lx}
                        cy={ly}
                        rx="1.32"
                        ry={sheet.eyeStyle === 'determined_slanted' || sheet.eyeStyle === 'fierce_glowing' ? '1.45' : '1.52'}
                        fill={speciesId === 'infurnus' ? '#0b1019' : irisColor}
                        stroke={isShadowType ? '#060c14' : 'none'}
                        strokeWidth="0.5"
                      />
                      <ellipse
                        cx={rx}
                        cy={ry}
                        rx="1.32"
                        ry={sheet.eyeStyle === 'determined_slanted' || sheet.eyeStyle === 'fierce_glowing' ? '1.45' : '1.52'}
                        fill={speciesId === 'infurnus' ? '#0b1019' : irisColor}
                        stroke={isShadowType ? '#060c14' : 'none'}
                        strokeWidth="0.5"
                      />
                      {speciesId === 'infurnus' && (
                        <>
                          <circle cx={lx + 0.15} cy={ly + 0.2} r="0.52" fill="#f97316" />
                          <circle cx={rx - 0.15} cy={ry + 0.2} r="0.52" fill="#f97316" />
                        </>
                      )}
                      <circle cx={lx - 0.42} cy={ly - 0.52} r="0.55" fill="#ffffff" />
                      <circle cx={rx - 0.42} cy={ry - 0.52} r="0.55" fill="#ffffff" />
                      {(isActiveEnergy ||
                        sheet.eyeStyle === 'determined_slanted' ||
                        sheet.eyeStyle === 'fierce_glowing' ||
                        sheet.eyeStyle === 'sly_angular') && (
                        <>
                          <line x1={lx - 1.6} y1={ly - 1.85} x2={lx + 1.3} y2={ly - 1.05} stroke="#060c14" strokeWidth="1.2" strokeLinecap="round" />
                          <line x1={rx + 1.6} y1={ry - 1.85} x2={rx - 1.3} y2={ry - 1.05} stroke="#060c14" strokeWidth="1.2" strokeLinecap="round" />
                        </>
                      )}
                    </>
                  )}
                </g>
              </g>
            )}

            {/* Expressive Mouth (Distinct by species & mood) */}
            {mood !== 'sleep' && mood !== 'rest' && mood !== 'ko' && speciesId !== 'aquabeak' && (
              <g>
                {mood === 'eat' ||
                mood === 'happy' ||
                mood === 'play' ||
                mood === 'victory' ||
                mood === 'attack' ||
                mood === 'fire' ||
                mood === 'flight' ||
                sheet.mouthStyle === 'cheerful_open' ? (
                  <g>
                    <path
                      d={`M14.2 ${geo.mouthY - 0.2} Q16 ${geo.mouthY + 2.0} 17.8 ${geo.mouthY - 0.2} Z`}
                      fill="#450a0a"
                      stroke="#060c14"
                      strokeWidth="0.72"
                    />
                    {speciesId === 'infurnus' && (
                      <polygon points={`16.9,${geo.mouthY} 17.5,${geo.mouthY} 17.2,${geo.mouthY + 0.85}`} fill="#ffffff" />
                    )}
                  </g>
                ) : sheet.mouthStyle === 'armored_jaw' || sheet.mouthStyle === 'fierce_scowl' ? (
                  <path
                    d={`M13.5 ${geo.mouthY + 0.55} L15.0 ${geo.mouthY - 0.35} L17.0 ${geo.mouthY - 0.35} L18.5 ${geo.mouthY + 0.55}`}
                    fill="none"
                    stroke="#060c14"
                    strokeWidth="1.15"
                    strokeLinecap="round"
                  />
                ) : sheet.mouthStyle === 'fang_grin' ? (
                  <g>
                    <path d={`M14.1 ${geo.mouthY + 0.1} Q16 ${geo.mouthY + 1.2} 18.1 ${geo.mouthY - 0.35}`} fill="none" stroke="#060c14" strokeWidth="1.0" strokeLinecap="round" />
                    <polygon points={`17.0,${geo.mouthY + 0.1} 17.7,${geo.mouthY + 0.1} 17.35,${geo.mouthY + 1.05}`} fill="#ffffff" />
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

            {/* Mood Signifiers (Sleep Zzz, React/Charge Sparkle) */}
            {(mood === 'sleep' || mood === 'rest') && (
              <g className={animated ? 'bt-slug-zzz' : ''} fill="#bae6fd" fontSize="5" fontWeight="bold">
                <text x="22" y="9">z</text>
              </g>
            )}
            {(mood === 'react' || mood === 'charge' || mood === 'transform') && (
              <circle
                cx="24.5"
                cy="7.5"
                r="1.45"
                className={sparkAnimClass}
                fill={sheet.palette.energyCore}
                stroke="#ffffff"
                strokeWidth="0.5"
              />
            )}
          </>
        )}
      </g>
    </svg>
  );
};
