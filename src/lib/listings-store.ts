import { cache, pushCategories, pushListings } from "@/lib/cloud-sync";
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
  return cache.listings;
}

export function saveListings(list: SavedListing[]) {
  pushListings(list);
}

export function loadCategories(): string[] {
  return Array.from(new Set([...BASE_CATEGORIES, ...cache.categories]));
}

export function saveCategories(list: string[]) {
  pushCategories(list.filter((c) => !BASE_CATEGORIES.includes(c)));
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
