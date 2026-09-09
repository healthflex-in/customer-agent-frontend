import { useState, useRef, useCallback } from "react";

interface UseVoiceRecorderOptions {
  onAudioChunk?: (chunk: Blob) => void;
  onAudioLevel?: (level: number) => void;
  onTranscript?: (text: string, isFinal: boolean) => void;
}

type LegacyGetUserMedia = (
  constraints: MediaStreamConstraints,
  onSuccess: (stream: MediaStream) => void,
  onError: (error: DOMException) => void,
) => void;

type NavigatorWithLegacyMedia = Navigator & {
  getUserMedia?: LegacyGetUserMedia;
  webkitGetUserMedia?: LegacyGetUserMedia;
  mozGetUserMedia?: LegacyGetUserMedia;
  msGetUserMedia?: LegacyGetUserMedia;
};

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike extends Event {
  readonly resultIndex: number;
  readonly results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionErrorEventLike extends Event {
  readonly error: string;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionLike;
}

type WindowWithLegacyMedia = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
  webkitAudioContext?: typeof AudioContext;
};

export default function useVoiceRecorder({ onAudioChunk, onAudioLevel, onTranscript }: UseVoiceRecorderOptions = {}) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number>();
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const interimTranscriptRef = useRef<string>("");

  const startRecording = useCallback(async () => {
    try {
      let stream: MediaStream;

      // Check if mediaDevices API is available
      // Try modern API first
      if (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
        // Modern browser API
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } else {
        // Fallback for older browsers or browsers where mediaDevices might not be available yet
        const legacyNavigator = navigator as NavigatorWithLegacyMedia;
        const getUserMedia =
          legacyNavigator.getUserMedia ||
          legacyNavigator.webkitGetUserMedia ||
          legacyNavigator.mozGetUserMedia ||
          legacyNavigator.msGetUserMedia;

        if (!getUserMedia) {
          // Last resort: try to access mediaDevices.getUserMedia directly
          if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            stream = await navigator.mediaDevices.getUserMedia({
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              },
            });
          } else {
            throw new Error(
              "getUserMedia is not supported in this browser. Please use a modern browser like Chrome, Firefox, or Safari, and ensure you're accessing the page via HTTPS or localhost."
            );
          }
        } else {
          // For older browsers, wrap in Promise
          stream = await new Promise<MediaStream>((resolve, reject) => {
            getUserMedia.call(
              navigator,
              { audio: true },
              resolve,
              reject
            );
          });
        }
      }

      streamRef.current = stream;

      // Setup Web Speech API for live transcription
      if (onTranscript && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
        const legacyWindow = window as WindowWithLegacyMedia;
        const SpeechRecognition = legacyWindow.SpeechRecognition || legacyWindow.webkitSpeechRecognition;
        if (!SpeechRecognition) {
          throw new Error("Speech recognition is not supported in this browser");
        }
        const recognition = new SpeechRecognition();
        
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        recognition.maxAlternatives = 1;
        
        recognition.onresult = (event: SpeechRecognitionEventLike) => {
          let interimTranscript = '';
          let finalTranscript = '';
          
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript + ' ';
            } else {
              interimTranscript += transcript;
            }
          }
          
          // Update interim transcript
          if (interimTranscript) {
            interimTranscriptRef.current = interimTranscript;
            onTranscript(interimTranscript, false);
          }
          
          // Send final transcript
          if (finalTranscript) {
            interimTranscriptRef.current = '';
            onTranscript(finalTranscript.trim(), true);
          }
        };
        
        recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
          console.error('Speech recognition error:', event.error);
          // Don't throw - just log, as this is optional functionality
        };
        
        recognition.onend = () => {
          // Restart recognition if still recording
          if (isRecording && streamRef.current) {
            try {
              recognition.start();
            } catch (e) {
              // Recognition might already be starting, ignore
            }
          }
        };
        
        recognition.start();
        recognitionRef.current = recognition;
        interimTranscriptRef.current = '';
      }

      // Setup audio visualization
      const AudioContextClass = window.AudioContext
        || (window as WindowWithLegacyMedia).webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error("AudioContext is not supported in this browser");
      }

      const audioContext = new AudioContextClass();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);

      analyser.fftSize = 2048;
      analyser.minDecibels = -90;
      analyser.maxDecibels = -10;
      analyser.smoothingTimeConstant = 0.85;
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      // Setup MediaRecorder for streaming
      // Check for supported MIME types
      let mimeType = "audio/webm;codecs=opus";
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        // Try alternatives
        if (MediaRecorder.isTypeSupported("audio/webm")) {
          mimeType = "audio/webm";
        } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
          mimeType = "audio/mp4";
        } else {
          // Use default
          mimeType = "";
        }
      }

      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      mediaRecorder.ondataavailable = (event) => {
        // Only send chunks if we're still recording and data is available
        // The component will control when chunks are actually sent via isRecordingRef
        if (event.data.size > 0 && onAudioChunk && mediaRecorderRef.current?.state === "recording") {
          onAudioChunk(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        // Ensure we don't process any more chunks after stopping
        mediaRecorderRef.current = null;
      };

      mediaRecorder.start(100); // Collect data every 100ms
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);

      // Start audio level monitoring
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      const isActive = true;

      const updateLevel = () => {
        if (!analyserRef.current || !isActive) return;

        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        const volume = 20 * Math.log10(average / 255 || 0.01);
        const level = Math.max(0, 1 + volume / 40);
        
        setAudioLevel(level);
        onAudioLevel?.(level);

        if (isActive) {
          animationFrameRef.current = requestAnimationFrame(updateLevel);
        }
      };

      updateLevel();
    } catch (error) {
      console.error("Error starting recording:", error);
      throw error;
    }
  }, [onAudioChunk, onAudioLevel, onTranscript, isRecording]);

  const stopRecording = useCallback(() => {
    // Stop speech recognition first
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Ignore errors when stopping
      }
      recognitionRef.current = null;
      interimTranscriptRef.current = '';
    }

    // Stop MediaRecorder and clear reference to prevent further chunks
    if (mediaRecorderRef.current) {
      if (mediaRecorderRef.current.state !== "inactive") {
        try {
          mediaRecorderRef.current.stop();
        } catch (e) {
          // Ignore errors when stopping
        }
      }
      // Clear reference immediately to prevent ondataavailable from firing
      mediaRecorderRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (analyserRef.current) {
      analyserRef.current = null;
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = undefined;
    }

    setIsRecording(false);
    setAudioLevel(0);
  }, []);

  return {
    isRecording,
    audioLevel,
    startRecording,
    stopRecording,
  };
}
