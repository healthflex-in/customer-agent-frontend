import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { KeyboardEvent } from "react";
import WelcomeOverlay from "@/components/WelcomeOverlay";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mic, Save, Trash2, Send, Square, Paperclip } from "lucide-react";
import WaveformAnimation from "./WaveformAnimation";
import useVoiceRecorder from "@/hooks/useVoiceRecorder";
import useWebSocket from "@/hooks/useWebSocket";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { UnderstandingCard } from "@/components/cards/UnderstandingCard";
import { AgentThoughtStream } from "@/components/cards/AgentThoughtStream";
import type { ThoughtStage } from "@/components/cards/AgentThoughtStream";
import { getApiUrl, getWsUrl } from "@/config/api";
import SegmentedProgress from "@/components/voice/SegmentedProgress";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface Attachment {
  id: string;
  label: string;
  fileName: string;
  url: string;
  uploadedAt: string;
}

interface InterviewState {
  section: string;
  current_section?: string; // optional: backend may send current_section
  progress: number;
  missing_fields: string[];
  attachments?: Attachment[];
  formId?: string;
   // Optional backend-driven per-section progress metadata
  // (shape is intentionally loose to stay compatible with API changes)
  sectionProgress?: {
    progress?: number;
    steps?: Array<{
      name?: string;
      section?: string;
      isComplete?: boolean;
    }>;
  };
}

interface TranscriptionInterfaceProps {
  userId?: string;
  userName?: string;
  initialFormId?: string | null; // null = new form, string = existing form ID
}

// Compact typing-indicator style cards
const _VOICE_HINTS = ["Understanding...", "Transcribing...", "Processing...", "Analysing...", "Thinking..."];

function _VoiceProcessingCard() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % _VOICE_HINTS.length), 1600);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="inline-flex items-center gap-2.5 bg-white border border-stance-steel/8 rounded-2xl px-4 py-2.5 shadow-sm">
      <div className="flex gap-1">
        {[0,1,2].map(i => (
          <span key={i} className="w-1.5 h-1.5 rounded-full bg-stance-steel/30 animate-bounce"
            style={{ animationDelay: `${i*150}ms`, animationDuration: '0.9s' }} />
        ))}
      </div>
      <span className="text-[12px] text-stance-steel/50 font-medium">{_VOICE_HINTS[idx]}</span>
    </div>
  );
}

// ChatGPT-style compact thought stream
function _CompactThoughtStream({ thoughts }: { thoughts: { stage: string; detail?: string; status: string }[] }) {
  const active = thoughts.find(t => t.status === "active");
  const doneCount = thoughts.filter(t => t.status === "done").length;
  return (
    <div className="inline-flex items-center gap-2 bg-white border border-stance-steel/8 rounded-2xl px-4 py-2.5 shadow-sm max-w-xs">
      <div className="flex gap-1">
        {[0,1,2].map(i => (
          <span key={i} className="w-1.5 h-1.5 rounded-full bg-stance-neon/70 animate-bounce"
            style={{ animationDelay: `${i*150}ms`, animationDuration: '0.9s' }} />
        ))}
      </div>
      <span className="text-[12px] text-stance-steel/60 font-medium truncate">
        {active ? active.stage : doneCount > 0 ? "Almost ready..." : "Thinking..."}
      </span>
      {doneCount > 0 && (
        <span className="text-[10px] text-stance-steel/30 flex-shrink-0">{doneCount}/{thoughts.length}</span>
      )}
    </div>
  );
}

// Compact processing indicator (while LLM responds)
function _ThinkingDots() {
  return (
    <div className="inline-flex items-center gap-2 bg-white border border-stance-steel/8 rounded-2xl px-4 py-2.5 shadow-sm">
      <div className="flex gap-1">
        {[0,1,2].map(i => (
          <span key={i} className="w-1.5 h-1.5 rounded-full bg-stance-steel/25 animate-bounce"
            style={{ animationDelay: `${i*150}ms`, animationDuration: '0.9s' }} />
        ))}
      </div>
      <span className="text-[12px] text-stance-steel/40 font-medium">Sage is thinking</span>
    </div>
  );
}

