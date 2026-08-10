import "server-only";
import { getRecentRuns } from "@/lib/supabase/queries/oxylabs";

export async function GET(): Promise<Response> {
  try {
    const runs = await getRecentRuns();
    return Response.json({ runs }, { status: 200 });
  } catch {
    return Response.json({ error: "Failed to load runs" }, { status: 500 });
  }
}
