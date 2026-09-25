import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { type Icon, Tooltip } from "./ui";

const TAB_CLASS =
  "-mb-px flex h-10 items-center gap-1.5 border-b-2 text-sm transition-colors duration-100";

export function Tabs({ children }: { children: ReactNode }) {
  return (
    <nav className="mb-6 flex gap-5 border-b border-border">{children}</nav>
  );
}

export function Tab({
  to,
  params,
  icon: TabIcon,
  label,
  active,
  disabledReason,
}: {
  to: string;
  params: Record<string, string>;
  icon: Icon;
  label: string;
  active: boolean;
  disabledReason?: string;
}) {
  if (disabledReason !== undefined) {
    return (
      <Tooltip label={disabledReason}>
        <button
          type="button"
          aria-disabled
          className={`${TAB_CLASS} cursor-not-allowed border-transparent text-muted opacity-45`}
        >
          <TabIcon size={16} />
          {label}
        </button>
      </Tooltip>
    );
  }
  return (
    <Link
      to={to}
      params={params}
      aria-current={active ? "page" : undefined}
      className={`${TAB_CLASS} ${
        active
          ? "border-accent text-text"
          : "border-transparent text-muted hover:text-text"
      }`}
    >
      <TabIcon size={16} />
      {label}
    </Link>
  );
}
