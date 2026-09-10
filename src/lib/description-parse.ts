export interface ParsedResponse {
  category: string;
  setting: string;
  shankType: string;
  style: string;
  shopSection: string;
  keywordAnalysis: string;
  imageAttributes: string;
  titleOptions: [string, string, string];
  finalTitle: string;
  description: string;
  tags: string[];
  missing: string[];
}

export function emptyParsed(): ParsedResponse {
  return {
    category: "",
    setting: "",
    shankType: "",
    style: "",
    shopSection: "",
    keywordAnalysis: "",
    imageAttributes: "",
    titleOptions: ["", "", ""],
    finalTitle: "",
    description: "",
    tags: [],
    missing: [],
  };
}

const SECTIONS = [
  { key: "attributes", re: /^\s*[#*\s]*etsy\s+listing\s+attributes\b[:\s*]*$/i },
  { key: "keywords", re: /^\s*[#*\s]*keyword\s+analysis\b[:\s*]*$/i },
  { key: "images", re: /^\s*[#*\s]*image[-\s]based\s+attributes\b[:\s*]*$/i },
  { key: "titles", re: /^\s*[#*\s]*title\s+options\b[:\s*]*$/i },
  { key: "description", re: /^\s*[#*\s]*description\b[:\s*]*$/i },
  { key: "tags", re: /^\s*[#*\s]*tags\b[:\s*]*$/i },
] as const;

type SectionKey = (typeof SECTIONS)[number]["key"];

function clean(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.replace(/\s+$/, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function labelled(block: string, label: string): string {
  const re = new RegExp(`^\\s*[*#\\-•\\s]*${label}\\s*[::]\\s*(.+)$`, "im");
  const m = block.match(re);
  return m?.[1] ? m[1].replace(/\*+/g, "").trim() : "";
}

/** Split the pasted GPT response into its labelled sections. */
function splitSections(input: string): Record<SectionKey, string> {
  const lines = clean(input).split("\n");
  const out = {
    attributes: "",
    keywords: "",
    images: "",
    titles: "",
    description: "",
    tags: "",
  } as Record<SectionKey, string>;

  let current: SectionKey | null = null;
  const buffers: Record<string, string[]> = {};

  for (const line of lines) {
    const hit = SECTIONS.find((s) => s.re.test(line));
    if (hit) {
      current = hit.key;
      buffers[current] ??= [];
      continue;
    }
    if (current) (buffers[current] ??= []).push(line);
  }

  for (const key of Object.keys(buffers)) {
    out[key as SectionKey] = clean((buffers[key] ?? []).join("\n"));
  }
  return out;
}

const BEST_RE =
  /\b(best|recommended|final|top\s*pick|preferred|chosen|winner)\b|[✅✔️⭐🏆]/i;

/** Remove list markers, option labels, quotes and stray markdown from a title line. */
function cleanTitleLine(line: string): string {
  let t = line.trim();
  t = t.replace(/^[-•*◆●>\s]+/, "");
  // Strip list numbering like "1." / "2)" / "(3)" — but never a decimal
  // measurement such as "0.30 CT" (requires whitespace after the marker).
  t = t.replace(/^\(\d{1,2}\)\s+/, "");
  t = t.replace(/^\d{1,2}[.)\]]\s+/, "");
  t = t.replace(
    /^[*_#\s]*(?:✅|✔️|⭐|🏆)?\s*(?:recommended|best|final|top\s*pick)?\s*(?:title\s*)?(?:option|choice|variant)?\s*#?\d{0,2}\s*(?:\((?:best|recommended|final)[^)]*\))?\s*[::\-–—]\s*/i,
    "",
  );
  t = t.replace(/^[*_#\s]*(?:best|recommended|final)\s*title\s*[::\-–—]\s*/i, "");
  t = t.replace(/\*+/g, "").replace(/^#+\s*/, "");
  t = t.replace(/\s*[—–-]?\s*\(?\s*(?:✅|✔️|⭐|🏆)?\s*(?:best|recommended|final)(?:\s*(?:title|choice|pick|option))?\s*\)?\s*$/i, "");
  t = t.replace(/^["“”'`]+|["“”'`]+$/g, "");
  return t.trim();
}

function looksLikeTitle(t: string): boolean {
  if (t.length < 12) return false;
  if (/^(character\s*count|length|note|why|reason|seo)\b/i.test(t)) return false;
  return /[A-Za-z]/.test(t);
}

/** Score a title: prefer Etsy's 140-char sweet spot and keyword richness. */
function scoreTitle(t: string): number {
  const len = t.length;
  const lengthScore = len <= 140 ? len / 140 : Math.max(0, 1 - (len - 140) / 140);
  const commas = (t.match(/[,|]/g) ?? []).length;
  return lengthScore * 100 + Math.min(commas, 6) * 3;
}

export function parseTitles(
  titleBlock: string,
  fullInput: string,
): { options: [string, string, string]; best: string } {
  const source = titleBlock.trim() ? titleBlock : "";
  const rawLines = source.split("\n").filter((l) => l.trim());

  const found: { text: string; marked: boolean }[] = [];
  let markedText = "";

  for (const line of rawLines) {
    const marked = BEST_RE.test(line);
    const text = cleanTitleLine(line);
    if (!looksLikeTitle(text)) continue;
    const isLabelledBest = /^[*_#\s]*(?:best|recommended|final)\s*title\b/i.test(line.trim());
    if (isLabelledBest) {
      markedText = text;
      continue;
    }
    if (marked && !markedText) markedText = text;
    if (!found.some((f) => f.text === text)) found.push({ text, marked });
  }

  // Fallback: look anywhere in the response for an explicit best title.
  if (!markedText) {
    const m = fullInput.match(/^[*_#\s>-]*(?:best|recommended|final)\s*title\s*[::\-–—]\s*(.+)$/im);
    if (m?.[1]) markedText = cleanTitleLine(m[1]);
  }

  const options: [string, string, string] = ["", "", ""];
  found.slice(0, 3).forEach((f, i) => {
    options[i] = f.text;
  });

  // If the marked best isn't in the list, keep it as an option too.
  if (markedText && !options.includes(markedText)) {
    const emptyIdx = options.findIndex((o) => !o);
    if (emptyIdx !== -1) options[emptyIdx] = markedText;
  }

  let best = markedText;
  if (!best) {
    const candidates = options.filter(Boolean);
    best = candidates.sort((a, b) => scoreTitle(b) - scoreTitle(a))[0] ?? "";
  }

  return { options, best };
}

export function parseGptResponse(input: string): ParsedResponse {
  const result = emptyParsed();
  if (!input.trim()) return result;

  const s = splitSections(input);

  result.category = labelled(s.attributes, "category");
  result.setting = labelled(s.attributes, "setting");
  result.shankType = labelled(s.attributes, "shank\\s*type");
  result.style = labelled(s.attributes, "style");
  result.shopSection = labelled(s.attributes, "shop\\s*section");
  result.keywordAnalysis = s.keywords;
  result.imageAttributes = s.images;

  const { options: opts, best } = parseTitles(s.titles, input);
  result.titleOptions = opts;
  result.finalTitle = best;

  result.description = s.description;

  const tagText = s.tags.replace(/\n/g, ", ");
  result.tags = tagText
    .split(",")
    .map((t) => t.replace(/^[-•*\s]+/, "").trim())
    .filter(Boolean);

  const checks: [string, boolean][] = [
    ["category", !!result.category],
    ["setting", !!result.setting],
    ["shank type", !!result.shankType],
    ["style", !!result.style],
    ["shop section", !!result.shopSection],
    ["keyword analysis", !!result.keywordAnalysis],
    ["image-based attributes", !!result.imageAttributes],
    ["title options", opts.some(Boolean)],
    ["final title", !!result.finalTitle],
    ["description", !!result.description],
    ["tags", result.tags.length > 0],
  ];
  result.missing = checks.filter(([, ok]) => !ok).map(([name]) => name);
  return result;
}
