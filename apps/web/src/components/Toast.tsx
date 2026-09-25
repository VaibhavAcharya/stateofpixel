import { CheckCircle, Warning } from "@phosphor-icons/react/ssr";
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
      className="pointer-events-auto flex w-full max-w-[420px] items-center gap-2 rounded-md border border-border bg-surface px-3 py-2.5 text-sm shadow-menu"
    >
      <Icon
        size={16}
        className={toast.tone === "success" ? "text-approved" : "text-failed"}
      />
      {toast.text}
    </div>
  );
}
