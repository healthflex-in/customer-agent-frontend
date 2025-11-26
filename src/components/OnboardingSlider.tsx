import { useState, useRef } from "react";
import { Mic, MessageSquare, Sparkles } from "lucide-react";
import SlideButton from "./SlideButton";

const slides = [
  {
    icon: Mic,
    title: "Voice-First Interface",
    description: "Speak naturally and watch your words transform into text in real-time with our advanced transcription technology."
  },
  {
    icon: MessageSquare,
    title: "Smart Conversations",
    description: "Edit your transcriptions on the fly and get intelligent responses in a seamless conversational flow."
  },
  {
    icon: Sparkles,
    title: "Effortless Control",
    description: "Auto-save, clear, or end chats with simple controls. Your conversation, your way."
  }
];

interface OnboardingSliderProps {
  onComplete: () => void;
}

export default function OnboardingSlider({ onComplete }: OnboardingSliderProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const sliderRef = useRef<HTMLDivElement>(null);

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      onComplete();
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (touchStart - touchEnd > 75) {
      // Swipe left
      handleNext();
    }

    if (touchStart - touchEnd < -75 && currentSlide > 0) {
      // Swipe right
      setCurrentSlide(currentSlide - 1);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6 overflow-hidden">
      <div className="max-w-md w-full space-y-8">
        <div
          ref={sliderRef}
          className="relative w-full"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="flex transition-transform duration-300 ease-out" style={{ transform: `translateX(-${currentSlide * 100}%)` }}>
            {slides.map((slide, index) => {
              const Icon = slide.icon;
              return (
                <div key={index} className="min-w-full space-y-8 animate-fade-in">
                  <div className="flex justify-center mb-8">
                    <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
                      <Icon className="w-12 h-12 text-primary" />
                    </div>
                  </div>

                  <div className="text-center space-y-4">
                    <h1 className="text-4xl font-bold text-foreground">
                      {slide.title}
                    </h1>
                    <p className="text-lg text-muted-foreground">
                      {slide.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex justify-center gap-2 py-6">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={`h-2 rounded-full transition-all ${
                index === currentSlide
                  ? "w-8 bg-primary"
                  : "w-2 bg-muted"
              }`}
            />
          ))}
        </div>

        <SlideButton
          onSlideComplete={handleNext}
          text={currentSlide < slides.length - 1 ? "Slide to Continue" : "Slide to Start"}
        />
      </div>
    </div>
  );
}
