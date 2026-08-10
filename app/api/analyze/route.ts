import "server-only";
import { runAnalysis } from "@/lib/pipeline/analyze";
import type { ManualAnalyzeOptions } from "@/lib/pipeline/types";

const ADMIN_SECRET_HEADER = "x-insight-ai-admin-secret";

function isAuthorized(req: Request): boolean {
  const expected = process.env.INSIGHT_AI_ADMIN_SECRET;
  if (!expected) return false;

  const provided = req.headers.get(ADMIN_SECRET_HEADER);
  return provided !== null && provided.length === expected.length && provided === expected;
}

function parseOptions(body: unknown): ManualAnalyzeOptions {
  if (typeof body !== "object" || body === null) return {};

  const { limit, articleIds } = body as Record<string, unknown>;

  const options: ManualAnalyzeOptions = {};
  if (typeof limit === "number" && Number.isFinite(limit) && limit > 0) {
    options.limit = Math.floor(limit);
  }
  if (Array.isArray(articleIds) && articleIds.every((id) => typeof id === "string")) {
    options.articleIds = articleIds;
  }
  return options;
}

export async function POST(req: Request): Promise<Response> {
  if (!isAuthorized(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown = {};
  try {
    const text = await req.text();
    body = text.length > 0 ? JSON.parse(text) : {};
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const summary = await runAnalysis(parseOptions(body));
    return Response.json(summary, { status: 200 });
  } catch {
    return Response.json({ error: "Analysis failed" }, { status: 500 });
  }
}
