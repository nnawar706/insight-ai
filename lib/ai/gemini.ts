import "server-only";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

export const ANALYSIS_MODEL = "gemini-3.6-flash";

function getApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing Gemini API key (GEMINI_API_KEY)");
  }
  return apiKey;
}

export function getAnalysisModel() {
  const google = createGoogleGenerativeAI({ apiKey: getApiKey() });
  return google(ANALYSIS_MODEL);
}
