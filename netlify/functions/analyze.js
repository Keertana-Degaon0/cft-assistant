import { analyzeIdea } from "./_services.js";

export default async (request) => {
  const payload = await request.json().catch(() => ({}));
  const result = await analyzeIdea(payload);

  return Response.json(result.body, {
    status: result.statusCode,
    headers: result.headers,
  });
};
