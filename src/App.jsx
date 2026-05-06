import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { CONFIG } from "./config";
import {
  APIError,
  analyseIdea,
  buildCopyText,
  getVoiceHealth,
  speakWithPremiumVoice,
  transcribeVoice,
} from "./lib/api";
import { matchProjects } from "../shared/projectLibrary";
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

  const feasibilityIntro =
    analysis.badge === "HIGH"
      ? "This looks highly feasible."
      : analysis.badge === "MEDIUM"
        ? "This looks feasible with a few important considerations."
        : "This idea needs careful planning before moving ahead.";

  const firstFeasibilitySentence = String(analysis.feasibility || "")
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean)[0] || "";

  return [
    `Here is your Craftech 360 voice brief for ${analysis.heading}.`,
    feasibilityIntro,
    `Feasibility score is ${analysis.feasibility_score} percent, with technology readiness at ${analysis.tech_score} percent and creative potential at ${analysis.creative_score} percent.`,
    firstFeasibilitySentence,
  ].join(" ");
}

function App() {
  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioPlayerRef = useRef(null);
  const finalTranscriptRef = useRef("");
  const autoSpeakRef = useRef(true);
  const greetedRef = useRef(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [activePanel, setActivePanel] = useState("feasibility");
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [toast, setToast] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [retryAfterSeconds, setRetryAfterSeconds] = useState(0);
  const [voiceStatus, setVoiceStatus] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [hasPremiumVoice, setHasPremiumVoice] = useState(false);

  const SpeechRecognition =
    typeof window !== "undefined"
      ? window.SpeechRecognition || window.webkitSpeechRecognition
      : null;
  const hasSpeechRecognition = Boolean(SpeechRecognition);
  const hasSpeechSynthesis =
    typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
  const hasVoiceAssistant = hasPremiumVoice || hasSpeechRecognition || hasSpeechSynthesis;

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
      recognitionRef.current?.stop?.();
      mediaRecorderRef.current?.stop?.();
      mediaStreamRef.current?.getTracks?.().forEach((track) => track.stop());
      audioPlayerRef.current?.pause?.();

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

  const relatedProjects = useMemo(() => matchProjects(query, 6), [query]);

  async function runAnalysis(overrideQuery = "") {
    if (isLoading) {
      return;
    }

    const trimmedQuery = (overrideQuery || query).trim();
    if (!trimmedQuery) {
      const textarea = document.getElementById("userQuery");
      textarea?.focus();
      setErrorMessage("Please enter your question or idea before running an analysis.");
      return;
    }

    setErrorMessage("");
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
      showError(error);
    } finally {
      setIsLoading(false);
    }
  }

  function showError(error) {
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

    setErrorMessage(message);
    setRetryAfterSeconds(
      error instanceof APIError && Number(error.raw?.retryAfterSeconds) > 0
        ? Number(error.raw.retryAfterSeconds)
        : 0
    );
    setVoiceStatus("");
  }

  function stopSpeaking() {
    audioPlayerRef.current?.pause?.();
    audioPlayerRef.current = null;

    if (hasSpeechSynthesis) {
      window.speechSynthesis.cancel();
    }

    setIsSpeaking(false);
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
        await new Promise(async (resolve) => {
          const audioBlob = await speakWithPremiumVoice(text);
          const audioUrl = URL.createObjectURL(audioBlob);
          const audio = new Audio(audioUrl);

          audioPlayerRef.current = audio;
          audio.onplay = () => {
            setIsSpeaking(true);
            setVoiceStatus("Craftech AI is speaking...");
          };
          audio.onended = () => {
            setIsSpeaking(false);
            setVoiceStatus("");
            audioPlayerRef.current = null;
            resolve();
          };
          audio.onerror = () => {
            setIsSpeaking(false);
            setVoiceStatus("Premium voice playback was interrupted.");
            audioPlayerRef.current = null;
            resolve();
          };

          try {
            await audio.play();
            premiumPlaybackWorked = true;
          } catch {
            setErrorMessage("Voice playback was blocked by the browser. Please use Chrome or Edge and allow site audio.");
            URL.revokeObjectURL(audioUrl);
            resolve();
          }
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

    await new Promise((resolve) => {
      const utterance = new window.SpeechSynthesisUtterance(text);
      utterance.rate = 1;
      utterance.pitch = 1.02;
      utterance.volume = 1;
      utterance.onstart = () => {
        setIsSpeaking(true);
        setVoiceStatus("Craftech AI is speaking...");
      };
      utterance.onend = () => {
        setIsSpeaking(false);
        setVoiceStatus("");
        resolve();
      };
      utterance.onerror = () => {
        setIsSpeaking(false);
        setVoiceStatus("Voice playback was interrupted.");
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

      window.speechSynthesis.speak(utterance);
    });
  }

  function stopVoiceCapture() {
    recognitionRef.current?.stop?.();
    mediaRecorderRef.current?.stop?.();
    mediaStreamRef.current?.getTracks?.().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    setIsListening(false);
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

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
    const recorder = new MediaRecorder(stream, { mimeType });

    mediaStreamRef.current = stream;
    mediaRecorderRef.current = recorder;
    audioChunksRef.current = [];

    recorder.onstart = () => {
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
      setIsListening(false);
      setVoiceStatus("");
      setErrorMessage("Voice capture did not complete. Please try again.");
    };

    recorder.onstop = async () => {
      setIsListening(false);
      mediaStreamRef.current?.getTracks?.().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      mediaRecorderRef.current = null;

      const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
      audioChunksRef.current = [];

      if (!audioBlob.size) {
        setVoiceStatus("");
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

  function startBrowserRecognition() {
    if (!hasSpeechRecognition) {
      setErrorMessage("Voice assistant is not supported in this browser. Please try Chrome or Edge.");
      return;
    }

    stopSpeaking();
    finalTranscriptRef.current = "";

    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      recognitionRef.current = recognition;
      setIsListening(true);
      setVoiceStatus("Listening... Ask your question now.");
      setErrorMessage("");
    };

    recognition.onresult = (event) => {
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
      setQuery(`${finalText}${interim}`.trim());
    };

    recognition.onerror = (event) => {
      setIsListening(false);
      recognitionRef.current = null;

      if (event.error === "not-allowed") {
        setErrorMessage("Microphone access was blocked. Please allow microphone permission and try again.");
      } else if (event.error !== "aborted") {
        setErrorMessage("Voice capture did not complete. Please try speaking again.");
      }

      setVoiceStatus("");
    };

    recognition.onend = () => {
      const spokenQuery = finalTranscriptRef.current.trim() || query.trim();

      setIsListening(false);
      recognitionRef.current = null;

      if (spokenQuery) {
        setVoiceStatus("Voice captured. Sending your request...");
        runAnalysis(spokenQuery);
      } else {
        setVoiceStatus("");
      }
    };

    recognition.start();
  }

  async function startVoiceAssistant() {
    setErrorMessage("");
    greetedRef.current = true;
    setVoiceStatus("Hi, how can I help with your idea today?");

    if (hasPremiumVoice) {
      try {
        const started = await startPremiumVoiceCapture();
        if (started) {
          return;
        }
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Microphone access was not available. Falling back to browser voice."
        );
      }
    }

    startBrowserRecognition();
  }

  function toggleVoiceAssistant() {
    if (isListening) {
      stopVoiceCapture();
      return;
    }

    startVoiceAssistant();
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
        <div className="hero__inner">
          <div className="hero__eyebrow">
            <span className="pulse-dot" aria-hidden="true"></span>
            AI Feasibility Engine
          </div>

          <h1 className="hero__title">
            Check <em>Feasibility</em>
            <br />
            <span className="hero__title-secondary">Unlock Ideas</span>
          </h1>

          <p className="hero__sub">
            Ask anything about your project, event, or idea. Our AI, trained on Craftech
            360&apos;s expertise across 17 cities and 800+ events, gives you real answers
            instantly.
          </p>

          <div className="stats-strip" role="list" aria-label="Company statistics">
            <div className="stat" role="listitem">
              <span className="stat__num">{CONFIG.company.stats.events}</span>
              <span className="stat__label">Events</span>
            </div>
            <div className="stat" role="listitem">
              <span className="stat__num">{CONFIG.company.stats.cities}</span>
              <span className="stat__label">Cities</span>
            </div>
            <div className="stat" role="listitem">
              <span className="stat__num">{CONFIG.company.stats.countries}</span>
              <span className="stat__label">Countries</span>
            </div>
            <div className="stat" role="listitem">
              <span className="stat__num">{CONFIG.company.stats.reach}</span>
              <span className="stat__label">Reached</span>
            </div>
          </div>
        </div>
      </section>

      <main className="main" id="mainContent">
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
                <strong>Request paused.</strong> {errorMessage}
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
          <div className="search-action-group">
            <div className="textarea-wrap">
              <textarea
                id="userQuery"
                maxLength={600}
                placeholder="e.g. Can we create an AR museum exhibit for a heritage brand in Mumbai? What would it take and is it feasible?"
                aria-describedby="charCount"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                    event.preventDefault();
                    runAnalysis();
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
              type="button"
              aria-label="Analyse feasibility and ideas"
              onClick={runAnalysis}
              disabled={isLoading}
            >
              <span className="submit-btn__icon" aria-hidden="true">
                {isLoading ? "..." : "AI"}
              </span>
              Analyse Feasibility &amp; Ideas
              <span className="submit-btn__hint">Ctrl+Enter</span>
            </button>
          </div>

          <span className="examples-label">Try an example -&gt;</span>
          <div className="chip-group" role="list" aria-label="Example prompts">
            {CONFIG.examples.map((example) => (
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

          <div className="project-scout" aria-label="Similar company projects">
            <div className="project-scout__header">
              <span className="field-label project-scout__label">Similar Company Projects</span>
            </div>
            <div className="project-scout__grid">
              {relatedProjects.map((project) => (
                <article className="project-card" key={project.slug}>
                  <h3 className="project-card__title">{project.title}</h3>
                  <p className="project-card__summary">{project.summary}</p>
                </article>
              ))}
            </div>
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
          </section>
        )}

        {history.length > 0 && (
          <aside className="history-section" id="historySection" aria-label="Recent checks">
            <h3 className="history-title">Recent Checks</h3>
            <ul className="history-list" id="historyList">
              {history.map((item, index) => (
                <li key={`${item.query}-${index}`}>
                  <button
                    className="history-item"
                    type="button"
                    onClick={() => restoreHistoryItem(item)}
                  >
                    <div
                      className="history-dot"
                      style={{
                        background:
                          item.badge === "HIGH"
                            ? "#00d4aa"
                            : item.badge === "MEDIUM"
                              ? "#ff6b2b"
                              : "#ff6060",
                      }}
                    ></div>
                    <span className="history-q">{item.query}</span>
                    <span className="history-badge">{item.badge}</span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </main>

      <footer className="footer">
        Powered by <strong>Craftech 360</strong> | Bengaluru &amp; Mumbai | 17
        Cities | 5 Countries
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
