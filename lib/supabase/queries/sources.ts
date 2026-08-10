import { createServiceRoleClient } from "../server-client";
import type { Source } from "../types";

export async function getActiveSources(): Promise<Source[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.from("sources").select("*").eq("is_active", true).order("name");

  if (error) throw new Error(`getActiveSources failed: ${error.message}`);
  return data;
}

export async function getAllSources(): Promise<Source[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.from("sources").select("*").order("name");

  if (error) throw new Error(`getAllSources failed: ${error.message}`);
  return data;
}

export async function getSourceById(id: string): Promise<Source | null> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.from("sources").select("*").eq("id", id).maybeSingle();

  if (error) throw new Error(`getSourceById failed: ${error.message}`);
  return data;
}
