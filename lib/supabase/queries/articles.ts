import { createServiceRoleClient } from "../server-client";
import type { Article, ArticleAnalysis, ArticleInsert, Database, Source } from "../types";

const URL_CHUNK_SIZE = 15;

export async function getExistingArticleUrls(urls: string[]): Promise<Set<string>> {
  if (urls.length === 0) return new Set();

  const supabase = createServiceRoleClient();
  const existing = new Set<string>();

  for (let i = 0; i < urls.length; i += URL_CHUNK_SIZE) {
    const chunk = urls.slice(i, i + URL_CHUNK_SIZE);
    const { data, error } = await supabase.from("articles").select("url").in("url", chunk);

    if (error) throw new Error(`getExistingArticleUrls failed: ${error.message}`);
    for (const row of data) existing.add(row.url);
  }

  return existing;
}

export async function insertArticle(input: ArticleInsert): Promise<Article> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.from("articles").insert(input).select().single();

  if (error) throw new Error(`insertArticle failed: ${error.message}`);
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
