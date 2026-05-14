import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { CONFIG } from "./config";
import {
  APIError,
  analyseIdea,
  buildCopyText,
  getVoiceHealth,
  speakWithLipSync,
  transcribeVoice,
} from "./lib/api";
import { buildLocalAnalysis } from "./lib/localAnalysis";
import LipSyncAvatar from "./components/LipSyncAvatar";
import { buildLipSyncTrack, pickVisemeForProgress } from "../shared/lipSync";
import craftechLogo from "./assets/craftech360-logo.jpg";

const PANELS = [
  { id: "feasibility", label: "Feasibility", title: "Feasibility Assessment", className: "answer-block--feasibility" },
  { id: "how", label: "How It Works", title: "How It Works", className: "answer-block--how" },
  { id: "challenges", label: "Challenges", title: "Challenges & Risks", className: "answer-block--challenges" },
  { id: "ideas", label: "Ideas", title: "Creative Ideas & Enhancements", className: "answer-block--ideas" },
];

function formatContent(text) {
  if (!text || !text.trim()) {
    return [{ type: "paragraph", text: "No data available." }];
  }

  const lines = text.split("\n").filter((line) => line.trim());
  const blocks = [];
  let listItems = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const isBullet = trimmed.startsWith("-") || trimmed.startsWith("*");

    if (isBullet) {
      listItems.push(trimmed.replace(/^[-*]\s*/, ""));
      continue;
    }

    if (listItems.length) {
      blocks.push({ type: "list", items: listItems });
      listItems = [];
    }

    blocks.push({ type: "paragraph", text: trimmed });
  }

  if (listItems.length) {
    blocks.push({ type: "list", items: listItems });
  }

  return blocks;
}

function buildVoiceSummary(analysis) {
  if (!analysis) {
    return "";
  }

  const normalizeSpeechText = (text) => String(text || "")
    .replace(/[*•]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return [
    `Here is your full Craftech 360 voice brief for ${analysis.heading}.`,
    `Overall feasibility is ${analysis.badge}.`,
    `Feasibility score is ${analysis.feasibility_score} percent, technology readiness is ${analysis.tech_score} percent, creative potential is ${analysis.creative_score} percent, and audience impact is ${analysis.impact_score} percent.`,
    `Feasibility analysis. ${normalizeSpeechText(analysis.feasibility)}`,
    `How it works. ${normalizeSpeechText(analysis.how_it_works)}`,
    `Challenges and risks. ${normalizeSpeechText(analysis.challenges)}`,
    `Ideas and enhancements. ${normalizeSpeechText(analysis.ideas)}`,
  ].join(" ");
}

function base64ToBlob(base64, mimeType) {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType });
}

function getAvatarTheme(selectedCategory, analysisResult) {
  const source = (selectedCategory && selectedCategory !== "All"
    ? selectedCategory
    : analysisResult?.category || "All").toLowerCase();

  if (source.includes("museum") || source.includes("exhibit")) {
    return "museum";
  }

  if (source.includes("experiential")) {
    return "experiential";
  }

  if (source.includes("corporate")) {
    return "corporate";
  }

  if (source.includes("brand")) {
    return "brand";
  }

  if (source.includes("tech") || source.includes("innovation")) {
    return "tech";
  }

  return "default";
}

