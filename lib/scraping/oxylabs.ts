import "server-only";

const REALTIME_ENDPOINT = "https://realtime.oxylabs.io/v1/queries";
export const OXYLABS_TIMEOUT_MS = 180_000;

export class OxylabsError extends Error {
  constructor(
    message: string,
    readonly url: string,
  ) {
    super(message);
    this.name = "OxylabsError";
  }
}

export interface FetchedHtml {
  html: string;
  statusCode: number;
  finalUrl: string;
}

interface OxylabsRealtimeResponse {
  results?: Array<{
    content?: unknown;
    status_code?: number;
    url?: string;
  }>;
}

function getCredentials(): { username: string; password: string } {
  const username = process.env.OXY_WSA_USERNAME;
  const password = process.env.OXY_WSA_PASSWORD;

  if (!username || !password) {
    throw new Error("Missing Oxylabs credentials (OXY_WSA_USERNAME / OXY_WSA_PASSWORD)");
  }

  return { username, password };
}

export async function fetchHtml(url: string): Promise<FetchedHtml> {
  const { username, password } = getCredentials();
  const auth = Buffer.from(`${username}:${password}`).toString("base64");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OXYLABS_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(REALTIME_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ source: "universal", url, render: "html" }),
      signal: controller.signal,
    });
  } catch (err) {
    throw new OxylabsError(`Oxylabs request failed for ${url}: ${(err as Error).message}`, url);
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new OxylabsError(`Oxylabs returned HTTP ${response.status} for ${url}`, url);
  }

  const body = (await response.json()) as OxylabsRealtimeResponse;
  const result = body.results?.[0];

  if (!result || typeof result.content !== "string" || result.content.length === 0) {
    throw new OxylabsError(`Oxylabs returned empty content for ${url}`, url);
  }

  const statusCode = result.status_code ?? 0;
  if (statusCode >= 400) {
    throw new OxylabsError(`Oxylabs job returned status ${statusCode} for ${url}`, url);
  }

  return {
    html: result.content,
    statusCode,
    finalUrl: result.url ?? url,
  };
}
