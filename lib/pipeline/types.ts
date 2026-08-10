import type { ArticleRejectionReason } from "../scraping/article";

export interface ManualScrapeOptions {
  sources?: string[];
  limitPerSource?: number;
}

export interface SourceRunResult {
  sourceId: string;
  sourceName: string;
  candidatesFound: number;
  candidatesRejected: number;
  duplicatesSkipped: number;
  detailPagesScraped: number;
  articlesInserted: number;
  articlesRejected: number;
  articlesFailed: number;
  rejectionReasons: Partial<Record<ArticleRejectionReason, number>>;
}

export interface ScrapeSummary {
  status: "ok" | "failed";
  sourcesChecked: number;
  candidatesFound: number;
  candidatesRejected: number;
  duplicatesSkipped: number;
  detailPagesScraped: number;
  articlesInserted: number;
  articlesRejected: number;
  articlesFailed: number;
  durationMs: number;
  rejectionReasons: Partial<Record<ArticleRejectionReason, number>>;
}

export interface ManualAnalyzeOptions {
  limit?: number;
  articleIds?: string[];
}

export interface AnalysisSummary {
  status: "ok" | "failed";
  pendingFound: number;
  analyzed: number;
  skipped: number;
  failed: number;
  durationMs: number;
}

export interface SyncSchedulesSummary {
  status: "ok" | "failed";
  activeSourcesChecked: number;
  schedulesCreated: number;
  schedulesSkipped: number;
  orphansDeactivated: number;
  durationMs: number;
}

export interface ProcessScheduledSummary {
  status: "ok" | "failed";
  schedulesChecked: number;
  runsFound: number;
  runsAlreadyProcessed: number;
  runsProcessed: number;
  candidatesFound: number;
  candidatesRejected: number;
  duplicatesSkipped: number;
  detailPagesScraped: number;
  articlesInserted: number;
  articlesRejected: number;
  articlesFailed: number;
  durationMs: number;
  rejectionReasons: Partial<Record<ArticleRejectionReason, number>>;
}

export interface CronPipelineSummary {
  process: ProcessScheduledSummary;
  analyze: AnalysisSummary;
}
