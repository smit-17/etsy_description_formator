import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

export type AppRoute = "/" | "/description" | "/saved" | "/list" | "/prompts" | "/style";

export type MainTabKey = "description" | "saved" | "list" | "prompts" | "style";

/** The five main tabs shown in every section header, in fixed order. */
export function mainTabs(active: MainTabKey): SectionTab[] {
  return [
    { label: "Description", to: "/description" as const, active: active === "description" },
    { label: "Saved Descriptions", to: "/saved" as const, active: active === "saved" },
    {
      label: "List",
      to: "/list" as const,
      search: { tab: "dashboard" },
      active: active === "list",
    },
    { label: "Saved Prompts", to: "/prompts" as const, active: active === "prompts" },
    { label: "Style Description", to: "/style" as const, active: active === "style" },
  ];
}

export interface SectionTab {
  label: string;
  /** Link target — omit when the tab switches state on the current page. */
  to?: AppRoute;
  search?: Record<string, unknown>;
  onClick?: () => void;
  active: boolean;
  icon?: ReactNode;
}

interface SectionHeaderProps {
  /** Main section name, e.g. "Description". */
  title: string;
  subtitle?: string;
  backTo?: AppRoute;
  backSearch?: Record<string, unknown>;
  backLabel?: string;
  tabs?: SectionTab[];
  /** Optional second row of section-specific tabs. */
  subTabs?: SectionTab[];
  actions?: ReactNode;
}

const tabClass = (active: boolean) =>
  `inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-1.5 text-sm transition-colors ${
    active
      ? "bg-ivory text-navy font-semibold shadow-[var(--shadow-soft)]"
      : "border border-navy-foreground/25 text-navy-foreground/80 hover:border-gold hover:text-gold"
  }`;

const subTabClass = (active: boolean) =>
  `inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs transition-colors ${
    active ? "bg-gold/20 text-gold font-semibold" : "text-navy-foreground/70 hover:text-gold"
  }`;

export function SectionHeader({
  title,
  subtitle,
  backTo,
  backSearch,
  backLabel = "Back",
  tabs,
  subTabs,
  actions,
}: SectionHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-[image:var(--gradient-navy)] shadow-[var(--shadow-soft)]">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex min-h-16 min-w-0 flex-wrap items-center justify-between gap-3 py-3">
          <div className="flex min-w-0 items-center gap-3">
            {backTo ? (
              <Link
                to={backTo}
                search={backSearch as never}
                title={backLabel}
                aria-label={backLabel}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-gold/50 px-3 py-1.5 text-xs font-medium text-gold transition-colors hover:bg-gold/10"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{backLabel}</span>
              </Link>
            ) : null}
            <div className="min-w-0">
              <h1 className="truncate font-[family-name:var(--font-display)] text-xl font-semibold tracking-tight text-navy-foreground sm:text-2xl">
                {title}
              </h1>
              {subtitle ? (
                <p className="truncate text-xs text-navy-foreground/70">{subtitle}</p>
              ) : null}
            </div>
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
        </div>
        {tabs && tabs.length > 0 ? (
          <nav className="-mx-4 flex flex-nowrap gap-2 overflow-x-auto px-4 pb-3 sm:flex-wrap sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {tabs.map((t) =>
              t.to ? (
                <Link
                  key={t.label}
                  to={t.to}
                  search={t.search as never}
                  className={tabClass(t.active)}
                >
                  {t.icon} {t.label}
                </Link>
              ) : (
                <button
                  key={t.label}
                  type="button"
                  onClick={t.onClick}
                  className={tabClass(t.active)}
                >
                  {t.icon} {t.label}
                </button>
              ),
            )}
          </nav>
        ) : null}
        {subTabs && subTabs.length > 0 ? (
          <nav className="-mx-4 flex gap-2 overflow-x-auto border-t border-navy-foreground/10 px-4 py-2 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {subTabs.map((t) =>
              t.to ? (
                <Link
                  key={t.label}
                  to={t.to}
                  search={t.search as never}
                  className={subTabClass(t.active)}
                >
                  {t.icon} {t.label}
                </Link>
              ) : (
                <button
                  key={t.label}
                  type="button"
                  onClick={t.onClick}
                  className={subTabClass(t.active)}
                >
                  {t.icon} {t.label}
                </button>
              ),
            )}
          </nav>
        ) : null}
      </div>
    </header>
  );
}
