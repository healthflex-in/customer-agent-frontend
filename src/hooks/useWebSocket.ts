import { useState, useEffect, useRef, useCallback } from "react";
import { getWsUrl } from "@/config/api";

interface InterviewState {
  section: string;
  progress: number;
  missing_fields: string[];
  attachments?: Array<{
    id: string;
    label: string;
    fileName: string;
    url: string;
    uploadedAt: string;
  }>;
  formId?: string;
  promSteps?: string[] | null;
}

interface ChatHistoryMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface ThoughtStage {
  stage: string;
  detail: string;
  status: "done" | "active" | "pending";
}

export interface QuestionMeta {
  type:
    | "single_choice" | "multiple_choice" | "checkbox"
    | "scale" | "linear_scale" | "slider"
    | "rating"
    | "text" | "short_answer" | "paragraph"
    | "number"
    | "boolean" | "yes_no"
    | "dropdown"
    | "date" | "time"
    | "likert"
    | "choice_grid" | "checkbox_grid"
    | "file_upload"
    | "multi_answer";
  options?: string[] | null;
  question_id?: string | null;
  question_ids?: string[] | null;
  questions?: string[] | null;
  question_options?: (string[] | null)[] | null;
  question_types?: string[] | null;
  question_scales?: string[] | null;
}

interface WebSocketMessage {
  type: "text_message" | "audio_start" | "audio_chunk" | "error" | "transcription" | "form_selection_required" | "form_loaded" | "chat_history" | "thought_update";
  text?: string;
  transcription?: string;
  interview_state?: InterviewState;
  request_attachment?: boolean;
  question_meta?: QuestionMeta;
  message?: string;
  forms?: any[];
  form_data?: Record<string, any>;
  message_id?: string;
  total_size?: number;
  data?: string; // base64 encoded audio
  is_last?: boolean;
  timestamp?: number;
  messages?: ChatHistoryMessage[]; // for chat_history type
  thoughts?: ThoughtStage[]; // for thought_update type
}

interface UseWebSocketOptions {
  serverUrl?: string;
  onMessage?: (message: string, transcription?: string, interviewState?: InterviewState, requestAttachment?: boolean, questionMeta?: QuestionMeta) => void;
  onTranscription?: (transcription: string) => void;
  onAudioStart?: (messageId: string, totalSize: number) => void;
  onAudioChunk?: (messageId: string, audioData: ArrayBuffer, isLast: boolean) => void;
  onError?: (error: Error) => void;
  onStatusChange?: (status: "disconnected" | "connecting" | "connected") => void;
  onFormSelectionRequired?: (forms: any[]) => void;
  onFormLoaded?: (formData: Record<string, any>, interviewState?: InterviewState) => void;
  onAttachmentRequest?: (messageText?: string) => void;
  onChatHistory?: (messages: ChatHistoryMessage[]) => void;
  onThoughtUpdate?: (thoughts: ThoughtStage[]) => void;
  onToken?: (token: string) => void;
}

