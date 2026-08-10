import "server-only";
import { embed } from "ai";
import { EMBEDDING_DIMENSIONS, getEmbeddingModel } from "./gemini";
import type { Article } from "../supabase/types";

const RAW_TEXT_EMBED_CHAR_LIMIT = 12_000;

export async function embedArticle(article: Article): Promise<number[]> {
  const value = `${article.title}\n\n${article.raw_text.slice(0, RAW_TEXT_EMBED_CHAR_LIMIT)}`;

  const { embedding } = await embed({
    model: getEmbeddingModel(),
    value,
    providerOptions: {
      google: {
        outputDimensionality: EMBEDDING_DIMENSIONS,
        taskType: "SEMANTIC_SIMILARITY",
      },
    },
  });

  return embedding;
}
