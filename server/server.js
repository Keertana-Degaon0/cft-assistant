import dotenv from "dotenv";
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { buildProjectContext } from "../shared/projectLibrary.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.resolve(__dirname, "..", ".env"),
});

const app = express();
const port = Number(process.env.PORT || 3001);
const distPath = path.resolve(__dirname, "..", "dist");

app.use(express.json({ limit: "1mb" }));

function buildSystemPrompt() {
  return `
You are the AI assistant for Craftech 360, a leading experiential design and technology company.

COMPANY PROFILE:
- Name: Craftech 360
- Tagline: Crafting Immersive Experiences
- Description: Craftech 360 specializes in crafting immersive experiences that connect brands with their audiences through innovative technology and creative design.
- Scale: 800+ events, 17 cities across 5 countries, 25M+ reached
- Locations: Bengaluru and Mumbai
- Mission: Connecting brands with audiences through innovative technology and creative design

CORE CAPABILITIES:
- Museum and heritage exhibits with interactive digital and AR/VR storytelling
- Experiential zones for retail, mall, and theme environments
- Corporate events and conferences at large scale, including 5000+ attendees
- Brand activations focused on immersive brand storytelling
- Technology integration across AR, VR, holographics, AI, projection mapping, and interactive installations
- Creative design through spatial design, narratives, and multi-sensory environments

YOUR ROLE:
When a user asks about any idea, concept, project, or question related to events, experiences, technology, or brand activations, respond with a comprehensive feasibility analysis and creative ideas from Craftech 360's perspective.

REFERENCE PROJECTS:
You may use the related public project titles and summaries provided in the user message as inspiration for patterns, naming, formats, and precedent. Do not mention code, repositories, or implementation files unless the user asks.

RESPONSE FORMAT - return ONLY a valid JSON object:
{
  "heading": "Short punchy title for this analysis (max 8 words)",
  "category": "Best matching category from: Museum & Exhibit, Experiential Zone, Corporate Event, Brand Activation, Tech & Innovation",
  "feasibility_score": 85,
  "tech_score": 78,
  "creative_score": 90,
  "impact_score": 88,
  "badge": "HIGH",
  "feasibility": "3-4 detailed paragraphs on feasibility. Reference Craftech 360's actual capabilities, past scale, and expert perspective.",
  "how_it_works": "3-4 paragraphs explaining the execution plan, technology stack, design approach, timeline, and delivery phases.",
  "challenges": "- First challenge\\n- Second challenge\\n- Third challenge",
  "ideas": "- First idea\\n- Second idea\\n- Third idea"
}

RULES:
- badge must be exactly one of: HIGH, MEDIUM, LOW
- All score fields must be integers between 0 and 100
- challenges and ideas must use lines that start with "- "
- Include every key shown above exactly once
- Return compact valid JSON only
- Escape line breaks inside JSON strings as \\n
- Return ONLY the JSON object with no markdown and no extra text
- Be specific, expert, practical, and confident
`.trim();
}

function clampScore(value) {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return 70;
  }
  return Math.min(100, Math.max(0, parsed));
}

function validateResult(obj) {
  return {
    heading: String(obj.heading || "Feasibility Analysis"),
    category: String(obj.category || "General"),
    feasibility_score: clampScore(obj.feasibility_score),
    tech_score: clampScore(obj.tech_score),
    creative_score: clampScore(obj.creative_score),
    impact_score: clampScore(obj.impact_score),
    badge: ["HIGH", "MEDIUM", "LOW"].includes(obj.badge) ? obj.badge : "MEDIUM",
    feasibility: String(obj.feasibility || ""),
    how_it_works: String(obj.how_it_works || ""),
    challenges: String(obj.challenges || ""),
    ideas: String(obj.ideas || ""),
  };
}

function parseModelResponse(data) {
  const rawText = data?.choices?.[0]?.message?.content;

  if (typeof rawText !== "string") {
    throw new Error("Unexpected Groq response structure.");
  }

  const cleaned = rawText
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  if (!cleaned) {
    throw new Error("Empty response from API.");
  }

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    const extracted =
      firstBrace >= 0 && lastBrace > firstBrace
        ? cleaned.slice(firstBrace, lastBrace + 1)
        : "";

    if (!extracted) {
      throw new Error("Could not parse JSON from API response.");
    }

    try {
      parsed = JSON.parse(extracted);
    } catch {
      throw new Error("Could not parse JSON from API response.");
    }
  }

  return validateResult(parsed);
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getJsonErrorMessage(errorBody, fallbackMessage) {
  try {
    const parsedError = JSON.parse(errorBody);
    const providerMessage = parsedError?.error?.message;
    return typeof providerMessage === "string" && providerMessage.trim()
      ? providerMessage
      : fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}

async function requestGroq({ apiKey, userMessage }) {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        temperature: 0.2,
        max_tokens: 1500,
        messages: [
          {
            role: "system",
            content: buildSystemPrompt(),
          },
          {
            role: "user",
            content: userMessage,
          },
        ],
      }),
    });

    if (response.ok) {
      return response;
    }

    if (response.status === 429 && attempt < maxAttempts) {
      const retryAfter = Number(response.headers.get("retry-after"));
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : attempt * 1500;

      await delay(waitMs);
      continue;
    }

    return response;
  }

  throw new Error("Groq request retry loop ended unexpectedly.");
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    hasApiKey: Boolean(process.env.GROQ_API_KEY),
    hasPremiumVoice: Boolean(process.env.OPENAI_API_KEY),
  });
});

