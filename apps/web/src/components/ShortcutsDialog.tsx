import { useEffect, useRef } from "react";
import { Kbd } from "./ui";

export const SHORTCUTS: [string, string[]][] = [
  ["Next / previous snapshot", ["j", "k"]],
  ["Approve, move to next pending", ["a"]],
  ["Reject (opens comment box)", ["r"]],
  ["Undo review", ["u"]],
  ["Approve all pending", ["shift", "a"]],
  ["Side by side, Diff, Slider, Flip", ["1", "2", "3", "4"]],
  ["Toggle image in Flip mode", ["space"]],
  ["Fit / 100% zoom", ["f", "0"]],
  ["Focus filter", ["/"]],
  ["Show shortcuts", ["?"]],
];

export function ShortcutsDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open && !dialog.current?.open) {
      dialog.current?.showModal();
    } else if (!open && dialog.current?.open) {
      dialog.current.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      className="m-auto w-[560px] outline-none max-w-[calc(100vw-32px)] rounded-lg border border-border bg-surface p-6 text-text shadow-menu backdrop:bg-black/20"
    >
      <h2 className="text-lg font-semibold tracking-[-0.01em]">
        Keyboard shortcuts
      </h2>
      <dl className="mt-4 grid grid-cols-[1fr_auto] gap-x-6 gap-y-2 text-sm">
        {SHORTCUTS.map(([action, keys]) => (
          <div key={action} className="contents">
            <dt>{action}</dt>
            <dd className="flex justify-end gap-1">
              {keys.map((key) => (
                <Kbd key={key}>{key}</Kbd>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </dialog>
  );
}
