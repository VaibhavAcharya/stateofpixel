import { useRef } from "react";
import {
  Dialog,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "uiofcraft";
import { Kbd } from "./ui";

export const SHORTCUT_GROUPS: { title: string; items: [string, string[]][] }[] =
  [
    {
      title: "Navigate",
      items: [
        ["Next / previous snapshot", ["j", "k"]],
        ["Show / hide the snapshots of a name", ["l", "h"]],
        ["Focus filter", ["/"]],
        ["Close the snapshot list", ["esc"]],
        ["Show shortcuts", ["?"]],
      ],
    },
    {
      title: "Review",
      items: [
        ["Approve, move to next pending", ["a"]],
        ["Reject, move to next pending", ["r"]],
        ["Undo review", ["u"]],
        ["Comments", ["m"]],
        ["Approve build", ["shift", "a"]],
        ["Reject build", ["shift", "r"]],
        ["Undo the build review", ["shift", "u"]],
      ],
    },
    {
      title: "View",
      items: [
        ["Side by side, Diff, Slider, Flip", ["1", "2", "3", "4"]],
        ["Diff overlay in Side by side, Diff only in Diff", ["d"]],
        ["Next diff color", ["c"]],
        ["Toggle image in Flip mode", ["space"]],
        ["Move the Slider divider by 10%", ["shift", "left", "right"]],
        ["Fit / 100% zoom", ["f", "0"]],
        ["Zoom in / out", ["+", "-"]],
      ],
    },
  ];

export const APP_SHORTCUTS = {
  title: "App",
  items: [
    ["Jump to a project, account or page", ["cmd", "k"]],
    ["Fold the app sidebar", ["cmd", "b"]],
  ],
} satisfies (typeof SHORTCUT_GROUPS)[number];

export function ShortcutsDialog({
  open,
  onClose,
  app = false,
}: {
  open: boolean;
  onClose: () => void;
  app?: boolean;
}) {
  const groups = app ? [...SHORTCUT_GROUPS, APP_SHORTCUTS] : SHORTCUT_GROUPS;
  const popup = useRef<HTMLDivElement>(null);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
    >
      <DialogPopup ref={popup} className="max-w-[560px]" initialFocus={popup}>
        <DialogHeader>
          <DialogTitle className="text-base font-semibold tracking-[-0.01em]">
            Keyboard shortcuts
          </DialogTitle>
        </DialogHeader>
        <DialogPanel className="flex flex-col gap-5">
          {groups.map((group) => (
            <section key={group.title}>
              <h3 className="mb-1 text-2xs font-medium text-muted-foreground">
                {group.title}
              </h3>
              <dl className="flex flex-col">
                {group.items.map(([action, keys]) => (
                  <div
                    key={action}
                    className="flex h-8 items-center justify-between gap-6 border-b border-dotted text-sm last:border-b-0"
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
        </DialogPanel>
      </DialogPopup>
    </Dialog>
  );
}
