import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Mic, Save, Trash2, MessageSquareX, Send } from "lucide-react";
import WaveformAnimation from "./WaveformAnimation";
import useVoiceRecorder from "@/hooks/useVoiceRecorder";
import useWebSocket from "@/hooks/useWebSocket";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { UnderstandingCard } from "@/components/cards/UnderstandingCard";
import { FormProgressCard } from "@/components/cards/FormProgressCard";

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
  progress: number;
  missing_fields: string[];
  attachments?: Attachment[];
  formId?: string;
}

interface TranscriptionInterfaceProps {
  userId?: string;
  userName?: string;
  initialFormId?: string | null; // null = new form, string = existing form ID
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
  const [isListening, setIsListening] = useState(false);
  const [pendingUploadRequest, setPendingUploadRequest] = useState(false);
  const [uploadRequestText, setUploadRequestText] = useState<string | null>(null);
  const [currentFormId, setCurrentFormId] = useState<string>("");
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasConnectedRef = useRef(false);
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
  const sentTranscriptionsRef = useRef<Set<string>>(new Set()); // Track transcriptions that have been sent
  const pendingTranscriptionRef = useRef<string | null>(null); // Track the transcription waiting to be auto-sent
  const shouldAutoSendOnStopRef = useRef<boolean>(false);
  const sendTranscriptRef = useRef<((text: string) => void) | null>(null);

