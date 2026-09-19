import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import type { Account, ListingRecord, Targets } from "@/lib/list-store";
import type { SavedListing } from "@/lib/listings-store";
import type { SavedPrompt } from "@/lib/prompts-store";

/**
 * Dedicated client for the shared (non user-scoped) data tables.
 *
 * The app-wide client waits for a brokered auth session before it issues any
 * request, which delayed — and sometimes stalled — the first page load. This
 * data is shared by everyone and protected by public policies, so it is read
 * and written with a session-less client that starts fetching immediately.
 */
const SUPABASE_URL =
  (import.meta.env["VITE_SUPABASE_URL"] as string | undefined) ?? process.env["SUPABASE_URL"]!;
const SUPABASE_KEY =
  (import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string | undefined) ??
  process.env["SUPABASE_PUBLISHABLE_KEY"]!;

const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  global: {
    fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      // New-format publishable keys are opaque strings, not bearer JWTs.
      if (
        /^sb_(publishable|secret)_/.test(SUPABASE_KEY) &&
        headers.get("Authorization") === `Bearer ${SUPABASE_KEY}`
      ) {
        headers.delete("Authorization");
      }
      headers.set("apikey", SUPABASE_KEY);
      return fetch(input, { ...init, headers });
    },
  },
});


/**
 * Shared cloud data layer.
 *
 * All sections read from this in-memory cache (kept synchronous so the existing
 * UI code is unchanged) and every write is pushed to the shared cloud database
 * so all users see the same data.
 */

export interface CloudCache {
  listings: SavedListing[];
  categories: string[];
  accounts: Account[];
  records: ListingRecord[];
  targets: Targets;
  prompts: SavedPrompt[];
  defaultPromptId: string | null;
}

export const cache: CloudCache = {
  listings: [],
  categories: [],
  accounts: [],
  records: [],
  targets: { accounts: {}, categories: {} },
  prompts: [],
  defaultPromptId: null,
};

const DEFAULT_PROMPT_KEY = "default-prompt-id";

/* ------------------------------------------------------------------ */
/* Row mapping                                                         */
/* ------------------------------------------------------------------ */

type Row = Record<string, unknown>;

const str = (v: unknown, fallback = "") => (typeof v === "string" ? v : fallback);

function listingFromRow(r: Row): SavedListing {
  return {
    id: str(r["id"]),
    sku: str(r["sku"]),
    listingCategory: str(r["listing_category"]),
    raw: str(r["raw"]),
    fields: (r["fields"] ?? {}) as SavedListing["fields"],
    options: (r["options"] ?? {}) as SavedListing["options"],
    styled: str(r["styled"]),
    createdAt: str(r["created_at"]),
    updatedAt: str(r["updated_at"]),
  };
}

const listingToRow = (l: SavedListing): Row => ({
  id: l.id,
  sku: l.sku,
  listing_category: l.listingCategory,
  raw: l.raw,
  fields: l.fields,
  options: l.options,
  styled: l.styled,
  created_at: l.createdAt,
  updated_at: l.updatedAt,
});

function accountFromRow(r: Row): Account {
  return {
    id: str(r["id"]),
    platform: str(r["platform"]),
    name: str(r["name"]),
    url: str(r["url"]),
    code: str(r["code"]),
    status: str(r["status"], "Active") as Account["status"],
    createdAt: str(r["created_at"]),
    updatedAt: str(r["updated_at"]),
  };
}

const accountToRow = (a: Account): Row => ({
  id: a.id,
  platform: a.platform,
  name: a.name,
  url: a.url,
  code: a.code,
  status: a.status,
  created_at: a.createdAt,
  updated_at: a.updatedAt,
});

