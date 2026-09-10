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

const ACCOUNTS_KEY = "lepdo-accounts-v1";
const RECORDS_KEY = "lepdo-listing-records-v1";

function read<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as T[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write<T>(key: string, list: T[]) {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export const loadAccounts = () => read<Account>(ACCOUNTS_KEY);
export const saveAccounts = (l: Account[]) => write(ACCOUNTS_KEY, l);
export const loadRecords = () => read<ListingRecord>(RECORDS_KEY);
export const saveRecords = (l: ListingRecord[]) => write(RECORDS_KEY, l);

/** Listing targets ------------------------------------------------------- */

export interface Targets {
  /** accountId -> overall listing target */
  accounts: Record<string, number>;
  /** category name -> listed target */
  categories: Record<string, number>;
}

const TARGETS_KEY = "lepdo-listing-targets-v1";

export function loadTargets(): Targets {
  try {
    const raw = localStorage.getItem(TARGETS_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<Targets>) : {};
    return { accounts: parsed.accounts ?? {}, categories: parsed.categories ?? {} };
  } catch {
    return { accounts: {}, categories: {} };
  }
}

export function saveTargets(t: Targets) {
  try {
    localStorage.setItem(TARGETS_KEY, JSON.stringify(t));
  } catch {
    /* ignore */
  }
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
