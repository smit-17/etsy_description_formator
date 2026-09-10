import type { ParsedResponse } from "@/lib/description-parse";
import type { FormatOptions } from "@/lib/etsy-format";

export interface SavedListing {
  id: string;
  sku: string;
  listingCategory: string;
  raw: string;
  fields: ParsedResponse;
  options: FormatOptions;
  styled: string;
  createdAt: string;
  updatedAt: string;
}

const LISTINGS_KEY = "etsy-saved-listings-v1";
const CATEGORIES_KEY = "etsy-listing-categories-v1";

export const BASE_CATEGORIES = [
  "Rings",
  "Necklaces",
  "Earrings",
  "Bracelets",
  "Pendants",
  "Bands",
  "Sets",
];

export function loadListings(): SavedListing[] {
  try {
    const raw = localStorage.getItem(LISTINGS_KEY);
    const parsed = raw ? (JSON.parse(raw) as SavedListing[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveListings(list: SavedListing[]) {
  try {
    localStorage.setItem(LISTINGS_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function loadCategories(): string[] {
  try {
    const raw = localStorage.getItem(CATEGORIES_KEY);
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    const extra = Array.isArray(parsed) ? parsed : [];
    return Array.from(new Set([...BASE_CATEGORIES, ...extra]));
  } catch {
    return [...BASE_CATEGORIES];
  }
}

export function saveCategories(list: string[]) {
  try {
    const extra = list.filter((c) => !BASE_CATEGORIES.includes(c));
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(extra));
  } catch {
    /* ignore */
  }
}

export function newId(): string {
  return `l_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function preview(text: string, max = 120): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}
