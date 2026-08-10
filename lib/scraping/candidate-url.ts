import "server-only";
import type { Source } from "../supabase/types";

/**
 * Non-article reject list (AGENTS.md §9). Path-segment patterns matched against
 * a candidate URL's pathname. This is the single home of this list — referenced
 * elsewhere, never duplicated.
 */
export const NON_ARTICLE_PATTERNS: RegExp[] = [
  /\/(category|categories|section|sections|topic|topics|tag|tags)(\/|$)/i,
  /\/(author|authors|profile|profiles|byline)(\/|$)/i,
  /\/(search)(\/|$)/i,
  /\/(show|shows|program|programs|podcast|podcasts)(\/|$)/i,
  /\/(live|live-news|live-blog|liveblog)(\/|$)/i,
  /\/(game|games)(\/|$)/i,
  /\/(product|products|review|reviews|shop|shopping|store)(\/|$)/i,
  /\/(about|about-us|contact|contact-us|careers|jobs|privacy|terms|support|help|faq|advertise|advertising|corporate|investor|investors)(\/|$)/i,
  /\/(newsletter|newsletters|subscribe|subscription|signup|sign-up|register)(\/|$)/i,
  /\/(sport)(\/|$)/i,
];

const TRACKING_QUERY_PARAMS = /^(utm_|fbclid|gclid|ref|ito|cmpid|icid|traffic_source)/i;

export function normalizeUrl(rawUrl: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }

  parsed.hash = "";
  for (const key of Array.from(parsed.searchParams.keys())) {
    if (TRACKING_QUERY_PARAMS.test(key)) parsed.searchParams.delete(key);
  }
  parsed.hostname = parsed.hostname.toLowerCase();

  let normalized = parsed.toString();
  if (normalized.endsWith("/") && parsed.pathname !== "/") {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

export function isRejectedUrl(url: string): boolean {
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    return true;
  }
  return NON_ARTICLE_PATTERNS.some((pattern) => pattern.test(pathname));
}

function isHomepagePath(pathname: string): boolean {
  return pathname === "" || pathname === "/";
}

function pathSegments(pathname: string): string[] {
  return pathname.split("/").filter(Boolean);
}

function looksLikeLongSlug(segments: string[]): boolean {
  const last = segments[segments.length - 1] ?? "";
  const wordCount = last.split("-").filter(Boolean).length;
  return wordCount >= 4 && last.length >= 20;
}

function looksDateBased(pathname: string): boolean {
  return /\/\d{4}\/\d{1,2}\/\d{1,2}\//.test(pathname) || /\/\d{4}-\d{2}-\d{2}(\/|$)/.test(pathname);
}

function looksNumericId(pathname: string): boolean {
  return /-id[a-z0-9]{6,}(\/|$)/i.test(pathname) || /-\d{6,}(\/|$)/.test(pathname);
}

const HOST_HEURISTICS: Record<string, (pathname: string, segments: string[]) => boolean> = {
  reuters: (pathname, segments) => segments.length >= 3 && (looksDateBased(pathname) || looksNumericId(pathname)),
  npr: (pathname) => /^\/\d{4}\/\d{2}\/\d{2}\//.test(pathname),
  fox: (pathname, segments) => {
    if (segments.length < 2) return false;
    if (/^(shows|games|live)$/i.test(segments[0])) return false;
    return looksLikeLongSlug(segments);
  },
  bbc: (pathname, segments) => {
    if (segments[0] !== "news") return false;
    return /-\d{6,}$/.test(pathname) || segments[1] === "articles";
  },
  guardian: (pathname) => /\/\d{4}\/[a-z]{3}\/\d{2}\//.test(pathname),
};

function genericHeuristic(pathname: string, segments: string[]): boolean {
  return looksDateBased(pathname) || looksNumericId(pathname) || (segments.length >= 2 && looksLikeLongSlug(segments));
}

export function isLikelyArticleUrl(url: string, source: Source): boolean {
  let parsed: URL;
  let sourceHost: string;
  try {
    parsed = new URL(url);
    sourceHost = new URL(source.listing_url).hostname.toLowerCase();
  } catch {
    return false;
  }

  if (parsed.hostname.toLowerCase() !== sourceHost) return false;
  if (isHomepagePath(parsed.pathname)) return false;
  if (isRejectedUrl(url)) return false;

  const segments = pathSegments(parsed.pathname);
  if (segments.length === 0) return false;

  const heuristic = source.parser_strategy ? HOST_HEURISTICS[source.parser_strategy] : undefined;
  return heuristic ? heuristic(parsed.pathname, segments) : genericHeuristic(parsed.pathname, segments);
}
