import { CheckIcon, CopyIcon } from "@phosphor-icons/react/ssr";
import { useEffect, useState } from "react";
import { buttonClass } from "./ui";

export function CodeBlock({
  fileName,
  code,
}: {
  fileName: string;
  code: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <figure className="overflow-hidden rounded-md bg-surface-2 shadow-[inset_0_0_0_1px_var(--color-border)]">
      <figcaption className="flex h-10 items-center justify-between border-b border-border pr-1.5 pl-4 text-xs text-muted">
        <span className="mono">{fileName}</span>
        <button
          type="button"
          aria-label={copied ? "Copied" : "Copy code"}
          className={buttonClass("ghost", "icon-sm")}
          onClick={() => {
            void navigator.clipboard
              .writeText(code)
              .then(() => setCopied(true));
          }}
        >
          {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
        </button>
      </figcaption>
      <pre className="overflow-x-auto p-4 font-mono text-xs leading-[1.8]">
        <code>{code}</code>
      </pre>
    </figure>
  );
}
