import * as cheerio from "cheerio";
import { createHash } from "node:crypto";
import type { NewsCategory, NewsItem } from "@/lib/feed-data";
import { isPublicInternetHostname } from "@/lib/network-safety";

const LANGUAGE = process.env.NEWS_LANGUAGE || "de";

const TRANSLATIONS: Record<string, string> = {
  "OpenAI announces plans to shut down its Sora video generator": "OpenAI kündigt Abschaltung des Sora Video-Generators an",
  "Electronic Frontier Foundation to swap leaders as AI, ICE fights escalate": "EFF wechselt Führung während AI- und ICE-Konflikte eskalieren",
  "Writer denies it, but publisher pulls horror novel after multiple allegations of AI use": "Verlag zieht Horror-Roman zurück nach Vorwürfen wegen KI-Nutzung",
  "Perplexity's \"Personal Computer\" brings its AI agents to the, uh, Personal Computer": "Perplexity bringt KI-Agenten auf den PC",
  "Musk fails to block California data disclosure law he fears will ruin xAI": "Musk scheitert mit Klage gegen Kaliforniens Datenschutzgesetz",
  "LLMs can unmask pseudonymous users at scale with surprising accuracy": "KI kann Nutzer mit Pseudonymen enttarnen",
  "Perplexity announces \"Computer,\" an AI agent that assigns work to other AI agents": "Perplexity kündigt KI-Agenten an, die andere KI beauftragen",
  "Aided by AI, California beach town broadens hunt for bike lane blockers": "Kalifornien setzt KI für Radweg-Überwachung ein",
  "Retraction: After a routine code rejection, an AI agent published a hit piece on someone by name": "Nach Code-Ablehnung: KI-Agent veröffentlicht diffamierenden Artikel",
  "Microsoft VibeVoice: Open-Source Frontier Voice AI": "Microsoft VibeVoice: Open-Source Sprach-KI",
  "4TB of voice samples just stolen from 40k AI contractors at Mercor": "4TB Stimmen von 40k KI-Auftragnehmern bei Mercor gestohlen",
  "An Update on GitHub Availability": "Update zur GitHub-Verfügbarkeit",
  "UK gov's Mythos AI tests help separate cybersecurity threat from hype": "Britische Mythos-KI hilft bei Cyberbedrohungen",
  "To teach in the time of ChatGPT is to know pain": "Unterrichten mit ChatGPT ist ein Albtraum",
  "What leaked \"SteamGPT\" files could mean for the PC gaming platform's use of AI": "Was geleakte SteamGPT-Dateien für Valve bedeuten könnten",
  "AI on the couch: Anthropic gives Claude 20 hours of psychiatry": "Anthropic gibt Claude 20 Stunden Psychotherapie",
  "Police corporal created AI porn from driver's license pics": "Polizist erstellt KI-Pornos aus Führerschein-Fotos",
  "Meta's Superintelligence Lab unveils its first public model, Muse Spark": "Meta stellt erstes öffentliches Modell vor",
  "What the heck is wrong with our AI overlords?": "Was ist nur falsch mit unseren KI-Herrschern?",
  "From folding boxes to fixing vacuums, GEN-1 robotics model hits 99% reliability": "GEN-1 Robotik-Modell erreicht 99% Zuverlässigkeit",
  "\"Cognitive surrender\" leads AI users to abandon logical thinking": "KI führt Nutzer zur logischen Kapitulation",
  "Perplexity's \"Incognito Mode\" is a \"sham,\" lawsuit says": "Klage: Perplexitys Inkognito-Modus ist eine Täuschung",
  "How did Anthropic measure AI's \"theoretical capabilities\" in the job market?": "Wie Anthropic die Fähigkeiten von KI maß",
  "With new plugins feature, OpenAI officially takes Codex beyond coding": "OpenAI bringt Plugins für Codex",
  "Hegseth, Trump had no authority to order Anthropic to be blacklisted, judge says": "Richter: Keine Befugnis für Anthropic-Verbot",
  "Mozilla dev's \"Stack Overflow for agents\" targets a key weakness in coding AI": "Mozilla entwickelt Stack Overflow für KI-Agenten",
  "Man faces 5 years in prison for using AI to fake sighting of runaway wolf": "Mann drohen 5 Jahre für KI-gefälschte Wolf-Sichtung",
  "Our newsroom AI policy": "Unsere Redaktions-KI-Richtlinie",
  "Anthropic tested removing Claude Code from the Pro plan": "Anthropic testete Entfernung von Claude Code",
  "Report: Meta will train AI agents by tracking employees' mouse, keyboard use": "Meta will KI durch Mitarbeiter-Überwachung trainieren",
  "Meta's AI spending spree is helping make its Quest headsets more expensive": "Meta's KI-Ausgaben machen Quest teurer",
  "Allbirds abandons clothes, pivots to \"AI compute infrastructure\"": "Allbirds pivotiert zu KI-Infrastruktur",
  "Americans ask AI for health care. Hospitals think the answer is more chatbots": "Amerikaner fragen KI, Krankenhäuser antworten mit Chatbots",
};

