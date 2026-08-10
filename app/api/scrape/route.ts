import "server-only";
import { runManualScrape } from "@/lib/pipeline/scrape";
import type { ManualScrapeOptions } from "@/lib/pipeline/types";

const ADMIN_SECRET_HEADER = "x-insight-ai-admin-secret";

function isAuthorized(req: Request): boolean {
  const expected = process.env.INSIGHT_AI_ADMIN_SECRET;
  if (!expected) return false;

  const provided = req.headers.get(ADMIN_SECRET_HEADER);
  return provided !== null && provided.length === expected.length && provided === expected;
}

function parseOptions(body: unknown): ManualScrapeOptions {
  if (typeof body !== "object" || body === null) return {};

  const { sources, limitPerSource } = body as Record<string, unknown>;

  const options: ManualScrapeOptions = {};
  if (Array.isArray(sources) && sources.every((s) => typeof s === "string")) {
    options.sources = sources;
  }
  if (typeof limitPerSource === "number" && Number.isFinite(limitPerSource) && limitPerSource > 0) {
    options.limitPerSource = Math.floor(limitPerSource);
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
    const summary = await runManualScrape(parseOptions(body));
    return Response.json(summary, { status: 200 });
  } catch {
    return Response.json({ error: "Scrape failed" }, { status: 500 });
  }
}
