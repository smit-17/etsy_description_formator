import { useCloudData } from "@/hooks/use-cloud-data";
import { createFileRoute, Link } from "@tanstack/react-router";
import { SectionHeader, mainTabs } from "@/components/SectionHeader";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  Eye,
  FileText,
  History,
  Pencil,
  Plus,
  Star,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import {
  byteSize,
  copyText,
  createPrompt,
  downloadText,
  duplicatePrompt,
  formatDate,
  formatDateTime,
  formatSize,
  loadDefaultId,
  loadPrompts,
  savePrompts,
  saveDefaultId,
  sortPrompts,
  updatePrompt,
  type SavedPrompt,
  type SortKey,
} from "@/lib/prompts-store";

export const Route = createFileRoute("/prompts")({
  head: () => ({
    meta: [
      { title: "Saved Prompts — Etsy Description Formatter" },
      {
        name: "description",
        content:
          "Store, version and manage your Etsy description-generation prompts locally in your browser — upload .md or .txt files or paste them manually.",
      },
      { property: "og:title", content: "Saved Prompts" },
      {
        property: "og:description",
        content:
          "Upload, organise and version your Etsy description prompts. Everything stays in your browser.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PromptsPage,
});

const sortChoices: { value: SortKey; label: string }[] = [
  { value: "updated", label: "Recently updated" },
  { value: "created", label: "Recently added" },
  { value: "name", label: "Prompt name" },
  { value: "version", label: "Version" },
];

const pillBase =
  "inline-flex items-center justify-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-gold";

function PromptsPage() {
  const [prompts, setPrompts] = useState<SavedPrompt[]>([]);
  const [defaultId, setDefaultId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("updated");
  const [filterDefaultOnly, setFilterDefaultOnly] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [composerOpen, setComposerOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftNote, setDraftNote] = useState("");
  const [draftContent, setDraftContent] = useState("");

  const [viewId, setViewId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editContent, setEditContent] = useState("");

  const fileRef = useRef<HTMLInputElement>(null);

  useCloudData(() => {
    setPrompts(loadPrompts());
    setDefaultId(loadDefaultId());
    setLoaded(true);
  });

  useEffect(() => {
    // Only push local edits; data that just arrived from the cloud is skipped.
    if (loaded && prompts !== loadPrompts()) savePrompts(prompts);
  }, [prompts, loaded]);

  const flash = useCallback((key: string) => {
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(null), 1600);
  }, []);

  const doCopy = useCallback(
    async (text: string, key: string) => {
      await copyText(text);
      flash(key);
    },
    [flash],
  );

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const added: SavedPrompt[] = [];
    for (const file of Array.from(files)) {
      const text = await file.text();
      added.push(
        createPrompt({
          name: file.name.replace(/\.(md|txt)$/i, ""),
          note: "Uploaded prompt file",
          content: text,
          fileName: file.name,
          fileType:
            file.type || (file.name.toLowerCase().endsWith(".md") ? "text/markdown" : "text/plain"),
        }),
      );
    }
    setPrompts((p) => [...added, ...p]);
  }, []);

  const savedDraft = () => {
    if (!draftContent.trim()) return;
    setPrompts((p) => [
      createPrompt({ name: draftName, note: draftNote, content: draftContent }),
      ...p,
    ]);
    setDraftName("");
    setDraftNote("");
    setDraftContent("");
    setComposerOpen(false);
  };

  const startEdit = (p: SavedPrompt) => {
    setEditId(p.id);
    setEditName(p.name);
    setEditNote(p.note);
    setEditContent(p.content);
  };

  const commitEdit = () => {
    setPrompts((list) =>
      list.map((p) =>
        p.id === editId
          ? updatePrompt(p, { name: editName, note: editNote, content: editContent })
          : p,
      ),
    );
    setEditId(null);
  };

  const restoreVersion = (id: string, version: number) => {
    setPrompts((list) =>
      list.map((p) => {
        if (p.id !== id) return p;
        const target = p.history.find((h) => h.version === version);
        if (!target) return p;
        return updatePrompt(p, { content: target.content, note: target.note });
      }),
    );
  };

  const removePrompt = (id: string) => {
    setPrompts((list) => list.filter((p) => p.id !== id));
    if (defaultId === id) {
      setDefaultId(null);
      saveDefaultId(null);
    }
  };

  const setAsDefault = (id: string) => {
    const next = defaultId === id ? null : id;
    setDefaultId(next);
    saveDefaultId(next);
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = prompts.filter(
      (p) =>
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.note.toLowerCase().includes(q) ||
        p.content.toLowerCase().includes(q),
    );
    if (filterDefaultOnly) list = list.filter((p) => p.id === defaultId);
    return sortPrompts(list, sort);
  }, [prompts, query, sort, filterDefaultOnly, defaultId]);

  const latest = useMemo(() => sortPrompts(prompts, "updated")[0] ?? null, [prompts]);
  const viewPrompt = prompts.find((p) => p.id === viewId) ?? null;
  const historyPrompt = prompts.find((p) => p.id === historyId) ?? null;

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-background pb-16">
      <SectionHeader
        title="Saved Prompts"
        subtitle="Store, version and organise your prompts"
        backTo="/saved"
        backLabel="Saved Descriptions"
        tabs={mainTabs("prompts")}
      />

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        {/* Add prompts */}
        <section className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)] sm:p-6">
          <div className="flex flex-wrap gap-3">
            <input
              ref={fileRef}
              type="file"
              accept=".md,.txt,text/markdown,text/plain"
              multiple
              className="hidden"
              onChange={(e) => {
                void handleFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-navy px-5 py-3 text-sm font-semibold text-navy-foreground shadow-[var(--shadow-soft)] transition-transform hover:-translate-y-0.5"
            >
              <Upload className="h-4 w-4 shrink-0" /> Upload .md / .txt files
            </button>
            <button
              type="button"
              onClick={() => setComposerOpen((v) => !v)}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-gold bg-[image:var(--gradient-gold)] px-5 py-3 text-sm font-semibold text-gold-foreground shadow-[var(--shadow-soft)] transition-transform hover:-translate-y-0.5"
            >
              <Plus className="h-4 w-4 shrink-0" /> Paste a prompt
            </button>
          </div>

          {composerOpen && (
            <div className="mt-5 grid gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  placeholder="Prompt name"
                  className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-gold focus:ring-4 focus:ring-gold/20"
                />
                <input
                  value={draftNote}
                  onChange={(e) => setDraftNote(e.target.value)}
                  placeholder="Short note or description"
                  className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-gold focus:ring-4 focus:ring-gold/20"
                />
              </div>
              <textarea
                value={draftContent}
                onChange={(e) => setDraftContent(e.target.value)}
                spellCheck={false}
                placeholder="Paste your prompt here…"
                className="h-48 w-full resize-y rounded-xl border border-input bg-background p-4 text-sm leading-relaxed text-foreground outline-none focus:border-gold focus:ring-4 focus:ring-gold/20"
              />
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={savedDraft} className={pillBase}>
                  <Check className="h-3.5 w-3.5" /> Save prompt
                </button>
                <button
                  type="button"
                  onClick={() => setComposerOpen(false)}
                  className={`${pillBase} text-muted-foreground`}
                >
                  <X className="h-3.5 w-3.5" /> Cancel
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Search & sort */}
        <section className="mt-6 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)] sm:p-6">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search prompts by name, note or content…"
            className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground outline-none focus:border-gold focus:ring-4 focus:ring-gold/20"
          />
          <div className="mt-4 flex flex-wrap gap-2">
            {sortChoices.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setSort(c.value)}
                className={`rounded-full border px-3.5 py-1.5 text-xs transition-all ${
                  sort === c.value
                    ? "border-transparent bg-navy text-navy-foreground shadow-[var(--shadow-soft)]"
                    : "border-border bg-card text-foreground hover:border-gold"
                }`}
              >
                {c.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setFilterDefaultOnly((v) => !v)}
              className={`rounded-full border px-3.5 py-1.5 text-xs transition-all ${
                filterDefaultOnly
                  ? "border-transparent bg-navy text-navy-foreground shadow-[var(--shadow-soft)]"
                  : "border-border bg-card text-foreground hover:border-gold"
              }`}
            >
              Default only
            </button>
          </div>
        </section>

        {/* Latest updated highlight */}
        {latest && (
          <section className="mt-6 rounded-2xl border border-gold bg-ivory p-4 shadow-[var(--shadow-card)] sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Last updated prompt
            </p>
            <div className="mt-3 min-w-0">
              <h2 className="truncate font-[family-name:var(--font-display)] text-xl font-semibold text-foreground">
                {latest.name}
              </h2>
              <p className="mt-1 break-words text-sm text-muted-foreground">
                {latest.note || "No note added."}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                v{latest.version} · updated {formatDateTime(latest.updatedAt)}
              </p>
            </div>
          </section>
        )}

        {/* Cards */}
        <div className="mt-6 grid gap-4">
          {visible.length === 0 && (
            <p className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
              No saved prompts yet. Upload a .md / .txt file or paste a prompt to get started.
            </p>
          )}

          {visible.map((p) => {
            const size = byteSize(p.content);
            const isEditing = editId === p.id;
            return (
              <article
                key={p.id}
                className="min-w-0 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)] sm:p-6"
              >
                <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <h3 className="min-w-0 break-words font-[family-name:var(--font-display)] text-lg font-semibold text-foreground">
                        {p.name}
                      </h3>
                      {defaultId === p.id && (
                        <span className="shrink-0 rounded-full border border-gold bg-[image:var(--gradient-gold)] px-2.5 py-0.5 text-[11px] font-semibold text-gold-foreground">
                          Default
                        </span>
                      )}
                      <span className="shrink-0 rounded-full bg-secondary px-2.5 py-0.5 text-[11px] text-muted-foreground">
                        v{p.version}
                      </span>
                    </div>
                    <p className="mt-1 break-words text-sm text-muted-foreground">
                      {p.note || "No note added."}
                    </p>
                  </div>
                </div>

                <dl className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
                  <div className="min-w-0">
                    <dt className="font-semibold uppercase tracking-[0.1em]">File</dt>
                    <dd className="mt-0.5 flex min-w-0 items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{p.fileName}</span>
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="font-semibold uppercase tracking-[0.1em]">Type / size</dt>
                    <dd className="mt-0.5 truncate">
                      {p.fileType} · {formatSize(size)}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="font-semibold uppercase tracking-[0.1em]">Created</dt>
                    <dd className="mt-0.5 truncate">{formatDate(p.createdAt)}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="font-semibold uppercase tracking-[0.1em]">Last updated</dt>
                    <dd className="mt-0.5 truncate">{formatDateTime(p.updatedAt)}</dd>
                  </div>
                </dl>

                {isEditing ? (
                  <div className="mt-4 grid gap-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-gold focus:ring-4 focus:ring-gold/20"
                      />
                      <input
                        value={editNote}
                        onChange={(e) => setEditNote(e.target.value)}
                        className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-gold focus:ring-4 focus:ring-gold/20"
                      />
                    </div>
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      spellCheck={false}
                      className="h-56 w-full resize-y rounded-xl border border-input bg-background p-4 text-sm leading-relaxed text-foreground outline-none focus:border-gold focus:ring-4 focus:ring-gold/20"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={commitEdit} className={pillBase}>
                        <Check className="h-3.5 w-3.5" /> Save new version
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditId(null)}
                        className={`${pillBase} text-muted-foreground`}
                      >
                        <X className="h-3.5 w-3.5" /> Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setViewId(viewId === p.id ? null : p.id)}
                      className={pillBase}
                    >
                      <Eye className="h-3.5 w-3.5" /> View
                    </button>
                    <button
                      type="button"
                      onClick={() => void doCopy(p.content, p.id)}
                      className={pillBase}
                    >
                      {copiedKey === p.id ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      {copiedKey === p.id ? "Copied!" : "Copy"}
                    </button>
                    <button type="button" onClick={() => startEdit(p)} className={pillBase}>
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setPrompts((list) => [duplicatePrompt(p), ...list])}
                      className={pillBase}
                    >
                      <Copy className="h-3.5 w-3.5" /> Duplicate
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadText(p.fileName, p.content)}
                      className={pillBase}
                    >
                      <Download className="h-3.5 w-3.5" /> Download
                    </button>
                    <button
                      type="button"
                      onClick={() => setHistoryId(historyId === p.id ? null : p.id)}
                      className={pillBase}
                    >
                      <History className="h-3.5 w-3.5" /> History ({p.history.length})
                    </button>
                    <button type="button" onClick={() => setAsDefault(p.id)} className={pillBase}>
                      <Star className="h-3.5 w-3.5" />
                      {defaultId === p.id ? "Unset default" : "Set as default"}
                    </button>
                    <button
                      type="button"
                      onClick={() => removePrompt(p.id)}
                      className={`${pillBase} text-muted-foreground hover:border-destructive hover:text-destructive`}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  </div>
                )}

                {viewPrompt?.id === p.id && !isEditing && (
                  <pre className="mt-4 max-h-80 w-full overflow-auto rounded-xl border border-border bg-ivory p-4 text-xs leading-relaxed whitespace-pre-wrap break-words text-foreground">
                    {p.content}
                  </pre>
                )}

                {historyPrompt?.id === p.id && (
                  <div className="mt-4 rounded-xl border border-border bg-secondary/50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Version history
                    </p>
                    {p.history.length === 0 ? (
                      <p className="mt-2 text-sm text-muted-foreground">
                        No previous versions yet.
                      </p>
                    ) : (
                      <ul className="mt-3 grid gap-2">
                        {p.history.map((h) => (
                          <li
                            key={h.version}
                            className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2"
                          >
                            <span className="min-w-0 truncate text-xs text-muted-foreground">
                              v{h.version} · {formatDateTime(h.savedAt)} ·{" "}
                              {formatSize(byteSize(h.content))}
                            </span>
                            <span className="flex shrink-0 gap-2">
                              <button
                                type="button"
                                onClick={() => void doCopy(h.content, `${p.id}-${h.version}`)}
                                className={pillBase}
                              >
                                {copiedKey === `${p.id}-${h.version}` ? "Copied!" : "Copy"}
                              </button>
                              <button
                                type="button"
                                onClick={() => restoreVersion(p.id, h.version)}
                                className={pillBase}
                              >
                                Restore
                              </button>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Prompts are stored only in this browser. No login, backend or external API involved.
        </p>
      </main>
    </div>
  );
}