function translate(text: string): string {
  if (LANGUAGE === "de") {
    return TRANSLATIONS[text] || text;
  }
  return text;
}

const RELEVANCE_KEYWORDS = [
  "ai", "llm", "gpt", "claude", "gemini", "model", "models",
  "agent", "agents", "mcp", "model context protocol",
  "openai", "anthropic", "deepseek", "mistral", "google",
  "llama", "opus", "sonnet", "haiku", "benchmark", "eval",
  "swe-bench", "humaneval", "rag", "embedding", "fine-tune",
  "tool calling", "function calling", "reasoning", "chain of thought",
  "chatgpt", "gemini ultra", "gpt-5", "claude 4", "o1", "o3"
];

type ScrapeSource = {
  name: string;
  url: string;
  articlesSelector: string;
  titleSelector: string;
  linkSelector: string;
  leadSelector?: string;
  dateSelector?: string;
  imageSelector?: string;
};

const SOURCES: ScrapeSource[] = [
  {
    name: "TechCrunch AI",
    url: "https://techcrunch.com/category/ai/",
    articlesSelector: "article.post-block",
    titleSelector: "h2.post-block-title",
    linkSelector: "a.post-block-title",
    leadSelector: "p.excerpt",
    dateSelector: "time",
  },
  {
    name: "The Verge AI",
    url: "https://www.theverge.com/ai",
    articlesSelector: "div.c-entry-content, article",
    titleSelector: "h2, h3",
    linkSelector: "h2 a, h3 a",
    leadSelector: "p",
  },
  {
    name: "Wired AI",
    url: "https://www.wired.com/tag/artificial-intelligence/",
    articlesSelector: "div.ArchiveSummary",
    titleSelector: "h3.ArchiveSummary-title, a.ArchiveSummary-title",
    linkSelector: "a.ArchiveSummary-title",
    leadSelector: "p.ArchiveSummary-description",
  },
  {
    name: "Ars Technica AI",
    url: "https://arstechnica.com/tag/ai/",
    articlesSelector: "article.post, .post",
    titleSelector: "header h2, h2",
    linkSelector: "header h2 a, h2 a",
    leadSelector: "p",
  },
  {
    name: "MIT Tech Review AI",
    url: "https://www.technologyreview.com/topic/artificial-intelligence/",
    articlesSelector: "div.MagazineFeature, div.story-card, article",
    titleSelector: "h3, h2, a.story-title",
    linkSelector: "h3 a, h2 a, a.story-title",
    leadSelector: "p.dek, p",
  },
  {
    name: "Reuters AI",
    url: "https://www.reuters.com/topics/artificial-intelligence/",
    articlesSelector: "article[data-testid='article'], article",
    titleSelector: "[data-testid='article-title'], a",
    linkSelector: "[data-testid='article-title'] a, article a",
  },
  {
    name: "Hacker News",
    url: "https://news.ycombinator.com/",
    articlesSelector: "tr.athing",
    titleSelector: "span.titleline",
    linkSelector: "span.titleline a",
    leadSelector: "div.subtext",
  },
];

function hashId(url: string): string {
  return createHash("sha256").update(url).digest("hex").slice(0, 16);
}

function isRelevant(title: string, lead: string): boolean {
  const hay = `${title} ${lead}`.toLowerCase();
  return RELEVANCE_KEYWORDS.some((kw) => hay.includes(kw));
}

function categorize(title: string, lead: string = ""): NewsCategory {
  const hay = (title + " " + lead).toLowerCase();
  if (/mcp/.test(hay) || /model context protocol/.test(hay)) return "MCP";
  if (/cli/.test(hay) || /command line/.test(hay) || /terminal/.test(hay) || /shell/.test(hay) || /bash/.test(hay)) return "CLI";
  if (/gpt-/.test(hay) || /claude \d+/.test(hay) || /gemini \d+/.test(hay) || /llama \d+/.test(hay) || /model release/.test(hay) || /new model/.test(hay) || /opus/.test(hay) || /sonnet/.test(hay) || /haiku/.test(hay) || /anthropic/.test(hay) || /openai/.test(hay)) return "Model Release";
  if (/benchmark/.test(hay) || /eval/.test(hay) || /swe-bench/.test(hay) || /arena/.test(hay) || /leaderboard/.test(hay) || /ranking/.test(hay) || /score/.test(hay)) return "Benchmark";
  if (/agent/.test(hay) || /automation/.test(hay) || /workflow/.test(hay) || /autonomous/.test(hay) || /robot/.test(hay)) return "Workflow";
  if (/bug/.test(hay) || /hack/.test(hay) || /breach/.test(hay) || /leak/.test(hay) || /attack/.test(hay) || /malware/.test(hay) || /security/.test(hay) || /privacy/.test(hay) || /data protection/.test(hay)) return "Benchmark";
  if (/deepfake/.test(hay)) return "Benchmark";
  return "Open Source";
}

