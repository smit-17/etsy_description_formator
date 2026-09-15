import { useCloudData } from "@/hooks/use-cloud-data";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { SectionHeader, mainTabs } from "@/components/SectionHeader";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Circle,
  Clock,
  ExternalLink,
  LayoutDashboard,
  ListChecks,
  Package,
  Plus,
  Search,
  Store,
  Target,
  Trash2,
  X,
} from "lucide-react";

import { ProgressBar, StatCard, StatusChip } from "@/components/dash";
import { formatDate, loadCategories, loadListings, type SavedListing } from "@/lib/listings-store";
import {
  LISTING_STATUSES,
  PLATFORMS,
  isSameMonth,
  isToday,
  loadAccounts,
  loadRecords,
  loadTargets,
  newListId,
  productState,
  saveAccounts,
  saveRecords,
  saveTargets,
  sameSku,
  todayISO,
  type Account,
  type AccountStatus,
  type ListingRecord,
  type ListingStatus,
  type Targets,
} from "@/lib/list-store";

type Tab = "dashboard" | "products" | "accounts";

interface ListSearch {
  tab?: Tab;
  sku?: string;
  account?: string;
}

export const Route = createFileRoute("/list")({
  validateSearch: (search: Record<string, unknown>): ListSearch => {
    const t = search["tab"];
    const sku = search["sku"];
    const account = search["account"];
    const out: ListSearch = {};
    if (t === "dashboard" || t === "products" || t === "accounts") out.tab = t;
    if (typeof sku === "string" && sku) out.sku = sku;
    if (typeof account === "string" && account) out.account = account;
    return out;
  },
  head: () => ({
    meta: [
      { title: "List — Track Every Product Listing & Account" },
      {
        name: "description",
        content:
          "Track which SKU is listed on which marketplace account, its live URL, listing status and per-account category counts.",
      },
      { property: "og:title", content: "List — Listing Tracker" },
      {
        property: "og:description",
        content: "Accounts, listings, live URLs and category analytics for every saved product.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ListSection,
});

const inputCls =
  "min-w-0 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-gold focus:ring-4 focus:ring-gold/20";
const pill =
  "min-w-0 rounded-full border border-input bg-background px-3 py-2 text-sm outline-none focus:border-gold";
const chipBtn =
  "rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium hover:border-gold";

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-navy/50 p-4 py-10">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1 hover:bg-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4 grid gap-3">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function Step({ done, label }: { done: boolean; label: string }) {
  return (
    <li className="flex min-w-0 items-center gap-2 text-xs">
      {done ? (
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-navy" />
      ) : (
        <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      )}
      <span className={done ? "truncate text-foreground" : "truncate text-muted-foreground"}>
        {label}
      </span>
    </li>
  );
}

function ListSection() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const tab: Tab = search.tab ?? "dashboard";

  const [listings, setListings] = useState<SavedListing[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [records, setRecords] = useState<ListingRecord[]>([]);
  const [targets, setTargets] = useState<Targets>({ accounts: {}, categories: {} });
  const [copied, setCopied] = useState<string | null>(null);

  useCloudData(() => {
    setListings(loadListings());
    setCategories(loadCategories());
    setAccounts(loadAccounts());
    setRecords(loadRecords());
    setTargets(loadTargets());
  });

  const setTab = (t: Tab) =>
    navigate({ to: "/list", search: (s: ListSearch): ListSearch => ({ ...s, tab: t, sku: "" }) });

  const persistAccounts = (next: Account[]) => {
    setAccounts(next);
    saveAccounts(next);
  };
  const persistRecords = (next: ListingRecord[]) => {
    setRecords(next);
    saveRecords(next);
  };
  const persistTargets = (next: Targets) => {
    setTargets(next);
    saveTargets(next);
  };

  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a] as const)), [accounts]);
  const categoryOfSku = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of listings) m.set(l.sku.toLowerCase(), l.listingCategory || "Other");
    return m;
  }, [listings]);

  const copy = async (text: string, key: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
    setCopied(key);
    window.setTimeout(() => setCopied(null), 1500);
  };

  // ---------- Account modal ----------
  const [accountModal, setAccountModal] = useState<Account | "new" | null>(null);
  const [aPlatform, setAPlatform] = useState("Etsy");
  const [aCustom, setACustom] = useState("");
  const [aName, setAName] = useState("");
  const [aUrl, setAUrl] = useState("");
  const [aCode, setACode] = useState("");
  const [aStatus, setAStatus] = useState<AccountStatus>("Active");
  const [aTarget, setATarget] = useState("");
  const [aError, setAError] = useState("");

  const openAccountModal = (acc: Account | "new") => {
    if (acc === "new") {
      setAPlatform("Etsy");
      setACustom("");
      setAName("");
      setAUrl("");
      setACode("");
      setAStatus("Active");
      setATarget("");
    } else {
      setAPlatform(PLATFORMS.includes(acc.platform) ? acc.platform : "Other / Custom");
      setACustom(PLATFORMS.includes(acc.platform) ? "" : acc.platform);
      setAName(acc.name);
      setAUrl(acc.url);
      setACode(acc.code);
      setAStatus(acc.status);
      setATarget(targets.accounts[acc.id] ? String(targets.accounts[acc.id]) : "");
    }
    setAError("");
    setAccountModal(acc);
  };

  const saveAccount = () => {
    const platform = aPlatform === "Other / Custom" ? aCustom.trim() || "Other" : aPlatform;
    if (!aName.trim()) {
      setAError("Account / store name is required.");
      return;
    }
    const now = new Date().toISOString();
    const editing = accountModal !== "new" && accountModal ? accountModal : null;
    const record: Account = {
      id: editing?.id ?? newListId("acc"),
      platform,
      name: aName.trim(),
      url: aUrl.trim(),
      code: aCode.trim(),
      status: aStatus,
      createdAt: editing?.createdAt ?? now,
      updatedAt: now,
    };
    persistAccounts(
      editing ? accounts.map((a) => (a.id === editing.id ? record : a)) : [...accounts, record],
    );
    const t = Number(aTarget);
    const nextAccounts = { ...targets.accounts };
    if (Number.isFinite(t) && t > 0) nextAccounts[record.id] = Math.round(t);
    else delete nextAccounts[record.id];
    persistTargets({ ...targets, accounts: nextAccounts });
    setAccountModal(null);
  };

  // ---------- Category target modal ----------
  const [catTargetModal, setCatTargetModal] = useState(false);

  // ---------- Listing modal ----------
  const [listingModal, setListingModal] = useState<{
    sku: string;
    record: ListingRecord | null;
  } | null>(null);
  const [lAccount, setLAccount] = useState("");
  const [lStatus, setLStatus] = useState<ListingStatus>("Listed");
  const [lUrl, setLUrl] = useState("");
  const [lDate, setLDate] = useState(todayISO());
  const [lId, setLId] = useState("");
  const [lNote, setLNote] = useState("");
  const [lError, setLError] = useState("");
  const [lConflict, setLConflict] = useState<ListingRecord | null>(null);

  const openListingModal = useCallback((sku: string, record: ListingRecord | null) => {
    setLAccount(record?.accountId ?? "");
    setLStatus(record?.status ?? "Listed");
    setLUrl(record?.url ?? "");
    setLDate(record?.listedDate ?? todayISO());
    setLId(record?.listingId ?? "");
    setLNote(record?.note ?? "");
    setLError("");
    setLConflict(null);
    setListingModal({ sku, record });
  }, []);

  // Deep link from a saved description: open Add Listing for that SKU.
  useEffect(() => {
    if (search.sku && listings.length) {
      openListingModal(search.sku, null);
      navigate({
        to: "/list",
        search: (s: ListSearch): ListSearch => ({ ...s, sku: "" }),
        replace: true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.sku, listings.length]);

  const commitListing = (existing: ListingRecord | null) => {
    if (!listingModal) return;
    const now = new Date().toISOString();
    const base = existing ?? listingModal.record;
    const record: ListingRecord = {
      id: base?.id ?? newListId("lst"),
      sku: listingModal.sku,
      accountId: lAccount,
      status: lStatus,
      url: lUrl.trim(),
      listedDate: lDate,
      listingId: lId.trim(),
      note: lNote.trim(),
      createdAt: base?.createdAt ?? now,
      updatedAt: now,
    };
    persistRecords(
      records.some((r) => r.id === record.id)
        ? records.map((r) => (r.id === record.id ? record : r))
        : [...records, record],
    );
    setListingModal(null);
  };

  const saveListing = () => {
    if (!listingModal) return;
    if (!lAccount) {
      setLError("Select an account.");
      return;
    }
    const dupe = records.find(
      (r) =>
        sameSku(r.sku, listingModal.sku) &&
        r.accountId === lAccount &&
        r.id !== listingModal.record?.id,
    );
    if (dupe) {
      setLConflict(dupe);
      return;
    }
    commitListing(null);
  };

  const removeRecord = (id: string) => persistRecords(records.filter((r) => r.id !== id));

  // ---------- Products filters ----------
  const [fSku, setFSku] = useState("");
  const [fTitle, setFTitle] = useState("");
  const [fCategory, setFCategory] = useState("all");
  const [fPlatform, setFPlatform] = useState("all");
  const [fAccount, setFAccount] = useState(search.account ?? "all");
  const [fListed, setFListed] = useState("all");
  const [fStatus, setFStatus] = useState("all");
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");
  const [moreFilters, setMoreFilters] = useState(false);

  const activeAccountCount = useMemo(
    () => accounts.filter((a) => a.status === "Active").length,
    [accounts],
  );

  const products = useMemo(() => {
    const sq = fSku.trim().toLowerCase();
    const tq = fTitle.trim().toLowerCase();
    return listings
      .map((l) => {
        const mine = records.filter((r) => sameSku(r.sku, l.sku));
        return { l, mine, ...productState(l.sku, records, activeAccountCount) };
      })
      .filter((p) => (sq ? p.l.sku.toLowerCase().includes(sq) : true))
      .filter((p) => (tq ? p.l.fields.finalTitle.toLowerCase().includes(tq) : true))
      .filter((p) => (fCategory === "all" ? true : p.l.listingCategory === fCategory))
      .filter((p) =>
        fPlatform === "all"
          ? true
          : p.mine.some((r) => accountById.get(r.accountId)?.platform === fPlatform),
      )
      .filter((p) => (fAccount === "all" ? true : p.mine.some((r) => r.accountId === fAccount)))
      .filter((p) =>
        fListed === "all" ? true : fListed === "listed" ? p.listed > 0 : p.listed === 0,
      )
      .filter((p) => (fStatus === "all" ? true : p.mine.some((r) => r.status === fStatus)))
      .filter((p) => (fFrom ? p.mine.some((r) => r.listedDate && r.listedDate >= fFrom) : true))
      .filter((p) => (fTo ? p.mine.some((r) => r.listedDate && r.listedDate <= fTo) : true))
      .sort((a, b) => b.l.updatedAt.localeCompare(a.l.updatedAt));
  }, [
    listings,
    records,
    accountById,
    activeAccountCount,
    fSku,
    fTitle,
    fCategory,
    fPlatform,
    fAccount,
    fListed,
    fStatus,
    fFrom,
    fTo,
  ]);

  // ---------- Dashboard stats ----------
  const stats = useMemo(() => {
    const listedSkus = new Set(
      records.filter((r) => r.status === "Listed").map((r) => r.sku.toLowerCase()),
    );
    return {
      totalProducts: listings.length,
      totalListings: records.length,
      listedProducts: listings.filter((l) => listedSkus.has(l.sku.toLowerCase())).length,
      pending: records.filter((r) => r.status === "Listing in Progress" || r.status === "Hold")
        .length,
      ready: records.filter((r) => r.status === "Ready to List").length,
      activeAccounts: activeAccountCount,
      notListed: listings.filter((l) => !listedSkus.has(l.sku.toLowerCase())).length,
    };
  }, [listings, records, activeAccountCount]);

  const accountStats = useMemo(
    () =>
      accounts.map((a) => {
        const mine = records.filter((r) => r.accountId === a.id);
        const byCategory = new Map<string, number>();
        for (const r of mine) {
          const cat = categoryOfSku.get(r.sku.toLowerCase()) || "Other";
          byCategory.set(cat, (byCategory.get(cat) ?? 0) + 1);
        }
        const last = mine
          .map((r) => r.updatedAt)
          .sort()
          .at(-1);
        return {
          account: a,
          total: mine.length,
          target: targets.accounts[a.id] ?? 0,
          categories: [...byCategory.entries()].sort((x, y) => y[1] - x[1]),
          month: mine.filter((r) => isSameMonth(r.createdAt)).length,
          today: mine.filter((r) => isToday(r.createdAt)).length,
          last,
        };
      }),
    [accounts, records, categoryOfSku, targets],
  );

  const categoryTargets = useMemo(() => {
    const listedByCat = new Map<string, number>();
    for (const r of records) {
      if (r.status !== "Listed") continue;
      const cat = categoryOfSku.get(r.sku.toLowerCase()) || "Other";
      listedByCat.set(cat, (listedByCat.get(cat) ?? 0) + 1);
    }
    const names = new Set<string>([
      ...listedByCat.keys(),
      ...Object.keys(targets.categories),
      ...listings.map((l) => l.listingCategory || "Other"),
    ]);
    return [...names]
      .map((name) => ({
        name,
        listed: listedByCat.get(name) ?? 0,
        target: targets.categories[name] ?? 0,
      }))
      .sort((a, b) => b.listed - a.listed);
  }, [records, categoryOfSku, targets, listings]);

  // Listing progress checklist across all products
  const progress = useMemo(() => {
    const withCategory = listings.filter((l) => l.listingCategory).length;
    const withRecord = listings.filter((l) => records.some((r) => sameSku(r.sku, l.sku))).length;
    const withUrl = listings.filter((l) =>
      records.some((r) => sameSku(r.sku, l.sku) && r.url),
    ).length;
    const next = !listings.length
      ? "Next: Save a description"
      : withCategory < listings.length
        ? "Next: Add missing categories"
        : !accounts.length
          ? "Next: Add an account"
          : withRecord < listings.length
            ? "Next: Create listings for remaining products"
            : withUrl < listings.length
              ? "Next: Add live listing URLs"
              : "All steps complete ✓";
    return {
      saved: listings.length > 0,
      category: listings.length > 0 && withCategory === listings.length,
      account: accounts.length > 0,
      listing: listings.length > 0 && withRecord === listings.length,
      url: listings.length > 0 && withUrl === listings.length,
      next,
    };
  }, [listings, records, accounts]);

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-background pb-16">
      <SectionHeader
        title="List"
        subtitle="Listing operations dashboard"
        backTo="/saved"
        backLabel="Saved Descriptions"
        tabs={mainTabs("list")}
        subTabs={(
          [
            ["dashboard", "Dashboard", LayoutDashboard],
            ["products", "Products", Package],
            ["accounts", "Accounts", Store],
          ] as const
        ).map(([key, label, Icon]) => ({
          label,
          active: tab === key,
          onClick: () => setTab(key),
          icon: <Icon className="h-4 w-4" />,
        }))}
        actions={
          <button
            type="button"
            onClick={() => openAccountModal("new")}
            className="inline-flex items-center gap-1.5 rounded-full bg-[image:var(--gradient-gold)] px-4 py-1.5 text-xs font-semibold text-gold-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Add Account</span>
          </button>
        }
      />

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {tab === "dashboard" ? (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <StatCard
                index={1}
                label="Total Products"
                value={stats.totalProducts}
                icon={<Package className="h-4 w-4" />}
              />
              <StatCard
                index={2}
                label="Total Listings"
                value={stats.totalListings}
                icon={<ListChecks className="h-4 w-4" />}
              />
              <StatCard
                index={3}
                label="Listed"
                value={stats.listedProducts}
                icon={<CheckCircle2 className="h-4 w-4" />}
              />
              <StatCard
                index={4}
                label="Pending"
                value={stats.pending}
                icon={<Clock className="h-4 w-4" />}
              />
              <StatCard
                index={5}
                label="Ready to List"
                value={stats.ready}
                icon={<Target className="h-4 w-4" />}
              />
              <StatCard
                index={6}
                label="Active Accounts"
                value={stats.activeAccounts}
                icon={<Store className="h-4 w-4" />}
                hint={`${stats.notListed} not yet listed`}
              />
            </div>

            <section className="mt-6 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">
                  Listing Progress
                </h2>
                <span className="rounded-full bg-gold/25 px-3 py-1 text-[11px] font-semibold">
                  {progress.next}
                </span>
              </div>
              <ul className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
                <Step done={progress.saved} label="Description Saved" />
                <Step done={progress.category} label="Category Added" />
                <Step done={progress.account} label="Account Selected" />
                <Step done={progress.listing} label="Listing Created" />
                <Step done={progress.url} label="URL Added" />
              </ul>
            </section>

            <h2 className="mt-8 font-[family-name:var(--font-display)] text-lg font-semibold">
              Accounts
            </h2>
            {accountStats.length ? (
              <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {accountStats.map((s) => (
                  <article
                    key={s.account.id}
                    className="flex h-full min-w-0 flex-col rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]"
                  >
                    <p className="truncate text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      {s.account.platform}
                    </p>
                    <p className="truncate text-sm font-semibold text-foreground">
                      {s.account.name}
                    </p>
                    <p className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold leading-none">
                      {s.total.toLocaleString()}
                    </p>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      Listings
                    </p>
                    <ul className="mt-2 space-y-0.5">
                      {s.categories.slice(0, 5).map(([cat, n]) => (
                        <li
                          key={cat}
                          className="flex min-w-0 justify-between gap-2 text-xs text-muted-foreground"
                        >
                          <span className="truncate">{cat}</span>
                          <span className="shrink-0 font-semibold text-foreground">{n}</span>
                        </li>
                      ))}
                      {s.categories.length === 0 ? (
                        <li className="text-xs text-muted-foreground">No listings yet</li>
                      ) : null}
                    </ul>
                    {s.target > 0 ? (
                      <ProgressBar value={s.total} max={s.target} />
                    ) : (
                      <button
                        type="button"
                        onClick={() => openAccountModal(s.account)}
                        className="mt-2 self-start text-[11px] font-medium text-gold hover:underline"
                      >
                        Set Listing Target
                      </button>
                    )}
                    <div className="mt-auto pt-3">
                      <p className="text-[11px] text-muted-foreground">
                        Month {s.month} · Today {s.today}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setFAccount(s.account.id);
                          setTab("products");
                        }}
                        className="mt-2 text-[11px] font-semibold text-foreground hover:text-gold"
                      >
                        View Account →
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-3 rounded-2xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
                Add your first account to start tracking listings.
              </p>
            )}

            <div className="mt-8 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">
                Category targets
              </h2>
              <button type="button" onClick={() => setCatTargetModal(true)} className={chipBtn}>
                <Target className="inline h-3 w-3" /> Set Targets
              </button>
            </div>
            {categoryTargets.length ? (
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {categoryTargets.map((c) => (
                  <div
                    key={c.name}
                    className="min-w-0 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]"
                  >
                    <p className="truncate text-xs font-medium text-muted-foreground">{c.name}</p>
                    <p className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold leading-none">
                      {c.listed.toLocaleString()}
                    </p>
                    {c.target > 0 ? (
                      <>
                        <ProgressBar value={c.listed} max={c.target} />
                        <p className="text-[11px] text-muted-foreground">
                          Remaining {Math.max(0, c.target - c.listed).toLocaleString()}
                        </p>
                      </>
                    ) : (
                      <p className="mt-2 text-[11px] text-muted-foreground">No target set</p>
                    )}
                  </div>
                ))}
              </div>
            ) : null}
          </>
        ) : null}

        {tab === "products" ? (
          <>
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-2.5 shadow-[var(--shadow-soft)]">
              <label className="relative min-w-0 flex-1 basis-40">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={fSku}
                  onChange={(e) => setFSku(e.target.value)}
                  placeholder="SKU"
                  className={`${pill} w-full pl-9`}
                />
              </label>
              <input
                value={fTitle}
                onChange={(e) => setFTitle(e.target.value)}
                placeholder="Title"
                className={`${pill} flex-1 basis-40`}
              />
              <select
                value={fCategory}
                onChange={(e) => setFCategory(e.target.value)}
                className={pill}
              >
                <option value="all">All categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                value={fAccount}
                onChange={(e) => setFAccount(e.target.value)}
                className={pill}
              >
                <option value="all">All accounts</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} — {a.platform}
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
                    value={fPlatform}
                    onChange={(e) => setFPlatform(e.target.value)}
                    className={pill}
                  >
                    <option value="all">All platforms</option>
                    {[...new Set(accounts.map((a) => a.platform))].map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                  <select
                    value={fListed}
                    onChange={(e) => setFListed(e.target.value)}
                    className={pill}
                  >
                    <option value="all">Listed & not listed</option>
                    <option value="listed">Listed</option>
                    <option value="not">Not listed</option>
                  </select>
                  <select
                    value={fStatus}
                    onChange={(e) => setFStatus(e.target.value)}
                    className={pill}
                  >
                    <option value="all">Any listing status</option>
                    {LISTING_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <input
                    type="date"
                    value={fFrom}
                    onChange={(e) => setFFrom(e.target.value)}
                    className={pill}
                  />
                  <input
                    type="date"
                    value={fTo}
                    onChange={(e) => setFTo(e.target.value)}
                    className={pill}
                  />
                </div>
              ) : null}
            </div>

            {products.length ? (
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {products.map(({ l, mine, listed }, i) => (
                  <article
                    key={l.id}
                    className="flex h-full min-w-0 flex-col rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)] transition-colors hover:border-gold/70"
                  >
                    <div className="flex min-w-0 items-center justify-between gap-2">
                      <span className="text-[10px] font-semibold tracking-[0.2em] text-gold">
                        #{String(i + 1).padStart(3, "0")}
                      </span>
                      <StatusChip
                        status={
                          listed === 0
                            ? "Not Listed"
                            : listed >= Math.max(accounts.length, 1)
                              ? "Listed"
                              : "Partially Listed"
                        }
                      />
                    </div>
                    <p className="mt-2 truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      {l.sku}
                    </p>
                    <h3 className="mt-1 line-clamp-2 break-words text-sm font-semibold">
                      {l.fields.finalTitle || "Untitled listing"}
                    </h3>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {l.listingCategory || "No category"}
                    </p>

                    <p className="mt-3 text-xs font-semibold text-foreground">
                      {listed} / {Math.max(accounts.length, mine.length)} Accounts Listed
                    </p>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-navy"
                        style={{
                          width: `${
                            Math.max(accounts.length, mine.length) > 0
                              ? Math.min(
                                  100,
                                  Math.round(
                                    (listed / Math.max(accounts.length, mine.length)) * 100,
                                  ),
                                )
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {accounts.slice(0, 6).map((a) => {
                        const rec = mine.find((r) => r.accountId === a.id);
                        const ok = rec?.status === "Listed";
                        return (
                          <span
                            key={a.id}
                            className={`max-w-full truncate rounded-full px-2 py-0.5 text-[10px] ${
                              ok
                                ? "bg-navy text-navy-foreground"
                                : rec
                                  ? "bg-gold/25 text-foreground"
                                  : "bg-secondary text-muted-foreground"
                            }`}
                          >
                            {ok ? "✓ " : "○ "}
                            {a.name}
                          </span>
                        );
                      })}
                    </div>

                    {mine.length ? (
                      <ul className="mt-3 space-y-1.5 border-t border-border pt-2">
                        {mine.map((r) => {
                          const acc = accountById.get(r.accountId);
                          return (
                            <li key={r.id} className="min-w-0 text-[11px]">
                              <p className="truncate text-muted-foreground">
                                {acc ? `${acc.platform} · ${acc.name}` : "Unknown account"} ·{" "}
                                {r.status}
                              </p>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {r.url ? (
                                  <a
                                    href={r.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className={chipBtn}
                                  >
                                    <ExternalLink className="inline h-3 w-3" /> Open
                                  </a>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() => openListingModal(l.sku, r)}
                                  className={chipBtn}
                                >
                                  Edit
                                </button>
                                {r.url ? (
                                  <button
                                    type="button"
                                    onClick={() => copy(r.url, r.id)}
                                    className={chipBtn}
                                  >
                                    {copied === r.id ? "Copied!" : "Copy URL"}
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() => removeRecord(r.id)}
                                  className={`${chipBtn} text-destructive`}
                                >
                                  Remove
                                </button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => openListingModal(l.sku, null)}
                      className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-full bg-navy px-3 py-2 text-xs font-semibold text-navy-foreground"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Listing
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-8 rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
                No products match these filters. Save a description first, then track it here.
              </p>
            )}
          </>
        ) : null}

        {tab === "accounts" ? (
          <>
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">
                Accounts
              </h2>
              <button
                type="button"
                onClick={() => openAccountModal("new")}
                className="inline-flex items-center gap-1.5 rounded-full bg-navy px-4 py-2 text-xs font-semibold text-navy-foreground"
              >
                <Plus className="h-3.5 w-3.5" /> Add Account
              </button>
            </div>
            {accountStats.length ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {accountStats.map((s) => (
                  <article
                    key={s.account.id}
                    className="flex h-full min-w-0 flex-col rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]"
                  >
                    <div className="flex min-w-0 items-center justify-between gap-2">
                      <p className="truncate text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                        {s.account.platform}
                      </p>
                      <StatusChip status={s.account.status} />
                    </div>
                    <p className="mt-1 truncate text-sm font-semibold">{s.account.name}</p>
                    {s.account.code ? (
                      <p className="truncate text-[11px] text-muted-foreground">{s.account.code}</p>
                    ) : null}
                    <p className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold leading-none">
                      {s.total.toLocaleString()}
                    </p>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      Listings · {s.categories.length} categories
                    </p>
                    {s.target > 0 ? <ProgressBar value={s.total} max={s.target} /> : null}
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      Last listing: {s.last ? formatDate(s.last) : "—"}
                    </p>
                    <div className="mt-auto flex flex-wrap gap-1.5 pt-3">
                      <button
                        type="button"
                        onClick={() => {
                          setFAccount(s.account.id);
                          setTab("products");
                        }}
                        className={chipBtn}
                      >
                        View Listings
                      </button>
                      <button
                        type="button"
                        onClick={() => openAccountModal(s.account)}
                        className={chipBtn}
                      >
                        Edit Account
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          persistAccounts(
                            accounts.map((a) =>
                              a.id === s.account.id
                                ? {
                                    ...a,
                                    status: a.status === "Paused" ? "Active" : "Paused",
                                    updatedAt: new Date().toISOString(),
                                  }
                                : a,
                            ),
                          )
                        }
                        className={chipBtn}
                      >
                        {s.account.status === "Paused" ? "Resume" : "Pause"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          persistAccounts(accounts.filter((a) => a.id !== s.account.id));
                          persistRecords(records.filter((r) => r.accountId !== s.account.id));
                        }}
                        className={`${chipBtn} text-destructive`}
                      >
                        <Trash2 className="inline h-3 w-3" /> Delete
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-4 rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
                No accounts yet. Add Etsy shops, your website, Alibaba stores and more.
              </p>
            )}
          </>
        ) : null}
      </main>

      {catTargetModal ? (
        <Modal title="Category Targets" onClose={() => setCatTargetModal(false)}>
          {categoryTargets.map((c) => (
            <Field key={c.name} label={`${c.name} — listed ${c.listed}`}>
              <input
                type="number"
                min={0}
                value={targets.categories[c.name] ?? ""}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  const next = { ...targets.categories };
                  if (Number.isFinite(v) && v > 0) next[c.name] = Math.round(v);
                  else delete next[c.name];
                  persistTargets({ ...targets, categories: next });
                }}
                placeholder="Target"
                className={inputCls}
              />
            </Field>
          ))}
          <button
            type="button"
            onClick={() => setCatTargetModal(false)}
            className="mt-1 rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-navy-foreground"
          >
            Done
          </button>
        </Modal>
      ) : null}

      {accountModal ? (
        <Modal
          title={accountModal === "new" ? "Add Account" : "Edit Account"}
          onClose={() => setAccountModal(null)}
        >
          <Field label="Platform">
            <select
              value={aPlatform}
              onChange={(e) => setAPlatform(e.target.value)}
              className={inputCls}
            >
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>
          {aPlatform === "Other / Custom" ? (
            <Field label="Platform name">
              <input
                value={aCustom}
                onChange={(e) => setACustom(e.target.value)}
                placeholder="e.g. Novica"
                className={inputCls}
              />
            </Field>
          ) : null}
          <Field label="Account / Store name">
            <input
              value={aName}
              onChange={(e) => setAName(e.target.value)}
              placeholder="LEPDO Lifestyle"
              className={inputCls}
            />
          </Field>
          <Field label="Account URL (optional)">
            <input value={aUrl} onChange={(e) => setAUrl(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Account code (optional)">
            <input
              value={aCode}
              onChange={(e) => setACode(e.target.value)}
              placeholder="ET-LS"
              className={inputCls}
            />
          </Field>
          <Field label="Listing target (optional)">
            <input
              type="number"
              min={0}
              value={aTarget}
              onChange={(e) => setATarget(e.target.value)}
              placeholder="2000"
              className={inputCls}
            />
          </Field>
          <Field label="Status">
            <select
              value={aStatus}
              onChange={(e) => setAStatus(e.target.value as AccountStatus)}
              className={inputCls}
            >
              <option value="Active">Active</option>
              <option value="Paused">Paused</option>
              <option value="Inactive">Inactive</option>
            </select>
          </Field>
          {aError ? <p className="text-xs font-medium text-destructive">{aError}</p> : null}
          <button
            type="button"
            onClick={saveAccount}
            className="mt-1 rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-navy-foreground"
          >
            Save Account
          </button>
        </Modal>
      ) : null}

      {listingModal ? (
        <Modal
          title={listingModal.record ? "Edit Listing" : "Add Listing"}
          onClose={() => setListingModal(null)}
        >
          {(() => {
            const product = listings.find((l) => sameSku(l.sku, listingModal.sku));
            return (
              <div className="rounded-xl border border-border bg-secondary/50 p-3 text-xs">
                <p className="font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  SKU: {listingModal.sku}
                </p>
                <p className="mt-1 line-clamp-2 font-semibold text-foreground">
                  {product?.fields.finalTitle || "Untitled listing"}
                </p>
                <p className="text-muted-foreground">{product?.listingCategory || "No category"}</p>
              </div>
            );
          })()}
          <Field label="Select account">
            <select
              value={lAccount}
              onChange={(e) => setLAccount(e.target.value)}
              className={inputCls}
            >
              <option value="">Choose an account…</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.platform} — {a.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Listing status">
            <select
              value={lStatus}
              onChange={(e) => setLStatus(e.target.value as ListingStatus)}
              className={inputCls}
            >
              {LISTING_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Live product URL">
            <input
              value={lUrl}
              onChange={(e) => setLUrl(e.target.value)}
              placeholder="https://etsy.com/listing/…"
              className={inputCls}
            />
          </Field>
          <Field label="Listed date">
            <input
              type="date"
              value={lDate}
              onChange={(e) => setLDate(e.target.value)}
              className={inputCls}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Listing ID (optional)">
              <input value={lId} onChange={(e) => setLId(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Note (optional)">
              <input
                value={lNote}
                onChange={(e) => setLNote(e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>
          {lError ? <p className="text-xs font-medium text-destructive">{lError}</p> : null}
          {lConflict ? (
            <div className="rounded-xl border border-gold/60 bg-secondary/60 p-3">
              <p className="text-sm">
                This SKU already has a listing for this account. Update existing listing?
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => commitListing(lConflict)}
                  className="rounded-full bg-navy px-4 py-2 text-xs font-semibold text-navy-foreground"
                >
                  Update
                </button>
                <button
                  type="button"
                  onClick={() => setLConflict(null)}
                  className="rounded-full border border-border bg-card px-4 py-2 text-xs font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
          <button
            type="button"
            onClick={saveListing}
            className="mt-1 rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-navy-foreground"
          >
            Save Listing
          </button>
        </Modal>
      ) : null}
    </div>
  );
}
