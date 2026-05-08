export class APIError extends Error {
  constructor(message, statusCode = null, raw = null) {
    super(message);
    this.name = "APIError";
    this.statusCode = statusCode;
    this.raw = raw;
  }
}

const API_CANDIDATES = Object.freeze({
  analyze: ["/api/analyze", "/.netlify/functions/analyze"],
  voiceHealth: ["/api/voice/health", "/.netlify/functions/voice-health"],
  voiceTranscribe: ["/api/voice/transcribe", "/.netlify/functions/voice-transcribe"],
  voiceSpeak: ["/api/voice/speak", "/.netlify/functions/voice-speak"],
  voiceLipSync: ["/api/voice/lipsync", "/.netlify/functions/voice-lipsync"],
});

function isValidAnalysisResult(data) {
  if (!data || typeof data !== "object") {
    return false;
  }

  const requiredTextFields = [
    "heading",
    "category",
    "badge",
    "feasibility",
    "how_it_works",
    "challenges",
    "ideas",
  ];

  const requiredScoreFields = [
    "feasibility_score",
    "tech_score",
    "creative_score",
    "impact_score",
  ];

  const hasAllTextFields = requiredTextFields.every(
    (field) => typeof data[field] === "string" && data[field].trim()
  );

  const hasAllScores = requiredScoreFields.every(
    (field) => Number.isFinite(Number(data[field]))
  );

  return hasAllTextFields && hasAllScores;
}

function shouldTryNextEndpoint(response, data) {
  if (!response) {
    return true;
  }

  if ([404, 405].includes(response.status)) {
    return true;
  }

  const contentType = response.headers.get("content-type") || "";
  const looksLikeHtml = contentType.includes("text/html");

  if (looksLikeHtml && !response.ok) {
    return true;
  }

  if (response.ok && (!data || typeof data !== "object")) {
    return true;
  }

  return false;
}

async function requestJsonWithFallbacks(urls, options) {
  let lastResponse = null;
  let lastData = null;
  let lastError = null;

  for (const url of urls) {
    try {
      const response = await fetch(url, options);
      const data = await response.json().catch(() => ({}));

      if (shouldTryNextEndpoint(response, data) && url !== urls[urls.length - 1]) {
        lastResponse = response;
        lastData = data;
        continue;
      }

      return { response, data };
    } catch (error) {
      lastError = error;

      if (url === urls[urls.length - 1]) {
        throw error;
      }
    }
  }

  if (lastResponse) {
    return { response: lastResponse, data: lastData };
  }

  throw lastError || new Error("API request failed before a response was received.");
}

export async function analyseIdea({ query, category }) {
  if (!query || !query.trim()) {
    throw new Error("Query cannot be empty.");
  }

  const { response, data } = await requestJsonWithFallbacks(
    API_CANDIDATES.analyze,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: query.trim(),
        category,
      }),
    }
  );

  if (!response.ok) {
    throw new APIError(
      data?.error || `API request failed (${response.status}).`,
      response.status,
      data
    );
  }

  if (!isValidAnalysisResult(data)) {
    throw new APIError(
      "The server returned an incomplete analysis. Please check the deployed API route or try again.",
      response.status,
      data
    );
  }

  return data;
}

export async function getVoiceHealth() {
  const { response, data } = await requestJsonWithFallbacks(
    API_CANDIDATES.voiceHealth,
    { method: "GET" }
  );

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
  const { response, data } = await requestJsonWithFallbacks(
    API_CANDIDATES.voiceTranscribe,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        audioBase64,
        mimeType,
      }),
    }
  );

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
  let lastResponse = null;

  for (const url of API_CANDIDATES.voiceSpeak) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    }).catch(() => null);

    if (!response) {
      continue;
    }

    if ([404, 405].includes(response.status) && url !== API_CANDIDATES.voiceSpeak.at(-1)) {
      continue;
    }

    lastResponse = response;
    break;
  }

  if (!lastResponse) {
    throw new APIError("Premium speech request could not reach the server.");
  }

  if (!lastResponse.ok) {
    const data = await lastResponse.json().catch(() => ({}));
    throw new APIError(
      data?.error || `Premium speech failed (${lastResponse.status}).`,
      lastResponse.status,
      data
    );
  }

  return lastResponse.blob();
}

export async function speakWithLipSync(text) {
  const { response, data } = await requestJsonWithFallbacks(
    API_CANDIDATES.voiceLipSync,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    }
  );

  if (!response.ok) {
    throw new APIError(
      data?.error || `Premium lip sync failed (${response.status}).`,
      response.status,
      data
    );
  }

  if (!data?.audioBase64 || !Array.isArray(data?.cues)) {
    throw new APIError(
      "The server returned incomplete lip sync data.",
      response.status,
      data
    );
  }

  return data;
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
