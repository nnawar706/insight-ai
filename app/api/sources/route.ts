import "server-only";
import { getActiveSources } from "@/lib/supabase/queries/sources";

export async function GET(): Promise<Response> {
  try {
    const sources = await getActiveSources();
    const payload = sources.map((s) => ({ id: s.id, name: s.name, listing_url: s.listing_url }));
    return Response.json({ sources: payload }, { status: 200 });
  } catch {
    return Response.json({ error: "Failed to load sources" }, { status: 500 });
  }
}
