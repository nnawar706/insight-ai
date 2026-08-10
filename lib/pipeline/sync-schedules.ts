import "server-only";
import { getActiveSources } from "../supabase/queries/sources";
import { getSchedules, upsertSchedule } from "../supabase/queries/oxylabs";
import { insertLog } from "../supabase/queries/logs";
import { createSchedule, deactivateSchedule, listOxylabsScheduleIds, OxylabsSchedulerError } from "../scraping/oxylabs-scheduler";
import type { Json } from "../supabase/types";
import type { SyncSchedulesSummary } from "./types";

/**
 * Creates one Oxylabs schedule per active source that doesn't already have one, then
 * deactivates any Oxylabs-side schedule not present in `oxylabs_schedules` (AGENTS.md §18 —
 * orphan schedule deactivation, so deleted/re-created source rows don't leave hourly-billed
 * schedules running forever).
 */
export async function syncSchedules(): Promise<SyncSchedulesSummary> {
  const startedAt = Date.now();
  console.info("[oxylabs-sync] sync started");

  const summary: SyncSchedulesSummary = {
    status: "ok",
    activeSourcesChecked: 0,
    schedulesCreated: 0,
    schedulesSkipped: 0,
    orphansDeactivated: 0,
    durationMs: 0,
  };

  try {
    const activeSources = await getActiveSources();
    const existingBySourceId = new Map((await getSchedules()).map((s) => [s.source_id, s]));

    summary.activeSourcesChecked = activeSources.length;
    console.info(`[oxylabs-sync] ${activeSources.length} active source(s) checked`);

    for (const source of activeSources) {
      if (existingBySourceId.has(source.id)) {
        summary.schedulesSkipped += 1;
        console.info(`[oxylabs-sync] ${source.name}: schedule already exists, skipped`);
        continue;
      }

      try {
        const scheduleId = await createSchedule(source);
        await upsertSchedule(source.id, scheduleId);
        summary.schedulesCreated += 1;
        console.info(`[oxylabs-sync] ${source.name}: schedule created (${scheduleId})`);
      } catch (err) {
        const message = err instanceof OxylabsSchedulerError || err instanceof Error ? err.message : "unknown error";
        console.error(`[oxylabs-sync] ${source.name}: failed to create schedule: ${message}`);
      }
    }

    const oxylabsIds = await listOxylabsScheduleIds();
    const storedIds = new Set((await getSchedules()).map((s) => s.oxylabs_schedule_id));
    const orphanIds = oxylabsIds.filter((id) => !storedIds.has(id));

    console.info(`[oxylabs-sync] ${oxylabsIds.length} Oxylabs-side schedule(s) found, ${orphanIds.length} orphan(s)`);

    for (const orphanId of orphanIds) {
      try {
        await deactivateSchedule(orphanId);
        summary.orphansDeactivated += 1;
        console.info(`[oxylabs-sync] deactivated orphan schedule ${orphanId}`);
      } catch (err) {
        const message = err instanceof OxylabsSchedulerError || err instanceof Error ? err.message : "unknown error";
        console.error(`[oxylabs-sync] failed to deactivate orphan schedule ${orphanId}: ${message}`);
      }
    }
  } catch (err) {
    summary.status = "failed";
    console.error(`[oxylabs-sync] sync run failed: ${(err as Error).message}`);
  }

  summary.durationMs = Date.now() - startedAt;
  console.info("[oxylabs-sync] sync completed", summary);

  try {
    await insertLog({
      level: "info",
      event: "oxylabs-sync.summary",
      message: `Schedule sync completed: ${summary.schedulesCreated} created, ${summary.schedulesSkipped} skipped, ${summary.orphansDeactivated} orphans deactivated`,
      context: summary as unknown as Json,
    });
  } catch (err) {
    console.error(`[oxylabs-sync] failed to persist run summary to logs: ${(err as Error).message}`);
  }

  return summary;
}
