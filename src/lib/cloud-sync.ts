import { supabase } from "@/integrations/supabase/client";

import type { Account, ListingRecord, Targets } from "@/lib/list-store";
import type { SavedListing } from "@/lib/listings-store";
import type { SavedPrompt } from "@/lib/prompts-store";

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

export async function refreshAll(): Promise<void> {
  const [listings, categories, accounts, records, targets, prompts, settings] = await Promise.all([
    supabase.from("listings").select("*"),
    supabase.from("categories").select("*"),
    supabase.from("accounts").select("*"),
    supabase.from("listing_records").select("*"),
    supabase.from("targets").select("*"),
    supabase.from("prompts").select("*"),
    supabase.from("app_settings").select("*"),
  ]);

  cache.listings = (listings.data ?? []).map((r) => listingFromRow(r as Row));
  cache.categories = (categories.data ?? []).map((r) => str((r as Row)["name"])).filter(Boolean);
  cache.accounts = (accounts.data ?? []).map((r) => accountFromRow(r as Row));
  cache.records = (records.data ?? []).map((r) => recordFromRow(r as Row));

  const t: Targets = { accounts: {}, categories: {} };
  for (const raw of targets.data ?? []) {
    const row = raw as Row;
    const bucket = str(row["kind"]) === "category" ? t.categories : t.accounts;
    bucket[str(row["key"])] = typeof row["value"] === "number" ? (row["value"] as number) : 0;
  }
  cache.targets = t;

  cache.prompts = (prompts.data ?? []).map((r) => promptFromRow(r as Row));

  const defaultRow = (settings.data ?? []).find((r) => (r as Row)["key"] === DEFAULT_PROMPT_KEY) as
    | Row
    | undefined;
  cache.defaultPromptId = defaultRow ? (str(defaultRow["value"]) || null) : null;

  loadedOnce = true;
}

/* ------------------------------------------------------------------ */
/* Saving                                                              */
/* ------------------------------------------------------------------ */

function fireAndForget(p: PromiseLike<unknown>) {
  Promise.resolve(p).catch((err) => console.error("Cloud sync failed", err));
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const db = supabase as unknown as { from: (table: string) => any };

const inList = (values: string[]) => `(${values.map((v) => `"${v.replace(/"/g, '\\"')}"`).join(",")})`;

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
  cache.listings = list;
  fireAndForget(syncRows("listings", "id", list.map(listingToRow)));
}

export function pushCategories(list: string[]) {
  cache.categories = list;
  fireAndForget(syncRows("categories", "name", list.map((name) => ({ name }))));
}

export function pushAccounts(list: Account[]) {
  cache.accounts = list;
  fireAndForget(syncRows("accounts", "id", list.map(accountToRow)));
}

export function pushRecords(list: ListingRecord[]) {
  cache.records = list;
  fireAndForget(syncRows("listing_records", "id", list.map(recordToRow)));
}

export function pushTargets(t: Targets) {
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
  cache.prompts = list;
  fireAndForget(syncRows("prompts", "id", list.map(promptToRow)));
}

export function pushDefaultPromptId(id: string | null) {
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
