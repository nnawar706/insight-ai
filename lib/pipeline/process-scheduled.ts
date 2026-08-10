import "server-only";
import { getActiveSchedulesWithSource, getRunByJobId, insertScheduleRun, markRunProcessed } from "../supabase/queries/oxylabs";
import { insertLog } from "../supabase/queries/logs";
import { fetchJobResultHtml, getScheduleRuns, OxylabsSchedulerError } from "../scraping/oxylabs-scheduler";
import { DEFAULT_LIMIT_PER_SOURCE, mergeRejectionReasons, runSourcePipeline } from "./scrape";
import type { Json } from "../supabase/types";
import type { ProcessScheduledSummary } from "./types";

const DONE_STATUS = "done";

/**
 * Runs the shared scrape-to-insert pipeline (§9) against completed Oxylabs Scheduler job
 * results instead of a live homepage fetch. Reused by both the manual process route and the
 * Vercel Cron pipeline route. Dedupes against `oxylabs_schedule_runs` so calling this
 * repeatedly never reprocesses the same job twice.
 */
export async function processScheduledResults(): Promise<ProcessScheduledSummary> {
  const startedAt = Date.now();
  console.info("[oxylabs-process] processing started");

  const summary: ProcessScheduledSummary = {
    status: "ok",
    schedulesChecked: 0,
    runsFound: 0,
    runsAlreadyProcessed: 0,
    runsProcessed: 0,
    candidatesFound: 0,
    candidatesRejected: 0,
    duplicatesSkipped: 0,
    detailPagesScraped: 0,
    articlesInserted: 0,
    articlesRejected: 0,
    articlesFailed: 0,
    durationMs: 0,
    rejectionReasons: {},
  };

  try {
    const schedules = await getActiveSchedulesWithSource();
    summary.schedulesChecked = schedules.length;
    console.info(`[oxylabs-process] ${schedules.length} active schedule(s) checked`);

    for (const schedule of schedules) {
      try {
        const runs = await getScheduleRuns(schedule.oxylabs_schedule_id);
        const doneJobs = runs.flatMap((run) => run.jobs.filter((job) => job.resultStatus === DONE_STATUS && job.id.length > 0));
        summary.runsFound += doneJobs.length;
        console.info(`[oxylabs-process] ${schedule.source.name}: ${doneJobs.length} done job(s) found`);

        for (const job of doneJobs) {
          const existingRun = await getRunByJobId(schedule.id, job.id);
          if (existingRun?.processed_at) {
            summary.runsAlreadyProcessed += 1;
            continue;
          }

          const runRow =
            existingRun ??
            (await insertScheduleRun({
              schedule_id: schedule.id,
              oxylabs_job_id: job.id,
              result_status: job.resultStatus,
            }));

          try {
            const html = await fetchJobResultHtml(job.id);
            const result = await runSourcePipeline(schedule.source, html, DEFAULT_LIMIT_PER_SOURCE);

            summary.candidatesFound += result.candidatesFound;
            summary.candidatesRejected += result.candidatesRejected;
            summary.duplicatesSkipped += result.duplicatesSkipped;
            summary.detailPagesScraped += result.detailPagesScraped;
            summary.articlesInserted += result.articlesInserted;
            summary.articlesRejected += result.articlesRejected;
            summary.articlesFailed += result.articlesFailed;
            mergeRejectionReasons(summary.rejectionReasons, result.rejectionReasons);

            await markRunProcessed(runRow.id);
            summary.runsProcessed += 1;
            console.info(`[oxylabs-process] ${schedule.source.name}: job ${job.id} processed (${result.articlesInserted} inserted)`);
          } catch (err) {
            const message = err instanceof OxylabsSchedulerError || err instanceof Error ? err.message : "unknown error";
            console.error(`[oxylabs-process] ${schedule.source.name}: job ${job.id} failed: ${message}`);
          }
        }
      } catch (err) {
        const message = err instanceof OxylabsSchedulerError || err instanceof Error ? err.message : "unknown error";
        console.error(`[oxylabs-process] ${schedule.source.name}: schedule-level error: ${message}`);
      }
    }
  } catch (err) {
    summary.status = "failed";
    console.error(`[oxylabs-process] processing run failed: ${(err as Error).message}`);
  }

  summary.durationMs = Date.now() - startedAt;
  console.info("[oxylabs-process] processing completed", summary);

  try {
    await insertLog({
      level: "info",
      event: "scheduled-scrape.summary",
      message: `Scheduled processing completed: ${summary.articlesInserted} inserted, ${summary.runsProcessed} runs processed`,
      context: summary as unknown as Json,
    });
  } catch (err) {
    console.error(`[oxylabs-process] failed to persist run summary to logs: ${(err as Error).message}`);
  }

  return summary;
}
