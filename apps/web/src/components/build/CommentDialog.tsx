import { ChatTextIcon, CheckIcon, XIcon } from "@phosphor-icons/react/ssr";
import { useEffect, useRef, useState } from "react";
import { buttonClass, RelativeTime } from "../ui";
import type { Snapshot } from "./types";

const MAX_COMMENT_LENGTH = 500;

export function CommentDialog({
  open,
  name,
  comments,
  canReview,
  onSubmit,
  onClose,
}: {
  open: boolean;
  name: string;
  comments: Snapshot["comments"];
  canReview: boolean;
  onSubmit: (body: string) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const [comment, setComment] = useState("");
  useEffect(() => {
    if (open && !dialog.current?.open) {
      setComment("");
      dialog.current?.showModal();
      input.current?.focus();
    } else if (!open && dialog.current?.open) {
      dialog.current.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialog}
      onClose={() => {
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        onClose();
      }}
      onPointerDown={(event) => {
        if (event.target === dialog.current) {
          onClose();
        }
      }}
      aria-labelledby="comments-title"
      className="m-auto w-[480px] max-w-[calc(100vw-32px)] rounded-lg bg-surface p-0 text-text shadow-menu ring-1 ring-border outline-none backdrop:bg-black/25 open:animate-enter"
    >
      <div className="flex h-14 items-center justify-between gap-3 border-b border-border pr-3 pl-6">
        <h2
          id="comments-title"
          className="min-w-0 truncate text-lg font-semibold tracking-[-0.01em]"
        >
          Comments on {name}
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
      {comments.length === 0 ? (
        <p className="px-6 pt-4 text-sm text-muted">No comments yet.</p>
      ) : (
        <ol className="flex max-h-72 flex-col gap-4 overflow-y-auto px-6 pt-4">
          {comments.map((item) => (
            <li key={item.id} className="flex flex-col gap-1 text-sm">
              <span className="flex items-center gap-1.5 text-xs text-muted">
                {item.action === "approve" ? (
                  <CheckIcon
                    size={12}
                    weight="bold"
                    className="text-approved"
                  />
                ) : item.action === "reject" ? (
                  <XIcon size={12} weight="bold" className="text-rejected" />
                ) : (
                  <ChatTextIcon size={12} />
                )}
                <span className="font-medium text-text">
                  {item.login === null ? "Someone" : `@${item.login}`}
                </span>
                {item.action === "approve"
                  ? "approved"
                  : item.action === "reject"
                    ? "rejected"
                    : "commented"}
                <RelativeTime timestamp={item.createdAt} />
              </span>
              <p className="whitespace-pre-wrap">{item.body}</p>
            </li>
          ))}
        </ol>
      )}
      {canReview ? (
        <form
          className="flex flex-col gap-4 px-6 pt-4 pb-6"
          onSubmit={(event) => {
            event.preventDefault();
            if (comment.trim() !== "") {
              onSubmit(comment.trim());
              setComment("");
            }
          }}
        >
          <textarea
            ref={input}
            value={comment}
            maxLength={MAX_COMMENT_LENGTH}
            rows={3}
            onChange={(event) => setComment(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.currentTarget.form?.requestSubmit();
              }
            }}
            aria-label="Comment"
            placeholder="Add a comment"
            className="resize-none rounded-md bg-surface px-2.5 py-2 text-sm shadow-[inset_0_0_0_1px_var(--color-field-border)] transition-shadow duration-250 ease-standard outline-none placeholder:text-subtle focus:shadow-field-focus"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className={buttonClass("ghost")}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={comment.trim() === ""}
              className={buttonClass("primary")}
            >
              Comment
            </button>
          </div>
        </form>
      ) : (
        <div className="pb-6" />
      )}
    </dialog>
  );
}
