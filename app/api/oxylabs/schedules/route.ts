import "server-only";
import { syncSchedules } from "@/lib/pipeline/sync-schedules";
import { getSchedules } from "@/lib/supabase/queries/oxylabs";

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
    const summary = await syncSchedules();
    return Response.json(summary, { status: 200 });
  } catch {
    return Response.json({ error: "Schedule sync failed" }, { status: 500 });
  }
}

export async function GET(): Promise<Response> {
  try {
    const schedules = await getSchedules();
    return Response.json({ schedules }, { status: 200 });
  } catch {
    return Response.json({ error: "Failed to load schedules" }, { status: 500 });
  }
}
