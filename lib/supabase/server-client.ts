import "server-only";
import { createClient, type WebSocketLikeConstructor } from "@supabase/supabase-js";
import WebSocket from "ws";
import type { Database } from "./types";

export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Missing Supabase env vars (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
  }

  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false },
    // Node 20 (this project's runtime) has no global WebSocket — supabase-js
    // always constructs a realtime client internally and throws without one.
    realtime: { transport: WebSocket as unknown as WebSocketLikeConstructor },
  });
}
