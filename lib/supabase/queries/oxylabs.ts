import { createServiceRoleClient } from "../server-client";
import type { OxylabsSchedule, OxylabsScheduleRun, OxylabsScheduleRunInsert, Source } from "../types";

export async function getSchedules(): Promise<OxylabsSchedule[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.from("oxylabs_schedules").select("*");

  if (error) throw new Error(`getSchedules failed: ${error.message}`);
  return data;
}

export async function getScheduleBySourceId(sourceId: string): Promise<OxylabsSchedule | null> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("oxylabs_schedules")
    .select("*")
    .eq("source_id", sourceId)
    .maybeSingle();

  if (error) throw new Error(`getScheduleBySourceId failed: ${error.message}`);
  return data;
}

export async function upsertSchedule(sourceId: string, oxylabsScheduleId: string): Promise<OxylabsSchedule> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("oxylabs_schedules")
    .upsert(
      {
        source_id: sourceId,
        oxylabs_schedule_id: oxylabsScheduleId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "source_id" },
    )
    .select()
    .single();

  if (error) throw new Error(`upsertSchedule failed: ${error.message}`);
  return data;
}

export async function setScheduleActive(id: string, isActive: boolean): Promise<void> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("oxylabs_schedules")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(`setScheduleActive failed: ${error.message}`);
}

export async function insertScheduleRun(input: OxylabsScheduleRunInsert): Promise<OxylabsScheduleRun> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.from("oxylabs_schedule_runs").insert(input).select().single();

  if (error) throw new Error(`insertScheduleRun failed: ${error.message}`);
  return data;
}

export async function markRunProcessed(id: string): Promise<void> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("oxylabs_schedule_runs")
    .update({ processed_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(`markRunProcessed failed: ${error.message}`);
}

export async function getRunByJobId(scheduleId: string, oxylabsJobId: string): Promise<OxylabsScheduleRun | null> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("oxylabs_schedule_runs")
    .select("*")
    .eq("schedule_id", scheduleId)
    .eq("oxylabs_job_id", oxylabsJobId)
    .maybeSingle();

  if (error) throw new Error(`getRunByJobId failed: ${error.message}`);
  return data;
}

export async function getActiveSchedulesWithSource(): Promise<(OxylabsSchedule & { source: Source })[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("oxylabs_schedules")
    .select<"*, source:sources(*)", OxylabsSchedule & { source: Source }>("*, source:sources(*)")
    .eq("is_active", true);

  if (error) throw new Error(`getActiveSchedulesWithSource failed: ${error.message}`);
  return data;
}

export async function getRecentRuns(limit = 50): Promise<OxylabsScheduleRun[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("oxylabs_schedule_runs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`getRecentRuns failed: ${error.message}`);
  return data;
}
