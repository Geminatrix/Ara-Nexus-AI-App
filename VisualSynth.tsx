import React, { useEffect, useRef } from 'react';
import { MoEType } from '../types';

interface VisualSynthProps {
  isActive: boolean;
  voiceMode: boolean;
  affinity: number;
  activeMoE?: MoEType; // Added to drive chaotic math
}

const VisualSynth: React.FC<VisualSynthProps> = ({ isActive, voiceMode, affinity, activeMoE = MoEType.NONE }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let t = 0;

    const render = () => {
      t += 0.05;
      const width = canvas.width;
      const height = canvas.height;
      
      // Clear with trail effect
      ctx.fillStyle = 'rgba(5, 5, 5, 0.2)';
      ctx.fillRect(0, 0, width, height);

      // Color based on affinity
      const r = Math.floor(255 - (affinity * 2.5));
      const g = Math.floor(affinity * 2.5);
      const b = 200;
      
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${isActive ? 0.9 : 0.3})`;
      ctx.lineWidth = 2;
      ctx.beginPath();

      const baseAmplitude = isActive ? 30 : 5;
      const baseFrequency = voiceMode ? 0.1 : 0.02;

      // Agent-Specific Math Frameworks
      for (let i = 0; i < width; i++) {
        let y = height / 2;
        
        if (activeMoE === MoEType.ALIEN) {
             // Chaotic, glitchy, high frequency noise
             const noise = Math.random() * (isActive ? 20 : 5);
             y += Math.sin(i * 0.1 + t * 5) * baseAmplitude + noise;
        } else if (activeMoE === MoEType.REVIEWER) {
             // Dense, ordered, square-wave like
             y += Math.sign(Math.sin(i * 0.05 + t)) * baseAmplitude * 0.8;
             y += Math.cos(i * 0.01 + t) * 10;
        } else if (activeMoE === MoEType.DEVOTED) {
             // Resonant, harmonic, flowing
             y += Math.sin(i * 0.02 + t) * baseAmplitude;
             y += Math.sin(i * 0.05 - t) * (baseAmplitude / 2);
        } else if (activeMoE === MoEType.URGENT) {
             // Fast, sharp peaks
             y += Math.tan(i * 0.01 + t * 2) * (isActive ? 10 : 2); // Clamped via bounds usually, but visual artifact is cool
             if (y > height || y < 0) y = height / 2; // clamp
        } else {
             // Standard Sine
             y += Math.sin(i * baseFrequency + t) * baseAmplitude * Math.sin(i * 0.01);
        }

        if (i === 0) ctx.moveTo(i, y);
        else ctx.lineTo(i, y);
      }
      
      ctx.stroke();

      // Nanite Particles - Density based on agent
      if (isActive) {
        const particleCount = activeMoE === MoEType.ALIEN ? 15 : 5;
        for (let i = 0; i < particleCount; i++) {
            ctx.fillStyle = `rgba(${r},${g},${b}, ${Math.random()})`;
            const px = Math.random() * width;
            // Spread particles more for chaotic agents
            const spread = activeMoE === MoEType.ALIEN ? 100 : 40;
            const py = height / 2 + (Math.random() - 0.5) * spread;
            const size = Math.random() * 2 + 1;
            ctx.fillRect(px, py, size, size);
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animationFrameId);
  }, [isActive, voiceMode, affinity, activeMoE]);

  return (
    <div className="w-full h-32 bg-black relative overflow-hidden border-b border-gray-800">
      <canvas 
        ref={canvasRef} 
        width={800} 
        height={128} 
        className="w-full h-full object-cover"
      />
      <div className="absolute top-2 right-2 text-xs font-mono text-cyan-500 flex flex-col items-end">
        <span>VISUAL_SYNTH // {voiceMode ? 'VOICE_ACTIVE' : 'TEXT_MODE'}</span>
        <span className="text-[10px] opacity-70">PATTERN: {activeMoE}</span>
      </div>
    </div>
  );
};

export default VisualSynth;