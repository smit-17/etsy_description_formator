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

const PAGE_LIMIT = 10000;

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

async function doRefresh(): Promise<void> {
  const [listings, categories, accounts, records, targets, prompts, settings] = await Promise.all([
    supabase.from("listings").select("*").limit(PAGE_LIMIT),
    supabase.from("categories").select("*").limit(PAGE_LIMIT),
    supabase.from("accounts").select("*").limit(PAGE_LIMIT),
    supabase.from("listing_records").select("*").limit(PAGE_LIMIT),
    supabase.from("targets").select("*").limit(PAGE_LIMIT),
    supabase.from("prompts").select("*").limit(PAGE_LIMIT),
    supabase.from("app_settings").select("*").limit(PAGE_LIMIT),
  ]);

  // Validate every response BEFORE touching the cache.
  const listingRows = unwrap(listings, "listings");
  const categoryRows = unwrap(categories, "categories");
  const accountRows = unwrap(accounts, "accounts");
  const recordRows = unwrap(records, "listing_records");
  const targetRows = unwrap(targets, "targets");
  const promptRows = unwrap(prompts, "prompts");
  const settingRows = unwrap(settings, "app_settings");

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

function fireAndForget(p: PromiseLike<unknown>) {
  Promise.resolve(p).catch((err) => console.error("Cloud sync failed", err));
}

/**
 * Writes replace the full table contents, so they are only safe once the
 * database has actually been read. Before that, a write would delete records
 * the page never managed to load.
 */
function guard(): boolean {
  if (loadedOnce) return true;
  console.warn("Ignoring save: shared data has not finished loading yet.");
  return false;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const db = supabase as unknown as { from: (table: string) => any };

const inList = (values: string[]) =>
  `(${values.map((v) => `"${v.replace(/"/g, '\\"')}"`).join(",")})`;

async function syncRows(table: string, idColumn: string, rows: Row[]) {
  if (rows.length > 0) {
    const { error } = await db.from(table).upsert(rows);
    if (error) throw error;
  }
  const ids = rows.map((r) => String(r[idColumn]));
  const del = db.from(table).delete();
  const { error } = await (ids.length > 0
    ? del.not(idColumn, "in", inList(ids))
    : del.neq(idColumn, "\u0000"));
  if (error) throw error;
}

export function pushListings(list: SavedListing[]) {
  if (!guard()) return;
  cache.listings = list;
  fireAndForget(syncRows("listings", "id", list.map(listingToRow)));
}

export function pushCategories(list: string[]) {
  if (!guard()) return;
  cache.categories = list;
  fireAndForget(
    syncRows(
      "categories",
      "name",
      list.map((name) => ({ name })),
    ),
  );
}

export function pushAccounts(list: Account[]) {
  if (!guard()) return;
  cache.accounts = list;
  fireAndForget(syncRows("accounts", "id", list.map(accountToRow)));
}

export function pushRecords(list: ListingRecord[]) {
  if (!guard()) return;
  cache.records = list;
  fireAndForget(syncRows("listing_records", "id", list.map(recordToRow)));
}

export function pushTargets(t: Targets) {
  if (!guard()) return;
  cache.targets = t;
  fireAndForget(
    (async () => {
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
    })(),
  );
}

export function pushPrompts(list: SavedPrompt[]) {
  if (!guard()) return;
  cache.prompts = list;
  fireAndForget(syncRows("prompts", "id", list.map(promptToRow)));
}

export function pushDefaultPromptId(id: string | null) {
  if (!guard()) return;
  cache.defaultPromptId = id;
  fireAndForget(
    id
      ? db.from("app_settings").upsert({ key: DEFAULT_PROMPT_KEY, value: id })
      : db.from("app_settings").delete().eq("key", DEFAULT_PROMPT_KEY),
  );
}

/* ------------------------------------------------------------------ */
/* Live sync                                                           */
/* ------------------------------------------------------------------ */

export function subscribeCloud(onChange: () => void): () => void {
  const channel = supabase
    .channel("shared-data")
    .on("postgres_changes", { event: "*", schema: "public", table: "listings" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "categories" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "accounts" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "listing_records" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "targets" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "prompts" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "app_settings" }, onChange)
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
