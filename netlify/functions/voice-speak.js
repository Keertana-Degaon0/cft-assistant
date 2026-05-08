import { generateSpeech } from "./_services.js";

export default async (request) => {
  const payload = await request.json().catch(() => ({}));
  const result = await generateSpeech(payload);

  if (result.isBinary) {
    return new Response(result.body, {
      status: result.statusCode,
      headers: {
        ...result.headers,
        "Content-Transfer-Encoding": "base64",
      },
    });
  }

  return Response.json(result.body, {
    status: result.statusCode,
    headers: result.headers,
  });
};
