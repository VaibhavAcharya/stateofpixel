import { XIcon } from "@phosphor-icons/react/ssr";
import { useEffect, useRef } from "react";
import { buttonClass, Kbd } from "./ui";

export const SHORTCUT_GROUPS: { title: string; items: [string, string[]][] }[] =
  [
    {
      title: "Navigate",
      items: [
        ["Next / previous snapshot", ["j", "k"]],
        ["Focus filter", ["/"]],
        ["Show shortcuts", ["?"]],
      ],
    },
    {
      title: "Review",
      items: [
        ["Approve, move to next pending", ["a"]],
        ["Reject with a comment", ["r"]],
        ["Undo review", ["u"]],
        ["Approve all pending", ["shift", "a"]],
      ],
    },
    {
      title: "View",
      items: [
        ["Side by side, Diff, Slider, Flip", ["1", "2", "3", "4"]],
        ["Toggle image in Flip mode", ["space"]],
        ["Fit / 100% zoom", ["f", "0"]],
      ],
    },
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
      dialog.current?.focus();
    } else if (!open && dialog.current?.open) {
      dialog.current.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialog}
      tabIndex={-1}
      onClose={onClose}
      onPointerDown={(event) => {
        if (event.target === dialog.current) {
          onClose();
        }
      }}
      aria-labelledby="shortcuts-title"
      className="m-auto w-[560px] max-w-[calc(100vw-32px)] rounded-lg bg-surface p-0 text-text shadow-menu ring-1 ring-border outline-none backdrop:bg-black/25 open:animate-enter"
    >
      <div className="flex h-14 items-center justify-between border-b border-border pr-3 pl-6">
        <h2
          id="shortcuts-title"
          className="text-lg font-semibold tracking-[-0.01em]"
        >
          Keyboard shortcuts
        </h2>
        <button
          type="button"
          aria-label="Close"
          className={buttonClass("ghost", "icon")}
          onClick={onClose}
        >
          <XIcon size={16} />
        </button>
      </div>
      <div className="flex flex-col gap-5 px-6 pt-4 pb-6">
        {SHORTCUT_GROUPS.map((group) => (
          <section key={group.title}>
            <h3 className="mb-1 text-2xs font-medium text-muted">
              {group.title}
            </h3>
            <dl className="flex flex-col">
              {group.items.map(([action, keys]) => (
                <div
                  key={action}
                  className="flex h-8 items-center justify-between gap-6 border-b border-dotted border-border text-sm last:border-b-0"
                >
                  <dt>{action}</dt>
                  <dd className="flex gap-1">
                    {keys.map((key) => (
                      <Kbd key={key}>{key}</Kbd>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </dialog>
  );
}
