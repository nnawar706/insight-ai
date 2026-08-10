import "server-only";
import { getActiveSources } from "../supabase/queries/sources";
import { getExistingArticleUrls, insertArticle } from "../supabase/queries/articles";
import { insertLog } from "../supabase/queries/logs";
import { fetchHtml, OxylabsError } from "../scraping/oxylabs";
import { extractCandidateLinks } from "../scraping/extract";
import { isLikelyArticleUrl } from "../scraping/candidate-url";
import { parseArticle, type ArticleRejectionReason } from "../scraping/article";
import type { ArticleInsert, Json, Source } from "../supabase/types";
import type { ManualScrapeOptions, ScrapeSummary, SourceRunResult } from "./types";

export const DEFAULT_LIMIT_PER_SOURCE = 5;
const CANDIDATE_CAP_MULTIPLIER = 4;
const MIN_CANDIDATE_CAP = 20;

export function mergeRejectionReasons(
  target: Partial<Record<ArticleRejectionReason, number>>,
  source: Partial<Record<ArticleRejectionReason, number>>,
): void {
  for (const [reason, count] of Object.entries(source) as [ArticleRejectionReason, number][]) {
    target[reason] = (target[reason] ?? 0) + count;
  }
}

/**
 * Runs the shared extract -> filter -> dedupe -> detail-scrape -> validate -> clean -> insert
 * pipeline for a single source, given its homepage HTML. Reused by manual scraping (live-fetched
 * HTML) and, later, the Oxylabs Scheduler task (§18, HTML from completed Oxylabs job results).
 */
export async function runSourcePipeline(source: Source, homepageHtml: string, limitPerSource: number): Promise<SourceRunResult> {
  const result: SourceRunResult = {
    sourceId: source.id,
    sourceName: source.name,
    candidatesFound: 0,
    candidatesRejected: 0,
    duplicatesSkipped: 0,
    detailPagesScraped: 0,
    articlesInserted: 0,
    articlesRejected: 0,
    articlesFailed: 0,
    rejectionReasons: {},
  };

  const links = extractCandidateLinks(homepageHtml, source);
  result.candidatesFound = links.length;
  console.info(`[scrape] ${source.name}: ${links.length} candidate links found`);

  const survivors = links.filter((url) => isLikelyArticleUrl(url, source));
  result.candidatesRejected = links.length - survivors.length;
  console.info(`[scrape] ${source.name}: ${survivors.length} passed URL filter, ${result.candidatesRejected} rejected pre-detail`);

  const existingUrls = await getExistingArticleUrls(survivors);
  const remaining = survivors.filter((url) => !existingUrls.has(url));
  result.duplicatesSkipped = survivors.length - remaining.length;
  console.info(`[scrape] ${source.name}: ${result.duplicatesSkipped} duplicates skipped, ${remaining.length} to detail-scrape`);

  const candidateCap = Math.max(limitPerSource * CANDIDATE_CAP_MULTIPLIER, MIN_CANDIDATE_CAP);

  for (const candidateUrl of remaining) {
    if (result.articlesInserted >= limitPerSource) break;
    if (result.detailPagesScraped >= candidateCap) break;

    result.detailPagesScraped += 1;
    try {
      const { html } = await fetchHtml(candidateUrl);
      const parsed = parseArticle(html, candidateUrl);

      if (!parsed.ok) {
        result.articlesRejected += 1;
        result.rejectionReasons[parsed.reason] = (result.rejectionReasons[parsed.reason] ?? 0) + 1;
        console.warn(`[scrape] ${source.name}: rejected ${candidateUrl} (${parsed.reason})`);
        continue;
      }

      const insert: ArticleInsert = {
        source_id: source.id,
        url: candidateUrl,
        canonical_url: parsed.data.canonicalUrl,
        title: parsed.data.title,
        image_url: parsed.data.imageUrl,
        published_at: parsed.data.publishedAt,
        raw_text: parsed.data.rawText,
        analyzed_at: null,
      };

      const inserted = await insertArticle(insert);
      if (!inserted) {
        result.duplicatesSkipped += 1;
        console.info(`[scrape] ${source.name}: duplicate on insert, skipped ${candidateUrl}`);
        continue;
      }

      result.articlesInserted += 1;
      console.info(`[scrape] ${source.name}: inserted "${parsed.data.title}"`);
    } catch (err) {
      result.articlesFailed += 1;
      const message = err instanceof OxylabsError || err instanceof Error ? err.message : "unknown error";
      console.warn(`[scrape] ${source.name}: failed to scrape ${candidateUrl}: ${message}`);
    }
  }

  return result;
}

function selectSources(activeSources: Source[], requested: string[] | undefined): Source[] {
  if (!requested || requested.length === 0) return activeSources;
  return activeSources.filter((source) =>
    requested.some((selector) => selector === source.id || selector.toLowerCase() === source.name.toLowerCase()),
  );
}

export async function runManualScrape(options: ManualScrapeOptions = {}): Promise<ScrapeSummary> {
  const startedAt = Date.now();
  const limitPerSource = options.limitPerSource ?? DEFAULT_LIMIT_PER_SOURCE;

  console.info("[scrape] scrape started", { requestedSources: options.sources ?? "all active", limitPerSource });

  const activeSources = await getActiveSources();
  const selectedSources = selectSources(activeSources, options.sources);

  console.info(`[scrape] selected ${selectedSources.length} source(s): ${selectedSources.map((s) => s.name).join(", ") || "none"}`);

  const summary: ScrapeSummary = {
    status: selectedSources.length > 0 ? "ok" : "failed",
    sourcesChecked: selectedSources.length,
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

  for (const source of selectedSources) {
    console.info(`[scrape] ${source.name}: starting`);
    try {
      const { html } = await fetchHtml(source.listing_url);
      console.info(`[scrape] ${source.name}: homepage fetched`);

      const result = await runSourcePipeline(source, html, limitPerSource);

      summary.candidatesFound += result.candidatesFound;
      summary.candidatesRejected += result.candidatesRejected;
      summary.duplicatesSkipped += result.duplicatesSkipped;
      summary.detailPagesScraped += result.detailPagesScraped;
      summary.articlesInserted += result.articlesInserted;
      summary.articlesRejected += result.articlesRejected;
      summary.articlesFailed += result.articlesFailed;
      mergeRejectionReasons(summary.rejectionReasons, result.rejectionReasons);

      console.info(`[scrape] ${source.name}: completed (${result.articlesInserted} inserted)`);
    } catch (err) {
      const message = err instanceof OxylabsError || err instanceof Error ? err.message : "unknown error";
      console.error(`[scrape] ${source.name}: source-level error: ${message}`);
      summary.articlesFailed += 1;
    }
  }

  summary.durationMs = Date.now() - startedAt;
  console.info("[scrape] scrape completed", summary);

  try {
    await insertLog({
      level: "info",
      event: "scrape.summary",
      message: `Manual scrape completed: ${summary.articlesInserted} inserted, ${summary.articlesRejected} rejected, ${summary.duplicatesSkipped} duplicates skipped`,
      context: summary as unknown as Json,
    });
  } catch (err) {
    console.error(`[scrape] failed to persist run summary to logs: ${(err as Error).message}`);
  }

  return summary;
}
