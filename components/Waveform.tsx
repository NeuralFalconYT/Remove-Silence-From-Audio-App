
import React, { useEffect, useRef } from 'react';

interface WaveformProps {
  audioBuffer: AudioBuffer | null;
  currentTime: number;
  duration: number;
  silenceRegions: { start: number; end: number }[]; // Now passed in directly
  onSeek: (time: number) => void;
  height?: number;
}

export const Waveform: React.FC<WaveformProps> = ({
  audioBuffer,
  currentTime,
  duration,
  silenceRegions,
  onSeek,
  height = 192
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Draw the waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !audioBuffer) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    // Ensure we use the prop height
    canvas.width = container.offsetWidth * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${container.offsetWidth}px`;
    canvas.style.height = `${height}px`;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, container.offsetWidth, height);

    const middle = height / 2;
    const rawData = audioBuffer.getChannelData(0);
    const step = Math.ceil(rawData.length / container.offsetWidth);
    
    // 1. Draw Silence Regions (Red blocks background) - Only if passed
    if (silenceRegions.length > 0) {
        silenceRegions.forEach(region => {
            const startX = (region.start / duration) * container.offsetWidth;
            const endX = (region.end / duration) * container.offsetWidth;
            
            // Semi-transparent red for silence background
            ctx.fillStyle = 'rgba(220, 38, 38, 0.15)'; 
            ctx.fillRect(startX, 0, endX - startX, height);
        });
    }

    // 2. Draw Waveform Lines
    const barWidth = 2;
    const gap = 1;

    for (let i = 0; i < container.offsetWidth; i += (barWidth + gap)) {
      let min = 1.0;
      let max = -1.0;
      
      for (let j = 0; j < step; j++) {
        const datum = rawData[(i * step) + j];
        if (datum !== undefined) {
            if (datum < min) min = datum;
            if (datum > max) max = datum;
        }
      }
      
      const val = Math.max(Math.abs(min), Math.abs(max));
      const h = Math.max(2, val * height * 0.9); 

      const currentSeconds = (i / container.offsetWidth) * duration;
      const isInsideSilence = silenceRegions.some(r => currentSeconds >= r.start && currentSeconds <= r.end);
      
      if (isInsideSilence) {
          // Red bars if silence
          ctx.fillStyle = '#ef4444'; // Red-500
          ctx.globalAlpha = 0.4;
      } else {
          // Bright NEON GREEN for active audio
          ctx.fillStyle = '#4ade80'; // Green-400
          ctx.globalAlpha = 1.0;
      }

      ctx.fillRect(i, middle - h / 2, barWidth, h);
    }

    // 3. Draw Playhead
    // Avoid division by zero
    if (duration > 0) {
        const cursorX = (currentTime / duration) * container.offsetWidth;
        
        ctx.globalAlpha = 1.0;
        ctx.beginPath();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.moveTo(cursorX, 0);
        ctx.lineTo(cursorX, height);
        ctx.stroke();
    }
    
  }, [audioBuffer, currentTime, duration, height, silenceRegions]);

  const handleClick = (e: React.MouseEvent) => {
      if (!containerRef.current || !duration) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const newTime = (x / rect.width) * duration;
      onSeek(Math.min(Math.max(0, newTime), duration));
  };

  return (
    <div 
        ref={containerRef} 
        className="w-full h-full relative cursor-pointer" 
        onClick={handleClick}
    >
        <canvas ref={canvasRef} className="w-full h-full block" />
        {!audioBuffer && (
            <div className="absolute inset-0 flex items-center justify-center text-tape-muted text-sm">
                Loading waveform...
            </div>
        )}
    </div>
  );
};
