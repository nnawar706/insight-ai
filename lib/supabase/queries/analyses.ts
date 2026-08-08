import { createServiceRoleClient } from "../server-client";
import type { ArticleAnalysis, ArticleAnalysisInsert } from "../types";

export async function insertArticleAnalysis(input: ArticleAnalysisInsert): Promise<ArticleAnalysis> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.from("article_analyses").insert(input).select().single();

  if (error) throw new Error(`insertArticleAnalysis failed: ${error.message}`);
  return data;
}