function recordFromRow(r: Row): ListingRecord {
  return {
    id: str(r["id"]),
    sku: str(r["sku"]),
    accountId: str(r["account_id"]),
    status: str(r["status"]) as ListingRecord["status"],
    url: str(r["url"]),
    listedDate: str(r["listed_date"]),
    listingId: str(r["listing_id"]),
    note: str(r["note"]),
    createdAt: str(r["created_at"]),
    updatedAt: str(r["updated_at"]),
  };
}

const recordToRow = (r: ListingRecord): Row => ({
  id: r.id,
  sku: r.sku,
  account_id: r.accountId,
  status: r.status,
  url: r.url,
  listed_date: r.listedDate,
  listing_id: r.listingId,
  note: r.note,
  created_at: r.createdAt,
  updated_at: r.updatedAt,
});

function promptFromRow(r: Row): SavedPrompt {
  return {
    id: str(r["id"]),
    name: str(r["name"]),
    note: str(r["note"]),
    content: str(r["content"]),
    version: typeof r["version"] === "number" ? (r["version"] as number) : 1,
    fileName: str(r["file_name"]),
    fileType: str(r["file_type"]),
    createdAt: str(r["created_at"]),
    updatedAt: str(r["updated_at"]),
    history: Array.isArray(r["history"]) ? (r["history"] as SavedPrompt["history"]) : [],
  };
}

const promptToRow = (p: SavedPrompt): Row => ({
  id: p.id,
  name: p.name,
  note: p.note,
  content: p.content,
  version: p.version,
  file_name: p.fileName,
  file_type: p.fileType,
  created_at: p.createdAt,
  updated_at: p.updatedAt,
  history: p.history,
});

/* ------------------------------------------------------------------ */
/* Loading                                                             */
/* ------------------------------------------------------------------ */

let loadedOnce = false;
export const isLoaded = () => loadedOnce;

// Description rows can be large. Small pages avoid the database statement
// timeout that a single multi-megabyte `select *` response can hit.
const PAGE_SIZE = 25;

function unwrap<T>(res: { data: T[] | null; error: unknown }, table: string): T[] {
  if (res.error) {
    throw new Error(
      `Failed to load "${table}": ${(res.error as { message?: string }).message ?? String(res.error)}`,
    );
  }
  if (!res.data) throw new Error(`Failed to load "${table}": no data returned`);
  return res.data;
}

let inFlight: Promise<void> | null = null;

/** Writes currently in flight. A read always waits for them first, so a fresh
 * save can never be overwritten by a read that started before it landed. */
const pendingWrites = new Set<Promise<unknown>>();

export function trackWrite<T>(p: Promise<T>): Promise<T> {
  const wrapped = p.catch(() => undefined);
  pendingWrites.add(wrapped);
  void wrapped.finally(() => pendingWrites.delete(wrapped));
  return p;
}

/**
 * Loads everything from the database. Throws when ANY table fails so a broken
 * request is never mistaken for an empty database — the cache keeps its
 * previous contents in that case.
 */