  // Initialize audio context
  useEffect(() => {
    if (typeof window !== "undefined" && !audioContextRef.current) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioContextRef.current = new AudioContextClass();
      }
    }
  }, []);

  // Handle real-time transcription from server
  const handleTranscription = useCallback((transcription: string) => {
    setIsListening(false);
    if (transcription && transcription.trim()) {
      const trimmedTranscription = transcription.trim();
      setCurrentTranscript(trimmedTranscription);
      setEditedTranscript(trimmedTranscription);
      setHasEdited(false);
      pendingTranscriptionRef.current = trimmedTranscription;

      if (
        shouldAutoSendOnStopRef.current &&
        sendTranscriptRef.current &&
        !isRecordingRef.current
      ) {
        sendTranscriptRef.current(trimmedTranscription);
      }
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
    }

    // Handle attachment request - show upload UI when server requests attachments
    if (requestAttachment) {
      console.log("[TranscriptionInterface] Attachment request detected:", message);
      setUploadRequestText(message || "Please upload any MRI, X-ray, CT scan, or blood reports related to this issue.");
      setPendingUploadRequest(true);
    }

    // Update interview state if provided
    if (interviewState) {
      setInterviewState(interviewState);
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

  const { status, connect, disconnect, sendAudio, sendAudioStart, sendAudioEnd, sendTextInput, sendStartInterview, sendEndSession, sendStartNewForm, sendLoadForm, isConnected } = useWebSocket({
    serverUrl: "wss://customeragent.stance.health",
    onMessage: handleWebSocketMessage,
    onTranscription: (transcription: string) => handleTranscription(transcription),
    onAudioStart: handleAudioStart,
    onAudioChunk: handleAudioChunk,
    onError: handleWebSocketError,
    onStatusChange: handleWebSocketStatusChange,
    onFormLoaded: handleFormLoaded,
    onAttachmentRequest: (messageText?: string) => {
      setUploadRequestText(messageText || "Please upload any MRI, X-ray, CT scan, or blood reports related to this issue.");
      setPendingUploadRequest(true);
    },
  });

  const sendTranscript = useCallback((textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed) return;

    if (sentTranscriptionsRef.current.has(trimmed)) {
      return;
    }

    sentTranscriptionsRef.current.add(trimmed);

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
    setIsUnderstanding(true);

    setCurrentTranscript("");
    setEditedTranscript("");
    setHasEdited(false);
    lastTranscriptionRef.current = "";
    pendingTranscriptionRef.current = null;
    shouldAutoSendOnStopRef.current = false;

    if (sentTranscriptionsRef.current.size > 20) {
      const transcriptionsArray = Array.from(sentTranscriptionsRef.current);
      sentTranscriptionsRef.current = new Set(transcriptionsArray.slice(-20));
    }
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
  const handleLiveTranscript = useCallback((text: string, isFinal: boolean) => {
    if (text && text.trim()) {
      setCurrentTranscript((prev) => {
        if (isFinal) {
          // For final transcripts, append to previous final text
          const trimmedText = text.trim();
          if (prev && prev.trim()) {
            // Check if this text is already in the previous (avoid duplicates)
            const prevLower = prev.toLowerCase();
            const textLower = trimmedText.toLowerCase();
            if (prevLower.includes(textLower)) {
              return prev; // Already have this text
            }
            // Append with space
            return `${prev} ${trimmedText}`;
          }
          return trimmedText;
        } else {
          // For interim transcripts, show live updates
          // Combine previous final text with new interim text
          const trimmedText = text.trim();
          if (prev && prev.trim()) {
            // Extract the last final part (before any interim text)
            // For simplicity, just append interim to the end
            return `${prev} ${trimmedText}`;
          }
          return trimmedText;
        }
      });

      // Update the textarea with live transcription (only if user hasn't manually edited)
      if (!hasEdited) {
        setEditedTranscript((prev) => {
          if (isFinal) {
            // For final transcripts, append to previous
            const trimmedText = text.trim();
            if (prev && prev.trim()) {
              const prevLower = prev.toLowerCase();
              const textLower = trimmedText.toLowerCase();
              if (prevLower.includes(textLower)) {
                return prev; // Already have this text
              }
              return `${prev} ${trimmedText}`;
            }
            return trimmedText;
          } else {
            // For interim transcripts, show live updates in textarea
            const trimmedText = text.trim();
            // For interim, we want to show the full accumulated text
            // The Web Speech API gives us the full sentence so far
            return trimmedText;
          }
        });
      }
    }
  }, [hasEdited]);

  const { isRecording, audioLevel, startRecording, stopRecording } = useVoiceRecorder({
    onAudioChunk: handleVoiceRecorderChunk,
    onTranscript: handleLiveTranscript,
  });

  // Connect to WebSocket on mount
  useEffect(() => {
    if (!hasConnectedRef.current) {
      hasConnectedRef.current = true;
      const timer = setTimeout(() => {
        connect();
      }, 100);
      
      return () => {
        clearTimeout(timer);
      };
    }
  }, [connect]);

  // Start interview or load form once connected and userId is available
  useEffect(() => {
    if (isConnected && userId) {
      // Small delay to ensure connection is fully established
      const timer = setTimeout(() => {
        // Always inform the server which user is active
        if (sendStartInterview) {
          sendStartInterview(userId);
        }

        // Form-specific behavior:
        // - initialFormId is a string  → load that existing form
        // - initialFormId is null      → user chose "new form" in UI, but server
        //                                will create the placeholder on start_interview,
        //                                so we do NOT call start_new_form here
        if (typeof initialFormId === "string" && initialFormId) {
          sendLoadForm(initialFormId);
        }
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isConnected, userId, initialFormId, sendStartInterview, sendLoadForm]);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
      shouldAutoSendOnStopRef.current = false;
      
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

    // After stopping, automatically send the latest transcription when available
    shouldAutoSendOnStopRef.current = true;
    const dispatched = dispatchPendingTranscription();
    if (!dispatched) {
      // Keep listening card visible until transcription arrives
      setIsListening(true);
    }

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
    setEditedTranscript(value);
    setCurrentTranscript(value); // Keep them in sync when user edits
    setHasEdited(value !== (currentTranscript || ""));
  };

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

  // Handle end chat
  const handleEndChat = () => {
    if (isRecording) stopRecording();
    disconnect();
    setMessages([]);
    setCurrentTranscript("");
    setEditedTranscript("");
    setHasEdited(false);
    setInterviewState(null);
    setFormData({});
    setIsListening(false);
    setIsUnderstanding(false);
    pendingTranscriptionRef.current = null;
    shouldAutoSendOnStopRef.current = false;
    
    toast({
      title: "Chat Ended",
      description: "Your conversation has been cleared.",
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
      "Medical History",
      "Lifestyle Factors",
      "Treatment Goals",
      "Diagnostic Reports",
      "Referral",
    ],
    []
  );

  const derivedCurrentStep = useMemo(() => {
    if (!interviewState) return 1;
    const totalSteps = interviewSteps.length;

    const normalizedProgress = Math.min(
      Math.max(interviewState.progress, 0),
      100
    );
    const progressStep = Math.ceil((normalizedProgress / 100) * totalSteps) || 1;

    const sectionIndex = interviewState.section
      ? interviewSteps.findIndex(
          (step) => step.toLowerCase() === interviewState.section.toLowerCase()
        )
      : -1;
    const sectionStep = sectionIndex >= 0 ? sectionIndex + 1 : 0;

    const derivedStep = Math.max(progressStep, sectionStep || 0);

    if (normalizedProgress >= 100) {
      return totalSteps;
    }

    return Math.min(Math.max(derivedStep, 1), totalSteps);
  }, [interviewState, interviewSteps]);

  const lastUserMessageIndex = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === "user") {
        return i;
      }
    }
    return -1;
  }, [messages]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground">Medical Interview</h1>
          <Badge 
            variant={status === "connected" ? "default" : status === "connecting" ? "secondary" : "destructive"}
            className="rounded-full"
          >
            <div
              className={`w-2 h-2 rounded-full mr-2 ${
                status === "connected"
                  ? "bg-primary-foreground animate-pulse"
                  : status === "connecting"
                  ? "bg-muted-foreground animate-pulse"
                  : "bg-destructive-foreground"
              }`}
            />
            {status === "connected" ? "Connected" : status === "connecting" ? "Connecting..." : "Disconnected"}
          </Badge>
        </div>
        {userId && userName && (
          <div className="mt-2 flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">User:</span>
            <span className="font-medium text-foreground">{userName}</span>
            <span className="text-muted-foreground">•</span>
            <span className="text-muted-foreground">ID: {userId}</span>
          </div>
        )}
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Progress Bar */}
          {interviewState && (
            <div className="border-b border-border bg-muted/50 p-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">{interviewState.progress.toFixed(0)}%</span>
                </div>
                <Progress value={interviewState.progress} className="h-2" />
                <div className="text-sm text-muted-foreground">
                  Section: {interviewState.section}
                  {interviewState.missing_fields.length > 0 && (
                    <span className="ml-2">
                      • Missing: {interviewState.missing_fields.join(", ")}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Live Transcript Display */}
          {currentTranscript && (
            <div className="border-b border-border bg-muted/50 p-3">
              <p className="text-sm text-muted-foreground mb-1">Live Transcript:</p>
              <p className="text-sm font-medium">{currentTranscript}</p>
            </div>
          )}

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground text-lg">Start speaking to begin your conversation</p>
              </div>
            ) : (
              messages.map((message, index) => {
                const isLastUserMessage = message.role === "user" && index === lastUserMessageIndex;
                return (
                  <div key={index} className="space-y-3">
                    <div className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[70%] rounded-2xl p-4 ${
                          message.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-card text-card-foreground border border-border"
                        }`}
                      >
                        {message.role === "assistant"
                          ? formatMessageContent(message.content)
                          : <p className="text-sm">{message.content}</p>}
                        <span className="text-xs opacity-70 mt-2 block">{message.timestamp.toLocaleTimeString()}</span>
                      </div>
                    </div>

                    {isLastUserMessage && isUnderstanding && (
                      <div className="flex justify-start">
                        <UnderstandingCard
                          style="clean"
                          headline="Understanding your response..."
                          caption="Updating the interview context"
                        />
                      </div>
                    )}
                  </div>
                );
              })
            )}
            {pendingUploadRequest && (
              <div className="space-y-3 rounded-2xl border border-dashed border-border/70 p-4 bg-background/60">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      Upload scans or reports
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {uploadRequestText ||
                        "Please upload any requested MRI, X-ray, CT scan, or blood reports."}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPendingUploadRequest(false)}
                    className="text-xs"
                  >
                    Dismiss
                  </Button>
                </div>
                <div className="mt-4">
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png,.dicom"
                    className="hidden"
                    id="file-upload"
                    onChange={async (e) => {
                      const files = e.target.files;
                      if (!files || files.length === 0) return;
                      
                      const formId = currentFormId || interviewState?.formId;
                      if (!formId) {
                        toast({
                          title: "Error",
                          description: "No form ID available. Please start an interview first.",
                          variant: "destructive",
                        });
                        return;
                      }

                      if (!userId) {
                        toast({
                          title: "Error",
                          description: "No user ID available.",
                          variant: "destructive",
                        });
                        return;
                      }

                      try {
                        const formData = new FormData();
                        for (let i = 0; i < files.length; i++) {
                          formData.append("files", files[i]);
                        }
                        formData.append("userId", userId);

                        toast({
                          title: "Uploading files...",
                          description: `Uploading ${files.length} file(s)...`,
                        });

                        const response = await fetch(
                          `https://customeragent.stance.health/api/forms/${formId}/attachments`,
                          {
                            method: "POST",
                            body: formData,
                          }
                        );

                        if (!response.ok) {
                          const error = await response.json();
                          throw new Error(error.detail || "Upload failed");
                        }

                        const result = await response.json();
                        toast({
                          title: "Success",
                          description: `Successfully uploaded ${files.length} file(s).`,
                        });

                        // Close upload UI
                        setPendingUploadRequest(false);
                        setUploadRequestText(null);

                        // Update interview state with new attachments and progress
                        if (result.attachments || result.progress !== undefined) {
                          setInterviewState((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  attachments:
                                    result.attachments ||
                                    prev.attachments ||
                                    [],
                                  progress:
                                    result.progress !== undefined
                                      ? result.progress
                                      : prev.progress,
                                }
                              : null
                          );
                        }

                        // Automatically answer the reports question so the
                        // conversation can move to the next step after a
                        // successful upload.
                        if (sendTranscriptRef.current) {
                          sendTranscriptRef.current(
                            "Yes, I have uploaded my MRI, X-ray, CT scan, or blood reports related to this issue."
                          );
                        }

                        // Clear file input
                        e.target.value = "";
                      } catch (error: any) {
                        toast({
                          title: "Upload failed",
                          description: error.message || "Failed to upload files. Please try again.",
                          variant: "destructive",
                        });
                      }
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      document.getElementById("file-upload")?.click();
                    }}
                  >
                    Choose Files
                  </Button>
                </div>
              </div>
            )}
            {isListening && (
              <div className="flex justify-start">
                <UnderstandingCard
                  style="clean"
                  headline="Listening to you..."
                  caption="Capturing your response"
                />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Sidebar with Form Status */}
        {interviewState && (
          <div className="w-80 border-l border-border bg-card/50 p-4 overflow-y-auto space-y-4">
            <FormProgressCard
              style="clean"
              currentStep={derivedCurrentStep}
              totalSteps={interviewSteps.length}
              steps={interviewSteps}
            />
            {interviewState.attachments && interviewState.attachments.length > 0 && (
              <div className="rounded-2xl border border-border/60 p-4 bg-background/40 space-y-2">
                <p className="text-sm font-medium text-foreground">Uploaded documents</p>
                <div className="space-y-2">
                  {interviewState.attachments.map((att) => (
                    <div key={att.id} className="text-xs text-muted-foreground space-y-1">
                      <div className="flex justify-between gap-2">
                        <span className="font-semibold text-foreground">{att.label}</span>
                        <a
                          href={att.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline"
                        >
                          View
                        </a>
                      </div>
                      <p>{att.fileName}</p>
                      <p className="text-[11px]">
                        {new Date(att.uploadedAt).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {interviewState.missing_fields.length > 0 && (
              <div className="rounded-2xl border border-border/60 p-4 bg-background/40">
                <p className="text-sm font-medium mb-2 text-foreground">Missing details</p>
                <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                  {interviewState.missing_fields.map((field, idx) => (
                    <li key={idx}>{field}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Transcription Input */}
      <div className="border-t border-border bg-card/50 backdrop-blur-sm p-6 space-y-4">
        <div className="relative">
          <Textarea
            ref={textareaRef}
            value={editedTranscript || currentTranscript}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder={isRecording ? "Listening... your speech will appear here..." : "Your transcription will appear here... or type manually"}
            className="min-h-[100px] pr-16 rounded-2xl bg-background border-border resize-none"
            disabled={isModelSpeaking}
          />
          {(editedTranscript.trim() || currentTranscript.trim()) && (
            <Button
              onClick={handleSendMessage}
              size="icon"
              className="absolute bottom-3 right-3 rounded-full bg-primary hover:bg-primary/90"
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex gap-2">
            <Button
              onClick={handleSaveChat}
              variant="secondary"
              size="lg"
              className="rounded-2xl"
              disabled={messages.length === 0}
            >
              <Save className="h-4 w-4 mr-2" />
              Save Chat
            </Button>
            <Button
              onClick={handleClearForm}
              variant="secondary"
              size="lg"
              className="rounded-2xl"
              disabled={!editedTranscript.trim()}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear
            </Button>
            <Button onClick={handleEndChat} variant="destructive" size="lg" className="rounded-2xl">
              <MessageSquareX className="h-4 w-4 mr-2" />
              End Chat
            </Button>
          </div>

          {/* Microphone Button */}
          <Button
            onClick={handleMicClick}
            size="lg"
            disabled={!isConnected || isModelSpeaking}
            className={`rounded-full w-16 h-16 ${
              isRecording ? "bg-primary hover:bg-primary/90 p-0" : "bg-primary hover:bg-primary/90"
            }`}
          >
            {isRecording ? (
              <WaveformAnimation isActive={isRecording} audioLevel={audioLevel} />
            ) : (
              <Mic className="h-6 w-6" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
