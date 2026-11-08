import type { ReactNode } from "react";

export function Page({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-[1200px] px-4 pt-6 pb-16 sm:px-6 sm:pt-10">
      {children}
    </main>
  );
}

export function PageHeader({
  title,
  leading,
  above,
  meta,
  actions,
}: {
  title: ReactNode;
  leading?: ReactNode;
  above?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 pb-6">
      <div className="flex min-w-0 items-center gap-3">
        {leading}
        <div className="flex min-w-0 flex-col">
          {above && (
            <div className="text-xs text-muted-foreground">{above}</div>
          )}
          <h1 className="truncate font-heading font-semibold text-2xl tracking-[-0.01em]">
            {title}
          </h1>
          {meta && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
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
