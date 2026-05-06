import { CONFIG } from "../config";

export class APIError extends Error {
  constructor(message, statusCode = null, raw = null) {
    super(message);
    this.name = "APIError";
    this.statusCode = statusCode;
    this.raw = raw;
  }
}

export async function analyseIdea({ query, category }) {
  if (!query || !query.trim()) {
    throw new Error("Query cannot be empty.");
  }

  const response = await fetch(CONFIG.api.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: query.trim(),
      category,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new APIError(
      data?.error || `API request failed (${response.status}).`,
      response.status,
      data
    );
  }

  return data;
}

export async function getVoiceHealth() {
  const response = await fetch("/api/voice/health");
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new APIError(
      data?.error || `Voice health request failed (${response.status}).`,
      response.status,
      data
    );
  }

  return data;
}

export async function transcribeVoice({ audioBase64, mimeType }) {
  const response = await fetch("/api/voice/transcribe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      audioBase64,
      mimeType,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new APIError(
      data?.error || `Voice transcription failed (${response.status}).`,
      response.status,
      data
    );
  }

  return data;
}

export async function speakWithPremiumVoice(text) {
  const response = await fetch("/api/voice/speak", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new APIError(
      data?.error || `Premium speech failed (${response.status}).`,
      response.status,
      data
    );
  }

  return response.blob();
}

export function buildCopyText({ query, category, result }) {
  const divider = "=".repeat(45);
  return [
    "CRAFTECH 360 - FEASIBILITY ANALYSIS",
    divider,
    `Query    : ${query}`,
    `Category : ${category}`,
    `Verdict  : ${result.badge} FEASIBILITY`,
    `Scores   : Feasibility ${result.feasibility_score}% | Tech ${result.tech_score}% | Creative ${result.creative_score}% | Impact ${result.impact_score}%`,
    "",
    "-- FEASIBILITY --",
    result.feasibility,
    "",
    "-- HOW IT WORKS --",
    result.how_it_works,
    "",
    "-- CHALLENGES --",
    result.challenges,
    "",
    "-- IDEAS --",
    result.ideas,
    "",
    divider,
    "Powered by Craftech 360 x Claude AI",
    "Bengaluru & Mumbai | 17 Cities | 5 Countries",
  ].join("\n");
}
