import React from 'react';
import {
  BatteryCharging,
  Cherry,
  Compass,
  Radar,
} from 'lucide-react';
import type { HotbarAction, InventoryKey } from '../game/types';

export const ToolIcon: React.FC<{ action: HotbarAction; className?: string }> = ({
  action,
  className = 'w-4 h-4',
}) => {
  switch (action) {
    case 'station':
      return <BatteryCharging className={`${className} text-cyan-300`} />;
    case 'berry':
      return <Cherry className={`${className} text-emerald-300`} />;
    case 'pulse':
      return <Radar className={`${className} text-teal-300`} />;
    default:
      return <Compass className={`${className} text-teal-300`} />;
  }
};

export const ResourceSwatch: React.FC<{ itemKey: InventoryKey }> = ({ itemKey }) => {
  const colorMap: Record<InventoryKey, string> = {
    ore: '#facc15',
    wood: '#a16207',
    stone: '#94a3b8',
    crystal: '#2dd4bf',
    shadowShard: '#a855f7',
    berries: '#4ade80',
    core: '#38bdf8',
    capsules: '#6366f1',
    masterCapsules: '#c084fc',
    torches: '#fb923c',
    walls: '#64748b',
    floors: '#b45309',
    doors: '#d97706',
    stations: '#22d3ee',
    elixirs: '#e879f9',
    relics: '#fbbf24',
    emberSnack: '#f97316',
    frostNectar: '#7dd3fc',
    nest: '#4ade80',
    bed: '#38bdf8',
    feeder: '#fbbf24',
    decor: '#5eead4',
    rootWood: '#84cc16',
    magmaCoal: '#ea580c',
    thermalCopper: '#f59e0b',
    iceCrystal: '#bae6fd',
    blueQuartz: '#3b82f6',
    darkIron: '#818cf8',
    neonMushroom: '#22d3ee',
    evoStone: '#f472b6',
  };

  return (
    <span
      className="inline-block w-2.5 h-2.5 rounded-[3px] shrink-0 border border-white/25"
      style={{ backgroundColor: colorMap[itemKey] || '#94a3b8' }}
    />
  );
};
