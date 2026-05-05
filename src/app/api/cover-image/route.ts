import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

const WIDTH = 1200;
const HEIGHT = 630;
const TITLE_LINE_LIMIT = 34;
const MAX_TITLE_LINES = 3;
const SUBTITLE_LIMIT = 64;

type CoverStyle = "signal" | "blueprint" | "editorial";
type Palette = {
  bgA: string;
  bgB: string;
  accent: string;
  accentSoft: string;
  text: string;
  muted: string;
};
type TypographyPreset = {
  titleFont: string;
  sourceFont: string;
  categoryFont: string;
  titleSize: number;
  sourceSize: number;
};

function escapeXml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function pickPalette(category: string): Palette {
  if (category === "MCP") {
    return {
      bgA: "#0a1120",
      bgB: "#1e3a8a",
      accent: "#22d3ee",
      accentSoft: "#67e8f9",
      text: "#f8fafc",
      muted: "#cbd5e1",
    };
  }
  if (category === "CLI") {
    return {
      bgA: "#0f172a",
      bgB: "#1d4ed8",
      accent: "#93c5fd",
      accentSoft: "#bfdbfe",
      text: "#f8fafc",
      muted: "#dbeafe",
    };
  }
  if (category === "Workflow") {
    return {
      bgA: "#111827",
      bgB: "#0f766e",
      accent: "#34d399",
      accentSoft: "#6ee7b7",
      text: "#ecfeff",
      muted: "#a7f3d0",
    };
  }
  if (category === "Model Release") {
    return {
      bgA: "#22163b",
      bgB: "#5b21b6",
      accent: "#c084fc",
      accentSoft: "#d8b4fe",
      text: "#f5f3ff",
      muted: "#ddd6fe",
    };
  }
  if (category === "Benchmark") {
    return {
      bgA: "#0b1324",
      bgB: "#1e40af",
      accent: "#38bdf8",
      accentSoft: "#93c5fd",
      text: "#f0f9ff",
      muted: "#cbd5e1",
    };
  }
  if (category === "Open Source Infra") {
    return {
      bgA: "#0f172a",
      bgB: "#0f766e",
      accent: "#67e8f9",
      accentSoft: "#a7f3d0",
      text: "#ecfeff",
      muted: "#ccfbf1",
    };
  }
  return {
    bgA: "#1f2937",
    bgB: "#1d4ed8",
    accent: "#60a5fa",
    accentSoft: "#93c5fd",
    text: "#f8fafc",
    muted: "#cbd5e1",
  };
}

function hashSeed(input: string): number {
  const digest = createHash("sha256").update(input).digest();
  return digest.readUInt32BE(0);
}

function truncate(input: string, limit: number): string {
  if (input.length <= limit) return input;
  return `${input.slice(0, Math.max(0, limit - 1)).trim()}...`;
}

function wrapTitle(input: string): string[] {
  const words = input.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current.length === 0 ? word : `${current} ${word}`;
    if (next.length > TITLE_LINE_LIMIT) {
      if (current.length > 0) {
        lines.push(current);
      }
      current = word;
      if (lines.length === MAX_TITLE_LINES - 1) {
        lines.push(truncate(current, TITLE_LINE_LIMIT));
        return lines;
      }
      continue;
    }
    current = next;
  }

  if (current.length > 0 && lines.length < MAX_TITLE_LINES) {
    lines.push(current);
  }

  if (lines.length === 0) {
    return [truncate(input, TITLE_LINE_LIMIT)];
  }

  if (lines.length === MAX_TITLE_LINES) {
    lines[MAX_TITLE_LINES - 1] = truncate(lines[MAX_TITLE_LINES - 1], TITLE_LINE_LIMIT);
  }

  return lines;
}

function pickStyle(category: string, seed: number): CoverStyle {
  if (category === "Open Source Infra") return "blueprint";
  if (category === "Model Release") return "editorial";
  if (category === "MCP" || category === "Benchmark") return "signal";
  const index = seed % 3;
  if (index === 0) return "signal";
  if (index === 1) return "blueprint";
  return "editorial";
}