export default function useWebSocket({
  serverUrl,
  onMessage,
  onTranscription,
  onAudioStart,
  onAudioChunk,
  onError,
  onStatusChange,
  onFormSelectionRequired,
  onFormLoaded,
  onAttachmentRequest,
  onChatHistory,
  onThoughtUpdate,
  onToken,
}: UseWebSocketOptions = {}) {
  const [status, setStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const isConnectingRef = useRef(false);
  const shouldReconnectRef = useRef(true);
  const audioBuffersRef = useRef<Map<string, Uint8Array>>(new Map());

  const connect = useCallback(async () => {
    if (!serverUrl) {
      return;
    }

    // Prevent multiple simultaneous connection attempts
    if (isConnectingRef.current) {
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    if (wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    isConnectingRef.current = true;

    try {
      setStatus("connecting");
      onStatusChange?.("connecting");

      // Establish WebSocket connection directly (server handles session creation)
      const ws = new WebSocket(serverUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        isConnectingRef.current = false;
        setStatus("connected");
        onStatusChange?.("connected");
        console.log("WebSocket connected successfully");
      };

      ws.onmessage = async (event) => {
        try {
          // Check if message is binary (audio data)
          if (event.data instanceof ArrayBuffer || event.data instanceof Blob) {
            // Binary audio data - this is sent during recording
            // The server expects binary audio chunks during recording
            console.log("Received binary audio data (unexpected from server)");
            return;
          }

          // Parse JSON message
          const data: WebSocketMessage = JSON.parse(event.data);

          if (data.type === "transcription") {
            // Real-time transcription update
            if (data.text) {
              onTranscription?.(data.text);
            }
          } else if (data.type === "form_selection_required") {
            // Server requires form selection (new or existing)
            if (data.forms && onFormSelectionRequired) {
              onFormSelectionRequired(data.forms);
            }
          } else if (data.type === "form_loaded") {
            // Form has been loaded
            const interviewState = data.interview_state ? {
              ...data.interview_state,
              attachments: data.interview_state.attachments || [],
              formId: data.interview_state.formId,
            } : undefined;
            if (onFormLoaded && data.form_data) {
              onFormLoaded(data.form_data, interviewState);
            }
            // Also send as a message
            if (data.text && onMessage) {
              onMessage(data.text, undefined, interviewState, false);
            }
          } else if (data.type === "text_message") {
            // Text message with optional transcription and interview state
            const interviewState = data.interview_state ? {
              ...data.interview_state,
              attachments: data.interview_state.attachments || [],
              formId: data.interview_state.formId,
            } : undefined;
            onMessage?.(data.text || "", data.transcription, interviewState, data.request_attachment || false, data.question_meta);
            
            // Handle attachment request if present
            if (data.request_attachment && onAttachmentRequest) {
              onAttachmentRequest(data.text || "");
            }
          } else if (data.type === "audio_start") {
            // Server is starting to send audio
            if (data.message_id && data.total_size !== undefined) {
              audioBuffersRef.current.set(data.message_id, new Uint8Array(0));
              onAudioStart?.(data.message_id, data.total_size);
            }
          } else if (data.type === "audio_chunk") {
            // Audio chunk (base64 encoded)
            if (data.message_id && data.data) {
              // Decode base64 audio data
              const binaryString = atob(data.data);
              const audioBytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                audioBytes[i] = binaryString.charCodeAt(i);
              }

              // Accumulate audio chunks
              const existingBuffer = audioBuffersRef.current.get(data.message_id) || new Uint8Array(0);
              const newBuffer = new Uint8Array(existingBuffer.length + audioBytes.length);
              newBuffer.set(existingBuffer);
              newBuffer.set(audioBytes, existingBuffer.length);
              audioBuffersRef.current.set(data.message_id, newBuffer);

              // Notify about the chunk
              onAudioChunk?.(data.message_id, audioBytes.buffer, data.is_last || false);

              // If this is the last chunk, clean up
              if (data.is_last) {
                audioBuffersRef.current.delete(data.message_id);
              }
            }
          } else if (data.type === "token") {
            // LLM streaming token — append to in-progress message
            if (data.content && onToken) {
              onToken(data.content as string);
            }
          } else if (data.type === "thought_update") {
            if (data.thoughts && onThoughtUpdate) {
              onThoughtUpdate(data.thoughts);
            }
          } else if (data.type === "chat_history") {
            if (data.messages && onChatHistory) {
              onChatHistory(data.messages);
            }
          } else if (data.type === "error") {
            onError?.(new Error(data.text || "Unknown error"));
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
          onError?.(error as Error);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        isConnectingRef.current = false;
        onError?.(new Error("WebSocket connection error"));
      };

      ws.onclose = (event) => {
        isConnectingRef.current = false;
        console.log(`WebSocket closed: code=${event.code}, reason=${event.reason || 'none'}, wasClean=${event.wasClean}`);
        setStatus("disconnected");
        onStatusChange?.("disconnected");
        wsRef.current = null;

        // Only attempt to reconnect if it wasn't a manual close (code 1000) and reconnect is enabled
        if (shouldReconnectRef.current && event.code !== 1000) {
          console.log("Attempting to reconnect in 3 seconds...");
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 3000);
        }
      };
    } catch (error) {
      isConnectingRef.current = false;
      setStatus("disconnected");
      onStatusChange?.("disconnected");
      onError?.(error as Error);
    }
  }, [serverUrl, onMessage, onTranscription, onAudioStart, onAudioChunk, onError, onStatusChange, onFormSelectionRequired, onFormLoaded, onAttachmentRequest, onChatHistory, onThoughtUpdate, onToken]);

  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false; // Prevent auto-reconnect on manual disconnect
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }
    if (wsRef.current) {
      // Close with code 1000 (normal closure) to indicate manual disconnect
      if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
        wsRef.current.close(1000, "Manual disconnect");
      }
      wsRef.current = null;
    }
    isConnectingRef.current = false;
    setStatus("disconnected");
    onStatusChange?.("disconnected");
  }, [onStatusChange]);

  const sendAudio = useCallback((audioData: ArrayBuffer) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      // Send binary audio data directly
      wsRef.current.send(audioData);
      return true;
    }
    return false;
  }, []);

  const sendAudioStart = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "audio_start",
          timestamp: Date.now() / 1000,
        })
      );
      return true;
    }
    return false;
  }, []);

  const sendAudioEnd = useCallback((duration: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "audio_end",
          duration,
          timestamp: Date.now() / 1000,
        })
      );
      return true;
    }
    return false;
  }, []);

  const sendTextInput = useCallback((text: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "text_input",
          text: text.trim(),
          timestamp: Date.now() / 1000,
        })
      );
      return true;
    }
    return false;
  }, []);

  const sendStartInterview = useCallback((userId: string, formId?: string) => {
    console.log(`[sendStartInterview] Called with userId=${userId}, formId=${formId}, wsState=${wsRef.current?.readyState}`);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const message = {
        type: "start_interview",
        userId: userId,
        formId: formId || null,
        timestamp: Date.now() / 1000,
      };
      console.log(`[sendStartInterview] Sending message:`, message);
      wsRef.current.send(JSON.stringify(message));
      return true;
    }
    console.log(`[sendStartInterview] WebSocket not open, state=${wsRef.current?.readyState}`);
    return false;
  }, []);

  const sendEndSession = useCallback((userId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "end_session",
          userId: userId,
          timestamp: Date.now() / 1000,
        })
      );
      return true;
    }
    return false;
  }, []);

  const sendStartNewForm = useCallback((userId?: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "start_new_form",
          // Include userId so the server can safely associate the new form
          // even if start_interview was not called in this session.
          userId,
          timestamp: Date.now() / 1000,
        })
      );
      return true;
    }
    return false;
  }, []);

  const sendLoadForm = useCallback((formId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "load_form",
          formId: formId,
          timestamp: Date.now() / 1000,
        })
      );
      return true;
    }
    return false;
  }, []);

  // Removed cleanup useEffect - it was causing immediate disconnection
  // The WebSocket will be cleaned up naturally when:
  // 1. Component unmounts (page navigation)
  // 2. User explicitly calls disconnect()
  // 3. Server closes connection
  // 4. Network error occurs

  return {
    status,
    connect,
    disconnect,
    sendAudio,
    sendAudioStart,
    sendAudioEnd,
    sendTextInput,
    sendStartInterview,
    sendEndSession,
    sendStartNewForm,
    sendLoadForm,
    isConnected: status === "connected",
  };
}

export type { UseWebSocketOptions };

