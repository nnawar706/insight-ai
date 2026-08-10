import "server-only";
import * as cheerio from "cheerio";
import type { Source } from "../supabase/types";
import { normalizeUrl } from "./candidate-url";

const NOISE_SELECTOR = [
  "nav",
  "header",
  "footer",
  "aside",
  "script",
  "style",
  '[class*="nav" i]',
  '[class*="menu" i]',
  '[class*="footer" i]',
  '[class*="subscri" i]',
  '[class*="newsletter" i]',
  '[class*="promo" i]',
  '[class*="advert" i]',
].join(", ");

const MIN_HEADLINE_LENGTH = 20;

export function extractCandidateLinks(html: string, source: Source): string[] {
  const $ = cheerio.load(html);
  $(NOISE_SELECTOR).remove();

  const base = source.listing_url;
  const links = new Set<string>();

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;

    const text = $(el).text().trim();
    const isHeadlineLink = text.length >= MIN_HEADLINE_LENGTH;
    const isInStoryContainer = $(el).closest('article, [class*="card" i], [class*="story" i], [class*="teaser" i], h1, h2, h3').length > 0;
    if (!isHeadlineLink && !isInStoryContainer) return;

    let absolute: string;
    try {
      absolute = new URL(href, base).toString();
    } catch {
      return;
    }

    const normalized = normalizeUrl(absolute);
    if (normalized) links.add(normalized);
  });

  return Array.from(links);
}
