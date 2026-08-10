import "server-only";
import { processScheduledResults } from "@/lib/pipeline/process-scheduled";

const ADMIN_SECRET_HEADER = "x-insight-ai-admin-secret";

function isAuthorized(req: Request): boolean {
  const expected = process.env.INSIGHT_AI_ADMIN_SECRET;
  if (!expected) return false;

  const provided = req.headers.get(ADMIN_SECRET_HEADER);
  return provided !== null && provided.length === expected.length && provided === expected;
}

export async function POST(req: Request): Promise<Response> {
  if (!isAuthorized(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await processScheduledResults();
    return Response.json(summary, { status: 200 });
  } catch {
    return Response.json({ error: "Scheduled processing failed" }, { status: 500 });
  }
}
