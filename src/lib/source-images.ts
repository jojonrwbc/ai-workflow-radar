import { NewsItem } from "@/lib/feed-data";
import { isPublicInternetHostname } from "@/lib/network-safety";

type CacheEntry = {
  expiresAt: number;
  imageUrl: string | null;
};

const cache = new Map<string, CacheEntry>();
const TTL_MS = 6 * 60 * 60 * 1000;

function decodeHtml(value: string): string {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#x27;", "'")
    .replaceAll("&#39;", "'");
}

function parseMetaImage(html: string): string | null {
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return decodeHtml(match[1].trim());
    }
  }

  return null;
}

function toAbsoluteUrl(candidate: string, baseUrl: string): string | null {
  try {
    const parsed = new URL(candidate, baseUrl);
    if (!["https:", "http:"].includes(parsed.protocol)) {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

export async function resolveSourceImage(sourceUrl: string): Promise<string | null> {
  const cached = cache.get(sourceUrl);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.imageUrl;
  }

  try {
    const source = new URL(sourceUrl);
    const isSourceHostAllowed = await isPublicInternetHostname(source.hostname);
    if (!isSourceHostAllowed) {
      return null;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);
    const response = await fetch(sourceUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "ai-workflow-radar/1.0",
        Accept: "text/html,application/xhtml+xml",
      },
      cache: "no-store",
    }).finally(() => clearTimeout(timeout));

    if (!response.ok) {
      cache.set(sourceUrl, { expiresAt: Date.now() + TTL_MS, imageUrl: null });
      return null;
    }

    const html = await response.text();
    const imageCandidate = parseMetaImage(html);
    const absoluteImageCandidate = imageCandidate
      ? toAbsoluteUrl(imageCandidate, sourceUrl)
      : null;
    let absoluteImage: string | null = absoluteImageCandidate;
    if (absoluteImageCandidate) {
      try {
        const parsed = new URL(absoluteImageCandidate);
        const isImageHostAllowed = await isPublicInternetHostname(parsed.hostname);
        if (!isImageHostAllowed) {
          absoluteImage = null;
        }
      } catch {
        absoluteImage = null;
      }
    }

    cache.set(sourceUrl, {
      expiresAt: Date.now() + TTL_MS,
      imageUrl: absoluteImage,
    });

    return absoluteImage;
  } catch {
    cache.set(sourceUrl, { expiresAt: Date.now() + TTL_MS, imageUrl: null });
    return null;
  }
}

export async function withResolvedImages(items: NewsItem[]): Promise<NewsItem[]> {
  const imageUrls = await Promise.all(items.map((item) => resolveSourceImage(item.sourceUrl)));

  return items.map((item, index) => {
    const resolved = imageUrls[index];
    if (!resolved) {
      return item;
    }

    return {
      ...item,
      imagePath: `/api/source-image?url=${encodeURIComponent(resolved)}`,
    };
  });
}
