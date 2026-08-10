import "server-only";
import { processScheduledResults } from "@/lib/pipeline/process-scheduled";
import { DEFAULT_BATCH_SIZE, runAnalysis } from "@/lib/pipeline/analyze";
import type { CronPipelineSummary, ProcessScheduledSummary } from "@/lib/pipeline/types";

export const maxDuration = 60;

const BEARER_PREFIX = "Bearer ";

function isAuthorized(req: Request): boolean {
  if (process.env.NODE_ENV === "development") return true;

  const expected = process.env.CRON_SECRET;
  if (!expected) return false;

  const authHeader = req.headers.get("authorization");
  const provided = authHeader?.startsWith(BEARER_PREFIX) ? authHeader.slice(BEARER_PREFIX.length) : null;
  return provided !== null && provided.length === expected.length && provided === expected;
}

const FAILED_PROCESS_SUMMARY: ProcessScheduledSummary = {
  status: "failed",
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

export async function GET(req: Request): Promise<Response> {
  if (!isAuthorized(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.info("[cron] pipeline started");

  let processSummary: ProcessScheduledSummary;
  try {
    processSummary = await processScheduledResults();
  } catch (err) {
    console.error(`[cron] process step failed: ${(err as Error).message}`);
    processSummary = FAILED_PROCESS_SUMMARY;
  }

  const analyzeSummary = await runAnalysis({ limit: DEFAULT_BATCH_SIZE });

  const summary: CronPipelineSummary = { process: processSummary, analyze: analyzeSummary };
  console.info("[cron] pipeline completed", summary);

  return Response.json(summary, { status: 200 });
}
