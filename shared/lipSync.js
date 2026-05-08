const LETTER_TO_VISEME = [
  { regex: /^(b|m|p)/, viseme: "bmp" },
  { regex: /^(f|v)/, viseme: "fv" },
  { regex: /^(l|t|d|n|s|z|r)/, viseme: "wide" },
  { regex: /^(o|u|w|oo)/, viseme: "round" },
  { regex: /^(e|i|y)/, viseme: "smile" },
  { regex: /^(a|h|k|g|q|c|x|j)/, viseme: "open" },
];

function tokenizeSpeech(text) {
  return String(text || "")
    .match(/[a-z']+|[.,!?;:]/gi) || [];
}

function normalizeWord(token) {
  return token.toLowerCase().replace(/[^a-z']/g, "");
}

function isPauseToken(token) {
  return /^[.,!?;:]$/.test(token);
}

function splitWordIntoChunks(word) {
  const chunks = [];
  let remaining = normalizeWord(word);

  while (remaining) {
    const digraph = remaining.slice(0, 2);

    if (/^(th|sh|ch|ph|wh|oo|ee|ea|ai|ay|ow|ou)/.test(digraph)) {
      chunks.push(digraph);
      remaining = remaining.slice(2);
      continue;
    }

    chunks.push(remaining[0]);
    remaining = remaining.slice(1);
  }

  return chunks;
}

function chunkToViseme(chunk) {
  const match = LETTER_TO_VISEME.find(({ regex }) => regex.test(chunk));
  return match?.viseme || "rest";
}

export function buildLipSyncTrack(text) {
  const tokens = tokenizeSpeech(text);
  const speechTokens = tokens.filter((token) => !isPauseToken(token) && normalizeWord(token));
  const baseDurationMs = Math.max(1400, speechTokens.length * 340);
  const cues = [];

  let cursor = 0;
  const totalWeight = tokens.reduce((sum, token) => {
    if (isPauseToken(token)) {
      return sum + 0.55;
    }

    const chunks = splitWordIntoChunks(token);
    return sum + Math.max(1, chunks.length * 0.9);
  }, 0) || 1;

  tokens.forEach((token) => {
    if (isPauseToken(token)) {
      cursor += 0.55 / totalWeight;
      return;
    }

    const chunks = splitWordIntoChunks(token);
    const span = Math.max(1, chunks.length * 0.9) / totalWeight;
    const chunkWidth = span / Math.max(1, chunks.length);

    chunks.forEach((chunk, index) => {
      const start = cursor + chunkWidth * index;
      const end = start + chunkWidth;

      cues.push({
        start,
        end,
        viseme: chunkToViseme(chunk),
      });
    });

    cursor += span;
  });

  return {
    estimatedDurationMs: baseDurationMs,
    cues,
  };
}

export function pickVisemeForProgress(cues, progress) {
  if (!Array.isArray(cues) || !cues.length) {
    return "rest";
  }

  const boundedProgress = Math.max(0, Math.min(1, progress));
  const match = cues.find((cue) => boundedProgress >= cue.start && boundedProgress <= cue.end);
  return match?.viseme || "rest";
}
