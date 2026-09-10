import type { ReactNode } from "react";

/** Big-number summary widget with an index badge. */
export function StatCard({
  index,
  label,
  value,
  icon,
  hint,
  onClick,
  active,
}: {
  index: number;
  label: string;
  value: number | string;
  icon?: ReactNode;
  hint?: string;
  onClick?: () => void;
  active?: boolean;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      {...(onClick ? { type: "button" as const, onClick } : {})}
      className={`min-w-0 rounded-2xl border bg-card p-4 text-left shadow-[var(--shadow-soft)] transition-colors ${
        active ? "border-gold ring-2 ring-gold/25" : "border-border hover:border-gold/70"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold tracking-[0.2em] text-gold">
          {String(index).padStart(2, "0")}
        </span>
        {icon ? <span className="text-muted-foreground">{icon}</span> : null}
      </div>
      <p className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold leading-none text-foreground">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      <p className="mt-1.5 truncate text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      {hint ? <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{hint}</p> : null}
    </Tag>
  );
}

export function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="mt-2">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-[image:var(--gradient-gold)]"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {value.toLocaleString()} / {max.toLocaleString()} · {pct}%
      </p>
    </div>
  );
}

const STATUS_STYLE: Record<string, string> = {
  Listed: "bg-navy text-navy-foreground",
  "Ready to List": "bg-gold/25 text-foreground",
  Ready: "bg-gold/25 text-foreground",
  "Listing in Progress": "bg-gold/25 text-foreground",
  "Partially Listed": "bg-gold/25 text-foreground",
  Pending: "bg-gold/25 text-foreground",
  Hold: "bg-destructive/15 text-destructive",
  "Not Listed": "bg-secondary text-muted-foreground",
};

export function StatusChip({ status }: { status: string }) {
  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
        STATUS_STYLE[status] ?? "bg-secondary text-muted-foreground"
      }`}
    >
      {status === "Listed" ? "Listed ✓" : status}
    </span>
  );
}

/** Category counter widget with share-of-total progress. */
export function CategoryCard({
  name,
  count,
  total,
  active,
  onClick,
}: {
  name: string;
  count: number;
  total: number;
  active?: boolean;
  onClick?: () => void;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-w-0 rounded-2xl border bg-card p-3.5 text-left shadow-[var(--shadow-soft)] transition-colors ${
        active ? "border-gold ring-2 ring-gold/25" : "border-border hover:border-gold/70"
      }`}
    >
      <p className="truncate text-xs font-medium text-muted-foreground">{name}</p>
      <p className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold leading-none">
        {count.toLocaleString()}
      </p>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-navy" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">{pct}% of total</p>
    </button>
  );
}
