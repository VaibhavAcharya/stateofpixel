import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { cn } from "uiofcraft";
import { type Icon, Tooltip } from "./ui";

const TAB_CLASS =
  "relative flex h-8.5 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-[calc(--spacing(2.5)-1px)] font-medium text-base outline-none transition-[color,background-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring sm:h-7.5 sm:text-sm [&_svg]:-mx-0.5 [&_svg]:shrink-0 [&_svg]:opacity-80";

export function Tabs({ children }: { children: ReactNode }) {
  return (
    <nav className="mb-6 flex gap-x-0.5 border-b py-1 text-muted-foreground">
      {children}
    </nav>
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
          className={cn(TAB_CLASS, "cursor-not-allowed opacity-64")}
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
      className={cn(
        TAB_CLASS,
        "hover:bg-accent hover:text-foreground",
        active &&
          "text-foreground after:absolute after:inset-x-0 after:-bottom-[calc(--spacing(1)+1px)] after:h-0.5 after:bg-primary",
      )}
    >
      <TabIcon size={16} />
      {label}
    </Link>
  );
}
