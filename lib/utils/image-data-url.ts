/**
 * Resolve a remote (or already-inline) image into a data URL for OpenAI vision.
 *
 * OpenAI's servers fetch `image_url` themselves and often fail with:
 *   "Unable to download content from the provided URL before the timeout"
 * when the asset is slow, signed, behind a bot wall, or otherwise not
 * reachable from OpenAI. Fetching from our workflow step and sending base64
 * avoids that path.
 */

const FETCH_TIMEOUT_MS = 25_000;
/** Soft cap — OpenAI vision rejects oversized payloads; keep request lean. */
const MAX_BYTES = 15 * 1024 * 1024;

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
};

function guessMimeFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    const ext = pathname.split(".").pop()?.split("?")[0] ?? "";
    return MIME_BY_EXT[ext] ?? "image/jpeg";
  } catch {
    return "image/jpeg";
  }
}

function normalizeMime(raw: string | null, fallbackUrl: string): string {
  const base = (raw ?? "").split(";")[0].trim().toLowerCase();
  if (base.startsWith("image/")) return base;
  return guessMimeFromUrl(fallbackUrl);
}

/**
 * Returns a `data:image/...;base64,...` string suitable for OpenAI chat
 * `image_url.url`. Passes through existing data URLs unchanged.
 */
export async function resolveImageToDataUrl(sourceUrl: string): Promise<string> {
  const url = sourceUrl.trim();
  if (!url) {
    throw new Error("Empty image URL");
  }

  if (url.startsWith("data:image/")) {
    return url;
  }

  if (!/^https?:\/\//i.test(url)) {
    throw new Error(
      `Image URL must be http(s) or a data URL (got: ${url.slice(0, 80)})`
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        // Some CDNs soft-block empty / bot UAs
        Accept: "image/*,*/*;q=0.8",
        "User-Agent": "vectorial-ab-test-simulation/1.0",
      },
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Failed to download image for OpenAI vision (${url.slice(0, 120)}): ${reason}`
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new Error(
      `Failed to download image for OpenAI vision (${response.status} ${response.statusText}): ${url.slice(0, 120)}`
    );
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength === 0) {
    throw new Error(`Downloaded image was empty: ${url.slice(0, 120)}`);
  }
  if (buffer.byteLength > MAX_BYTES) {
    throw new Error(
      `Image too large for vision request (${Math.round(buffer.byteLength / (1024 * 1024))}MB > 15MB): ${url.slice(0, 120)}`
    );
  }

  const mime = normalizeMime(response.headers.get("content-type"), url);
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

/** Resolve many URLs; skips blanks. Fails fast with a clear message. */
export async function resolveImagesToDataUrls(urls: string[]): Promise<string[]> {
  const cleaned = urls.map((u) => u.trim()).filter(Boolean);
  const out: string[] = [];
  for (const url of cleaned) {
    out.push(await resolveImageToDataUrl(url));
  }
  return out;
}
