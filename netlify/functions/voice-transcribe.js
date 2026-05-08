import { transcribeAudio } from "./_services.js";

export default async (request) => {
  const payload = await request.json().catch(() => ({}));
  const result = await transcribeAudio(payload);

  return Response.json(result.body, {
    status: result.statusCode,
    headers: result.headers,
  });
};
