import "server-only";
import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";
import { isRejectedUrl } from "./candidate-url";

export type ArticleRejectionReason =
  | "missing-title"
  | "generic-title"
  | "missing-image"
  | "missing-published-date"
  | "insufficient-body"
  | "non-article-canonical";

export interface ParsedArticle {
  title: string;
  imageUrl: string;
  publishedAt: string;
  canonicalUrl: string | null;
  rawText: string;
}

export type ParseArticleResult = { ok: true; data: ParsedArticle } | { ok: false; reason: ArticleRejectionReason };

const MIN_PARAGRAPHS = 3;
const MIN_CLEANED_CHARS = 900;

const REMOVE_BEFORE_TEXT_SELECTOR = [
  "script",
  "style",
  "nav",
  "header",
  "footer",
  "aside",
  "figure figcaption",
  '[class*="newsletter" i]',
  '[class*="subscri" i]',
  '[class*="related" i]',
  '[class*="most-viewed" i]',
  '[class*="most-read" i]',
  '[class*="load-more" i]',
  '[class*="social-share" i]',
  '[class*="share-" i]',
  '[class*="advert" i]',
  '[class*="promo" i]',
  '[class*="byline" i]',
].join(", ");

const GENERIC_TITLE_PATTERNS = [
  /^home$/i,
  /^news$/i,
  /^sport$/i,
  /^live$/i,
  /^shows?$/i,
  /^programs?$/i,
  /^podcasts?$/i,
  /^videos?$/i,
  /^subscribe$/i,
  /^about( us)?$/i,
  /^contact( us)?$/i,
];

function extractTitle($: CheerioAPI): string | null {
  const ogTitle = $('meta[property="og:title"]').attr("content");
  const h1 = $("h1").first().text().trim();
  const title = (ogTitle?.trim() || h1 || $("title").text().trim()) ?? "";
  return title.length > 0 ? title : null;
}

function extractImageUrl($: CheerioAPI): string | null {
  const ogImage = $('meta[property="og:image"]').attr("content");
  const twitterImage = $('meta[name="twitter:image"]').attr("content");
  const firstImg = $("article img, main img").first().attr("src");
  const url = ogImage || twitterImage || firstImg;
  return url && url.trim().length > 0 ? url.trim() : null;
}

function extractPublishedAt($: CheerioAPI): string | null {
  const metaPublished =
    $('meta[property="article:published_time"]').attr("content") || $('meta[name="article:published_time"]').attr("content");
  if (metaPublished) return metaPublished;

  const timeEl = $("time[datetime]").first().attr("datetime");
  if (timeEl) return timeEl;

  const ldJsonNodes = $('script[type="application/ld+json"]');
  for (const node of ldJsonNodes.toArray()) {
    const text = $(node).contents().text();
    try {
      const json: unknown = JSON.parse(text);
      const candidates = Array.isArray(json) ? json : [json];
      for (const candidate of candidates) {
        if (candidate && typeof candidate === "object" && "datePublished" in candidate) {
          const value = (candidate as { datePublished?: unknown }).datePublished;
          if (typeof value === "string" && value.length > 0) return value;
        }
      }
    } catch {
      continue;
    }
  }

  return null;
}

function extractCanonicalUrl($: CheerioAPI): string | null {
  const canonical = $('link[rel="canonical"]').attr("href");
  const ogUrl = $('meta[property="og:url"]').attr("content");
  const url = canonical || ogUrl;
  return url && url.trim().length > 0 ? url.trim() : null;
}

function splitIntoParagraphs(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'])/g)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function extractRawText($: CheerioAPI): string {
  const container = $("article").length > 0 ? $("article") : $("main").length > 0 ? $("main") : $("body");
  container.find(REMOVE_BEFORE_TEXT_SELECTOR).remove();

  const paragraphNodes = container
    .find("p")
    .toArray()
    .map((el) => $(el).text().replace(/\s+/g, " ").trim())
    .filter((text) => text.length > 40);

  let paragraphs = paragraphNodes;
  if (paragraphs.length <= 1) {
    const blockText = container.text().replace(/\s+/g, " ").trim();
    paragraphs = splitIntoParagraphs(blockText).filter((p) => p.length > 40);
  }

  return paragraphs.join("\n\n");
}

function isGenericTitle(title: string): boolean {
  const trimmed = title.trim();
  return GENERIC_TITLE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function passesBodyGate(rawText: string): boolean {
  const paragraphCount = rawText.split("\n\n").filter((p) => p.trim().length > 0).length;
  return paragraphCount >= MIN_PARAGRAPHS || rawText.length >= MIN_CLEANED_CHARS;
}

export function parseArticle(html: string, url: string): ParseArticleResult {
  if (isRejectedUrl(url)) return { ok: false, reason: "non-article-canonical" };

  const $ = cheerio.load(html);

  const title = extractTitle($);
  if (!title) return { ok: false, reason: "missing-title" };
  if (isGenericTitle(title)) return { ok: false, reason: "generic-title" };

  const canonicalUrl = extractCanonicalUrl($);
  if (canonicalUrl && isRejectedUrl(canonicalUrl)) return { ok: false, reason: "non-article-canonical" };

  const imageUrl = extractImageUrl($);
  if (!imageUrl) return { ok: false, reason: "missing-image" };

  const publishedAt = extractPublishedAt($);
  if (!publishedAt) return { ok: false, reason: "missing-published-date" };

  const rawText = extractRawText($);
  if (!passesBodyGate(rawText)) return { ok: false, reason: "insufficient-body" };

  return {
    ok: true,
    data: { title, imageUrl, publishedAt, canonicalUrl: canonicalUrl ?? null, rawText },
  };
}