function typographyForStyle(style: CoverStyle): TypographyPreset {
  if (style === "editorial") {
    return {
      titleFont:
        "ui-serif, Georgia, Cambria, Times New Roman, Times, serif",
      sourceFont:
        "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
      categoryFont:
        "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
      titleSize: 62,
      sourceSize: 28,
    };
  }

  if (style === "blueprint") {
    return {
      titleFont:
        "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace",
      sourceFont:
        "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
      categoryFont:
        "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace",
      titleSize: 54,
      sourceSize: 27,
    };
  }

  return {
    titleFont:
      "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
    sourceFont:
      "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
    categoryFont:
      "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
    titleSize: 60,
    sourceSize: 29,
  };
}

function renderSignalPattern(seed: number, accent: string): string {
  const y1 = 150 + (seed % 100);
  const y2 = 300 + ((seed >> 6) % 100);
  const y3 = 460 + ((seed >> 12) % 80);
  return `
    <circle cx="${170 + (seed % 160)}" cy="${130 + (seed % 80)}" r="180" fill="${accent}" fill-opacity="0.08"/>
    <circle cx="${960 - (seed % 130)}" cy="${500 - (seed % 90)}" r="220" fill="${accent}" fill-opacity="0.1"/>
    <path d="M70 ${y1} C 280 ${y1 - 60}, 420 ${y1 + 30}, 620 ${y1 - 24} S 900 ${y1 - 70}, 1130 ${y1 + 8}" stroke="${accent}" stroke-opacity="0.9" stroke-width="8" fill="none" stroke-linecap="round"/>
    <path d="M90 ${y2} C 260 ${y2 - 40}, 430 ${y2 + 35}, 630 ${y2 - 16} S 930 ${y2 - 58}, 1140 ${y2 + 15}" stroke="${accent}" stroke-opacity="0.5" stroke-width="4" fill="none" stroke-linecap="round"/>
    <path d="M110 ${y3} C 300 ${y3 - 28}, 540 ${y3 + 24}, 770 ${y3 - 18} S 980 ${y3 - 35}, 1130 ${y3 + 10}" stroke="${accent}" stroke-opacity="0.28" stroke-width="3" fill="none" stroke-linecap="round"/>
  `;
}

function renderBlueprintPattern(seed: number, accentSoft: string): string {
  const xStep = 120 + (seed % 40);
  const yStep = 96 + ((seed >> 7) % 30);
  const rectW = 260 + ((seed >> 13) % 120);
  return `
    <g stroke="${accentSoft}" stroke-opacity="0.2">
      ${Array.from({ length: 10 }, (_, idx) => `<line x1="${idx * xStep}" y1="0" x2="${idx * xStep}" y2="${HEIGHT}" />`).join("")}
      ${Array.from({ length: 8 }, (_, idx) => `<line x1="0" y1="${idx * yStep}" x2="${WIDTH}" y2="${idx * yStep}" />`).join("")}
    </g>
    <rect x="${90 + (seed % 40)}" y="${130 + (seed % 40)}" width="${rectW}" height="130" rx="22" fill="${accentSoft}" fill-opacity="0.14" stroke="${accentSoft}" stroke-opacity="0.6"/>
    <rect x="${790 - (seed % 70)}" y="${355 - (seed % 45)}" width="${280 + ((seed >> 5) % 100)}" height="160" rx="20" fill="${accentSoft}" fill-opacity="0.14" stroke="${accentSoft}" stroke-opacity="0.5"/>
    <path d="M130 225 H${470 + (seed % 110)} V${280 + ((seed >> 9) % 80)} H${760 + (seed % 150)}" stroke="${accentSoft}" stroke-opacity="0.8" stroke-width="5" fill="none" stroke-linecap="round"/>
    <circle cx="${760 + (seed % 140)}" cy="${280 + ((seed >> 9) % 80)}" r="10" fill="${accentSoft}"/>
  `;
}

