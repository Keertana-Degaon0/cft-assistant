export default async () =>
  Response.json({
    ok: true,
    hasApiKey: Boolean(process.env.GROQ_API_KEY),
    hasPremiumVoice: Boolean(process.env.OPENAI_API_KEY),
  });
