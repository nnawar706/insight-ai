import { z } from "zod";

export const articleAnalysisOutputSchema = z
  .object({
    summary: z.string().min(1).describe("A neutral, balanced summary of the article in 2-4 sentences."),
    sentimentScore: z
      .number()
      .min(-1)
      .max(1)
      .describe("Overall sentiment of the article's tone, from -1 (very negative) to 1 (very positive)."),
    sentimentLabel: z
      .enum(["positive", "neutral", "negative"])
      .describe("Sentiment label matching sentimentScore."),
    biasLabel: z
      .enum(["left", "center", "right", "mixed", "unclear"])
      .describe(
        "AI-estimated political framing of the article text itself, not the source outlet. Use 'unclear' when evidence is weak.",
      ),
    leftPercentage: z.number().int().min(0).max(100),
    centerPercentage: z.number().int().min(0).max(100),
    rightPercentage: z.number().int().min(0).max(100),
    confidence: z.number().min(0).max(1).describe("Confidence in the framing estimate, from 0 to 1."),
    framingNotes: z.string().min(1).describe("Brief notes explaining the framing assessment, citing article evidence."),
    loadedTerms: z.array(z.string()).describe("Loaded or emotionally charged terms found in the article. Empty array if none."),
    disclaimer: z
      .string()
      .min(1)
      .describe("A short disclaimer that this framing estimate is AI-generated, not objective fact."),
  })
  .refine((data) => data.leftPercentage + data.centerPercentage + data.rightPercentage === 100, {
    message: "leftPercentage + centerPercentage + rightPercentage must sum to 100",
    path: ["leftPercentage"],
  });

export type ArticleAnalysisOutput = z.infer<typeof articleAnalysisOutputSchema>;
