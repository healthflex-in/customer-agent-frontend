import { useState, useRef, useEffect } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface SlideButtonProps {
  onSlideComplete: () => void;
  text: string;
  disabled?: boolean;
}

export default function SlideButton({ onSlideComplete, text, disabled = false }: SlideButtonProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);

  const maxPosition = containerRef.current 
    ? containerRef.current.offsetWidth - (sliderRef.current?.offsetWidth || 64)
    : 0;

  const handleStart = (clientX: number) => {
    if (disabled) return;
    setIsDragging(true);
  };

  const handleMove = (clientX: number) => {
    if (!isDragging || !containerRef.current || !sliderRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const newPosition = clientX - containerRect.left - sliderRef.current.offsetWidth / 2;
    const maxPos = containerRect.width - sliderRef.current.offsetWidth;

    if (newPosition >= 0 && newPosition <= maxPos) {
      setPosition(newPosition);

      // Check if slide is complete (90% threshold)
      if (newPosition >= maxPos * 0.9 && !isCompleted) {
        setIsCompleted(true);
        setTimeout(() => {
          onSlideComplete();
        }, 200);
      }
    }
  };

  const handleEnd = () => {
    setIsDragging(false);
    if (!isCompleted) {
      setPosition(0);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleStart(e.clientX);
  };

  const handleMouseMove = (e: MouseEvent) => {
    handleMove(e.clientX);
  };

  const handleMouseUp = () => {
    handleEnd();
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    handleStart(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    handleMove(e.touches[0].clientX);
  };

  const handleTouchEnd = () => {
    handleEnd();
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative w-full h-16 bg-secondary rounded-2xl overflow-hidden select-none transition-opacity",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      {/* Background text */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span
          className="text-sm font-bold uppercase tracking-widest transition-opacity duration-300"
          style={{
            opacity: Math.max(0, 1 - position / (maxPosition * 0.5)),
            color: "rgba(255,255,255,0.7)"
          }}
        >
          {text}
        </span>
      </div>

      {/* Progress background */}
      <div
        className="absolute inset-0 bg-primary/20 transition-all duration-150"
        style={{
          width: `${(position / (maxPosition || 1)) * 100}%`
        }}
      />

      {/* Slider button */}
      <div
        ref={sliderRef}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="absolute left-0 top-0 h-full w-16 bg-primary rounded-2xl flex items-center justify-center cursor-grab active:cursor-grabbing transition-shadow duration-150 hover:shadow-lg"
        style={{
          transform: `translateX(${position}px)`,
          boxShadow: isDragging ? "0 0 20px hsl(var(--primary) / 0.5)" : undefined
        }}
      >
        <ChevronRight className="h-6 w-6 text-primary-foreground" />
      </div>

      {/* Chevron hints */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex gap-1 pointer-events-none">
        {[...Array(3)].map((_, i) => (
          <ChevronRight
            key={i}
            className="h-5 w-5 text-muted-foreground/30 animate-pulse"
            style={{
              animationDelay: `${i * 0.2}s`
            }}
          />
        ))}
      </div>
    </div>
  );
}
