import { cache, pushAccounts, pushRecords, pushTargets } from "@/lib/cloud-sync";

export const PLATFORMS = [
  "Etsy",
  "Own Website",
  "Alibaba",
  "Amazon",
  "Shopify",
  "eBay",
  "Walmart",
  "Faire",
  "Other / Custom",
];

export type AccountStatus = "Active" | "Paused" | "Inactive";

export const LISTING_STATUSES = [
  "Ready to List",
  "Listing in Progress",
  "Listed",
  "Hold",
] as const;

export type ListingStatus = (typeof LISTING_STATUSES)[number];

export interface Account {
  id: string;
  platform: string;
  name: string;
  url: string;
  code: string;
  status: AccountStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ListingRecord {
  id: string;
  sku: string;
  accountId: string;
  status: ListingStatus;
  url: string;
  listedDate: string; // yyyy-mm-dd
  listingId: string;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export const loadAccounts = () => cache.accounts;
export const saveAccounts = (l: Account[]) => pushAccounts(l);
export const loadRecords = () => cache.records;
export const saveRecords = (l: ListingRecord[]) => pushRecords(l);

/** Listing targets ------------------------------------------------------- */

export interface Targets {
  /** accountId -> overall listing target */
  accounts: Record<string, number>;
  /** category name -> listed target */
  categories: Record<string, number>;
}

export function loadTargets(): Targets {
  return cache.targets;
}

export function saveTargets(t: Targets) {
  pushTargets(t);
}


export function newListId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function sameSku(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Overall listing state of a product across all active accounts. */
export type ProductListingState = "Not Listed" | "Partially Listed" | "Listed";

export function productState(
  sku: string,
  records: ListingRecord[],
  accountCount: number,
): { state: ProductListingState; listed: number; total: number } {
  const mine = records.filter((r) => sameSku(r.sku, sku));
  const listed = mine.filter((r) => r.status === "Listed").length;
  const total = Math.max(accountCount, mine.length);
  if (listed === 0) return { state: "Not Listed", listed, total };
  if (total > 0 && listed >= total) return { state: "Listed", listed, total };
  return { state: "Partially Listed", listed, total };
}

export function isSameMonth(iso: string, ref = new Date()): boolean {
  const d = new Date(iso);
  return (
    !Number.isNaN(d.getTime()) &&
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth()
  );
}

export function isToday(iso: string, ref = new Date()): boolean {
  const d = new Date(iso);
  return !Number.isNaN(d.getTime()) && d.toDateString() === ref.toDateString();
}
