export type NewsCategory =
  | "MCP"
  | "CLI"
  | "Open Source"
  | "Model Release"
  | "Benchmark"
  | "Workflow";

export type CommandSet = {
  install?: string;
  run?: string;
  docsUrl?: string;
};

export type RepoReference = {
  fullName: string;
  url: string;
  npmPackage?: string;
};

export type BenchmarkSummary = {
  label: string;
  value: string;
  delta: string;
  score: number;
};

export type NewsItem = {
  id: string;
  title: string;
  lead: string;
  whyItMatters: string;
  sourceName: string;
  sourceUrl: string;
  imageLabel: string;
  imagePath: string;
  publishedAt: string;
  category: NewsCategory;
  score: number;
  novelty: number;
  workflowFit: number;
  signal: number;
  obscurity: number;
  saved: boolean;
  deepDive: string[];
  commands?: CommandSet;
  benchmark?: BenchmarkSummary;
  repo?: RepoReference;
};

export const dailyNews: NewsItem[] = [
  {
    id: "mcp-registry-health",
    title: "Neue MCP-Server im Registry-Feed mit Fokus auf Agent-Workflows",
    lead: "Mehrere neue Registry-Entries erweitern Tools fuer Files, Browser und lokale Dev-Automation.",
    whyItMatters:
      "Du bekommst sofort neue Integrationspunkte fuer deinen Agent-Stack statt nur allgemeiner AI-News.",
    sourceName: "Model Context Protocol Registry",
    sourceUrl: "https://prod.registry.modelcontextprotocol.io/",
    imageLabel: "MCP Registry",
    imagePath:
      "https://images.unsplash.com/photo-1518186285589-2f7649de83e0?auto=format&fit=crop&w=1600&q=80",
    publishedAt: "2026-04-27T06:40:00Z",
    category: "MCP",
    score: 91,
    novelty: 84,
    workflowFit: 95,
    signal: 88,
    obscurity: 82,
    saved: true,
    deepDive: [
      "Die Registry-Aktivitaet ist fuer dich relevant, weil neue MCP-Server oft frueher auftauchen als in allgemeinen Tech-News. Dadurch bekommst du konkrete Integrationsmoeglichkeiten, bevor das Thema im Mainstream landet.",
      "Achte bei neuen Eintraegen auf Aktivitaet, klare Doku und ein reproduzierbares Setup. Das reduziert das Risiko, Zeit in kurzlebige Experimente zu investieren.",
    ],
    commands: {
      install: "npx @modelcontextprotocol/inspector",
      run: "npx @modelcontextprotocol/inspector --server http://localhost:3001/mcp",
      docsUrl: "https://modelcontextprotocol.io/",
    },
    repo: {
      fullName: "modelcontextprotocol/servers",
      url: "https://github.com/modelcontextprotocol/servers",
      npmPackage: "@modelcontextprotocol/inspector",
    },
  },
  {
    id: "github-cli-release",
    title: "GitHub CLI Release bringt schnellere Workflows fuer PR-Automation",
    lead: "Neue Release-Notes zeigen Verbesserungen in PR- und Actions-Kommandos fuer Daily Ops.",
    whyItMatters:
      "Direkt nutzbar fuer deinen Workflow: schnelleres Review, weniger manuelle GitHub-Klicks.",
    sourceName: "GitHub Changelog",
    sourceUrl: "https://github.blog/changelog/type/new-releases/",
    imageLabel: "CLI Update",
    imagePath:
      "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1600&q=80",
    publishedAt: "2026-04-27T05:20:00Z",
    category: "CLI",
    score: 87,
    novelty: 76,
    workflowFit: 92,
    signal: 90,
    obscurity: 58,
    saved: false,
    deepDive: [
      "CLI-Verbesserungen sind meist sofort wirksam, weil du sie direkt in bestehende Skripte und Team-Workflows einbauen kannst.",
      "Gerade fuer PR- und CI-Operationen lohnen sich kleine Release-Delta schnell, wenn sie manuelle Schritte ersetzen.",
    ],
    commands: {
      install: "brew upgrade gh",
      run: "gh pr status && gh run list --limit 5",
      docsUrl: "https://cli.github.com/manual/",
    },
    repo: {
      fullName: "cli/cli",
      url: "https://github.com/cli/cli",
    },
  },
  {
    id: "hf-daily-paper",
    title: "Open-Source Eval-Tooling aus Daily Papers zeigt reproduzierbare Agent-Benchmarks",
    lead: "Neuer Paper-Stack kombiniert Evaluations-Harness und Reporting fuer Agent Tasks.",
    whyItMatters:
      "Hilft dir, neue AI-Funktionen mit echten Messwerten zu vergleichen statt nur Demos zu vertrauen.",
    sourceName: "Hugging Face Papers",
    sourceUrl: "https://huggingface.co/papers",
    imageLabel: "Open Eval",
    imagePath:
      "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1600&q=80",
    publishedAt: "2026-04-27T04:00:00Z",
    category: "Open Source",
    score: 85,
    novelty: 90,
    workflowFit: 79,
    signal: 86,
    obscurity: 74,
    saved: true,
    deepDive: [
      "Eval-Tooling ist eine Schluessel-Schicht zwischen Modell-Hype und produktiver Nutzung. Wenn Benchmarks reproduzierbar sind, kannst du Entscheidungen fundierter treffen.",
      "Priorisiere Tools mit klarer Methodik, offener Konfiguration und nachvollziehbaren Datensaetzen.",
    ],
    benchmark: {
      label: "Agentic Tasks",
      value: "74.2",
      delta: "+2.8",
      score: 74,
    },
    commands: {
      install: "pip install livebench",
      run: "livebench run --task agentic --model your-model",
      docsUrl: "https://github.com/LiveBench/LiveBench",
    },
    repo: {
      fullName: "LiveBench/LiveBench",
      url: "https://github.com/LiveBench/LiveBench",
    },
  },
  {
    id: "openai-release-notes",
    title: "Model Release Notes mit neuen Tool-Calling Limits und stabileren Responses",
    lead: "Release-Notes zeigen konkrete API- und Verhalten-Aenderungen fuer Production-Integrationen.",
    whyItMatters:
      "Wichtig fuer bestehende Pipelines: du kannst Prompting, Retries und Kostenplanung frueh anpassen.",
    sourceName: "OpenAI Release Notes",
    sourceUrl: "https://help.openai.com/en/articles/9624314-model-release-notes",
    imageLabel: "Model Notes",
    imagePath:
      "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1600&q=80",
    publishedAt: "2026-04-26T21:30:00Z",
    category: "Model Release",
    score: 81,
    novelty: 69,
    workflowFit: 88,
    signal: 90,
    obscurity: 40,
    saved: false,
    deepDive: [
      "Release Notes mit konkreten API-Details helfen dir, Migrationen planbar zu machen und Regressionen zu vermeiden.",
      "Wichtig sind vor allem Aenderungen bei Limits, Tool-Calling-Verhalten, Kostenstrukturen und stabilitaetsrelevanten Defaults.",
    ],
  },
  {
    id: "arena-shift",
    title: "LMArena Ranking-Sprung bei Coding-Modellen nach neuem Eval-Update",
    lead: "Die neuesten Vergleichswerte zeigen klare Gewinner bei Coding-Tasks und Kostenbalance.",
    whyItMatters:
      "Du kannst direkt entscheiden, welches Modell fuer welchen Coding-Workflow am meisten lohnt.",
    sourceName: "LMArena Leaderboard",
    sourceUrl: "https://huggingface.co/spaces/lmarena-ai/arena-leaderboard",
    imageLabel: "Benchmark Shift",
    imagePath:
      "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1600&q=80",
    publishedAt: "2026-04-26T18:10:00Z",
    category: "Benchmark",
    score: 79,
    novelty: 72,
    workflowFit: 82,
    signal: 84,
    obscurity: 66,
    saved: true,
    deepDive: [
      "Benchmark-Deltas machen nur Sinn, wenn sich Testbedingungen nicht still veraendert haben. Verifiziere deshalb immer Datensatz- und Prompting-Kontext.",
      "Der eigentliche Mehrwert liegt darin, Modellwahl pro Use Case zu treffen statt global auf einen Sieger zu setzen.",
    ],
    benchmark: {
      label: "Coding Rank Delta",
      value: "Top 3",
      delta: "+1 Platz",
      score: 81,
    },
  },
];

export const benchmarkBoard: BenchmarkSummary[] = [
  { label: "Coding Reliability", value: "86.4", delta: "+1.7", score: 86 },
  { label: "Tool Use Precision", value: "78.9", delta: "+2.4", score: 79 },
  { label: "Latency Median (s)", value: "1.9", delta: "-0.3", score: 72 },
  { label: "Cost per 1k Tokens", value: "$0.92", delta: "-0.08", score: 76 },
];

export function findNewsItem(id: string): NewsItem | undefined {
  return dailyNews.find((item) => item.id === id);
}