export function refreshAll(): Promise<void> {
  if (inFlight) return inFlight;
  inFlight = doRefresh().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

let writeVersion = 0;

async function doRefresh(depth = 0): Promise<void> {
  // Never read over a save that is still being written.
  while (pendingWrites.size > 0) {
    await Promise.all([...pendingWrites]);
  }
  const versionAtStart = writeVersion;

  async function readAll(table: string): Promise<Row[]> {
    const rows: Row[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const result = await db.from(table).select("*").range(from, from + PAGE_SIZE - 1);
      const page = unwrap<Row>(result, table);
      rows.push(...page);
      if (page.length < PAGE_SIZE) return rows;
    }
  }


  const [listingRows, categoryRows, accountRows, recordRows, targetRows, promptRows, settingRows] =
    await Promise.all([

      readAll("listings"),
      readAll("categories"),
      readAll("accounts"),
      readAll("listing_records"),
      readAll("targets"),
      readAll("prompts"),
      readAll("app_settings"),
    ]);

  // A save started while this read was running: the result is already stale,
  // so read again instead of putting older data back on screen.
  if (writeVersion !== versionAtStart && depth < 2) return doRefresh(depth + 1);

  // Validate every response BEFORE touching the cache.

  cache.listings = listingRows.map((r) => listingFromRow(r as Row));
  cache.categories = categoryRows.map((r) => str((r as Row)["name"])).filter(Boolean);
  cache.accounts = accountRows.map((r) => accountFromRow(r as Row));
  cache.records = recordRows.map((r) => recordFromRow(r as Row));

  const t: Targets = { accounts: {}, categories: {} };
  for (const raw of targetRows) {
    const row = raw as Row;
    const bucket = str(row["kind"]) === "category" ? t.categories : t.accounts;
    bucket[str(row["key"])] = typeof row["value"] === "number" ? (row["value"] as number) : 0;
  }
  cache.targets = t;

  cache.prompts = promptRows.map((r) => promptFromRow(r as Row));

  const defaultRow = settingRows.find((r) => (r as Row)["key"] === DEFAULT_PROMPT_KEY) as
    Row | undefined;
  cache.defaultPromptId = defaultRow ? str(defaultRow["value"]) || null : null;

  loadedOnce = true;
}

/* ------------------------------------------------------------------ */
/* Saving                                                              */
/* ------------------------------------------------------------------ */

/* Save failures used to be invisible: the card appeared on screen but the row
 * never reached the database, so it was gone after a refresh. Failures are now
 * retried and reported to the UI. */
const errorListeners = new Set<(message: string | null) => void>();
let lastSyncError: string | null = null;

export const getSyncError = () => lastSyncError;

export function subscribeSyncError(cb: (message: string | null) => void): () => void {
  errorListeners.add(cb);
  return () => errorListeners.delete(cb);
}

function reportSyncError(message: string | null) {
  lastSyncError = message;
  errorListeners.forEach((cb) => cb(message));
}

function fireAndForget(run: () => Promise<unknown>) {
  writeVersion++;
  trackWrite(

    (async () => {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await run();
          reportSyncError(null);
          return;
        } catch (err) {
          console.error("Cloud sync failed", err);
          if (attempt === 2) {
            reportSyncError(
              err instanceof Error ? err.message : "Could not save to the database.",
            );
            return;
          }
          await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
        }
      }
    })(),
  );
}

/**
 * Writes are only safe once the database has actually been read. Before that,
 * a write could delete records the page never managed to load.
 */
function guard(): boolean {
  if (loadedOnce) return true;
  console.warn("Ignoring save: shared data has not finished loading yet.");
  reportSyncError("Still loading your data — please wait a moment and save again.");
  return false;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const db = supabase as unknown as { from: (table: string) => any };

const inList = (values: string[]) =>
  `(${values.map((v) => `"${v.replace(/"/g, '\\"')}"`).join(",")})`;

const CHUNK = 20;

/**
 * Only rows that actually changed are written. Sending every row on every save
 * produced multi-megabyte requests that timed out, which is why new entries
 * sometimes never reached the database.
 */
async function syncRows(
  table: string,
  idColumn: string,
  previous: Row[],
  rows: Row[],
  removedIds: string[],
) {
  const before = new Map(previous.map((row) => [String(row[idColumn]), JSON.stringify(row)]));
  const changed = rows.filter((row) => before.get(String(row[idColumn])) !== JSON.stringify(row));

  for (let i = 0; i < changed.length; i += CHUNK) {
    const { error } = await db
      .from(table)
      .upsert(changed.slice(i, i + CHUNK), { onConflict: idColumn });
    if (error) throw error;
  }
  if (removedIds.length > 0) {
    const { error } = await db.from(table).delete().in(idColumn, removedIds);
    if (error) throw error;
  }
}

const removed = <T extends Row>(previous: T[], next: T[], key: string) => {
  const nextIds = new Set(next.map((row) => String(row[key])));
  return previous.map((row) => String(row[key])).filter((id) => !nextIds.has(id));
};