app.post("/api/analyze", async (req, res) => {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "Missing GROQ_API_KEY in server environment.",
    });
  }

  const query = String(req.body?.query || "").trim();
  const category = String(req.body?.category || "All");

  if (!query) {
    return res.status(400).json({
      error: "Query cannot be empty.",
    });
  }

  const userMessage = [
    category && category !== "All"
      ? `Category filter: ${category}`
      : "Category: Detect automatically",
    `User question: ${query}`,
    "Related public company projects for inspiration:",
    buildProjectContext(query, 8),
  ].join("\n");

  try {
    const response = await requestGroq({ apiKey, userMessage });

    if (!response.ok) {
      const errorBody = await response.text();
      const retryAfter = Number(response.headers.get("retry-after"));
      let providerMessage = `Groq request failed: ${errorBody}`;

      try {
        const parsedError = JSON.parse(errorBody);
        const groqError = parsedError?.error;

        if (groqError?.code === "json_validate_failed") {
          providerMessage =
            "Groq returned an invalid structured response. Please try again.";
        } else if (typeof groqError?.message === "string" && groqError.message.trim()) {
          providerMessage = `Groq request failed: ${groqError.message}`;
        }
      } catch {
        // Keep the raw fallback message when the provider error is not JSON.
      }

      return res.status(response.status).json({
        error:
          response.status === 429
            ? `Groq is receiving too many requests right now.${retryAfter ? ` Please retry in about ${retryAfter} seconds.` : " Please wait a moment and try again."}`
            : providerMessage,
        retryAfterSeconds:
          response.status === 429 && Number.isFinite(retryAfter) && retryAfter > 0
            ? retryAfter
            : null,
      });
    }

    const data = await response.json();
    const result = parseModelResponse(data);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown server error.",
    });
  }
});

app.get("/api/voice/health", (_req, res) => {
  res.json({
    ok: true,
    hasPremiumVoice: Boolean(process.env.OPENAI_API_KEY),
  });
});

app.post("/api/voice/transcribe", async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return res.status(503).json({
      error: "Premium voice transcription is not configured on the server.",
    });
  }

  const audioBase64 = String(req.body?.audioBase64 || "");
  const mimeType = String(req.body?.mimeType || "audio/webm");

  if (!audioBase64) {
    return res.status(400).json({
      error: "Audio payload is required.",
    });
  }

  try {
    const buffer = Buffer.from(audioBase64, "base64");
    const formData = new FormData();
    const extension = mimeType.includes("wav") ? "wav" : "webm";

    formData.append(
      "file",
      new Blob([buffer], { type: mimeType }),
      `voice-input.${extension}`
    );
    formData.append("model", "gpt-4o-mini-transcribe");
    formData.append("language", "en");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return res.status(response.status).json({
        error: getJsonErrorMessage(errorBody, "Premium transcription failed."),
      });
    }

    const data = await response.json();
    return res.json({
      text: String(data?.text || "").trim(),
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown transcription error.",
    });
  }
});

app.post("/api/voice/speak", async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return res.status(503).json({
      error: "Premium voice playback is not configured on the server.",
    });
  }

  const text = String(req.body?.text || "").trim();

  if (!text) {
    return res.status(400).json({
      error: "Text is required for speech generation.",
    });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini-tts",
        voice: "marin",
        input: text.slice(0, 4096),
        instructions: "Speak in a warm, polished, natural assistant tone. Sound calm, premium, and confident, with clear pacing, short pauses between ideas, and a conversational delivery that feels human rather than robotic.",
        response_format: "mp3",
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return res.status(response.status).json({
        error: getJsonErrorMessage(errorBody, "Premium speech generation failed."),
      });
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    return res.send(audioBuffer);
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown speech generation error.",
    });
  }
});

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));

  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) {
      return next();
    }

    return res.sendFile(path.join(distPath, "index.html"));
  });
}

app.listen(port, () => {
  console.log(`Craftech backend running on http://localhost:${port}`);
});
