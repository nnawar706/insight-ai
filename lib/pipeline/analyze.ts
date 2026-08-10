import "server-only";
import { getArticlesByIds, getPendingArticles, markArticleAnalyzed } from "../supabase/queries/articles";
import { insertArticleAnalysis, updateArticleAnalysisEmbedding } from "../supabase/queries/analyses";
import { insertLog } from "../supabase/queries/logs";
import { analyzeArticle } from "../ai/analyze-article";
import { embedArticle } from "../ai/embed-article";
import type { Article, ArticleAnalysisInsert, Json } from "../supabase/types";
import type { AnalysisSummary, ManualAnalyzeOptions } from "./types";

export const DEFAULT_BATCH_SIZE = 5;
const PENDING_ID_FETCH_CAP = 10_000;

function getBatchSize(): number {
  const raw = process.env.ANALYSIS_BATCH_SIZE;
  if (!raw) return DEFAULT_BATCH_SIZE;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_BATCH_SIZE;
}

async function analyzeOne(article: Article, needsEmbeddingOnly: boolean): Promise<"analyzed" | "failed"> {
  try {
    if (needsEmbeddingOnly) {
      const embedding = await embedArticle(article);
      await updateArticleAnalysisEmbedding(article.id, embedding);
      await markArticleAnalyzed(article.id);
      console.info(`[analyze] backfilled embedding for "${article.title}"`);
      return "analyzed";
    }

    const [result, embedding] = await Promise.all([analyzeArticle(article), embedArticle(article)]);

    const insert: ArticleAnalysisInsert = {
      article_id: article.id,
      summary: result.summary,
      sentiment_score: result.sentimentScore,
      sentiment_label: result.sentimentLabel,
      bias_score: result.biasScore,
      bias_label: result.biasLabel,
      left_percentage: result.leftPercentage,
      center_percentage: result.centerPercentage,
      right_percentage: result.rightPercentage,
      confidence: result.confidence,
      framing_notes: result.framingNotes,
      loaded_terms: result.loadedTerms,
      disclaimer: result.disclaimer,
      model: result.model,
      embedding,
    };

    await insertArticleAnalysis(insert);
    await markArticleAnalyzed(article.id);
    console.info(`[analyze] analyzed "${article.title}" (${result.biasLabel}, sentiment ${result.sentimentLabel})`);
    return "analyzed";
  } catch (err) {
    console.warn(`[analyze] failed "${article.title}": ${(err as Error).message}`);
    return "failed";
  }
}

async function runExplicitIds(articleIds: string[], summary: AnalysisSummary): Promise<void> {
  const pending = await getPendingArticles(PENDING_ID_FETCH_CAP);
  const pendingMap = new Map(pending.map((p) => [p.id, p.needsEmbeddingOnly]));
  const toAnalyze = articleIds.filter((id) => pendingMap.has(id));
  const alreadyAnalyzed = articleIds.length - toAnalyze.length;

  summary.pendingFound = toAnalyze.length;
  summary.skipped += alreadyAnalyzed;
  if (alreadyAnalyzed > 0) {
    console.info(`[analyze] ${alreadyAnalyzed} requested article(s) already analyzed, skipped`);
  }

  const batchSize = getBatchSize();
  for (let i = 0; i < toAnalyze.length; i += batchSize) {
    const batchIds = toAnalyze.slice(i, i + batchSize);
    const articles = await getArticlesByIds(batchIds);
    console.info(`[analyze] batch: analyzing ${articles.length} article(s)`);

    for (const article of articles) {
      const outcome = await analyzeOne(article, pendingMap.get(article.id) ?? false);
      if (outcome === "analyzed") summary.analyzed += 1;
      else summary.failed += 1;
    }
  }
}

async function runPendingLoop(limit: number | undefined, summary: AnalysisSummary): Promise<void> {
  const batchSize = getBatchSize();
  let processed = 0;

  for (;;) {
    const remaining = limit !== undefined ? limit - processed : batchSize;
    if (remaining <= 0) break;

    const fetchSize = Math.min(batchSize, remaining);
    const pending = await getPendingArticles(fetchSize);
    if (pending.length === 0) break;

    summary.pendingFound += pending.length;
    const pendingMap = new Map(pending.map((p) => [p.id, p.needsEmbeddingOnly]));
    const articles = await getArticlesByIds(pending.map((p) => p.id));
    console.info(`[analyze] batch: analyzing ${articles.length} article(s)`);

    for (const article of articles) {
      const outcome = await analyzeOne(article, pendingMap.get(article.id) ?? false);
      if (outcome === "analyzed") summary.analyzed += 1;
      else summary.failed += 1;
      processed += 1;
    }

    console.info(`[analyze] batch complete: ${summary.analyzed} analyzed, ${summary.failed} failed so far`);
  }
}

export async function runAnalysis(options: ManualAnalyzeOptions = {}): Promise<AnalysisSummary> {
  const startedAt = Date.now();
  console.info("[analyze] analysis started", {
    limit: options.limit ?? "none",
    articleIds: options.articleIds?.length ?? "none",
  });

  const summary: AnalysisSummary = {
    status: "ok",
    pendingFound: 0,
    analyzed: 0,
    skipped: 0,
    failed: 0,
    durationMs: 0,
  };

  try {
    if (options.articleIds && options.articleIds.length > 0) {
      await runExplicitIds(options.articleIds, summary);
    } else {
      await runPendingLoop(options.limit, summary);
    }
  } catch (err) {
    summary.status = "failed";
    console.error(`[analyze] analysis run failed: ${(err as Error).message}`);
  }

  summary.durationMs = Date.now() - startedAt;
  console.info("[analyze] analysis completed", summary);

  try {
    await insertLog({
      level: "info",
      event: "analyze.summary",
      message: `Analysis run completed: ${summary.analyzed} analyzed, ${summary.skipped} skipped, ${summary.failed} failed`,
      context: summary as unknown as Json,
    });
  } catch (err) {
    console.error(`[analyze] failed to persist run summary to logs: ${(err as Error).message}`);
  }

  return summary;
}
