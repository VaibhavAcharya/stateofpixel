import { ChatTextIcon, CheckIcon, XIcon } from "@phosphor-icons/react/ssr";
import { MAX_COMMENT_LENGTH } from "@stateofpixel/backend/limits";
import { useEffect, useRef, useState } from "react";
import {
  Button,
  Dialog,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
  Textarea,
} from "uiofcraft";
import { RelativeTime } from "../ui";
import type { Snapshot } from "./types";

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
  const input = useRef<HTMLTextAreaElement>(null);
  const [comment, setComment] = useState("");
  useEffect(() => {
    if (open) {
      setComment("");
    }
  }, [open]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
          }
          onClose();
        }
      }}
    >
      <DialogPopup className="max-w-[480px]" initialFocus={input}>
        <DialogHeader>
          <DialogTitle className="min-w-0 truncate pr-8 text-base font-semibold tracking-[-0.01em]">
            Comments on {name}
          </DialogTitle>
        </DialogHeader>
        <DialogPanel className={canReview ? "pb-4" : undefined}>
          {comments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No comments yet.</p>
          ) : (
            <ol className="flex flex-col gap-4">
              {comments.map((item) => (
                <li key={item.id} className="flex flex-col gap-1 text-sm">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {item.action === "approve" ? (
                      <CheckIcon
                        size={12}
                        weight="bold"
                        className="text-approved"
                      />
                    ) : item.action === "reject" ? (
                      <XIcon
                        size={12}
                        weight="bold"
                        className="text-rejected"
                      />
                    ) : (
                      <ChatTextIcon size={12} />
                    )}
                    <span className="font-medium text-foreground">
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
        </DialogPanel>
        {canReview && (
          <form
            className="flex flex-col gap-4 px-6 pb-6"
            onSubmit={(event) => {
              event.preventDefault();
              if (comment.trim() !== "") {
                onSubmit(comment.trim());
                setComment("");
              }
            }}
          >
            <Textarea
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
              className="*:resize-none"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={comment.trim() === ""}>
                Comment
              </Button>
            </div>
          </form>
        )}
      </DialogPopup>
    </Dialog>
  );
}