export default function TranscriptionInterface({ 
  userId = "", 
  userName = "",
  initialFormId = null
}: TranscriptionInterfaceProps = {}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [editedTranscript, setEditedTranscript] = useState("");
  const [hasEdited, setHasEdited] = useState(false);
  const [isModelSpeaking, setIsModelSpeaking] = useState(false);
  const [interviewState, setInterviewState] = useState<InterviewState | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isUnderstanding, setIsUnderstanding] = useState(false);
  const [agentThoughts, setAgentThoughts] = useState<ThoughtStage[] | null>(null);
  const [streamingToken, setStreamingToken] = useState("");   // tokens arriving in real-time
  const [isListening, setIsListening] = useState(false);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [pendingUploadRequest, setPendingUploadRequest] = useState(false);
  const [uploadRequestText, setUploadRequestText] = useState<string | null>(null);
  const [currentFormId, setCurrentFormId] = useState<string>("");
  const [inputMode, setInputMode] = useState<"voice" | "text" | null>(null); // null = show ready screen
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const handleStartRecordingRef = useRef<(() => Promise<void>) | null>(null);
  const recordingStartTimeRef = useRef<number | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const isRecordingRef = useRef(false);
  const audioStartSentRef = useRef(false);
  const audioBuffersRef = useRef<Map<string, Uint8Array>>(new Map());
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const lastChunkTimeRef = useRef<number>(0);
  const lastTranscriptionRef = useRef<string>("");
  const playedAudioMessagesRef = useRef<Set<string>>(new Set());
  const isPlayingAudioRef = useRef<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const pendingTranscriptionRef = useRef<string | null>(null); // Track the transcription waiting to be auto-sent
  const sendTranscriptRef = useRef<((text: string) => void) | null>(null);
  const autoSendTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Track auto-send timeout
  const hasEditedRef = useRef<boolean>(false); // Track edit state for timeout callback
  const lastSentTextRef = useRef<string | null>(null); // Track last sent text to prevent duplicates
  const lastSentTimeRef = useRef<number>(0); // Track when last message was sent


  // Initialize audio context
  useEffect(() => {
    if (typeof window !== "undefined" && !audioContextRef.current) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioContextRef.current = new AudioContextClass();
      }
    }
  }, []);

  // Keep URL in sync with current user and form so that the outer app / backend
  // can read userId + formId from query params if needed.


  // Handle real-time transcription from server
  const handleTranscription = useCallback((transcription: string) => {
    // Hide listening card — mic is no longer active
    setIsListening(false);
    // Keep isProcessingVoice=true so the "Transcribing / Processing / Thinking..." card
    // keeps running until the text is actually sent (cleared in sendTranscript below).
    if (transcription && transcription.trim()) {
      const trimmedTranscription = transcription.trim();
      pendingTranscriptionRef.current = trimmedTranscription;
      
      // Clear any existing auto-send timeout to prevent duplicates
      if (autoSendTimeoutRef.current) {
        clearTimeout(autoSendTimeoutRef.current);
        autoSendTimeoutRef.current = null;
      }
      
      // CRITICAL: Update textarea state so the transcription appears
      // Always show server transcription, reset edit flag
      setCurrentTranscript(trimmedTranscription);
      setEditedTranscript(trimmedTranscription);
      setHasEdited(false);
      hasEditedRef.current = false; // Reset ref as well
      
      // Set auto-send timeout for 2 seconds - ONLY PATH for auto-send
      autoSendTimeoutRef.current = setTimeout(() => {
        // Only auto-send if user hasn't edited (check ref for current state)
        if (!hasEditedRef.current && sendTranscriptRef.current) {
          sendTranscriptRef.current(trimmedTranscription);
          // Clear after sending
          autoSendTimeoutRef.current = null;
        }
      }, 2000);
    }
  }, []);

  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback((message: string, transcription?: string, interviewState?: InterviewState, requestAttachment?: boolean) => {
    // Clear the pending transcription ref when new AI message arrives
    pendingTranscriptionRef.current = null;

    // DO NOT clear the transcription textarea when new AI message arrives
    // User may want to keep the transcription and send it manually
    
    // Only add message if it has content
    if (message && message.trim()) {
      // Add assistant message
      const aiMessage: Message = {
        role: "assistant",
        content: message.trim(),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);
      setIsUnderstanding(false);
      setAgentThoughts(null);
    }

    // Handle attachment request - show/hide upload UI based on server signal
    if (requestAttachment) {
      console.log("[TranscriptionInterface] Attachment request detected:", message);
      setUploadRequestText(
        message ||
          "Please upload any MRI, X-ray, CT scan, or blood reports related to this issue."
      );
      setPendingUploadRequest(true);
    } else {
      // When the server stops requesting attachments for subsequent messages,
      // automatically hide the upload card so it doesn't "stick" on screen.
      setPendingUploadRequest(false);
      setUploadRequestText(null);
    }

    // Update interview state if provided
    if (interviewState) {
      setInterviewState(interviewState);
      if (interviewState.formId) {
        setCurrentFormId(interviewState.formId);
      }
    }
  }, []);

  // Handle audio start from server
  const handleAudioStart = useCallback((messageId: string, totalSize: number) => {
    // Only process if we haven't already played this audio
    if (playedAudioMessagesRef.current.has(messageId)) {
      console.log(`Audio ${messageId} already played, skipping`);
      return;
    }

    setIsModelSpeaking(true);
    isPlayingAudioRef.current = true;
    audioBuffersRef.current.set(messageId, new Uint8Array(0));
    console.log(`Audio stream started: ${messageId}, total size: ${totalSize}`);
  }, []);

  // Handle audio chunks from server and play them
  const handleAudioChunk = useCallback(async (messageId: string, audioData: ArrayBuffer, isLast: boolean) => {
    // Skip if we've already played this audio
    if (playedAudioMessagesRef.current.has(messageId)) {
      return;
    }

    // Accumulate audio chunks
    const existingBuffer = audioBuffersRef.current.get(messageId) || new Uint8Array(0);
    const newBuffer = new Uint8Array(existingBuffer.length + audioData.byteLength);
    newBuffer.set(existingBuffer);
    newBuffer.set(new Uint8Array(audioData), existingBuffer.length);
    audioBuffersRef.current.set(messageId, newBuffer);

    // If this is the last chunk, play the complete audio
    if (isLast && audioContextRef.current) {
      // Mark as played immediately to prevent duplicate playback
      playedAudioMessagesRef.current.add(messageId);

      try {
        const completeAudio = audioBuffersRef.current.get(messageId);
        if (completeAudio && completeAudio.length > 0) {
          // Stop any currently playing audio first
          if (currentAudioSourceRef.current) {
            try {
              currentAudioSourceRef.current.stop();
              currentAudioSourceRef.current = null;
            } catch (e) {
              // Ignore errors when stopping
            }
          }

          // Stop any text-to-speech that might be playing
          if ("speechSynthesis" in window) {
            window.speechSynthesis.cancel();
          }

          // Convert Uint8Array to ArrayBuffer for decoding
          const audioArrayBuffer = completeAudio.buffer.slice(
            completeAudio.byteOffset,
            completeAudio.byteOffset + completeAudio.byteLength
          ) as ArrayBuffer;
          
          // Decode WAV audio
          const audioBuffer = await audioContextRef.current.decodeAudioData(audioArrayBuffer);

          // Create and play new audio source
          const source = audioContextRef.current.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(audioContextRef.current.destination);
          
          currentAudioSourceRef.current = source;
          isPlayingAudioRef.current = true;

          // Play audio and wait for it to finish
          source.start(0);
          
          source.onended = () => {
            currentAudioSourceRef.current = null;
            isPlayingAudioRef.current = false;
            setIsModelSpeaking(false);
            // Don't auto-start recording - wait for user to click mic button
            // This prevents sending audio before server is ready
          };
        }
      } catch (error) {
        console.error("Error playing audio:", error);
        isPlayingAudioRef.current = false;
        setIsModelSpeaking(false);
        // Don't fallback to text-to-speech - we already have the text message
        // Just mark as done and allow recording to start
        if (handleStartRecordingRef.current) {
          setTimeout(() => {
            handleStartRecordingRef.current?.();
          }, 500);
        }
      } finally {
        // Clean up buffer
        audioBuffersRef.current.delete(messageId);
      }
    }
  }, []);

  const handleWebSocketError = useCallback((error: Error) => {
    toast({
      title: "Connection Error",
      description: error.message,
      variant: "destructive",
    });
  }, [toast]);

  const handleWebSocketStatusChange = useCallback((status: "disconnected" | "connecting" | "connected") => {
    // Status is managed by the hook
  }, []);

  const handleFormLoaded = useCallback((formData: Record<string, any>, interviewState?: InterviewState) => {
    setFormData(formData);
    if (interviewState) {
      setInterviewState(interviewState);
      if (interviewState.formId) {
        setCurrentFormId(interviewState.formId);
      }
    }
  }, []);

  const handleTranscriptionStable = useCallback((transcription: string) => {
    handleTranscription(transcription);
  }, [handleTranscription]);

  const handleAttachmentRequest = useCallback((messageText?: string) => {
    setUploadRequestText(messageText || "Please upload any MRI, X-ray, CT scan, or blood reports related to this issue.");
    setPendingUploadRequest(true);
  }, []);

  const handleChatHistory = useCallback((historyMessages: { role: "user" | "assistant"; content: string; timestamp: string }[]) => {
    const restored = historyMessages.map((m) => ({
      role: m.role,
      content: m.content,
      timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
    }));
    setMessages(restored);
  }, []);

  const handleThoughtUpdate = useCallback((thoughts: ThoughtStage[]) => {
    setAgentThoughts(thoughts);
  }, []);

  // Accumulate streaming tokens into a live bubble; cleared when text_message arrives
  const handleToken = useCallback((token: string) => {
    setStreamingToken(prev => prev + token);
    setIsUnderstanding(true);  // keep processing card hidden while streaming
  }, []);

  // When the full text_message arrives, clear the streaming buffer (already added to messages)
  const handleWebSocketMessageWithTokenClear = useCallback(
    (message: string, transcription?: string, interviewState?: any, requestAttachment?: boolean) => {
      setStreamingToken("");   // clear accumulated tokens — final message is now in messages[]
      handleWebSocketMessage(message, transcription, interviewState, requestAttachment);
    },
    [handleWebSocketMessage]
  );

  const { status, connect, disconnect, sendAudio, sendAudioStart, sendAudioEnd, sendTextInput, sendStartInterview, sendEndSession, sendStartNewForm, sendLoadForm, isConnected } = useWebSocket({
    serverUrl: userId ? getWsUrl(`/ws/${userId}`) : undefined,
    onMessage: handleWebSocketMessageWithTokenClear,
    onTranscription: handleTranscriptionStable,
    onAudioStart: handleAudioStart,
    onAudioChunk: handleAudioChunk,
    onError: handleWebSocketError,
    onStatusChange: handleWebSocketStatusChange,
    onFormLoaded: handleFormLoaded,
    onAttachmentRequest: handleAttachmentRequest,
    onChatHistory: handleChatHistory,
    onThoughtUpdate: handleThoughtUpdate,
    onToken: handleToken,
  });

  const sendTranscript = useCallback((textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed) return;

    // Prevent duplicate sends — 8s window covers slow LLM + reconnect retries
    const now = Date.now();
    if (
      lastSentTextRef.current === trimmed &&
      now - lastSentTimeRef.current < 8000
    ) {
      console.log("Duplicate send prevented:", trimmed);
      return;
    }

    // Clear auto-send timeout if sending manually
    if (autoSendTimeoutRef.current) {
      clearTimeout(autoSendTimeoutRef.current);
      autoSendTimeoutRef.current = null;
    }

    // Track what we're sending
    lastSentTextRef.current = trimmed;
    lastSentTimeRef.current = now;

    setMessages((prev) => {
      const lastMessage = prev[prev.length - 1];
      if (lastMessage?.role === "user" && lastMessage.content === trimmed) {
        return prev;
      }
      const userMessage: Message = {
        role: "user",
        content: trimmed,
        timestamp: new Date(),
      };
      return [...prev, userMessage];
    });

    sendTextInput(trimmed);
    setIsProcessingVoice(false);  // text is now sent — stop the voice processing indicator
    setIsUnderstanding(true);
    // Don't clear agentThoughts here — the server sends thought_update immediately
    // after receiving text_input. Clearing here creates a flash of UnderstandingCard
    // before AgentThoughtStream appears. Let handleWebSocketMessage clear it on response.

    setCurrentTranscript("");
    setEditedTranscript("");
    setHasEdited(false);
    hasEditedRef.current = false;
    lastTranscriptionRef.current = "";
    pendingTranscriptionRef.current = null;
  }, [sendTextInput]);

  useEffect(() => {
    sendTranscriptRef.current = sendTranscript;
  }, [sendTranscript]);

  const handleSendMessage = useCallback(() => {
    const textToSend = (editedTranscript || currentTranscript).trim();
    sendTranscript(textToSend);
  }, [editedTranscript, currentTranscript, sendTranscript]);

  const dispatchPendingTranscription = useCallback(() => {
    const pendingText = pendingTranscriptionRef.current;
    if (!pendingText || !pendingText.trim()) {
      return false;
    }
    sendTranscript(pendingText);
    return true;
  }, [sendTranscript]);

  // Handle audio chunks from voice recorder
  const handleVoiceRecorderChunk = useCallback(async (chunk: Blob) => {
    // CRITICAL: Only send if we're actually recording AND audio_start has been sent AND we've waited
    // This prevents sending audio before server is ready
    if (!isRecordingRef.current || !audioStartSentRef.current) {
      // Silently drop chunks if server isn't ready yet
      return;
    }

    // Additional safety check: ensure enough time has passed since audio_start was sent
    if (recordingStartTimeRef.current) {
      const timeSinceStart = Date.now() - recordingStartTimeRef.current;
      if (timeSinceStart < 300) {
        // Don't send chunks in first 300ms after audio_start
        return;
      }
    }

    // Prevent duplicate chunks by checking time
    const now = Date.now();
    if (now - lastChunkTimeRef.current < 50) {
      // Skip if chunk arrived too soon (likely duplicate)
      return;
    }
    lastChunkTimeRef.current = now;

    // Only send if chunk has data
    if (chunk.size === 0) {
      return;
    }

    audioChunksRef.current.push(chunk);
    
    // Convert blob to ArrayBuffer and send
    try {
      const arrayBuffer = await chunk.arrayBuffer();
      // Double-check before sending
      if (isRecordingRef.current && audioStartSentRef.current && isConnected) {
        sendAudio(arrayBuffer);
      }
    } catch (error) {
      console.error("Error sending audio chunk:", error);
    }
  }, [sendAudio, isConnected]);

  // Handle live transcription from Web Speech API
  // NOTE: Browser transcription is IGNORED - only server transcription is used
  const handleLiveTranscript = useCallback((text: string, isFinal: boolean) => {
    // Completely ignore browser transcription - do not update any state or refs
    // Only server transcription should populate the textarea
    // This function is kept for compatibility but does nothing
    return;
  }, []);

  // NOTE: onTranscript is NOT passed - browser transcription is completely disabled
  // Only server transcription is used
  const { isRecording, audioLevel, startRecording, stopRecording } = useVoiceRecorder({
    onAudioChunk: handleVoiceRecorderChunk,
    // onTranscript is intentionally omitted - we only use server transcription
  });

  // Keep a ref to the latest connect so the mount effect doesn't re-run on re-renders
  const connectRef = useRef(connect);
  useEffect(() => { connectRef.current = connect; }, [connect]);

  // Connect to WebSocket once on mount — empty deps so re-renders never cancel the timer
  useEffect(() => {
    const timer = setTimeout(() => {
      connectRef.current();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Cleanup auto-send timeout on unmount
  useEffect(() => {
    return () => {
      if (autoSendTimeoutRef.current) {
        clearTimeout(autoSendTimeoutRef.current);
        autoSendTimeoutRef.current = null;
      }
    };
  }, []);

  // Start interview or load form once connected and userId is available
  useEffect(() => {
    console.log(`[TranscriptionInterface] useEffect triggered: isConnected=${isConnected}, userId=${userId}, initialFormId=${initialFormId}`);
    if (isConnected && userId) {
      // Small delay to ensure connection is fully established
      const timer = setTimeout(() => {
        // Determine which formId to use (if any)
        // Priority: explicit initialFormId from parent (URL), then any saved formId from a previous session.
        const formIdToUse: string | undefined = initialFormId || undefined;

        // Always use start_interview (not load_form) - the backend will handle resume logic
        if (formIdToUse) {
          console.log(`[TranscriptionInterface] Starting/resuming interview for user ${userId} with form ${formIdToUse}`);
        } else {
          console.log(`[TranscriptionInterface] Starting new interview for user ${userId}`);
        }
        
        if (sendStartInterview) {
          const result = sendStartInterview(userId, formIdToUse);
          console.log(`[TranscriptionInterface] sendStartInterview returned: ${result}`);
        } else {
          console.error(`[TranscriptionInterface] sendStartInterview is undefined!`);
        }
      }, 500); // Increased delay to 500ms
      return () => clearTimeout(timer);
    }
  }, [isConnected, userId, initialFormId, sendStartInterview]);

  // No auto-start mic — user explicitly clicks the mic button to record,
  // or types in the text box. Both are always available after Get Started.

  // Auto-scroll only when new messages arrive or tokens stream in — NOT on mic state changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingToken]);

  // Handle start recording
  const handleStartRecording = useCallback(async () => {
    if (isModelSpeaking || !isConnected) return;
    
    try {
      // Reset flags
      isRecordingRef.current = false; // Don't set to true yet - wait for audio_start to be sent
      audioStartSentRef.current = false;
      audioChunksRef.current = [];
      recordingStartTimeRef.current = Date.now();
      lastChunkTimeRef.current = 0;
      lastTranscriptionRef.current = ""; // Reset to allow new transcriptions
      
      // Clean up old played audio messages (keep only last 10)
      if (playedAudioMessagesRef.current.size > 10) {
        const messagesArray = Array.from(playedAudioMessagesRef.current);
        playedAudioMessagesRef.current = new Set(messagesArray.slice(-10));
      }
      
      // Send audio_start message FIRST, before starting recording
      const startSent = sendAudioStart();
      if (!startSent) {
        toast({
          title: "Connection Error",
          description: "Failed to send audio start signal. Please try again.",
          variant: "destructive",
        });
        return;
      }
      
      audioStartSentRef.current = true;
      
      // Wait longer to ensure audio_start is processed by server
      // Server needs to set is_recording = true before accepting binary data
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Now set recording flag and start recording
      isRecordingRef.current = true;
      await startRecording();
      setIsListening(true);
    } catch (error: any) {
      isRecordingRef.current = false;
      audioStartSentRef.current = false;
      setIsListening(false);
      let errorMessage = "Failed to start recording. ";
      
      if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
        errorMessage += "Microphone permission denied. Please allow microphone access and try again.";
      } else if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
        errorMessage += "No microphone found. Please connect a microphone and try again.";
      } else if (error.name === "NotSupportedError" || error.name === "ConstraintNotSatisfiedError") {
        errorMessage += "Microphone not supported. Please use a different browser or device.";
      } else if (error.message) {
        errorMessage += error.message;
      } else {
        errorMessage += "Please check microphone permissions and try again.";
      }
      
      toast({
        title: "Recording Error",
        description: errorMessage,
        variant: "destructive",
      });
      console.error("Recording error details:", error);
    }
  }, [isModelSpeaking, isConnected, startRecording, sendAudioStart, toast]);

  handleStartRecordingRef.current = handleStartRecording;

  // Handle stop recording
  const handleStopRecording = useCallback(async () => {
    if (!isRecordingRef.current) return;

    // Stop recording flag FIRST to prevent more chunks from being sent
    isRecordingRef.current = false;
    audioStartSentRef.current = false;

    // Stop the MediaRecorder
    await stopRecording();

    // Wait a bit to ensure all pending chunks are processed
    await new Promise(resolve => setTimeout(resolve, 200));

    // Calculate duration
    const duration = recordingStartTimeRef.current 
      ? (Date.now() - recordingStartTimeRef.current) / 1000 
      : 0;

    // Send audio_end message
    sendAudioEnd(duration);

    // Switch from listening → processing voice while Whisper transcribes + auto-sends
    setIsListening(false);
    setIsProcessingVoice(true);
    // Safety timeout: hide if transcription + send never arrive (e.g. network drop)
    // 45s covers even long voice recordings on the base Whisper model
    setTimeout(() => {
      setIsProcessingVoice(false);
    }, 45000);

    // Reset chunk tracking
    lastChunkTimeRef.current = 0;

    // Don't clear transcript immediately - wait for server response
    // The server will send back the transcription, which will update the textarea
  }, [stopRecording, sendAudioEnd, dispatchPendingTranscription]);

  // Handle mic click
  const handleMicClick = useCallback(async () => {
    if (isRecording) {
      await handleStopRecording();
    } else {
      await handleStartRecording();
    }
  }, [isRecording, handleStopRecording, handleStartRecording]);

  // Handle text change
  const handleTextChange = (value: string) => {
    // Cancel auto-send if user edits
    if (autoSendTimeoutRef.current) {
      clearTimeout(autoSendTimeoutRef.current);
      autoSendTimeoutRef.current = null;
    }
    
    setEditedTranscript(value);
    setCurrentTranscript(value); // Keep them in sync when user edits
    // Treat any user edit as authoritative so live transcription doesn't overwrite
    setHasEdited(true);
    hasEditedRef.current = true; // Update ref as well
  };
  
  // Handle textarea click/focus - cancel auto-send if user interacts
  const handleTextareaClick = useCallback(() => {
    if (autoSendTimeoutRef.current) {
      clearTimeout(autoSendTimeoutRef.current);
      autoSendTimeoutRef.current = null;
      setHasEdited(true); // Mark as edited to prevent auto-send
      hasEditedRef.current = true; // Update ref as well
    }
  }, []);

  // Handle enter-to-send for manual input (Shift+Enter still makes a newline)
  const handleTextareaKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        handleSendMessage();
      }
    },
    [handleSendMessage]
  );

  // Handle save chat
  const handleSaveChat = async () => {
    try {
      const chatData = JSON.stringify({
        messages,
        interviewState,
        formData,
        timestamp: new Date().toISOString(),
      }, null, 2);
      const blob = new Blob([chatData], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `chat-${Date.now()}.json`;
      a.click();
      
      toast({
        title: "Chat Saved",
        description: "Your conversation has been saved to your device.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save chat.",
        variant: "destructive",
      });
    }
  };

  // Handle clear form
  const handleClearForm = () => {
    setCurrentTranscript("");
    setEditedTranscript("");
    setHasEdited(false);
  };

  // Note: Transcript is cleared in handleSendMessage after sending
  // No need to clear it here based on messages


  // Handle end chat (pause & continue later)
  const handleEndChat = () => {
    if (isRecording) stopRecording();

    // Submit existing session to backend if possible
    if (userId && sendEndSession) {
      try {
        sendEndSession(userId);
      } catch (error) {
        console.error("Failed to send end_session message:", error);
      }
    }

    // Disconnect from WebSocket but keep UI state visible
    disconnect();
    setIsListening(false);
    setIsUnderstanding(false);
    setAgentThoughts(null);
    pendingTranscriptionRef.current = null;

    toast({
      title: "Chat Paused",
      description: "Your current interview has been saved. You can continue from here later.",
    });
  };

  // Format message content to render bullet points as proper lists
  const formatMessageContent = (content: string) => {
    const lines = content.split('\n');
    const elements: JSX.Element[] = [];
    let currentList: string[] = [];
    let currentParagraph: string[] = [];

    const flushList = () => {
      if (currentList.length > 0) {
        elements.push(
          <ul key={`list-${elements.length}`} className="list-disc list-inside space-y-1 my-2 ml-2">
            {currentList.map((item, idx) => (
              <li key={idx} className="text-sm">{item.trim()}</li>
            ))}
          </ul>
        );
        currentList = [];
      }
    };

    const flushParagraph = () => {
      if (currentParagraph.length > 0) {
        const paragraphText = currentParagraph.join(' ').trim();
        if (paragraphText) {
          elements.push(
            <p key={`para-${elements.length}`} className="text-sm mb-2">
              {paragraphText}
            </p>
          );
        }
        currentParagraph = [];
      }
    };

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      
      // Check if line starts with bullet point (•, -, *, or numbered)
      if (trimmedLine.match(/^[•\-\*]\s/) || trimmedLine.match(/^\d+\.\s/)) {
        flushParagraph();
        // Remove bullet marker and add to list
        const listItem = trimmedLine.replace(/^[•\-\*]\s/, '').replace(/^\d+\.\s/, '').trim();
        if (listItem) {
          currentList.push(listItem);
        }
      } else if (trimmedLine === '') {
        // Empty line - flush both list and paragraph
        flushList();
        flushParagraph();
      } else {
        // Regular text line
        flushList();
        currentParagraph.push(trimmedLine);
      }
    });

    // Flush any remaining content
    flushList();
    flushParagraph();

    // If no elements were created, return the original content
    if (elements.length === 0) {
      return <p className="text-sm">{content}</p>;
    }

    return <div>{elements}</div>;
  };

  const interviewSteps = useMemo(
    () => [
      "Present Complaint",
      "Previous Consultations",
      "Pain Assessment",
      "History & Diagnostics",
      "Treatment Goals",
      "Referral",
    ],
    []
  );

  const derivedCurrentStep = useMemo(() => {
    if (!interviewState) return 1;
    const totalSteps = interviewSteps.length;

    // If backend reports interview as fully complete, always show final step
    const normalizedProgress = Math.min(
      Math.max(interviewState.progress, 0),
      100
    );
    if (normalizedProgress >= 100) {
      return totalSteps;
    }

    const currentSectionName = interviewState.current_section || interviewState.section;
    const sectionAliases: Record<string, string> = {
      "present complaint": "Present Complaint",
      "previous consultations": "Previous Consultations",
      "pain assessment": "Pain Assessment",
      "history & diagnostics": "History & Diagnostics",
      "treatment goals": "Treatment Goals",
      "referral": "Referral",
      "medical history": "History & Diagnostics",
      "lifestyle factors": "History & Diagnostics",
      "diagnostic reports": "History & Diagnostics",
    };
    const normalizedSectionName = currentSectionName
      ? sectionAliases[currentSectionName.toLowerCase()] || currentSectionName
      : "";
    
    // Prioritize section-based detection as it's more accurate
    const sectionIndex = normalizedSectionName
      ? interviewSteps.findIndex(
          (step) => step.toLowerCase() === normalizedSectionName.toLowerCase()
        )
      : -1;
    
    if (sectionIndex >= 0) {
      // If we found a matching section, use it (add 1 because index is 0-based)
      return sectionIndex + 1;
    }

    // Fallback to progress-based calculation if section name doesn't match
    const progressStep = Math.ceil((normalizedProgress / 100) * totalSteps) || 1;
    return Math.min(Math.max(progressStep, 1), totalSteps);
  }, [interviewState, interviewSteps]);

  const lastUserMessageIndex = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === "user") return i;
    }
    return -1;
  }, [messages]);

  const lastAssistantMessageIndex = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === "assistant") return i;
    }
    return -1;
  }, [messages]);

  return (
    <div className="h-[100dvh] bg-stance-steel flex flex-col overflow-hidden overflow-x-hidden text-white" style={{ paddingTop: 'env(safe-area-inset-top)', paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)' }}>

      {/* ── Header ── */}
      <header className="bg-stance-steel/80 backdrop-blur-md z-10">
        <div className="max-w-5xl mx-auto px-5 py-3 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src="/assets/brand/logo-white.png"
                alt="Stance Health"
                className="h-7 w-auto max-w-[120px]"
              />
              {interviewState?.section && (
                <>
                  <div className="h-3.5 w-px bg-white/15" />
                  <div className="flex flex-col leading-none">
                    <span className="text-[9px] uppercase tracking-[0.18em] text-white/35 font-semibold">Phase</span>
                    <span className="text-[12px] font-medium text-white/70 mt-0.5">
                      {interviewState.section}
                    </span>
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center gap-3">
              {/* Progress number — compact */}
              {interviewState && (
                <span className="text-[11px] font-bold text-stance-neon tabular-nums">
                  {Math.round(Math.max(interviewState.progress, interviewState.sectionProgress?.progress ?? 0))}%
                </span>
              )}

              <Badge
                variant="outline"
                className="rounded-sm border-0 text-stance-steel bg-stance-neon font-display text-[8px] uppercase tracking-widest px-2 py-0.5 font-bold"
              >
                Live
              </Badge>

              {status !== "connected" && (
                <div className="flex items-center gap-1.5">
                  <div className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    status === "connecting" ? "bg-yellow-400 animate-pulse" : "bg-red-500"
                  )} />
                  <span className="text-[9px] font-bold uppercase tracking-widest text-white/40">
                    {status === "connecting" ? "Connecting" : "Offline"}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Progress bar — compact */}
          {interviewState && (
            <SegmentedProgress
              steps={interviewSteps}
              currentStep={derivedCurrentStep}
              stepStatus={interviewState.sectionProgress?.steps}
              overallProgress={
                Math.max(
                  interviewState.progress,
                  interviewState.sectionProgress?.progress ?? 0
                )
              }
              activeLabel={interviewState.section}
            />
          )}
        </div>
      </header>

      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Background Accents */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-full pointer-events-none overflow-hidden opacity-10">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-stance-neon rounded-full blur-[128px]" />
          <div className="absolute top-1/2 -right-24 w-64 h-64 bg-stance-stone rounded-full blur-[96px]" />
        </div>

        <ScrollArea className="flex-1 min-h-0 bg-[#F0F3F8] shadow-[0_-8px_32px_rgba(0,0,0,0.2)] rounded-t-[32px] md:rounded-t-[48px] mt-2">
          <div className="max-w-3xl mx-auto px-6 py-8 space-y-8 min-h-[calc(100dvh-200px)]">

            {/* ── Ready / Resume screen — shown until user clicks Get Started ──
                 Condition is inputMode === null ONLY, not message count.
                 Returning users get messages in the background before clicking,
                 but they still see this screen first. ── */}
            {inputMode === null ? (
              <div className="flex flex-col items-center text-center gap-8 pt-16 pb-8 min-h-[60vh] justify-center">

                {/* Big mic icon — like the original */}
                <div className="h-24 w-24 rounded-[28px] bg-stance-steel flex items-center justify-center shadow-[0_8px_32px_rgba(14,27,42,0.18)]">
                  <Mic className="h-10 w-10 text-stance-neon" />
                </div>

                {/* Headline */}
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-stance-steel/40">
                    Stance Health · Live Interview
                  </p>
                  <h2 className="font-display text-4xl md:text-5xl font-extrabold tracking-tight text-stance-steel">
                    {(messages.length > 0 || (interviewState && interviewState.progress > 5))
                      ? "Resume your session"
                      : "Ready to begin?"}
                  </h2>
                  <p className="text-stance-grey/50 max-w-xs mx-auto text-sm leading-relaxed">
                    {(messages.length > 0 || (interviewState && interviewState.progress > 5))
                      ? "Pick up right where you left off."
                      : "Choose how you'd like to answer — voice is faster."}
                  </p>
                </div>


                {/* Voice vs Text — info cards only, not buttons */}
                <div className="flex gap-3 w-full max-w-xs">
                  {/* Voice card — solid dark background for contrast */}
                  <div className="flex-1 rounded-2xl bg-stance-steel px-4 py-3.5">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Mic size={12} className="text-stance-neon" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-stance-neon">Voice</span>
                    </div>
                    <p className="text-[22px] font-display font-bold text-white leading-none">~3 min</p>
                    <p className="text-[11px] text-white/50 mt-1">Speak naturally</p>
                  </div>
                  {/* Text card — muted */}
                  <div className="flex-1 rounded-2xl bg-white border border-stance-steel/10 px-4 py-3.5">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Send size={11} className="text-stance-steel/40" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-stance-steel/40">Text</span>
                    </div>
                    <p className="text-[22px] font-display font-bold text-stance-steel/30 leading-none">6–10 min</p>
                    <p className="text-[11px] text-stance-steel/30 mt-1">Type your answers</p>
                  </div>
                </div>

                <p className="text-[11px] text-stance-steel/35 italic">
                  Tip: Voice is much faster — just speak naturally.
                </p>

                {/* Single CTA */}
                <button
                  onClick={() => setInputMode("voice")}
                  className="w-full max-w-xs flex items-center justify-center gap-2 bg-stance-steel text-white font-semibold text-[15px] rounded-2xl py-4 px-6 hover:bg-stance-steel/90 active:scale-[0.98] transition-all shadow-[0_4px_24px_rgba(14,27,42,0.2)]"
                >
                  Get Started
                  <Mic size={16} className="text-stance-neon" />
                </button>

              </div>
            ) : (
              messages.map((message, index) => {
                const isLastUserMessage = message.role === "user" && index === lastUserMessageIndex;
                const isLastAssistant = message.role === "assistant" && index === lastAssistantMessageIndex;
                const isAssistant = message.role === "assistant";
                const showUploadPrompt = isLastAssistant && pendingUploadRequest;

                return (
                  <div key={index} className={cn(
                    "flex flex-col space-y-2",
                    isAssistant ? "items-start" : "items-end"
                  )}>
                    <div className={cn(
                      "max-w-[85%] rounded-2xl p-5 md:p-6 shadow-sm transition-all duration-300",
                      isAssistant
                        ? "bg-stance-steel text-white rounded-tl-none border border-white/5"
                        : "bg-white text-stance-grey rounded-tr-none border border-stance-neon/50 shadow-sm"
                    )}>
                      {isAssistant
                        ? formatMessageContent(message.content)
                        : <p className="text-sm leading-relaxed">{message.content}</p>}
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-stance-grey/40 px-1">
                      {isAssistant ? "Sage" : "You"} • {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>

                    {/* Inline upload prompt under the triggering assistant message */}
                    {showUploadPrompt && (
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          type="file"
                          multiple
                          className="hidden"
                          id="file-upload-inline"
                          onChange={async (e) => {
                            const files = e.target.files;
                            if (!files || files.length === 0) return;
                            const formId = currentFormId || interviewState?.formId;
                            if (!formId || !userId) return;
                            try {
                              const fd = new FormData();
                              for (let i = 0; i < files.length; i++) fd.append("files", files[i]);
                              fd.append("userId", userId);
                              toast({ title: "Uploading...", description: `Uploading ${files.length} file(s).` });
                              const res = await fetch(getApiUrl(`/api/forms/${formId}/attachments`), { method: "POST", body: fd });
                              if (!res.ok) throw new Error("Upload failed");
                              const result = await res.json();
                              toast({ title: "Upload Complete", description: "Documents added to your profile." });
                              setPendingUploadRequest(false);
                              if (result.attachments || result.progress !== undefined) {
                                setInterviewState(prev => prev ? { ...prev, attachments: result.attachments || prev.attachments || [], progress: result.progress !== undefined ? result.progress : prev.progress } : null);
                              }
                              if (sendTranscriptRef.current) sendTranscriptRef.current("I have uploaded my clinical documents.");
                            } catch {
                              toast({ title: "Upload failed", variant: "destructive" });
                            }
                            e.target.value = "";
                          }}
                        />
                        <Button
                          onClick={() => document.getElementById("file-upload-inline")?.click()}
                          size="sm"
                          className="bg-stance-neon text-stance-steel hover:bg-stance-neon/90 font-bold text-xs px-4 h-9 rounded-xl gap-2"
                        >
                          <Paperclip className="h-3.5 w-3.5" />
                          Upload Documents
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setPendingUploadRequest(false);
                            // Tell the server the user has no reports so the interview continues
                            if (sendTranscriptRef.current) {
                              sendTranscriptRef.current("I don't have any reports to upload.");
                            }
                          }}
                          className="text-stance-grey/40 hover:text-stance-grey/70 text-xs h-9 px-3 rounded-xl"
                        >
                          Skip
                        </Button>
                      </div>
                    )}

                    {isLastUserMessage && isUnderstanding && (
                      <div className="w-full mt-3 flex justify-start">
                        {agentThoughts && agentThoughts.length > 0 ? (
                          <_CompactThoughtStream thoughts={agentThoughts} />
                        ) : (
                          <_ThinkingDots />
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {/* Live streaming bubble — shows words appearing as LLM generates them */}
            {streamingToken && (
              <div className="flex justify-start">
                <div className="max-w-[75%] rounded-[18px] px-5 py-3 bg-stance-steel text-white text-sm leading-relaxed shadow-sm">
                  {streamingToken}
                  <span className="inline-block w-1.5 h-3.5 bg-stance-neon ml-1 animate-pulse rounded-sm align-middle" />
                </div>
              </div>
            )}

            {isListening && (
              <div className="flex justify-end">
                <UnderstandingCard
                  style="clean"
                  headline="Listening..."
                  caption="Speak clearly. We're capturing every detail."
                  className="bg-stance-neon/5 border-stance-neon/20 text-stance-grey"
                />
              </div>
            )}

            {isProcessingVoice && !isListening && (
              <div className="flex justify-end">
                <_VoiceProcessingCard />
              </div>
            )}

            <div ref={messagesEndRef} className="h-32" />
          </div>
        </ScrollArea>
      </main>

      {/* Persistent Controls — shown after Get Started is clicked */}
      {inputMode !== null && (
        <div className="bg-[#F0F3F8] border-t border-stance-steel/10 px-6 py-4 z-20" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Textarea
                  ref={textareaRef}
                  value={editedTranscript || currentTranscript}
                  onChange={(e) => handleTextChange(e.target.value)}
                  onClick={handleTextareaClick}
                  onFocus={handleTextareaClick}
                  onKeyDown={handleTextareaKeyDown}
                  placeholder="Speak or type your response..."
                  className="min-h-[52px] max-h-[120px] pr-14 py-3.5 rounded-2xl bg-white border border-stance-steel/10 shadow-sm focus-visible:ring-stance-steel/10 resize-none text-base text-stance-grey placeholder:text-stance-grey/30 placeholder:italic leading-snug"
                  disabled={isModelSpeaking}
                />
                {(editedTranscript.trim() || currentTranscript.trim()) && (
                  <Button
                    onClick={handleSendMessage}
                    size="icon"
                    className="absolute right-3 bottom-3 h-8 w-8 rounded-xl bg-stance-steel text-white hover:bg-stance-grey transition-all shadow-md"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <Button
                onClick={handleMicClick}
                disabled={!isConnected || isModelSpeaking}
                className={cn(
                  "rounded-full w-14 h-14 flex-shrink-0 shadow-xl transition-all duration-300 hover:scale-105 active:scale-95",
                  isRecording
                    ? "bg-red-500 hover:bg-red-600 shadow-red-500/30"
                    : "bg-stance-steel hover:bg-stance-steel/90 shadow-stance-steel/30 ring-2 ring-stance-neon ring-offset-2 ring-offset-[#F0F3F8]"
                )}
              >
                {isRecording ? (
                  <Square className="h-5 w-5 fill-white text-white animate-pulse" />
                ) : (
                  <Mic className="h-5 w-5 text-white" />
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