function renderEditorialPattern(seed: number, accent: string, accentSoft: string): string {
  const bar1 = 130 + (seed % 80);
  const bar2 = 250 + ((seed >> 6) % 90);
  const bar3 = 390 + ((seed >> 11) % 90);
  return `
    <rect x="0" y="${bar1}" width="${WIDTH}" height="84" fill="${accent}" fill-opacity="0.12"/>
    <rect x="0" y="${bar2}" width="${WIDTH}" height="62" fill="${accentSoft}" fill-opacity="0.16"/>
    <rect x="0" y="${bar3}" width="${WIDTH}" height="48" fill="${accent}" fill-opacity="0.11"/>
    <circle cx="${150 + (seed % 110)}" cy="${520 - (seed % 70)}" r="120" fill="${accentSoft}" fill-opacity="0.18"/>
    <circle cx="${1020 - (seed % 140)}" cy="${120 + (seed % 90)}" r="140" fill="${accent}" fill-opacity="0.14"/>
  `;
}

export async function GET(request: NextRequest) {
  const title = (request.nextUrl.searchParams.get("title") ?? "Hook AI Story").slice(
    0,
    140,
  );
  const source = (
    request.nextUrl.searchParams.get("source") ?? "Hook AI Source"
  ).slice(0, 90);
  const category = (
    request.nextUrl.searchParams.get("category") ?? "Open Source"
  ).slice(0, 40);

  const palette = pickPalette(category);
  const seed = hashSeed(`${title}::${source}::${category}`);
  const style = pickStyle(category, seed);
  const typo = typographyForStyle(style);
  const titleLines = wrapTitle(title);
  const subtitle = truncate(source, SUBTITLE_LIMIT);
  const titleStartY = 388 - (titleLines.length - 1) * 46;

  const safeSource = escapeXml(subtitle);
  const safeCategoryUpper = escapeXml(category.toUpperCase());
  const safeTitleLines = titleLines.map((line) => escapeXml(line));

  const pattern =
    style === "blueprint"
      ? renderBlueprintPattern(seed, palette.accentSoft)
      : style === "editorial"
        ? renderEditorialPattern(seed, palette.accent, palette.accentSoft)
        : renderSignalPattern(seed, palette.accent);

  const titleBlock = safeTitleLines
    .map(
      (line, idx) =>
        `<text x="66" y="${titleStartY + idx * 68}" fill="${palette.text}" font-size="${typo.titleSize}" font-family="${typo.titleFont}" font-weight="700">${line}</text>`,
    )
    .join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${palette.bgA}" />
      <stop offset="60%" stop-color="${palette.bgB}" />
      <stop offset="100%" stop-color="#0b1220" />
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  ${pattern}
  <rect x="56" y="48" rx="28" ry="28" width="420" height="64" fill="#0b1220" fill-opacity="0.58" stroke="${palette.accent}" stroke-opacity="0.55" stroke-width="2"/>
  <circle cx="94" cy="80" r="8" fill="${palette.accent}"/>
  <text x="112" y="87" fill="${palette.text}" font-size="26" letter-spacing="1.3" font-family="${typo.categoryFont}" font-weight="700">${safeCategoryUpper}</text>
  <text x="66" y="130" fill="${palette.accentSoft}" font-size="18" letter-spacing="2.8" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial" font-weight="600">HOOK AI SIGNAL</text>
  ${titleBlock}
  <rect x="56" y="536" rx="20" ry="20" width="680" height="52" fill="#0b1220" fill-opacity="0.46" stroke="${palette.accentSoft}" stroke-opacity="0.34"/>
  <text x="78" y="571" fill="${palette.muted}" font-size="${typo.sourceSize}" font-family="${typo.sourceFont}" font-weight="500">${safeSource}</text>
</svg>`;

  return new NextResponse(svg, {
    status: 200,
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=86400, s-maxage=86400",
    },
  });
}