const CATEGORY_IMAGES: Record<NewsCategory, string> = {
  MCP: "/thumbnails/mcp-registry.svg",
  CLI: "/thumbnails/cli-release.svg",
  "Open Source": "/thumbnails/open-eval.svg",
  "Model Release": "/thumbnails/model-notes.svg",
  Benchmark: "/thumbnails/benchmark-shift.svg",
  Workflow: "/thumbnails/open-eval.svg",
};

function calcScore(sourceName: string, title: string): number {
  const priorityWeight: Record<string, number> = {
    "TechCrunch AI": 30,
    "The Verge AI": 28,
    "Wired AI": 26,
    "Ars Technica AI": 24,
    "MIT Tech Review AI": 22,
    "Reuters AI": 28,
    "Hacker News": 20,
  };
  
  const hasTitle = RELEVANCE_KEYWORDS.filter(kw => 
    title.toLowerCase().includes(kw)
  ).length;
  
  const base = priorityWeight[sourceName] || 15;
  return Math.min(base + hasTitle * 8, 100);
}

type RawScrapeItem = {
  title: string;
  link: string;
  lead: string;
  sourceName: string;
};

async function fetchSource(source: ScrapeSource): Promise<RawScrapeItem[]> {
  try {
    let parsed: URL;
    try {
      parsed = new URL(source.url);
    } catch {
      console.warn(`[scraper] ${source.name} invalid URL: ${source.url}`);
      return [];
    }
    if (!["http:", "https:"].includes(parsed.protocol)) {
      console.warn(`[scraper] ${source.name} blocked non-http(s) URL`);
      return [];
    }
    const allowed = await isPublicInternetHostname(parsed.hostname);
    if (!allowed) {
      console.warn(`[scraper] ${source.name} blocked non-public host: ${parsed.hostname}`);
      return [];
    }

    const res = await fetch(source.url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      next: { revalidate: 60 }
    });
    
    if (!res.ok) {
      console.warn(`[scraper] ${source.name} fetch failed: ${res.status}`);
      return [];
    }
    
    const html = await res.text();
    const $ = cheerio.load(html);
    const items: RawScrapeItem[] = [];
    
    $(source.articlesSelector).each((_, el) => {
      const $el = $(el);
      
      const title = $el.find(source.titleSelector).text().trim() || 
                 $el.attr("aria-label") || 
                 "";
      const link = $el.find(source.linkSelector).attr("href") || 
                 $el.find("a").first().attr("href") || 
                 "";
      
      if (!link.startsWith("http")) return;
      
      let lead = source.leadSelector 
        ? $el.find(source.leadSelector).text().trim() 
        : "";
      
      if (lead.length > 300) lead = lead.slice(0, 300) + "...";
      
      if (title && link && isRelevant(title, lead)) {
        items.push({ title, link, lead, sourceName: source.name });
      }
    });
    
    return items;
  } catch (err) {
    console.error(`[scraper] ${source.name} error:`, err);
    return [];
  }
}

export async function scrapeAllSources(): Promise<NewsItem[]> {
  console.log("[scraper] starting scrape...");
  
  const allItems: RawScrapeItem[] = [];
  
  for (const source of SOURCES) {
    const items = await fetchSource(source);
    allItems.push(...items);
    
    const delay = 1000 + Math.random() * 2000;
    await new Promise(r => setTimeout(r, delay));
  }
  
  const seenLinks = new Set<string>();
  const newsItems: NewsItem[] = [];
  
  for (const item of allItems) {
    if (seenLinks.has(item.link)) continue;
    seenLinks.add(item.link);
    
    const category = categorize(item.title, item.lead);
    const score = calcScore(item.sourceName, item.title);
    
    newsItems.push({
      id: hashId(item.link),
      title: translate(item.title),
      lead: translate(item.lead || item.title),
      whyItMatters: item.sourceName === "Hacker News" 
        ? translate("Quelle Hacker News")
        : translate("Relevante News fuer deinen AI Workflow") + " " + category,
      sourceName: item.sourceName,
      sourceUrl: item.link,
      imageLabel: `${category} Quelle`,
      imagePath: CATEGORY_IMAGES[category],
      publishedAt: new Date().toISOString(),
      category,
      score,
      novelty: 85,
      workflowFit: 70,
      signal: 75,
      obscurity: 50,
      saved: false,
      deepDive: [item.lead || item.title],
    });
  }
  
  console.log(`[scraper] found ${newsItems.length} items from ${SOURCES.length} sources`);
  return newsItems;
}

export { SOURCES };