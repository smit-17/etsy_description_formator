export type PromptVersion = {
  version: number;
  content: string;
  note: string;
  savedAt: string;
};

export type SavedPrompt = {
  id: string;
  name: string;
  note: string;
  content: string;
  version: number;
  fileName: string;
  fileType: string;
  createdAt: string;
  updatedAt: string;
  history: PromptVersion[];
};

const KEY = "etsy-saved-prompts-v1";
const DEFAULT_KEY = "etsy-saved-prompts-default-v1";

export function byteSize(text: string) {
  try {
    return new TextEncoder().encode(text).length;
  } catch {
    return text.length;
  }
}

export function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function formatDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export function loadPrompts(): SavedPrompt[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedPrompt[]) : [];
  } catch {
    return [];
  }
}

export function savePrompts(prompts: SavedPrompt[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(prompts));
  } catch {
    /* ignore */
  }
}

export function loadDefaultId(): string | null {
  try {
    return localStorage.getItem(DEFAULT_KEY);
  } catch {
    return null;
  }
}

export function saveDefaultId(id: string | null) {
  try {
    if (id) localStorage.setItem(DEFAULT_KEY, id);
    else localStorage.removeItem(DEFAULT_KEY);
  } catch {
    /* ignore */
  }
}

export function newId() {
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createPrompt(input: {
  name: string;
  note?: string;
  content: string;
  fileName?: string;
  fileType?: string;
}): SavedPrompt {
  const now = new Date().toISOString();
  return {
    id: newId(),
    name: input.name.trim() || "Untitled prompt",
    note: input.note?.trim() ?? "",
    content: input.content,
    version: 1,
    fileName: input.fileName ?? `${(input.name || "prompt").trim().replace(/\s+/g, "-").toLowerCase()}.md`,
    fileType: input.fileType ?? "text/markdown",
    createdAt: now,
    updatedAt: now,
    history: [],
  };
}

/** Update a prompt, pushing the previous state into version history. */
export function updatePrompt(
  prompt: SavedPrompt,
  patch: { name?: string; note?: string; content?: string },
): SavedPrompt {
  const now = new Date().toISOString();
  const changed =
    (patch.content !== undefined && patch.content !== prompt.content) ||
    (patch.note !== undefined && patch.note !== prompt.note) ||
    (patch.name !== undefined && patch.name !== prompt.name);
  if (!changed) return prompt;

  return {
    ...prompt,
    name: (patch.name ?? prompt.name).trim() || prompt.name,
    note: patch.note ?? prompt.note,
    content: patch.content ?? prompt.content,
    version: prompt.version + 1,
    updatedAt: now,
    history: [
      {
        version: prompt.version,
        content: prompt.content,
        note: prompt.note,
        savedAt: prompt.updatedAt,
      },
      ...prompt.history,
    ].slice(0, 30),
  };
}

export function duplicatePrompt(prompt: SavedPrompt): SavedPrompt {
  const now = new Date().toISOString();
  return {
    ...prompt,
    id: newId(),
    name: `${prompt.name} (copy)`,
    version: 1,
    history: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function downloadText(fileName: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function copyText(text: string) {
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
}

export type SortKey = "updated" | "created" | "name" | "version";

export function sortPrompts(prompts: SavedPrompt[], key: SortKey) {
  const list = [...prompts];
  switch (key) {
    case "created":
      return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    case "name":
      return list.sort((a, b) => a.name.localeCompare(b.name));
    case "version":
      return list.sort((a, b) => b.version - a.version);
    default:
      return list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
}
