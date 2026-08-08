import { createServiceRoleClient } from "../server-client";
import type { Log, LogInsert } from "../types";

export async function insertLog(entry: LogInsert): Promise<void> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("logs").insert(entry);

  if (error) throw new Error(`insertLog failed: ${error.message}`);
}

export async function getRecentLogs(limit = 50): Promise<Log[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`getRecentLogs failed: ${error.message}`);
  return data;
}
