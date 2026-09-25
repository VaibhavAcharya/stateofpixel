import { CheckCircle, Warning, X } from "@phosphor-icons/react/ssr";
import { useCallback, useEffect, useState } from "react";

export type ToastMessage = {
  id: number;
  tone: "success" | "error";
  text: string;
};

export function useToasts() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const show = useCallback((tone: ToastMessage["tone"], text: string) => {
    setToasts((current) => [
      ...current.slice(-2),
      { id: Date.now() + Math.random(), tone, text },
    ]);
  }, []);
  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);
  return { toasts, show, dismiss };
}

export function Toasts({
  toasts,
  dismiss,
}: {
  toasts: ToastMessage[];
  dismiss: (id: number) => void;
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} dismiss={dismiss} />
      ))}
    </div>
  );
}

function Toast({
  toast,
  dismiss,
}: {
  toast: ToastMessage;
  dismiss: (id: number) => void;
}) {
  useEffect(() => {
    const timer = setTimeout(() => dismiss(toast.id), 5000);
    return () => clearTimeout(timer);
  }, [toast.id, dismiss]);
  const Icon = toast.tone === "success" ? CheckCircle : Warning;

  return (
    <div
      role={toast.tone === "error" ? "alert" : "status"}
      className="pointer-events-auto flex w-full max-w-[420px] animate-enter items-start gap-2.5 rounded-md bg-surface py-2.5 pr-2 pl-3 text-sm shadow-menu ring-1 ring-border"
    >
      <Icon
        size={16}
        weight="fill"
        className={`mt-0.5 shrink-0 ${toast.tone === "success" ? "text-approved" : "text-failed"}`}
      />
      <span className="min-w-0 flex-1">{toast.text}</span>
      <button
        type="button"
        aria-label="Dismiss"
        className="-my-0.5 flex size-6 shrink-0 items-center justify-center rounded-sm text-muted hover:bg-hover hover:text-text"
        onClick={() => dismiss(toast.id)}
      >
        <X size={12} />
      </button>
    </div>
  );
}
