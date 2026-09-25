import type { ReactNode } from "react";

export function Page({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-[1200px] px-6 pt-8 pb-16 max-sm:px-4 max-sm:pt-6">
      {children}
    </main>
  );
}

export function PageHeader({
  title,
  leading,
  meta,
  actions,
}: {
  title: ReactNode;
  leading?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 pb-6">
      <div className="flex min-w-0 items-center gap-3">
        {leading}
        <div className="flex min-w-0 flex-col">
          <h1 className="truncate text-xl font-semibold tracking-[-0.025em]">
            {title}
          </h1>
          {meta && (
            <div className="flex items-center gap-2 text-xs text-muted">
              {meta}
            </div>
          )}
        </div>
      </div>
      {actions && (
        <div className="ml-auto flex items-center gap-2">{actions}</div>
      )}
    </div>
  );
}
