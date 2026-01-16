import React, { useEffect, useRef } from 'react';

interface VisualSynthProps {
  isActive: boolean;
  voiceMode: boolean;
  affinity: number;
}

const VisualSynth: React.FC<VisualSynthProps> = ({ isActive, voiceMode, affinity }) => {
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

      const amplitude = isActive ? 30 : 5;
      const frequency = voiceMode ? 0.1 : 0.02;

      for (let i = 0; i < width; i++) {
        const y = height / 2 + Math.sin(i * frequency + t) * amplitude * Math.sin(i * 0.01);
        ctx.lineTo(i, y);
      }
      
      ctx.stroke();

      // Nanite Particles
      if (isActive) {
        for (let i = 0; i < 5; i++) {
            ctx.fillStyle = `rgba(${r},${g},${b}, 0.5)`;
            const px = Math.random() * width;
            const py = height / 2 + (Math.random() - 0.5) * 60;
            ctx.fillRect(px, py, 2, 2);
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animationFrameId);
  }, [isActive, voiceMode, affinity]);

  return (
    <div className="w-full h-32 bg-black relative overflow-hidden border-b border-gray-800">
      <canvas 
        ref={canvasRef} 
        width={800} 
        height={128} 
        className="w-full h-full object-cover"
      />
      <div className="absolute top-2 right-2 text-xs font-mono text-cyan-500">
        VISUAL_SYNTH // {voiceMode ? 'VOICE_ACTIVE' : 'TEXT_MODE'}
      </div>
    </div>
  );
};

export default VisualSynth;