export function pushListings(list: SavedListing[]) {
  if (!guard()) return;
  const previous = cache.listings.map(listingToRow);
  const rows = list.map(listingToRow);
  cache.listings = list;
  fireAndForget(() => syncRows("listings", "id", previous, rows, removed(previous, rows, "id")));
}

export function pushCategories(list: string[]) {
  if (!guard()) return;
  const previous = cache.categories.map((name) => ({ name }));
  const rows = list.map((name) => ({ name }));
  cache.categories = list;
  fireAndForget(() =>
    syncRows("categories", "name", previous, rows, removed(previous, rows, "name")),
  );
}

export function pushAccounts(list: Account[]) {
  if (!guard()) return;
  const previous = cache.accounts.map(accountToRow);
  const rows = list.map(accountToRow);
  cache.accounts = list;
  fireAndForget(() => syncRows("accounts", "id", previous, rows, removed(previous, rows, "id")));
}

export function pushRecords(list: ListingRecord[]) {
  if (!guard()) return;
  const previous = cache.records.map(recordToRow);
  const rows = list.map(recordToRow);
  cache.records = list;
  fireAndForget(() =>
    syncRows("listing_records", "id", previous, rows, removed(previous, rows, "id")),
  );
}

export function pushTargets(t: Targets) {
  if (!guard()) return;
  cache.targets = t;
  fireAndForget(async () => {
    const buckets: [string, Record<string, number>][] = [
      ["account", t.accounts],
      ["category", t.categories],
    ];
    for (const [kind, map] of buckets) {
      const rows = Object.entries(map).map(([key, value]) => ({ kind, key, value }));
      if (rows.length > 0) {
        const { error } = await db.from("targets").upsert(rows);
        if (error) throw error;
      }
      const keys = Object.keys(map);
      const del = db.from("targets").delete().eq("kind", kind);
      const { error } = await (keys.length > 0 ? del.not("key", "in", inList(keys)) : del);
      if (error) throw error;
    }
  });
}

export function pushPrompts(list: SavedPrompt[]) {
  if (!guard()) return;
  const previous = cache.prompts.map(promptToRow);
  const rows = list.map(promptToRow);
  cache.prompts = list;
  fireAndForget(() => syncRows("prompts", "id", previous, rows, removed(previous, rows, "id")));
}

export function pushDefaultPromptId(id: string | null) {
  if (!guard()) return;
  cache.defaultPromptId = id;
  fireAndForget(async () => {
    const { error } = await (id
      ? db.from("app_settings").upsert({ key: DEFAULT_PROMPT_KEY, value: id })
      : db.from("app_settings").delete().eq("key", DEFAULT_PROMPT_KEY));
    if (error) throw error;
  });
}


/* ------------------------------------------------------------------ */
/* Live sync                                                           */
/* ------------------------------------------------------------------ */

export function subscribeCloud(onChange: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const scheduleRefresh = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(onChange, 300);
  };
  const channel = supabase
    .channel("shared-data")
    .on("postgres_changes", { event: "*", schema: "public", table: "listings" }, scheduleRefresh)
    .on("postgres_changes", { event: "*", schema: "public", table: "categories" }, scheduleRefresh)
    .on("postgres_changes", { event: "*", schema: "public", table: "accounts" }, scheduleRefresh)
    .on("postgres_changes", { event: "*", schema: "public", table: "listing_records" }, scheduleRefresh)
    .on("postgres_changes", { event: "*", schema: "public", table: "targets" }, scheduleRefresh)
    .on("postgres_changes", { event: "*", schema: "public", table: "prompts" }, scheduleRefresh)
    .on("postgres_changes", { event: "*", schema: "public", table: "app_settings" }, scheduleRefresh)
    .subscribe();

  return () => {
    if (timer) clearTimeout(timer);
    void supabase.removeChannel(channel);
  };
}
