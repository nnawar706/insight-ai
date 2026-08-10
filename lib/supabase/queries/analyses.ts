import { createServiceRoleClient } from "../server-client";
import type { ArticleAnalysis, ArticleAnalysisInsert } from "../types";

export async function insertArticleAnalysis(input: ArticleAnalysisInsert): Promise<ArticleAnalysis> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.from("article_analyses").insert(input).select().single();

  if (error) throw new Error(`insertArticleAnalysis failed: ${error.message}`);
  return data;
}

/** §20 embedding backfill: updates an existing row's embedding without re-running analysis. */
export async function updateArticleAnalysisEmbedding(articleId: string, embedding: number[]): Promise<void> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("article_analyses").update({ embedding }).eq("article_id", articleId);

  if (error) throw new Error(`updateArticleAnalysisEmbedding failed: ${error.message}`);
}
