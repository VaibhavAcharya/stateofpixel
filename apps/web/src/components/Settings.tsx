import { type ReactNode, useEffect, useId, useState } from "react";
import {
  Card,
  cn,
  FieldDescription,
  FieldLabel,
  Field as UiField,
} from "uiofcraft";

export function Section({
  title,
  danger = false,
  children,
}: {
  title: string;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-4 border-t py-8 first:border-t-0 first:pt-0 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-10">
      <h2 className="font-heading font-semibold text-base">{title}</h2>
      <Card
        className={cn("gap-6 p-5 sm:p-6", danger && "border-destructive/32")}
      >
        {children}
      </Card>
    </section>
  );
}

export function Field({
  label,
  hint,
  status,
  children,
}: {
  label: string;
  hint?: string;
  status?: ReactNode;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <UiField className="items-stretch gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        {status}
      </div>
      {children(id)}
      {hint && <FieldDescription>{hint}</FieldDescription>}
    </UiField>
  );
}

export function useSaveStatus(errorMessage: (error: unknown) => string) {
  const [status, setStatus] = useState<
    { state: "saved" } | { state: "error"; message: string } | null
  >(null);
  useEffect(() => {
    if (status?.state !== "saved") {
      return;
    }
    const timer = setTimeout(() => setStatus(null), 2000);
    return () => clearTimeout(timer);
  }, [status]);
  const run = (promise: Promise<unknown>) =>
    promise.then(
      () => setStatus({ state: "saved" }),
      (error: unknown) =>
        setStatus({ state: "error", message: errorMessage(error) }),
    );
  const note =
    status === null ? null : status.state === "saved" ? (
      <span className="text-xs text-muted-foreground">Saved</span>
    ) : (
      <span role="alert" className="text-xs text-rejected">
        {status.message}
      </span>
    );
  return { run, note, invalid: status?.state === "error" };
}
