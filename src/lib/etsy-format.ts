export type HeadingStyle = "star" | "diamond" | "plain";
export type BulletStyle = "diamond" | "dot" | "dash" | "keep";

export interface FormatOptions {
  headingStyle: HeadingStyle;
  bulletStyle: BulletStyle;
  boldLabels: boolean;
  normalizeBlankLines: boolean;
  keepSeparators: boolean;
}

export const defaultOptions: FormatOptions = {
  headingStyle: "diamond",
  bulletStyle: "dot",
  boldLabels: true,
  normalizeBlankLines: true,
  keepSeparators: false,
};

const UPPER_A = 0x41;
const LOWER_A = 0x61;
const DIGIT_0 = 0x30;

/** Map ASCII letters/digits to Unicode Mathematical Bold characters. */
export function toUnicodeBold(input: string): string {
  let out = "";
  for (const ch of input) {
    const code = ch.codePointAt(0)!;
    if (code >= UPPER_A && code <= UPPER_A + 25) {
      out += String.fromCodePoint(0x1d400 + (code - UPPER_A));
    } else if (code >= LOWER_A && code <= LOWER_A + 25) {
      out += String.fromCodePoint(0x1d41a + (code - LOWER_A));
    } else if (code >= DIGIT_0 && code <= DIGIT_0 + 9) {
      out += String.fromCodePoint(0x1d7ce + (code - DIGIT_0));
    } else {
      out += ch;
    }
  }
  return out;
}

function stripInlineMarkdown(text: string): string {
  // bold -> unicode bold
  let out = text.replace(/\*\*(.+?)\*\*|__(.+?)__/g, (_m, a, b) =>
    toUnicodeBold(a ?? b ?? ""),
  );
  // remove leftover emphasis markers without touching content characters
  out = out.replace(/\*(?!\s)([^*\n]+?)\*/g, "$1");
  out = out.replace(/`([^`\n]+)`/g, "$1");
  return out.replace(/\*\*/g, "").replace(/#+/g, (m, off: number) =>
    off === 0 ? "" : m,
  );
}

function formatHeading(text: string, style: HeadingStyle): string {
  const cleaned = text.replace(/^[✦◆•\s]+/, "").replace(/[✦◆•\s]+$/, "").trim();
  const bold = toUnicodeBold(cleaned);
  if (style === "star") return `✦ ${bold} ✦`;
  if (style === "diamond") return `◆ ${bold}`;
  return bold;
}

function bulletSymbol(style: BulletStyle, original: string): string {
  switch (style) {
    case "diamond":
      return "◆";
    case "dot":
      return "•";
    case "dash":
      return "-";
    default:
      return original;
  }
}

const SEPARATOR_RE = /^\s*(?:-{3,}|\*{3,}|_{3,}|—{3,})\s*$/;

export function formatEtsy(input: string, opts: FormatOptions): string {
  if (!input.trim()) return "";
  const lines = input.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, "");

    if (SEPARATOR_RE.test(line)) {
      if (opts.keepSeparators) out.push("──────────────");
      else out.push("");
      continue;
    }

    if (!line.trim()) {
      out.push("");
      continue;
    }

    const heading = line.match(/^\s{0,3}(#{1,6})\s*(.+)$/);
    if (heading) {
      out.push(
        formatHeading(stripInlineMarkdown(heading[2] ?? ""), opts.headingStyle),
      );
      continue;
    }

    const bulletMatch = line.match(/^(\s*)([-*+•◆●·]|\d+[.)])\s+(.*)$/);
    if (bulletMatch) {
      const indent = bulletMatch[1] ?? "";
      const marker = bulletMatch[2] ?? "-";
      const rest = bulletMatch[3] ?? "";
      const isNumbered = /^\d/.test(marker);
      let body = stripInlineMarkdown(rest);
      if (opts.boldLabels) body = boldLabel(body);
      const sym = isNumbered ? marker : bulletSymbol(opts.bulletStyle, marker);
      out.push(`${indent}${sym} ${body}`);
      continue;
    }

    let body = stripInlineMarkdown(line.replace(/^\s*>\s?/, ""));
    if (opts.boldLabels) body = boldLabel(body);
    out.push(body);
  }

  let result = out.join("\n");
  if (opts.normalizeBlankLines) {
    result = result.replace(/\n{3,}/g, "\n\n");
  }
  return result.replace(/^\n+/, "").replace(/\s+$/, "");
}

/** Bold a short "Label:" prefix at the start of a line. */
function boldLabel(line: string): string {
  const m = line.match(/^([^:\n]{1,40}):(\s*)(.*)$/);
  if (!m) return line;
  const label = m[1] ?? "";
  if (!/[A-Za-z]/.test(label)) return line;
  // Skip if already bold (contains math bold chars)
  if (/[\u{1D400}-\u{1D7FF}]/u.test(label)) return line;
  if (/https?$/i.test(label)) return line;
  return `${toUnicodeBold(label)}:${m[2] ?? ""}${m[3] ?? ""}`;
}


export function stripExtraSpaces(text: string): string {
  return text
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export const SAMPLE_INPUT = `# ✦ Product Overview ✦

This **handcrafted pendant necklace** is inspired by vintage Art Deco jewelry. Each piece is polished by hand for a mirror-bright finish.

---

## Details

- **Pendant size:** 18mm x 12mm
- Chain length: 16" / 18" / 20"
- Metal Options: 14k Gold Fill, Sterling Silver, Rose Gold
- Finish: High polish

## Care Instructions

Store your necklace in the pouch provided. Avoid contact with perfume, lotion, and chlorine.

---

Ships in 1-3 business days from our studio.`;
