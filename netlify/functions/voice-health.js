import { voiceHealth } from "./_services.js";

export default async () => {
  const result = voiceHealth();
  return Response.json(result.body, { status: result.statusCode });
};
