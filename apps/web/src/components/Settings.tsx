import { type ReactNode, useEffect, useId, useState } from "react";

export function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-6 border-t border-dotted border-border py-12 first:border-t-0 first:pt-0">
      <h2 className="text-base font-semibold">{title}</h2>
      {children}
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
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        {status}
      </div>
      {children(id)}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
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
      <span className="text-xs text-muted">Saved</span>
    ) : (
      <span role="alert" className="text-xs text-rejected">
        {status.message}
      </span>
    );
  return { run, note, invalid: status?.state === "error" };
}

export function RadioSetting<Value extends string>({
  label,
  hint,
  value,
  options,
  onSave,
}: {
  label: string;
  hint: string;
  value: Value;
  options: { value: Value; label: string; detail: string }[];
  onSave: (value: Value) => Promise<unknown>;
}) {
  const id = useId();
  const { run, note } = useSaveStatus(() => "Could not save. Try again.");
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <p id={id} className="text-sm font-medium">
          {label}
        </p>
        {note}
      </div>
      <div
        role="radiogroup"
        aria-labelledby={id}
        className="flex flex-col gap-2"
      >
        {options.map((option) => (
          <label key={option.value} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name={id}
              checked={value === option.value}
              onChange={() => void run(onSave(option.value))}
              className="size-4 accent-[var(--color-accent)]"
            />
            {option.label}
            <span className="text-muted">{option.detail}</span>
          </label>
        ))}
      </div>
      <p className="text-xs text-muted">{hint}</p>
    </div>
  );
}
