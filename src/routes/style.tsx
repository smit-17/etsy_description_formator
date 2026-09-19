import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { Check, ClipboardPaste, Copy, Eraser, Wand2 } from "lucide-react";

import { SectionHeader, mainTabs } from "@/components/SectionHeader";
import {
  defaultOptions,
  formatEtsy,
  SAMPLE_INPUT,
  stripExtraSpaces,
  type BulletStyle,
  type FormatOptions,
  type HeadingStyle,
} from "@/lib/etsy-format";

export const Route = createFileRoute("/style")({
  head: () => ({
    meta: [
      { title: "Style Description — Etsy Unicode Formatter" },
      {
        name: "description",
        content:
          "Convert AI-generated Markdown product descriptions into clean, Etsy-ready text with Unicode bold headings and tidy bullet points.",
      },
      { property: "og:title", content: "Style Description" },
      {
        property: "og:description",
        content:
          "Convert AI text into clean, styled, copy-ready Etsy descriptions — free and fully in your browser.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StylePage,
});

const headingChoices: { value: HeadingStyle; label: string }[] = [
  { value: "star", label: "✦ Heading ✦" },
  { value: "diamond", label: "◆ Heading" },
  { value: "plain", label: "𝐇𝐄𝐀𝐃𝐈𝐍𝐆" },
];

const bulletChoices: { value: BulletStyle; label: string }[] = [
  { value: "diamond", label: "◆" },
  { value: "dot", label: "•" },
  { value: "dash", label: "-" },
  { value: "keep", label: "Keep" },
];

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="group flex w-full min-w-0 items-center justify-between gap-3 rounded-xl border border-border bg-secondary/50 px-3 py-2.5 text-left transition-colors hover:border-gold"
    >
      <span className="min-w-0 text-sm text-foreground">{label}</span>
      <span
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
          checked ? "bg-navy" : "bg-border"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-ivory shadow-[var(--shadow-soft)] transition-all ${
            checked ? "left-4.5" : "left-0.5"
          }`}
        />
      </span>
    </button>
  );
}

function SegmentedGroup<T extends string>({
  label,
  value,
  choices,
  onChange,
}: {
  label: string;
  value: T;
  choices: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="min-w-0">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {choices.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => onChange(c.value)}
            className={`rounded-full border px-3.5 py-1.5 text-sm transition-all ${
              value === c.value
                ? "border-transparent bg-navy text-navy-foreground shadow-[var(--shadow-soft)]"
                : "border-border bg-card text-foreground hover:border-gold"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function StylePage() {
  const [input, setInput] = useState("");
  const [options, setOptions] = useState<FormatOptions>(defaultOptions);
  const [copied, setCopied] = useState<string | null>(null);

  const output = useMemo(() => formatEtsy(input, options), [input, options]);

  const copy = useCallback(async (text: string, key: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(key);
    window.setTimeout(() => setCopied(null), 1800);
  }, []);

  const setOpt = <K extends keyof FormatOptions>(k: K, v: FormatOptions[K]) =>
    setOptions((o) => ({ ...o, [k]: v }));

  const actions = (
    <>
      <button
        type="button"
        onClick={() => setInput((v) => v)}
        className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-navy px-5 py-3 text-sm font-semibold text-navy-foreground shadow-[var(--shadow-soft)] transition-transform hover:-translate-y-0.5 active:translate-y-0"
      >
        <Wand2 className="h-4 w-4 shrink-0" /> Convert to Etsy Style
      </button>
      <button
        type="button"
        onClick={() => copy(output, "main")}
        className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-gold bg-[image:var(--gradient-gold)] px-5 py-3 text-sm font-semibold text-gold-foreground shadow-[var(--shadow-soft)] transition-transform hover:-translate-y-0.5 active:translate-y-0"
      >
        {copied === "main" ? (
          <Check className="h-4 w-4 shrink-0" />
        ) : (
          <Copy className="h-4 w-4 shrink-0" />
        )}
        {copied === "main" ? "Copied!" : "Copy Styled Description"}
      </button>
      <button
        type="button"
        onClick={() => copy(stripExtraSpaces(output), "tight")}
        className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card px-5 py-3 text-sm font-medium text-foreground transition-colors hover:border-gold"
      >
        {copied === "tight" ? "Copied!" : "Copy Without Extra Spaces"}
      </button>
      <button
        type="button"
        onClick={() => setInput(SAMPLE_INPUT)}
        className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card px-5 py-3 text-sm font-medium text-foreground transition-colors hover:border-gold"
      >
        <ClipboardPaste className="h-4 w-4 shrink-0" /> Paste Sample
      </button>
      <button
        type="button"
        onClick={() => setInput("")}
        className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card px-5 py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-destructive hover:text-destructive"
      >
        <Eraser className="h-4 w-4 shrink-0" /> Clear
      </button>
    </>
  );

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-background pb-28 md:pb-10">
      <SectionHeader
        title="Style Description"
        subtitle="Convert AI text into clean, styled, copy-ready Etsy descriptions"
        backTo="/saved"
        tabs={mainTabs("style")}
      />

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        <section className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)] sm:p-6">
          <div className="grid gap-5 sm:grid-cols-2">
            <SegmentedGroup
              label="Heading style"
              value={options.headingStyle}
              choices={headingChoices}
              onChange={(v) => setOpt("headingStyle", v)}
            />
            <SegmentedGroup
              label="Bullet symbol"
              value={options.bulletStyle}
              choices={bulletChoices}
              onChange={(v) => setOpt("bulletStyle", v)}
            />
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Toggle
              checked={options.boldLabels}
              onChange={(v) => setOpt("boldLabels", v)}
              label="Bold labels before a colon"
            />
            <Toggle
              checked={options.normalizeBlankLines}
              onChange={(v) => setOpt("normalizeBlankLines", v)}
              label="Normalize blank lines"
            />
            <Toggle
              checked={options.keepSeparators}
              onChange={(v) => setOpt("keepSeparators", v)}
              label="Keep horizontal separators"
            />
          </div>
        </section>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <section className="flex min-w-0 flex-col rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)] sm:p-6">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <h2 className="truncate font-[family-name:var(--font-display)] text-xl font-semibold text-foreground">
                Paste AI Description
              </h2>
              <span className="shrink-0 rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">
                {input.length} chars
              </span>
            </div>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              spellCheck={false}
              placeholder="Paste your AI-generated description with #, **bold**, bullets and --- separators…"
              className="mt-4 h-[420px] w-full resize-y rounded-xl border border-input bg-background p-4 font-[family-name:var(--font-sans)] text-sm leading-relaxed text-foreground outline-none transition-shadow placeholder:text-muted-foreground/70 focus:border-gold focus:ring-4 focus:ring-gold/20 md:h-[520px]"
            />
          </section>

          <section className="flex min-w-0 flex-col rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)] sm:p-6">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <h2 className="truncate font-[family-name:var(--font-display)] text-xl font-semibold text-foreground">
                Etsy Styled Description
              </h2>
              <span className="shrink-0 rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">
                {output.length} chars
              </span>
            </div>
            <textarea
              value={output}
              readOnly
              spellCheck={false}
              placeholder="Your Etsy-ready description appears here…"
              className="mt-4 h-[420px] w-full resize-y rounded-xl border border-input bg-ivory p-4 font-[family-name:var(--font-sans)] text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/70 md:h-[520px]"
            />
          </section>
        </div>

        <div className="mt-6 hidden flex-wrap gap-3 md:flex">{actions}</div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Everything runs locally in your browser. Your wording, measurements and facts are never
          changed.
        </p>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 p-3 shadow-[0_-8px_24px_-16px_oklch(0.243_0.055_262/0.4)] backdrop-blur md:hidden">
        <div className="flex flex-wrap gap-2 [&>button]:flex-1 [&>button]:py-2.5 [&>button]:text-xs">
          {actions}
        </div>
      </div>
    </div>
  );
}
