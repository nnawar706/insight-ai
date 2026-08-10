import "server-only";
import { OXYLABS_TIMEOUT_MS } from "./oxylabs";
import type { Source } from "../supabase/types";

const SCHEDULER_BASE = "https://data.oxylabs.io/v1";
const SCHEDULER_METADATA_TIMEOUT_MS = 30_000;
const SCHEDULE_END_TIME_YEARS = 2;

/**
 * Once daily (Vercel Hobby plan cron can only fire once/day; matched to the
 * Vercel Cron cadence in vercel.json so scrape jobs aren't left unprocessed —
 * see prompts/010-oxylabs-scheduler-vercel-cron.md).
 */
export const SCHEDULE_CRON = "0 6 * * *";

/** 64-bit Oxylabs IDs are always well above 15 digits; small status-type numbers never collide. */
const LARGE_ID_PATTERN = /\d{15,}/g;

export class OxylabsSchedulerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OxylabsSchedulerError";
  }
}

function getCredentials(): { username: string; password: string } {
  const username = process.env.OXY_WSA_USERNAME;
  const password = process.env.OXY_WSA_PASSWORD;

  if (!username || !password) {
    throw new OxylabsSchedulerError("Missing Oxylabs credentials (OXY_WSA_USERNAME / OXY_WSA_PASSWORD)");
  }

  return { username, password };
}

interface RawResponse {
  status: number;
  rawText: string;
}

async function request(path: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<RawResponse> {
  const { username, password } = getCredentials();
  const auth = Buffer.from(`${username}:${password}`).toString("base64");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), init.timeoutMs ?? SCHEDULER_METADATA_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${SCHEDULER_BASE}${path}`, {
      method: init.method,
      body: init.body,
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });
  } catch (err) {
    throw new OxylabsSchedulerError(`Oxylabs Scheduler request failed for ${path}: ${(err as Error).message}`);
  } finally {
    clearTimeout(timeout);
  }

  const rawText = await response.text();
  return { status: response.status, rawText };
}

function assertOk({ status, rawText }: RawResponse, context: string): void {
  if (status < 200 || status >= 300) {
    throw new OxylabsSchedulerError(`${context}: HTTP ${status} ${rawText.slice(0, 300)}`);
  }
}

function formatEndTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
}

/**
 * Creates one Oxylabs schedule for a source's homepage. The response's `schedule_id` is a
 * 64-bit integer that exceeds Number.MAX_SAFE_INTEGER, so it is read from the raw response
 * text via regex, never via JSON.parse (AGENTS.md §18 — large integer precision).
 */
export async function createSchedule(source: Source): Promise<string> {
  const endTime = new Date();
  endTime.setUTCFullYear(endTime.getUTCFullYear() + SCHEDULE_END_TIME_YEARS);

  const body = {
    cron: SCHEDULE_CRON,
    items: [{ source: "universal", url: source.listing_url, render: "html" }],
    end_time: formatEndTime(endTime),
  };

  const res = await request("/schedules", { method: "POST", body: JSON.stringify(body) });
  assertOk(res, `Oxylabs create schedule failed for ${source.name}`);

  const match = res.rawText.match(/"schedule_id"\s*:\s*(\d+)/);
  if (!match) {
    throw new OxylabsSchedulerError(`Oxylabs create schedule response missing schedule_id for ${source.name}`);
  }
  return match[1];
}

/**
 * Lists all Oxylabs-side schedule IDs. The exact response envelope is undocumented, so IDs
 * are extracted defensively from the raw text rather than a specific JSON shape.
 */
export async function listOxylabsScheduleIds(): Promise<string[]> {
  const res = await request("/schedules", { method: "GET" });
  assertOk(res, "Oxylabs list schedules failed");

  const matches = res.rawText.match(LARGE_ID_PATTERN);
  return matches ? Array.from(new Set(matches)) : [];
}

export async function deactivateSchedule(oxylabsScheduleId: string): Promise<void> {
  const res = await request(`/schedules/${oxylabsScheduleId}/state`, {
    method: "PUT",
    body: JSON.stringify({ active: false }),
  });
  assertOk(res, `Oxylabs deactivate schedule ${oxylabsScheduleId} failed`);
}

export interface ScheduleRunJob {
  id: string;
  resultStatus: string;
}

export interface ScheduleRun {
  runId: string;
  jobs: ScheduleRunJob[];
}

interface RunsResponseShape {
  runs?: Array<{ jobs?: Array<{ result_status?: string }> }>;
}

/**
 * Fetches a schedule's runs. `run_id` and job `id` are both 64-bit integers, so the response
 * shape (array order, job counts, result_status) is read via JSON.parse while the exact digit
 * strings are recovered via ordered raw-text regex passes and zipped back positionally
 * (AGENTS.md §18 — use /runs, never /jobs, and never round-trip large IDs through JSON.parse).
 */
export async function getScheduleRuns(oxylabsScheduleId: string): Promise<ScheduleRun[]> {
  const res = await request(`/schedules/${oxylabsScheduleId}/runs`, { method: "GET" });
  assertOk(res, `Oxylabs get runs failed for schedule ${oxylabsScheduleId}`);

  let parsed: RunsResponseShape;
  try {
    parsed = JSON.parse(res.rawText) as RunsResponseShape;
  } catch {
    throw new OxylabsSchedulerError(`Oxylabs runs response for schedule ${oxylabsScheduleId} is not valid JSON`);
  }

  const runs = parsed.runs ?? [];
  const runIdMatches = Array.from(res.rawText.matchAll(/"run_id"\s*:\s*(\d+)/g)).map((m) => m[1]);
  const jobIdMatches = Array.from(res.rawText.matchAll(/"id"\s*:\s*(\d+)/g)).map((m) => m[1]);

  let jobIdCursor = 0;
  return runs.map((run, index) => {
    const jobs = run.jobs ?? [];
    const mappedJobs: ScheduleRunJob[] = jobs.map((job) => {
      const id = jobIdMatches[jobIdCursor] ?? "";
      jobIdCursor += 1;
      return { id, resultStatus: job.result_status ?? "" };
    });
    return { runId: runIdMatches[index] ?? "", jobs: mappedJobs };
  });
}

interface JobResultsResponseShape {
  results?: Array<{ content?: unknown }>;
}

/**
 * Fetches a completed job's raw HTML. The `{jobId}` path segment must be the raw string
 * captured from `getScheduleRuns` — never a value round-tripped through a JS number.
 */
export async function fetchJobResultHtml(jobId: string): Promise<string> {
  const res = await request(`/queries/${jobId}/results?type=raw`, { method: "GET", timeoutMs: OXYLABS_TIMEOUT_MS });
  assertOk(res, `Oxylabs fetch job result failed for job ${jobId}`);

  let parsed: JobResultsResponseShape;
  try {
    parsed = JSON.parse(res.rawText) as JobResultsResponseShape;
  } catch {
    throw new OxylabsSchedulerError(`Oxylabs job result response for job ${jobId} is not valid JSON`);
  }

  const content = parsed.results?.[0]?.content;
  if (typeof content !== "string" || content.length === 0) {
    throw new OxylabsSchedulerError(`Oxylabs job ${jobId} returned empty content`);
  }
  return content;
}
