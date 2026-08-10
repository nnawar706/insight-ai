import { createServiceRoleClient } from "../server-client";
import type { Article, ArticleAnalysis, ArticleInsert, Database, SentimentLabel, Source } from "../types";

const URL_CHUNK_SIZE = 15;

export async function getExistingArticleUrls(urls: string[]): Promise<Set<string>> {
  if (urls.length === 0) return new Set();

  const supabase = createServiceRoleClient();
  const existing = new Set<string>();

  for (let i = 0; i < urls.length; i += URL_CHUNK_SIZE) {
    const chunk = urls.slice(i, i + URL_CHUNK_SIZE);

    const { data: byUrl, error: urlError } = await supabase.from("articles").select("url").in("url", chunk);
    if (urlError) throw new Error(`getExistingArticleUrls failed: ${urlError.message}`);
    for (const row of byUrl) existing.add(row.url);

    const { data: byCanonical, error: canonicalError } = await supabase
      .from("articles")
      .select("url, canonical_url")
      .in("canonical_url", chunk);
    if (canonicalError) throw new Error(`getExistingArticleUrls failed: ${canonicalError.message}`);
    for (const row of byCanonical) {
      existing.add(row.url);
      if (row.canonical_url) existing.add(row.canonical_url);
    }
  }

  return existing;
}

const POSTGRES_UNIQUE_VIOLATION = "23505";

export async function insertArticle(input: ArticleInsert): Promise<Article | null> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.from("articles").insert(input).select().single();

  if (error) {
    if (error.code === POSTGRES_UNIQUE_VIOLATION) return null;
    throw new Error(`insertArticle failed: ${error.message}`);
  }
  return data;
}

type PublishedArticleRow = Database["public"]["Tables"]["articles"]["Row"] & {
  source: Source;
  analysis: ArticleAnalysis;
};

export async function getPublishedArticles(): Promise<PublishedArticleRow[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("articles")
    .select<"*, source:sources(*), analysis:article_analyses!inner(*)", PublishedArticleRow>(
      "*, source:sources(*), analysis:article_analyses!inner(*)",
    )
    .not("analyzed_at", "is", null)
    .order("published_at", { ascending: false });

  if (error) throw new Error(`getPublishedArticles failed: ${error.message}`);
  return data;
}

type ArticleDetailRow = Database["public"]["Tables"]["articles"]["Row"] & {
  source: Source;
  analysis: ArticleAnalysis | null;
};

export async function getArticleById(id: string): Promise<ArticleDetailRow | null> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("articles")
    .select<"*, source:sources(*), analysis:article_analyses(*)", ArticleDetailRow>(
      "*, source:sources(*), analysis:article_analyses(*)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`getArticleById failed: ${error.message}`);
  return data;
}

type PendingCheckRow = { id: string; analysis: { id: string; embedding: number[] | null } | null };

export interface PendingArticleInfo {
  id: string;
  /** True when an `article_analyses` row already exists but `embedding` is null (§20 backfill). */
  needsEmbeddingOnly: boolean;
}

/**
 * Pending-analysis check (AGENTS.md §19/§20): an article is pending when no `article_analyses`
 * row exists for it, or when a row exists but `embedding` hasn't been backfilled yet. Fetches
 * the embedded relation and filters in JS, per the joined-table filter gotcha (§21) — never
 * `.eq()`/`.is()` on a joined-table column.
 */
export async function getPendingArticles(limit: number): Promise<PendingArticleInfo[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("articles")
    .select<"id, analysis:article_analyses(id, embedding)", PendingCheckRow>(
      "id, analysis:article_analyses(id, embedding)",
    )
    .order("scraped_at", { ascending: true });

  if (error) throw new Error(`getPendingArticles failed: ${error.message}`);
  return data
    .filter((row) => row.analysis === null || row.analysis.embedding === null)
    .map((row) => ({ id: row.id, needsEmbeddingOnly: row.analysis !== null }))
    .slice(0, limit);
}

export async function getArticlesByIds(ids: string[]): Promise<Article[]> {
  if (ids.length === 0) return [];

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.from("articles").select("*").in("id", ids);

  if (error) throw new Error(`getArticlesByIds failed: ${error.message}`);
  return data;
}

export async function markArticleAnalyzed(articleId: string): Promise<void> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("articles")
    .update({ analyzed_at: new Date().toISOString() })
    .eq("id", articleId);

  if (error) throw new Error(`markArticleAnalyzed failed: ${error.message}`);
}

const RELATED_ARTICLES_LIMIT = 5;

export interface RelatedArticleRow {
  id: string;
  title: string;
  imageUrl: string;
  publishedAt: string;
  sourceName: string;
  sentimentLabel: SentimentLabel;
  leftPercentage: number;
  centerPercentage: number;
  rightPercentage: number;
}

/** pgvector cosine-similarity search (§20). Requires the `match_related_articles` RPC. */
export async function getRelatedArticles(articleId: string, embedding: number[]): Promise<RelatedArticleRow[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.rpc("match_related_articles", {
    p_article_id: articleId,
    p_embedding: embedding,
    p_match_count: RELATED_ARTICLES_LIMIT,
  });

  if (error) throw new Error(`getRelatedArticles failed: ${error.message}`);
  return data.map((row) => ({
    id: row.id,
    title: row.title,
    imageUrl: row.image_url,
    publishedAt: row.published_at,
    sourceName: row.source_name,
    sentimentLabel: row.sentiment_label,
    leftPercentage: row.left_percentage,
    centerPercentage: row.center_percentage,
    rightPercentage: row.right_percentage,
  }));
}
