import React from 'react';
import { AffinityState } from '../types';

interface AffinityBarProps {
  affinity: AffinityState;
}

const AffinityBar: React.FC<AffinityBarProps> = ({ affinity }) => {
  return (
    <div className="w-full p-4 border-b border-gray-800 bg-gray-900/50 backdrop-blur">
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs font-mono text-cyan-400">EARNED_AFFINITY</span>
        <span className="text-xl font-mono font-bold text-white">{affinity.score.toFixed(1)}%</span>
      </div>
      
      {/* Progress Bar */}
      <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden relative">
        <div 
          className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 transition-all duration-500 ease-out"
          style={{ width: `${affinity.score}%` }}
        />
        {/* Milestones */}
        <div className="absolute top-0 left-[25%] h-full w-0.5 bg-black/50" />
        <div className="absolute top-0 left-[50%] h-full w-0.5 bg-black/50" />
        <div className="absolute top-0 left-[75%] h-full w-0.5 bg-black/50" />
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {affinity.abilities.map((ability, idx) => (
          <span key={idx} className="px-2 py-0.5 text-[10px] font-mono border border-cyan-500/30 text-cyan-300 rounded bg-cyan-950/30">
            {ability}
          </span>
        ))}
      </div>
    </div>
  );
};

export default AffinityBar;
