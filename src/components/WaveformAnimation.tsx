import { useEffect, useRef } from "react";

interface WaveformAnimationProps {
  isActive: boolean;
  audioLevel?: number;
}

export default function WaveformAnimation({ isActive, audioLevel = 0.5 }: WaveformAnimationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const barsRef = useRef<number[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const barCount = 40;
    if (barsRef.current.length === 0) {
      barsRef.current = Array(barCount).fill(0);
    }

    const draw = () => {
      const width = canvas.width;
      const height = canvas.height;
      const barWidth = width / barCount;

      ctx.clearRect(0, 0, width, height);

      barsRef.current.forEach((bar, i) => {
        if (isActive) {
          const targetHeight = Math.random() * audioLevel * height * 0.8 + height * 0.1;
          barsRef.current[i] += (targetHeight - bar) * 0.3;
        } else {
          barsRef.current[i] *= 0.9;
        }

        const barHeight = Math.max(2, barsRef.current[i]);
        const x = i * barWidth + barWidth / 4;
        const y = (height - barHeight) / 2;

        ctx.fillStyle = `hsl(142, 76%, ${56 + Math.sin(Date.now() / 1000 + i) * 10}%)`;
        ctx.fillRect(x, y, barWidth / 2, barHeight);
      });

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isActive, audioLevel]);

  return (
    <canvas
      ref={canvasRef}
      width={300}
      height={60}
      className="w-full h-full"
    />
  );
}
