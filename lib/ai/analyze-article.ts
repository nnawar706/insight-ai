import "server-only";
import { generateText, Output } from "ai";
import { ANALYSIS_MODEL, getAnalysisModel } from "./gemini";
import { articleAnalysisOutputSchema, type ArticleAnalysisOutput } from "./schema";
import type { Article } from "../supabase/types";

const RAW_TEXT_PROMPT_CHAR_LIMIT = 12_000;

export class AnalysisFailedError extends Error {
  constructor(
    message: string,
    readonly articleId: string,
  ) {
    super(message);
    this.name = "AnalysisFailedError";
  }
}

export interface AnalyzedArticle extends ArticleAnalysisOutput {
  biasScore: number;
  model: string;
}

function buildPrompt(article: Article): string {
  const truncatedText = article.raw_text.slice(0, RAW_TEXT_PROMPT_CHAR_LIMIT);

  return [
    "You are a neutral news analyst. Read the article below and produce a structured, AI-estimated analysis.",
    "",
    "Rules:",
    "- Base political framing only on evidence in the article text itself, never on the source outlet's reputation or name.",
    "- If the evidence for political framing is weak or mixed, use biasLabel 'unclear' and keep confidence low.",
    "- The biasLabel should match whichever of leftPercentage/centerPercentage/rightPercentage is strongest, unless confidence is low or the percentages are close together.",
    "- leftPercentage, centerPercentage, and rightPercentage must be integers from 0 to 100 that sum to exactly 100.",
    "- Keep the summary neutral and factual, not an opinion.",
    "- Note any loaded or emotionally charged terms actually used in the article; return an empty array if there are none.",
    "- The disclaimer must make clear this is an AI-generated estimate, not objective fact.",
    "",
    `Title: ${article.title}`,
    "",
    "Article text:",
    truncatedText,
  ].join("\n");
}

async function callModel(prompt: string): Promise<ArticleAnalysisOutput> {
  const { output } = await generateText({
    model: getAnalysisModel(),
    output: Output.object({ schema: articleAnalysisOutputSchema }),
    prompt,
  });
  return output;
}

export async function analyzeArticle(article: Article): Promise<AnalyzedArticle> {
  const prompt = buildPrompt(article);

  let output: ArticleAnalysisOutput;
  try {
    output = await callModel(prompt);
  } catch (firstErr) {
    console.warn(`[analyze] retrying "${article.title}" after generation failure: ${(firstErr as Error).message}`);
    try {
      output = await callModel(prompt);
    } catch (secondErr) {
      throw new AnalysisFailedError(
        `Gemini analysis failed after retry: ${(secondErr as Error).message}`,
        article.id,
      );
    }
  }

  const biasScore = (output.rightPercentage - output.leftPercentage) / 100;

  return {
    ...output,
    biasScore,
    model: ANALYSIS_MODEL,
  };
}