function App() {
  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioPlayerRef = useRef(null);
  const audioUrlRef = useRef("");
  const finalTranscriptRef = useRef("");
  const spokenQueryRef = useRef("");
  const autoSpeakRef = useRef(true);
  const voiceCancelRef = useRef(false);
  const recognitionErrorRef = useRef(false);
  const voiceFallbackAttemptedRef = useRef(false);
  const voiceSessionIdRef = useRef(0);
  const lipSyncFrameRef = useRef(0);
  const speechWatchdogRef = useRef(0);
  const speechPollRef = useRef(0);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [activePanel, setActivePanel] = useState("feasibility");
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [toast, setToast] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [warningMessage, setWarningMessage] = useState("");
  const [retryAfterSeconds, setRetryAfterSeconds] = useState(0);
  const [voiceStatus, setVoiceStatus] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [avatarViseme, setAvatarViseme] = useState("rest");
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [hasPremiumVoice, setHasPremiumVoice] = useState(false);

  const SpeechRecognition =
    typeof window !== "undefined"
      ? window.SpeechRecognition || window.webkitSpeechRecognition
      : null;
  const hasSpeechRecognition = Boolean(SpeechRecognition);
  const hasSpeechSynthesis =
    typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
  const canRecordAudio =
    typeof window !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== "undefined";
  const hasVoiceAssistant = hasSpeechRecognition || canRecordAudio || hasSpeechSynthesis;

  useEffect(() => {
    if (!isLoading) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      setPhaseIndex((current) => (current + 1) % CONFIG.loadingPhases.length);
    }, 1800);

    return () => window.clearInterval(interval);
  }, [isLoading]);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!retryAfterSeconds) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setRetryAfterSeconds((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [retryAfterSeconds]);

  useEffect(() => {
    autoSpeakRef.current = autoSpeak;
  }, [autoSpeak]);

  useEffect(() => {
    let cancelled = false;

    getVoiceHealth()
      .then((data) => {
        if (!cancelled) {
          setHasPremiumVoice(Boolean(data?.hasPremiumVoice));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHasPremiumVoice(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isLoading) {
      window.setTimeout(() => {
        document.getElementById("loadingState")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 80);
    }
  }, [isLoading]);

  useEffect(() => {
    if (result && !isLoading) {
      window.setTimeout(() => {
        document.getElementById("resultSection")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 80);
    }
  }, [result, isLoading]);

  useEffect(() => {
    return () => {
      if (speechWatchdogRef.current) {
        window.clearTimeout(speechWatchdogRef.current);
      }

      if (speechPollRef.current) {
        window.clearInterval(speechPollRef.current);
      }

      if (lipSyncFrameRef.current) {
        window.cancelAnimationFrame(lipSyncFrameRef.current);
      }

      recognitionRef.current?.stop?.();
      mediaRecorderRef.current?.stop?.();
      mediaStreamRef.current?.getTracks?.().forEach((track) => track.stop());
      audioPlayerRef.current?.pause?.();

      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
      }

      if (hasSpeechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [hasSpeechSynthesis]);

  const panelContent = useMemo(() => {
    if (!result) {
      return {};
    }

    return {
      feasibility: formatContent(result.feasibility),
      how: formatContent(result.how_it_works),
      challenges: formatContent(result.challenges),
      ideas: formatContent(result.ideas),
    };
  }, [result]);

  const avatarMode = isSpeaking ? "speaking" : isListening ? "listening" : isLoading ? "thinking" : "idle";
  const avatarTheme = getAvatarTheme(category, result);
  const avatarSubtitle = voiceStatus || (isLoading
    ? "Analysing your idea and preparing a spoken brief."
    : "Tap the mic to ask a question and watch the avatar speak.");
  const showcaseExamples = CONFIG.examples.slice(0, 3);
  const visibleErrorMessage = errorMessage.replace(/^Request paused\.\s*/i, "");

  async function runAnalysis(overrideQuery = "") {
    if (isLoading) {
      return;
    }

    stopSpeaking();

    const trimmedQuery = (overrideQuery || query).trim();
    if (!trimmedQuery) {
      const textarea = document.getElementById("userQuery");
      textarea?.focus();
      setErrorMessage("Please enter your question or idea before running an analysis.");
      return;
    }

    setErrorMessage("");
    setWarningMessage("");
    setRetryAfterSeconds(0);
    setVoiceStatus(overrideQuery ? "Your question was captured. Analysing now..." : "");
    setIsLoading(true);
    setPhaseIndex(0);

    try {
      const nextResult = await analyseIdea({ query: trimmedQuery, category });

      startTransition(() => {
        setResult(nextResult);
        setActivePanel("feasibility");
        setQuery(trimmedQuery);
        setHistory((current) => {
          if (current[0]?.query === trimmedQuery) {
            return current;
          }

          const nextHistory = [
            { query: trimmedQuery, category, badge: nextResult.badge, result: nextResult },
            ...current,
          ];

          return nextHistory.slice(0, CONFIG.maxHistory);
        });
      });

      if (autoSpeakRef.current) {
        speakText(buildVoiceSummary(nextResult));
      }
    } catch (error) {
      console.error("[Craftech360] Analysis error:", error);
      const fallbackResult = buildLocalAnalysis({
        query: trimmedQuery,
        category,
      });

      startTransition(() => {
        setResult(fallbackResult);
        setActivePanel("feasibility");
        setQuery(trimmedQuery);
        setHistory((current) => {
          if (current[0]?.query === trimmedQuery) {
            return current;
          }

          const nextHistory = [
            { query: trimmedQuery, category, badge: fallbackResult.badge, result: fallbackResult },
            ...current,
          ];

          return nextHistory.slice(0, CONFIG.maxHistory);
        });
      });

      setWarningMessage(
        "Live AI service is unavailable right now, so this result is a local preview analysis."
      );
      showError(error, true);
    } finally {
      setIsLoading(false);
    }
  }

  function handleAnalysisSubmit(event) {
    event.preventDefault();
    void runAnalysis();
  }

  function handleFollowUpSubmit(event) {
    event.preventDefault();
    void runAnalysis();
  }

  function showError(error, keepResultVisible = false) {
    let message = "Something went wrong. Please try again.";

    if (error instanceof APIError) {
      if (error.statusCode === 401) {
        message = "API authentication failed. Please check your server Groq API key.";
      } else if (error.statusCode === 500 && /GROQ_API_KEY/i.test(error.message)) {
        message = "Server is missing GROQ_API_KEY. Add it to your .env file and restart the backend.";
      } else if (error.statusCode === 429) {
        message = error.message || "Groq is busy right now. Please wait a moment and try again.";
      } else if (error.statusCode >= 500) {
        message = "The AI service is temporarily unavailable. Please try again shortly.";
      } else if (error.message) {
        message = error.message;
      }
    } else if (!navigator.onLine) {
      message = "No internet connection. Please check your network and try again.";
    }

    setErrorMessage(keepResultVisible ? "" : message);
    setRetryAfterSeconds(
      error instanceof APIError && Number(error.raw?.retryAfterSeconds) > 0
        ? Number(error.raw.retryAfterSeconds)
        : 0
    );
    setVoiceStatus("");
  }

  function stopLipSyncAnimation() {
    if (lipSyncFrameRef.current) {
      window.cancelAnimationFrame(lipSyncFrameRef.current);
      lipSyncFrameRef.current = 0;
    }

    setAvatarViseme("rest");
  }

  function clearSpeechWatchdog() {
    if (speechWatchdogRef.current) {
      window.clearTimeout(speechWatchdogRef.current);
      speechWatchdogRef.current = 0;
    }

    if (speechPollRef.current) {
      window.clearInterval(speechPollRef.current);
      speechPollRef.current = 0;
    }
  }

  function finishSpeaking(nextStatus = "") {
    clearSpeechWatchdog();
    stopLipSyncAnimation();
    setIsSpeaking(false);
    setVoiceStatus(nextStatus);
  }

  function startSpeechWatchdog(expectedDurationMs) {
    clearSpeechWatchdog();

    const safeDurationMs = Math.max(Number(expectedDurationMs) || 0, 1500);
    speechWatchdogRef.current = window.setTimeout(() => {
      finishSpeaking("");
    }, safeDurationMs + 1800);

    if (hasSpeechSynthesis) {
      speechPollRef.current = window.setInterval(() => {
        if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
          finishSpeaking("");
        }
      }, 400);
    }
  }

  function startLipSyncAnimation({ cues, estimatedDurationMs, getProgress }) {
    stopLipSyncAnimation();

    const fallbackDurationMs = Math.max(estimatedDurationMs || 1, 1);

    const tick = () => {
      const progress = getProgress(fallbackDurationMs);
      setAvatarViseme(pickVisemeForProgress(cues, progress));

      if (progress >= 1) {
        stopLipSyncAnimation();
        return;
      }

      lipSyncFrameRef.current = window.requestAnimationFrame(tick);
    };

    lipSyncFrameRef.current = window.requestAnimationFrame(tick);
  }

  function stopSpeaking() {
    clearSpeechWatchdog();
    audioPlayerRef.current?.pause?.();
    audioPlayerRef.current = null;

    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = "";
    }

    if (hasSpeechSynthesis) {
      window.speechSynthesis.cancel();
    }

    finishSpeaking("");
  }

  function cancelVoiceAssistant() {
    voiceSessionIdRef.current += 1;
    voiceCancelRef.current = true;
    stopSpeaking();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop?.();
      } catch {}
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop?.();
      } catch {}
    }

    mediaStreamRef.current?.getTracks?.().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    mediaRecorderRef.current = null;
    recognitionRef.current = null;
    audioChunksRef.current = [];
    finalTranscriptRef.current = "";
    spokenQueryRef.current = "";
    setIsListening(false);
    setVoiceStatus("");
  }

  async function speakText(text) {
    if (!text.trim()) {
      return;
    }

    stopSpeaking();
    let premiumPlaybackWorked = false;

    if (hasPremiumVoice) {
      try {
        const lipSync = await speakWithLipSync(text);

        await new Promise((resolve) => {
          const audioBlob = base64ToBlob(lipSync.audioBase64, lipSync.mimeType || "audio/mpeg");
          const audioUrl = URL.createObjectURL(audioBlob);
          const audio = new Audio(audioUrl);

          audioUrlRef.current = audioUrl;
          audioPlayerRef.current = audio;
          audio.onplay = () => {
            setIsSpeaking(true);
            setVoiceStatus("Craftech AI is speaking...");
            startLipSyncAnimation({
              cues: lipSync.cues,
              estimatedDurationMs: lipSync.estimatedDurationMs,
              getProgress: (fallbackDurationMs) => {
                const durationMs = Number.isFinite(audio.duration) && audio.duration > 0
                  ? audio.duration * 1000
                  : fallbackDurationMs;

                return (audio.currentTime * 1000) / durationMs;
              },
            });
            startSpeechWatchdog(lipSync.estimatedDurationMs);
          };
          audio.onended = () => {
            finishSpeaking("");
            audioPlayerRef.current = null;
            if (audioUrlRef.current) {
              URL.revokeObjectURL(audioUrlRef.current);
              audioUrlRef.current = "";
            }
            resolve();
          };
          audio.onerror = () => {
            finishSpeaking("Premium voice playback was interrupted.");
            audioPlayerRef.current = null;
            if (audioUrlRef.current) {
              URL.revokeObjectURL(audioUrlRef.current);
              audioUrlRef.current = "";
            }
            resolve();
          };

          audio.play()
            .then(() => {
              premiumPlaybackWorked = true;
              setErrorMessage("");
            })
            .catch(() => {
              audioPlayerRef.current = null;
              if (audioUrlRef.current) {
                URL.revokeObjectURL(audioUrlRef.current);
                audioUrlRef.current = "";
              }
              if (!hasSpeechSynthesis) {
                setErrorMessage("Voice playback was blocked by the browser. Please allow site audio and try again.");
              }
              resolve();
            });
        });
        if (premiumPlaybackWorked) {
          return;
        }
      } catch {
        // Fall back to browser speech below.
      }
    }

    if (!hasSpeechSynthesis) {
      setErrorMessage("Voice playback is not available in this browser. Please try Chrome or Edge.");
      return;
    }

    const lipSync = buildLipSyncTrack(text);
    await new Promise((resolve) => {
      const utterance = new window.SpeechSynthesisUtterance(text);
      utterance.rate = 1;
      utterance.pitch = 1.02;
      utterance.volume = 1;
      let speechStartTime = 0;

      utterance.onstart = () => {
        speechStartTime = performance.now();
        setIsSpeaking(true);
        setVoiceStatus("Craftech AI is speaking...");
        startLipSyncAnimation({
          cues: lipSync.cues,
          estimatedDurationMs: lipSync.estimatedDurationMs,
          getProgress: (fallbackDurationMs) => (performance.now() - speechStartTime) / fallbackDurationMs,
        });
        startSpeechWatchdog(lipSync.estimatedDurationMs);
      };
      utterance.onend = () => {
        finishSpeaking("");
        resolve();
      };
      utterance.onerror = () => {
        finishSpeaking("Voice playback was interrupted.");
        resolve();
      };

      const voices = window.speechSynthesis.getVoices();
      const preferredVoice =
        voices.find((voice) => /en-in/i.test(voice.lang)) ||
        voices.find((voice) => /en-gb|en-us/i.test(voice.lang)) ||
        voices[0];

      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      window.speechSynthesis.cancel();
      window.setTimeout(() => {
        window.speechSynthesis.speak(utterance);
      }, 60);
    });
  }

  function stopVoiceCapture() {
    cancelVoiceAssistant();
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = typeof reader.result === "string" ? reader.result : "";
        resolve(result.split(",")[1] || "");
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async function startPremiumVoiceCapture() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      return false;
    }

    const sessionId = voiceSessionIdRef.current + 1;
    voiceSessionIdRef.current = sessionId;
    voiceCancelRef.current = false;
    recognitionErrorRef.current = false;
    finalTranscriptRef.current = "";
    spokenQueryRef.current = "";
    audioChunksRef.current = [];
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
    const recorder = new MediaRecorder(stream, { mimeType });

    mediaStreamRef.current = stream;
    mediaRecorderRef.current = recorder;
    audioChunksRef.current = [];

    recorder.onstart = () => {
      if (voiceSessionIdRef.current !== sessionId) {
        return;
      }

      setIsListening(true);
      setVoiceStatus("Listening... Ask your question now.");
      setErrorMessage("");
    };

    recorder.ondataavailable = (event) => {
      if (event.data?.size) {
        audioChunksRef.current.push(event.data);
      }
    };

    recorder.onerror = () => {
      if (voiceSessionIdRef.current !== sessionId) {
        return;
      }

      setIsListening(false);
      setVoiceStatus("");
      setErrorMessage("Voice capture did not complete. Please try again.");
    };

    recorder.onstop = async () => {
      if (voiceSessionIdRef.current !== sessionId) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      setIsListening(false);
      mediaStreamRef.current?.getTracks?.().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      mediaRecorderRef.current = null;

      if (voiceCancelRef.current) {
        voiceCancelRef.current = false;
        audioChunksRef.current = [];
        setVoiceStatus("");
        return;
      }

      const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
      audioChunksRef.current = [];

      if (!audioBlob.size) {
        setVoiceStatus("");
        setErrorMessage("I could not hear a full question. Please try again.");
        return;
      }

      try {
        setVoiceStatus("Transcribing your voice...");
        const audioBase64 = await blobToBase64(audioBlob);
        const response = await transcribeVoice({ audioBase64, mimeType });
        const spokenQuery = String(response?.text || "").trim();

        if (!spokenQuery) {
          setVoiceStatus("");
          setErrorMessage("I could not hear a full question. Please try again.");
          return;
        }

        setQuery(spokenQuery);
        setVoiceStatus("Voice captured. Sending your request...");
        await runAnalysis(spokenQuery);
      } catch (error) {
        setVoiceStatus("");
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Premium voice transcription failed. Please try again."
        );
      }
    };

    recorder.start();
    return true;
  }

  async function fallbackToPremiumVoiceCapture(nextStatus = "Switching to backup voice capture...") {
    if (!canRecordAudio || voiceFallbackAttemptedRef.current) {
      return false;
    }

    voiceFallbackAttemptedRef.current = true;

    try {
      setVoiceStatus(nextStatus);
      return await startPremiumVoiceCapture();
    } catch (error) {
      setVoiceStatus("");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Voice capture did not complete. Please try again."
      );
      return false;
    }
  }

  function startBrowserRecognition() {
    if (!hasSpeechRecognition) {
      return false;
    }

    const sessionId = voiceSessionIdRef.current + 1;
    voiceSessionIdRef.current = sessionId;
    voiceCancelRef.current = false;
    stopSpeaking();
    finalTranscriptRef.current = "";
    spokenQueryRef.current = "";

    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      if (voiceSessionIdRef.current !== sessionId) {
        return;
      }

      voiceFallbackAttemptedRef.current = false;
      recognitionErrorRef.current = false;
      recognitionRef.current = recognition;
      setIsListening(true);
      setVoiceStatus("Listening... Ask your question now.");
      setErrorMessage("");
    };

    recognition.onresult = (event) => {
      if (voiceSessionIdRef.current !== sessionId) {
        return;
      }

      let interim = "";
      let finalText = finalTranscriptRef.current;

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const transcript = event.results[index][0]?.transcript || "";

        if (event.results[index].isFinal) {
          finalText += `${transcript} `;
        } else {
          interim += transcript;
        }
      }

      finalTranscriptRef.current = finalText;
      spokenQueryRef.current = `${finalText}${interim}`.trim();
      setQuery(spokenQueryRef.current);
    };

    recognition.onerror = (event) => {
      if (voiceSessionIdRef.current !== sessionId) {
        return;
      }

      const spokenQuery = finalTranscriptRef.current.trim() || spokenQueryRef.current.trim();

      setIsListening(false);
      recognitionRef.current = null;

      if (event.error === "aborted") {
        setVoiceStatus("");
        return;
      }

      if (spokenQuery) {
        recognitionErrorRef.current = false;
        setVoiceStatus("Finalising your question...");
        return;
      }

      recognitionErrorRef.current = true;

      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setErrorMessage("Microphone access was blocked. Please allow microphone permission and try again.");
      } else if (event.error === "audio-capture") {
        void fallbackToPremiumVoiceCapture("Browser mic failed. Trying backup voice capture...");
        return;
      } else if (event.error === "no-speech") {
        void fallbackToPremiumVoiceCapture("I didn't catch that. Trying backup voice capture...");
        return;
      } else if (event.error !== "aborted") {
        void fallbackToPremiumVoiceCapture("Voice capture was interrupted. Trying backup voice capture...");
        return;
      }

      setVoiceStatus("");
    };

    recognition.onend = () => {
      if (voiceSessionIdRef.current !== sessionId) {
        return;
      }

      const spokenQuery = finalTranscriptRef.current.trim() || spokenQueryRef.current.trim();

      setIsListening(false);
      recognitionRef.current = null;

      if (voiceCancelRef.current) {
        voiceCancelRef.current = false;
        finalTranscriptRef.current = "";
        spokenQueryRef.current = "";
        setVoiceStatus("");
        return;
      }

      if (recognitionErrorRef.current) {
        recognitionErrorRef.current = false;
        setVoiceStatus("");
        return;
      }

      if (spokenQuery) {
        setVoiceStatus("Voice captured. Sending your request...");
        void runAnalysis(spokenQuery);
      } else {
        void fallbackToPremiumVoiceCapture("No speech detected. Trying backup voice capture...");
        return;
      }

      spokenQueryRef.current = "";
    };

    try {
      recognition.start();
      return true;
    } catch (error) {
      recognitionRef.current = null;
      setIsListening(false);
      setVoiceStatus("");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Browser speech recognition could not start. Please try again."
      );
      return false;
    }
  }

  async function startVoiceCapture() {
    setErrorMessage("");
    setWarningMessage("");
    finalTranscriptRef.current = "";
    spokenQueryRef.current = "";
    audioChunksRef.current = [];

    if (recognitionRef.current || mediaRecorderRef.current) {
      cancelVoiceAssistant();
    }

    stopSpeaking();
    voiceFallbackAttemptedRef.current = false;

    if (startBrowserRecognition()) {
      return;
    }

    if (canRecordAudio) {
      try {
        setVoiceStatus("Starting fallback voice capture...");
        const started = await startPremiumVoiceCapture();
        if (started) {
          return;
        }
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Microphone access was not available. Please try again."
        );
      }
    }

    setVoiceStatus("");
    setErrorMessage("Voice capture is not available in this browser right now. Please allow mic access and try Chrome or Edge.");
  }

  function toggleVoiceAssistant() {
    if (isListening) {
      cancelVoiceAssistant();
      return;
    }

    void startVoiceCapture();
  }

  function replayVoiceSummary() {
    if (!result) {
      return;
    }

    speakText(buildVoiceSummary(result));
  }

  async function copyReport() {
    if (!result) {
      return;
    }

    const text = buildCopyText({ query: query.trim(), category, result });

    try {
      await navigator.clipboard.writeText(text);
      setToast("Report copied to clipboard");
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.cssText = "position:fixed;opacity:0;pointer-events:none";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setToast("Report copied");
    }
  }

  async function shareReport() {
    if (!result) {
      return;
    }

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Craftech 360 - ${result.heading}`,
          text: `Feasibility: ${result.badge} | ${result.heading}\nPowered by Craftech 360 AI`,
          url: window.location.href,
        });
      } catch {
        return;
      }
    } else {
      await navigator.clipboard.writeText(window.location.href).catch(() => {});
      setToast("Link copied");
    }
  }

  function restoreHistoryItem(item) {
    setQuery(item.query);
    setCategory(item.category);
    setResult(item.result);
    setActivePanel("feasibility");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setQuery("");
    setResult(null);
    setActivePanel("feasibility");
    setErrorMessage("");
    setWarningMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <>
      <header className="header" id="appHeader">
        <div className="header__inner">
          <div className="logo">
            <img
              className="logo__icon"
              src={craftechLogo}
              alt="Craftech 360 logo"
            />
            <span className="logo__text">
              Craftech <em>360</em>
            </span>
          </div>
          <span className="header__badge">AI Feasibility Tool</span>
        </div>
      </header>

      <section className="hero" aria-label="Hero section">
        <div className="hero__particles" aria-hidden="true">
          <span className="hero__particle hero__particle--1"></span>
          <span className="hero__particle hero__particle--2"></span>
          <span className="hero__particle hero__particle--3"></span>
          <span className="hero__particle hero__particle--4"></span>
          <span className="hero__particle hero__particle--5"></span>
          <span className="hero__particle hero__particle--6"></span>
        </div>
        <div className="hero__inner">
          <div className="hero__copy">
            <div className="hero__eyebrow">
              <span className="pulse-dot" aria-hidden="true"></span>
              Craftech Voice Robot
            </div>

            <h1 className="hero__title">
              AI CHAT <em>APP</em>
            </h1>

            <p className="hero__sub">
              A cleaner voice-first assistant with the bot in the spotlight and only the
              most useful information around it.
            </p>
          </div>
        </div>
      </section>

      <main className="main" id="mainContent">
        <div className="showcase-shell">
          <div className="showcase-shell__center">
            <div className={`voice-scene voice-scene--${avatarMode}`} aria-hidden="true">
              <div className="voice-scene__floor"></div>
              <div className="voice-scene__ring voice-scene__ring--outer"></div>
              <div className="voice-scene__ring voice-scene__ring--mid"></div>
              <div className="voice-scene__ring voice-scene__ring--inner"></div>
              <div className="voice-scene__wave voice-scene__wave--back"></div>
              <div className="voice-scene__wave voice-scene__wave--front"></div>
              <div className="voice-scene__panel voice-scene__panel--left">
                <span></span>
                <span></span>
                <span></span>
                <div className="voice-scene__eq" aria-hidden="true">
                  <i></i>
                  <i></i>
                  <i></i>
                  <i></i>
                </div>
              </div>
              <div className="voice-scene__panel voice-scene__panel--center">
                <span></span>
                <span></span>
                <span></span>
                <span></span>
                <div className="voice-scene__eq voice-scene__eq--wide" aria-hidden="true">
                  <i></i>
                  <i></i>
                  <i></i>
                  <i></i>
                  <i></i>
                  <i></i>
                </div>
              </div>
              <div className="voice-scene__panel voice-scene__panel--right">
                <span></span>
                <span></span>
                <span></span>
                <div className="voice-scene__eq" aria-hidden="true">
                  <i></i>
                  <i></i>
                  <i></i>
                  <i></i>
                </div>
              </div>
              <div className="voice-scene__beam"></div>
            </div>
            <LipSyncAvatar
              mode={avatarMode}
              viseme={avatarViseme}
              theme={avatarTheme}
            />

            <div className="showcase-info" aria-label="Assistant features">
              <article className="showcase-info__item">
                <span className="showcase-info__label">Fast</span>
                <p>Voice-first feasibility answers in one place.</p>
              </article>
              <article className="showcase-info__item">
                <span className="showcase-info__label">Focused</span>
                <p>Only the bot, your prompt, and the result stay on screen.</p>
              </article>
              <article className="showcase-info__item">
                <span className="showcase-info__label">Useful</span>
                <p>Get feasibility, execution notes, risks, and idea prompts.</p>
              </article>
            </div>
          </div>
        </div>

        <div className="main-layout">
          <div className="main-content">
        <div className="card input-card" id="inputCard">
          <div className="card__stripe" aria-hidden="true"></div>

          <label className="field-label" htmlFor="categoryGroup">Category</label>
          <div className="pill-group" id="categoryGroup" role="group" aria-label="Select category">
            {CONFIG.categories.map((item) => (
              <button
                key={item}
                className={`pill ${category === item ? "pill--active" : ""}`}
                type="button"
                data-cat={item}
                onClick={() => setCategory(item)}
              >
                {item}
              </button>
            ))}
          </div>

          <label className="field-label" htmlFor="userQuery">Your Question or Idea</label>
          {errorMessage && (
            <div className="status-banner status-banner--error" role="alert" aria-live="assertive">
              <div>
                <strong>Request paused.</strong> {visibleErrorMessage}
                {retryAfterSeconds > 0 && ` Retry available in ${retryAfterSeconds}s.`}
              </div>
              <button
                className="status-banner__action"
                type="button"
                onClick={runAnalysis}
                disabled={isLoading || retryAfterSeconds > 0}
              >
                {retryAfterSeconds > 0 ? `Retry in ${retryAfterSeconds}s` : "Try again"}
              </button>
            </div>
          )}
          {warningMessage && (
            <div className="status-banner" role="status" aria-live="polite">
              <div>
                <strong>Preview mode.</strong> {warningMessage}
              </div>
            </div>
          )}
          {voiceStatus && (
            <div className="status-banner" role="status" aria-live="polite">
              <div>
                <strong>Voice assistant.</strong> {voiceStatus}
              </div>
              {isListening && (
                <button
                  className="status-banner__action"
                  type="button"
                  onClick={cancelVoiceAssistant}
                >
                  Stop
                </button>
              )}
            </div>
          )}
          <form className="search-action-group" onSubmit={handleAnalysisSubmit}>
            <div className="textarea-wrap">
              <textarea
                id="userQuery"
                maxLength={600}
                placeholder="e.g. Can we create an AR museum exhibit for a heritage brand in Mumbai? What would it take and is it feasible?"
                aria-describedby="charCount"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  if (errorMessage) {
                    setErrorMessage("");
                  }
                }}
                onKeyDown={(event) => {
                  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                    event.preventDefault();
                    void runAnalysis();
                  }
                }}
              />
              <span className="char-count" id="charCount" aria-live="polite">
                {query.length} / 600
              </span>
            </div>

            <button
              className="submit-btn"
              id="submitBtn"
              type="submit"
              aria-label="Analyse feasibility and ideas"
              disabled={isLoading}
            >
              <span className="submit-btn__icon" aria-hidden="true">
                {isLoading ? "..." : "AI"}
              </span>
              Analyse Feasibility &amp; Ideas
              <span className="submit-btn__hint">Ctrl+Enter</span>
            </button>
          </form>

          <span className="examples-label">Try an example</span>
          <div className="chip-group" role="list" aria-label="Example prompts">
            {showcaseExamples.map((example) => (
              <button
                key={example}
                className="chip"
                type="button"
                role="listitem"
                onClick={() => setQuery(example)}
              >
                {example}
              </button>
            ))}
          </div>
        </div>

        {isLoading && (
          <div className="loading-card card" id="loadingState" aria-live="polite" aria-hidden="false">
            <div className="spinner" aria-label="Loading"></div>
            <p className="loading-text">Craftech 360 AI is analysing your idea...</p>
            <p className="loading-phase" id="loadingPhase">
              {CONFIG.loadingPhases[phaseIndex]}
            </p>
            <p className="loading-note">
              This can take a few seconds. If Groq is busy, we retry automatically in the background.
            </p>
            <div className="loading-dots" aria-hidden="true">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}

        {result && (
          <section className="result-section" id="resultSection" aria-label="Analysis result" aria-hidden="false">
            <div className="result-header">
              <div className="result-title-group">
                <h2 className="result-title" id="resultHeading">{result.heading}</h2>
                <p className="result-meta" id="resultMeta">
                  {category !== "All" ? category : result.category} | Craftech 360 Analysis
                </p>
              </div>
              <span
                className={`feasibility-badge ${CONFIG.badgeClass[result.badge] || ""}`}
                id="feasBadge"
                aria-label="Feasibility level"
              >
                {result.badge} FEASIBILITY
              </span>
            </div>

            <div className="score-card card" id="scoreCard" aria-label="Scores">
              {CONFIG.scoreBars.map(({ key, label, color }) => (
                <div className="score-row" key={key}>
                  <div className="score-row__header">
                    <span className="score-row__label">{label}</span>
                    <span className="score-row__value">{result[key]}%</span>
                  </div>
                  <div className="score-bar">
                    <div
                      className="score-bar__fill"
                      style={{ background: color, width: `${result[key]}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>

            <div className="tabs" role="tablist" aria-label="Analysis sections" id="tabList">
              {PANELS.map((panel) => (
                <button
                  key={panel.id}
                  className={`tab ${activePanel === panel.id ? "tab--active" : ""}`}
                  type="button"
                  role="tab"
                  aria-selected={activePanel === panel.id}
                  onClick={() => setActivePanel(panel.id)}
                >
                  {panel.label}
                </button>
              ))}
            </div>

            {PANELS.map((panel) => (
              <div
                key={panel.id}
                className={`panel ${activePanel === panel.id ? "panel--active" : ""}`}
                role="tabpanel"
              >
                <div className={`answer-block ${panel.className}`}>
                  <div className="answer-block__heading">{panel.title}</div>
                  <div className="answer-block__body">
                    {(panelContent[panel.id] || []).map((block, index) => {
                      if (block.type === "list") {
                        return (
                          <ul key={`${panel.id}-list-${index}`}>
                            {block.items.map((item) => (
                              <li key={`${panel.id}-${item}`}>{item}</li>
                            ))}
                          </ul>
                        );
                      }

                      return <p key={`${panel.id}-p-${index}`}>{block.text}</p>;
                    })}
                  </div>
                </div>
              </div>
            ))}

            <div className="actions-row">
              <button className="action-btn action-btn--primary" id="copyBtn" type="button" onClick={copyReport}>
                Copy Report
              </button>
              <button className="action-btn" id="resetBtn" type="button" onClick={resetForm}>
                New Question
              </button>
              <button className="action-btn" id="shareBtn" type="button" onClick={shareReport}>
                Share
              </button>
            </div>

            <div className="follow-up-card card" aria-label="Ask a follow-up question">
              <div className="follow-up-card__header">
                <h3 className="follow-up-card__title">Ask The Robot Anything Else</h3>
                <p className="follow-up-card__meta">
                  Continue with doubts, feasibility questions, budget ideas, or implementation details.
                </p>
              </div>
              <form className="follow-up-form" onSubmit={handleFollowUpSubmit}>
                <div className="follow-up-form__field">
                  <textarea
                    id="followUpQuery"
                    maxLength={600}
                    placeholder={`Ask a follow-up about ${result.heading}, execution, cost, risks, or next steps...`}
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      if (errorMessage) {
                        setErrorMessage("");
                      }
                    }}
                    onKeyDown={(event) => {
                      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                        event.preventDefault();
                        void runAnalysis();
                      }
                    }}
                  />
                </div>
                <div className="follow-up-form__actions">
                  <button
                    className="action-btn action-btn--primary"
                    type="submit"
                    disabled={isLoading}
                  >
                    Ask Robot
                  </button>
                  <button
                    className={`action-btn ${isListening ? "action-btn--active" : ""}`}
                    type="button"
                    onClick={toggleVoiceAssistant}
                  >
                    {isListening ? "Stop Listening" : "Ask By Voice"}
                  </button>
                </div>
              </form>
            </div>
          </section>
        )}

          </div>
        </div>
      </main>

      <footer className="footer">
        Powered by <strong>Craftech 360</strong>
      </footer>

      <button
        className={`floating-mic ${isListening ? "floating-mic--active" : ""}`}
        type="button"
        aria-label={isListening ? "Stop voice assistant" : "Start voice assistant"}
        onClick={toggleVoiceAssistant}
      >
        <span className="floating-mic__ring" aria-hidden="true"></span>
        <span className="floating-mic__icon" aria-hidden="true">{isListening ? "..." : "Mic"}</span>
      </button>

      <div className={`toast ${toast ? "toast--show" : ""}`} id="toast" role="alert" aria-live="assertive">
        {toast || "Copied to clipboard"}
      </div>
    </>
  );
}

export default App;
