import { useCloudData } from "@/hooks/use-cloud-data";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  Copy,
  Eraser,
  FileText,
  Pencil,
  Plus,
  Save,
  Sparkles,
  Wand2,
} from "lucide-react";
import {
  BASE_CATEGORIES,
  loadCategories,
  loadListings,
  newId,
  saveCategories,
  saveListings,
  type SavedListing,
} from "@/lib/listings-store";

import { SectionHeader, mainTabs } from "@/components/SectionHeader";
import { parseGptResponse, emptyParsed, type ParsedResponse } from "@/lib/description-parse";
import {
  defaultOptions,
  formatEtsy,
  stripExtraSpaces,
  type BulletStyle,
  type FormatOptions,
  type HeadingStyle,
} from "@/lib/etsy-format";

interface StudioSearch {
  id?: string;
}

export const Route = createFileRoute("/description")({
  validateSearch: (search: Record<string, unknown>): StudioSearch => {
    const id = search["id"];
    return typeof id === "string" && id ? { id } : {};
  },
  head: () => ({
    meta: [
      { title: "Description — Paste, Extract & Style Etsy Listings" },
      {
        name: "description",
        content:
          "Paste a full ChatGPT jewelry response and automatically extract the title, tags, attributes and a styled Etsy-ready description.",
      },
      { property: "og:title", content: "Description Editor" },
      {
        property: "og:description",
        content:
          "Paste a full ChatGPT response and get the title, tags, attributes and styled Etsy description in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DescriptionStudio,
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

type Fields = ParsedResponse;

function Card({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)] sm:p-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <h2 className="truncate font-[family-name:var(--font-display)] text-xl font-semibold text-foreground">
          {title}
        </h2>
        {right}
      </div>
      <div className="mt-4 min-w-0">{children}</div>
    </section>
  );
}

function CopyButton({
  text,
  label = "Copy",
  onCopy,
  copied,
}: {
  text: string;
  label?: string;
  onCopy: (t: string) => void;
  copied: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onCopy(text)}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-gold"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied!" : label}
    </button>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-shadow focus:border-gold focus:ring-4 focus:ring-gold/20"
      />
    </label>
  );
}

function DescriptionStudio() {
  const navigate = useNavigate();
  const [raw, setRaw] = useState("");
  const [fields, setFields] = useState<Fields>(emptyParsed);
  const [options, setOptions] = useState<FormatOptions>(defaultOptions);
  const [copied, setCopied] = useState<string | null>(null);

  // ---- Listing details + saved listings ----
  const [sku, setSku] = useState("");
  const [listingCategory, setListingCategory] = useState("");
  const [categories, setCategories] = useState<string[]>(BASE_CATEGORIES);
  const [newCategory, setNewCategory] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [listings, setListings] = useState<SavedListing[]>([]);
  const [saveMsg, setSaveMsg] = useState("");
  const [saveError, setSaveError] = useState("");
  const [conflictSku, setConflictSku] = useState<string | null>(null);
  const [savedSku, setSavedSku] = useState("");

  const search = Route.useSearch();
  const openId = search.id;

  useCloudData(() => {
    setListings(loadListings());
    setCategories(loadCategories());
  });

  // A fresh studio always starts blank; only an explicit ?id= loads a record.
  useEffect(() => {
    if (!openId) return;
    const l = listings.find((x) => x.id === openId);
    if (!l) return;
    setRaw(l.raw);
    setFields({ ...emptyParsed(), ...l.fields });
    setOptions({ ...defaultOptions, ...l.options });
    setSku(l.sku);
    setListingCategory(l.listingCategory);
    setEditingId(l.id);
  }, [openId, listings]);

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

  const extract = useCallback(
    (text: string) => {
      const source = text ?? raw;
      if (!source.trim()) return;
      setFields(parseGptResponse(source));
    },
    [raw],
  );

  const set = <K extends keyof Fields>(k: K, v: Fields[K]) => setFields((f) => ({ ...f, [k]: v }));

  const styled = useMemo(
    () => formatEtsy(fields.description, options),
    [fields.description, options],
  );

  const tagLine = fields.tags.join(", ");

  const persistListings = useCallback((next: SavedListing[]) => {
    setListings(next);
    saveListings(next);
  }, []);

  const commitSave = useCallback(
    (mode: "new" | "update") => {
      const now = new Date().toISOString();
      const trimmedSku = sku.trim();
      const current = loadListings();
      const existing = current.find((l) => l.sku.toLowerCase() === trimmedSku.toLowerCase());
      const record: SavedListing = {
        id: existing?.id ?? editingId ?? newId(),
        sku: trimmedSku,
        listingCategory,
        raw,
        fields,
        options,
        styled,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      const next =
        mode === "update" && existing
          ? current.map((l) => (l.id === existing.id ? record : l))
          : [record, ...current.filter((l) => l.id !== record.id)];
      persistListings(next);
      setEditingId(record.id);
      setConflictSku(null);
      setSavedSku(record.sku);
      setSaveMsg("Save Description ✓");
    },
    [sku, listingCategory, raw, fields, options, styled, editingId, persistListings],
  );

  const handleSaveListing = useCallback(() => {
    const trimmedSku = sku.trim();
    if (!trimmedSku) {
      setSaveError("SKU is required.");
      window.setTimeout(() => setSaveError(""), 2500);
      return;
    }
    setSaveError("");
    const existing = loadListings().find((l) => l.sku.toLowerCase() === trimmedSku.toLowerCase());
    if (existing && existing.id !== editingId) {
      setConflictSku(trimmedSku);
      return;
    }
    commitSave(existing ? "update" : "new");
  }, [sku, editingId, commitSave]);

  const resetAll = useCallback(() => {
    setRaw("");
    setFields(emptyParsed());
    setOptions(defaultOptions);
    setSku("");
    setListingCategory("");
    setEditingId(null);
    setConflictSku(null);
    setSaveError("");
    setSaveMsg("");
    setSavedSku("");
    navigate({ to: "/description", search: {} });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [navigate]);

  const attributes: [string, keyof Fields][] = [
    ["Category", "category"],
    ["Setting", "setting"],
    ["Shank type", "shankType"],
    ["Style", "style"],
    ["Shop section", "shopSection"],
  ];

  const copyAll = [
    `TITLE\n${fields.finalTitle}`,
    `TAGS\n${tagLine}`,
    ...attributes
      .map(([label, key]) => [label, String(fields[key] ?? "")] as const)
      .filter(([, v]) => v)
      .map(([label, v]) => `${label.toUpperCase()}: ${v}`),
    `DESCRIPTION\n${styled}`,
  ].join("\n\n");

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-background pb-10">
      <SectionHeader
        title="Description"
        subtitle="Paste the full ChatGPT response to fill every field"
        backTo="/saved"
        backLabel="Saved Descriptions"
        tabs={mainTabs("description")}
        actions={
          <button
            type="button"
            onClick={resetAll}
            className="inline-flex items-center gap-1.5 rounded-full bg-[image:var(--gradient-gold)] px-4 py-1.5 text-xs font-semibold text-gold-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">New Description</span>
          </button>
        }
      />

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 sm:py-10">
        <Card
          title="Paste full ChatGPT response"
          right={
            <span className="shrink-0 rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">
              {raw.length.toLocaleString()} chars
            </span>
          }
        >
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            onPaste={(e) => {
              const text = e.clipboardData.getData("text");
              if (text) window.setTimeout(() => extract(text), 0);
            }}
            spellCheck={false}
            placeholder="Paste the complete response — ETSY LISTING ATTRIBUTES, KEYWORD ANALYSIS, IMAGE-BASED ATTRIBUTES, TITLE OPTIONS, DESCRIPTION, TAGS…"
            className="h-56 w-full resize-y rounded-xl border border-input bg-background p-4 font-mono text-xs leading-relaxed text-foreground outline-none transition-shadow placeholder:text-muted-foreground/70 focus:border-gold focus:ring-4 focus:ring-gold/20"
          />
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => extract(raw)}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-navy-foreground shadow-[var(--shadow-soft)] transition-transform hover:-translate-y-0.5"
            >
              <Wand2 className="h-4 w-4" /> Extract Fields
            </button>
            <button
              type="button"
              onClick={() => {
                setRaw("");
                setFields(emptyParsed());
              }}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-destructive hover:text-destructive"
            >
              <Eraser className="h-4 w-4" /> Clear All
            </button>
          </div>
          {fields.missing.length ? (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-gold/50 bg-secondary/60 p-3 text-xs text-foreground">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
              <span>Not found in the response, fill in manually: {fields.missing.join(", ")}</span>
            </div>
          ) : null}
        </Card>

        <Card
          title="Final title"
          right={
            <CopyButton
              text={fields.finalTitle}
              onCopy={(t) => copy(t, "title")}
              copied={copied === "title"}
            />
          }
        >
          <textarea
            value={fields.finalTitle}
            onChange={(e) => set("finalTitle", e.target.value)}
            className="h-20 w-full resize-y rounded-xl border border-input bg-background p-3 text-sm text-foreground outline-none focus:border-gold focus:ring-4 focus:ring-gold/20"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {fields.finalTitle.length} characters
          </p>
          {fields.titleOptions.some(Boolean) ? (
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {fields.titleOptions.map((t, i) => (
                <div
                  key={i}
                  className="min-w-0 rounded-xl border border-border bg-secondary/40 p-3"
                >
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Title option {i + 1}
                  </p>
                  <p className="break-words text-sm text-foreground">{t || "—"}</p>
                  <button
                    type="button"
                    disabled={!t}
                    onClick={() => set("finalTitle", t)}
                    className="mt-2 w-full rounded-full border border-border bg-card py-1.5 text-xs font-medium transition-colors hover:border-gold disabled:opacity-40"
                  >
                    Use as final title
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </Card>

        <Card
          title="Tags"
          right={
            <CopyButton text={tagLine} onCopy={(t) => copy(t, "tags")} copied={copied === "tags"} />
          }
        >
          <input
            value={tagLine}
            onChange={(e) =>
              set(
                "tags",
                e.target.value
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean),
              )
            }
            placeholder="comma separated tags"
            className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-gold focus:ring-4 focus:ring-gold/20"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {fields.tags.map((t) => (
              <span
                key={t}
                className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-foreground"
              >
                {t}
              </span>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{fields.tags.length} of 13 tags</p>
        </Card>

        <Card title="Etsy listing attributes">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {attributes.map(([label, key]) => (
              <TextField
                key={key}
                label={label}
                value={String(fields[key] ?? "")}
                onChange={(v) => set(key, v as never)}
              />
            ))}
          </div>
        </Card>

        <Card title="Description styling">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="min-w-0">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Heading style
              </p>
              <div className="flex flex-wrap gap-2">
                {headingChoices.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setOptions((o) => ({ ...o, headingStyle: c.value }))}
                    className={`rounded-full border px-3.5 py-1.5 text-sm transition-all ${
                      options.headingStyle === c.value
                        ? "border-transparent bg-navy text-navy-foreground shadow-[var(--shadow-soft)]"
                        : "border-border bg-card text-foreground hover:border-gold"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="min-w-0">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Bullet symbol
              </p>
              <div className="flex flex-wrap gap-2">
                {bulletChoices.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setOptions((o) => ({ ...o, bulletStyle: c.value }))}
                    className={`rounded-full border px-3.5 py-1.5 text-sm transition-all ${
                      options.bulletStyle === c.value
                        ? "border-transparent bg-navy text-navy-foreground shadow-[var(--shadow-soft)]"
                        : "border-border bg-card text-foreground hover:border-gold"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {(
              [
                ["boldLabels", "Bold labels before a colon"],
                ["normalizeBlankLines", "Normalize blank lines"],
                ["keepSeparators", "Keep horizontal separators"],
              ] as [keyof FormatOptions, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="switch"
                aria-checked={Boolean(options[key])}
                onClick={() => setOptions((o) => ({ ...o, [key]: !o[key] }))}
                className="flex w-full min-w-0 items-center justify-between gap-3 rounded-xl border border-border bg-secondary/50 px-3 py-2.5 text-left transition-colors hover:border-gold"
              >
                <span className="min-w-0 text-sm">{label}</span>
                <span
                  className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                    options[key] ? "bg-navy" : "bg-border"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-ivory shadow-[var(--shadow-soft)] transition-all ${
                      options[key] ? "left-4.5" : "left-0.5"
                    }`}
                  />
                </span>
              </button>
            ))}
          </div>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card
            title="Description (editable)"
            right={
              <span className="shrink-0 rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">
                {fields.description.length} chars
              </span>
            }
          >
            <textarea
              value={fields.description}
              onChange={(e) => set("description", e.target.value)}
              spellCheck={false}
              className="h-[460px] w-full resize-y rounded-xl border border-input bg-background p-4 text-sm leading-relaxed outline-none focus:border-gold focus:ring-4 focus:ring-gold/20"
            />
          </Card>

          <Card
            title="Etsy styled description"
            right={
              <span className="shrink-0 rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">
                {styled.length} chars
              </span>
            }
          >
            <textarea
              value={styled}
              readOnly
              spellCheck={false}
              placeholder="Your Etsy-ready description appears here…"
              className="h-[460px] w-full resize-y rounded-xl border border-input bg-ivory p-4 text-sm leading-relaxed outline-none"
            />
          </Card>
        </div>

        <Card title="Keyword analysis">
          <textarea
            value={fields.keywordAnalysis}
            onChange={(e) => set("keywordAnalysis", e.target.value)}
            className="h-40 w-full resize-y rounded-xl border border-input bg-background p-3 text-sm outline-none focus:border-gold focus:ring-4 focus:ring-gold/20"
          />
        </Card>

        <Card title="Image-based attributes">
          <textarea
            value={fields.imageAttributes}
            onChange={(e) => set("imageAttributes", e.target.value)}
            className="h-40 w-full resize-y rounded-xl border border-input bg-background p-3 text-sm outline-none focus:border-gold focus:ring-4 focus:ring-gold/20"
          />
        </Card>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => copy(styled, "styled")}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-gold bg-[image:var(--gradient-gold)] px-5 py-3 text-sm font-semibold text-gold-foreground shadow-[var(--shadow-soft)] transition-transform hover:-translate-y-0.5"
          >
            {copied === "styled" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied === "styled" ? "Copied!" : "Copy Styled Description"}
          </button>
          <button
            type="button"
            onClick={() => copy(stripExtraSpaces(styled), "tight")}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card px-5 py-3 text-sm font-medium transition-colors hover:border-gold"
          >
            {copied === "tight" ? "Copied!" : "Copy Without Extra Spaces"}
          </button>
          <button
            type="button"
            onClick={() => copy(copyAll, "all")}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-navy px-5 py-3 text-sm font-semibold text-navy-foreground shadow-[var(--shadow-soft)] transition-transform hover:-translate-y-0.5"
          >
            {copied === "all" ? "Copied!" : "Copy Everything"}
          </button>
        </div>

        <Card
          title="Listing details"
          right={
            editingId ? (
              <span className="shrink-0 rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">
                Editing saved listing
              </span>
            ) : undefined
          }
        >
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
            <TextField label="SKU (required)" value={sku} onChange={setSku} />
            <label className="block min-w-0">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Category
              </span>
              <select
                value={listingCategory}
                onChange={(e) => setListingCategory(e.target.value)}
                className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-gold focus:ring-4 focus:ring-gold/20"
              >
                <option value="">Select a category…</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={handleSaveListing}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-navy-foreground shadow-[var(--shadow-soft)] transition-transform hover:-translate-y-0.5"
            >
              <Save className="h-4 w-4" /> Save Listing
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {addingCategory ? (
              <>
                <input
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="New category name"
                  className="min-w-0 flex-1 rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-gold focus:ring-4 focus:ring-gold/20"
                />
                <button
                  type="button"
                  onClick={() => {
                    const name = newCategory.trim();
                    if (!name) return;
                    const next = Array.from(new Set([...categories, name]));
                    setCategories(next);
                    saveCategories(next);
                    setListingCategory(name);
                    setNewCategory("");
                    setAddingCategory(false);
                  }}
                  className="rounded-full border border-gold bg-card px-4 py-2 text-xs font-medium"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => setAddingCategory(false)}
                  className="rounded-full border border-border bg-card px-4 py-2 text-xs text-muted-foreground"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setAddingCategory(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium transition-colors hover:border-gold"
              >
                <Plus className="h-3.5 w-3.5" /> Add new category
              </button>
            )}
            <button
              type="button"
              onClick={resetAll}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-gold"
            >
              <Plus className="h-3.5 w-3.5" /> New Description
            </button>
          </div>

          {saveError ? (
            <p className="mt-3 text-xs font-medium text-destructive">{saveError}</p>
          ) : null}
          {saveMsg ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-foreground">
                {saveMsg}
              </span>
              <button
                type="button"
                onClick={() =>
                  navigate({ to: "/list", search: { tab: "products" as const, sku: savedSku } })
                }
                className="rounded-full bg-navy px-4 py-1.5 text-xs font-semibold text-navy-foreground"
              >
                Go to List →
              </button>
              <button
                type="button"
                onClick={resetAll}
                className="rounded-full border border-border bg-card px-4 py-1.5 text-xs font-medium transition-colors hover:border-gold"
              >
                + New Description
              </button>
            </div>
          ) : null}

          {conflictSku ? (
            <div className="mt-4 rounded-xl border border-gold/60 bg-secondary/60 p-3">
              <p className="text-sm text-foreground">
                SKU already exists — Update existing listing?
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => commitSave("update")}
                  className="rounded-full bg-navy px-4 py-2 text-xs font-semibold text-navy-foreground"
                >
                  Update
                </button>
                <button
                  type="button"
                  onClick={() => setConflictSku(null)}
                  className="rounded-full border border-border bg-card px-4 py-2 text-xs font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Everything stays in your browser. Wording, facts and measurements are never rewritten.
        </p>
      </main>
    </div>
  );
}
