import { useCloudData } from "@/hooks/use-cloud-data";
import { CloudStatus } from "@/components/CloudStatus";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Layers,
  LayoutList,
  ListChecks,
  MoreHorizontal,
  Search,
  Sparkles,
  Store,
  Trash2,
} from "lucide-react";
import { SectionHeader, mainTabs } from "@/components/SectionHeader";
import { CategoryCard, StatCard, StatusChip } from "@/components/dash";

import {
  formatDate,
  loadCategories,
  loadListings,
  preview,
  saveListings,
  type SavedListing,
} from "@/lib/listings-store";
import {
  isToday,
  loadAccounts,
  loadRecords,
  productState,
  sameSku,
  type Account,
  type ListingRecord,
} from "@/lib/list-store";

export const Route = createFileRoute("/saved")({
  head: () => ({
    meta: [
      { title: "Saved Descriptions — LEPDO Listing Studio" },
      {
        name: "description",
        content:
          "Browse every saved product description with SKU search, category filters and listing status across all marketplace accounts.",
      },
      { property: "og:title", content: "Saved Descriptions" },
      {
        property: "og:description",
        content: "Every saved product description with listing status per account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SavedDescriptions,
});

type SortKey = "updated" | "newest" | "oldest";

function SavedDescriptions() {
  const navigate = useNavigate();
  const [listings, setListings] = useState<SavedListing[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [records, setRecords] = useState<ListingRecord[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [menu, setMenu] = useState<string | null>(null);

  const [skuQuery, setSkuQuery] = useState("");
  const [titleQuery, setTitleQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<SortKey>("updated");
  const [moreFilters, setMoreFilters] = useState(false);

  const cloud = useCloudData(() => {
    setListings(loadListings());
    setCategories(loadCategories());
    setAccounts(loadAccounts());
    setRecords(loadRecords());
  });

  const activeAccounts = useMemo(
    () => accounts.filter((a) => a.status === "Active").length,
    [accounts],
  );

  const copy = async (text: string, key: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
    setCopied(key);
    window.setTimeout(() => setCopied(null), 1600);
  };

  const remove = (id: string) => {
    const next = loadListings().filter((l) => l.id !== id);
    saveListings(next);
    setListings(next);
    setMenu(null);
  };

  const enriched = useMemo(
    () =>
      listings.map((l) => {
        const mine = records.filter((r) => sameSku(r.sku, l.sku));
        const ps = productState(l.sku, records, activeAccounts);
        const ready = mine.length === 0 && Boolean(l.sku && l.listingCategory);
        return { listing: l, mine, ...ps, ready };
      }),
    [listings, records, activeAccounts],
  );

  const stats = useMemo(() => {
    const cats = new Set(listings.map((l) => l.listingCategory).filter(Boolean));
    return {
      total: listings.length,
      ready: enriched.filter((e) => e.ready).length,
      notListed: enriched.filter((e) => e.state === "Not Listed").length,
      listed: enriched.filter((e) => e.state === "Listed").length,
      categories: cats.size,
      today: listings.filter((l) => isToday(l.updatedAt)).length,
    };
  }, [listings, enriched]);

  const categoryCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of listings)
      m.set(l.listingCategory || "Other", (m.get(l.listingCategory || "Other") ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [listings]);

  const rows = useMemo(() => {
    const sq = skuQuery.trim().toLowerCase();
    const tq = titleQuery.trim().toLowerCase();
    const filtered = enriched
      .filter((r) => (sq ? r.listing.sku.toLowerCase().includes(sq) : true))
      .filter((r) => (tq ? r.listing.fields.finalTitle.toLowerCase().includes(tq) : true))
      .filter((r) =>
        category === "all" ? true : (r.listing.listingCategory || "Other") === category,
      )
      .filter((r) =>
        status === "all" ? true : status === "Ready to List" ? r.ready : r.state === status,
      );
    return filtered.sort((a, b) => {
      if (sort === "newest") return b.listing.createdAt.localeCompare(a.listing.createdAt);
      if (sort === "oldest") return a.listing.createdAt.localeCompare(b.listing.createdAt);
      return b.listing.updatedAt.localeCompare(a.listing.updatedAt);
    });
  }, [enriched, skuQuery, titleQuery, category, status, sort]);

  const selectCategory = (name: string) => setCategory((c) => (c === name ? "all" : name));

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-background pb-16">
      <SectionHeader
        title="Saved Descriptions"
        subtitle="Every saved listing description"
        tabs={mainTabs("saved")}
        actions={
          <>
            <Link
              to="/list"
              search={{ tab: "products" as const }}
              className="inline-flex items-center gap-1.5 rounded-full border border-gold/60 px-4 py-1.5 text-xs font-medium text-gold hover:bg-gold/10"
            >
              <LayoutList className="h-3.5 w-3.5" /> List
            </Link>
            <Link
              to="/description"
              className="inline-flex items-center gap-1.5 rounded-full bg-[image:var(--gradient-gold)] px-4 py-1.5 text-xs font-semibold text-gold-foreground"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">New Description</span>
            </Link>
          </>
        }
      />

      <CloudStatus state={cloud} label="descriptions" />
      {cloud.status === "loading" ? null : (
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard
              index={1}
              label="Total Saved"
              value={stats.total}
              icon={<Layers className="h-4 w-4" />}
            />
            <StatCard
              index={2}
              label="Ready to List"
              value={stats.ready}
              icon={<ListChecks className="h-4 w-4" />}
              onClick={() => setStatus((s) => (s === "Ready to List" ? "all" : "Ready to List"))}
              active={status === "Ready to List"}
            />
            <StatCard
              index={3}
              label="Not Listed"
              value={stats.notListed}
              icon={<Clock className="h-4 w-4" />}
              onClick={() => setStatus((s) => (s === "Not Listed" ? "all" : "Not Listed"))}
              active={status === "Not Listed"}
            />
            <StatCard
              index={4}
              label="Listed"
              value={stats.listed}
              icon={<CheckCircle2 className="h-4 w-4" />}
              onClick={() => setStatus((s) => (s === "Listed" ? "all" : "Listed"))}
              active={status === "Listed"}
            />
            <StatCard
              index={5}
              label="Categories"
              value={stats.categories}
              icon={<Store className="h-4 w-4" />}
            />
            <StatCard
              index={6}
              label="Updated Today"
              value={stats.today}
              icon={<Clock className="h-4 w-4" />}
            />
          </div>

          {categoryCounts.length ? (
            <>
              <h2 className="mt-8 font-[family-name:var(--font-display)] text-lg font-semibold">
                Category overview
              </h2>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {categoryCounts.map(([name, count]) => (
                  <CategoryCard
                    key={name}
                    name={name}
                    count={count}
                    total={stats.total}
                    active={category === name}
                    onClick={() => selectCategory(name)}
                  />
                ))}
              </div>
            </>
          ) : null}

          {/* Compact filter toolbar */}
          <div className="mt-8 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-2.5 shadow-[var(--shadow-soft)]">
            <label className="relative min-w-0 flex-1 basis-44">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={skuQuery}
                onChange={(e) => setSkuQuery(e.target.value)}
                placeholder="Search SKU"
                className="w-full rounded-full border border-input bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-gold"
              />
            </label>
            <input
              value={titleQuery}
              onChange={(e) => setTitleQuery(e.target.value)}
              placeholder="Search title"
              className="min-w-0 flex-1 basis-40 rounded-full border border-input bg-background px-3 py-2 text-sm outline-none focus:border-gold"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="min-w-0 rounded-full border border-input bg-background px-3 py-2 text-sm outline-none focus:border-gold"
            >
              <option value="all">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setMoreFilters((v) => !v)}
              className="rounded-full border border-border bg-secondary/60 px-3 py-2 text-xs font-medium hover:border-gold"
            >
              More Filters
            </button>
            {moreFilters ? (
              <div className="flex w-full flex-wrap gap-2 border-t border-border pt-2">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="min-w-0 rounded-full border border-input bg-background px-3 py-2 text-sm outline-none focus:border-gold"
                >
                  <option value="all">All statuses</option>
                  <option value="Ready to List">Ready to List</option>
                  <option value="Not Listed">Not Listed</option>
                  <option value="Partially Listed">Partially Listed</option>
                  <option value="Listed">Listed</option>
                </select>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  className="min-w-0 rounded-full border border-input bg-background px-3 py-2 text-sm outline-none focus:border-gold"
                >
                  <option value="updated">Recently updated</option>
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                </select>
              </div>
            ) : null}
          </div>

          {rows.length ? (
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {rows.map(({ listing: l, state, listed, ready }, i) => (
                <article
                  key={l.id}
                  className="flex h-full min-w-0 flex-col rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)] transition-colors hover:border-gold/70"
                >
                  <div className="flex min-w-0 items-center justify-between gap-2">
                    <span className="text-[10px] font-semibold tracking-[0.2em] text-gold">
                      #{String(i + 1).padStart(3, "0")}
                    </span>
                    <StatusChip status={ready ? "Ready to List" : state} />
                  </div>
                  <p className="mt-2 truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    {l.sku || "No SKU"}
                  </p>
                  <h2 className="mt-1 line-clamp-2 break-words text-sm font-semibold text-foreground">
                    {l.fields.finalTitle || "Untitled listing"}
                  </h2>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {l.listingCategory || "No category"}
                  </p>
                  <p className="mt-2 line-clamp-1 break-words text-[11px] text-muted-foreground">
                    {preview(l.fields.description, 70) || "—"}
                  </p>
                  <div className="mt-auto pt-3">
                    <p className="text-[11px] text-muted-foreground">
                      Listed on {listed} account{listed === 1 ? "" : "s"} ·{" "}
                      {formatDate(l.updatedAt)}
                    </p>
                    <div className="mt-2 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => navigate({ to: "/description", search: { id: l.id } })}
                        className="rounded-full bg-navy px-3 py-1.5 text-[11px] font-semibold text-navy-foreground"
                      >
                        Open
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          navigate({
                            to: "/list",
                            search: { tab: "products" as const, sku: l.sku },
                          })
                        }
                        className="rounded-full border border-gold/60 px-3 py-1.5 text-[11px] font-medium text-foreground hover:bg-gold/10"
                      >
                        Go to List
                      </button>
                      <button
                        type="button"
                        aria-label="More actions"
                        onClick={() => setMenu(menu === l.id ? null : l.id)}
                        className="ml-auto rounded-full border border-border p-1.5 hover:border-gold"
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {menu === l.id ? (
                      <div className="mt-2 flex flex-wrap gap-1.5 border-t border-border pt-2">
                        <button
                          type="button"
                          onClick={() => copy(l.fields.finalTitle, `t${l.id}`)}
                          className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] hover:border-gold"
                        >
                          {copied === `t${l.id}` ? <Check className="inline h-3 w-3" /> : null} Copy
                          Title
                        </button>
                        <button
                          type="button"
                          onClick={() => copy(l.styled || l.fields.description, `d${l.id}`)}
                          className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] hover:border-gold"
                        >
                          {copied === `d${l.id}` ? (
                            <Check className="inline h-3 w-3" />
                          ) : (
                            <Copy className="inline h-3 w-3" />
                          )}{" "}
                          Copy Description
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(l.id)}
                          className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-destructive hover:border-destructive"
                        >
                          <Trash2 className="inline h-3 w-3" /> Delete
                        </button>
                      </div>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-8 rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
              No saved descriptions match these filters.
            </p>
          )}
        </main>
      )}
    </div>
  );
}
