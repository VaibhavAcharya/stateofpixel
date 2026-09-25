import { CheckIcon, CopyIcon } from "@phosphor-icons/react/ssr";
import { useEffect, useState } from "react";
import { buttonClass } from "./ui";

export type Snippet = {
  code: string;
  lines: {
    content: string;
    offset: number;
    style?: Record<string, string>;
  }[][];
};

export function CodeBlock({
  fileName,
  code,
  lines,
}: {
  fileName: string;
  code: string;
  lines?: Snippet["lines"];
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
          data-umami-event="Copy code"
          data-umami-event-file={fileName}
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
        <code>
          {lines === undefined
            ? code
            : lines.flatMap((line, index) => [
                ...(index > 0 ? ["\n"] : []),
                ...line.map((token) => (
                  <span
                    key={token.offset}
                    className="syntax"
                    style={token.style}
                  >
                    {token.content}
                  </span>
                )),
              ])}
        </code>
      </pre>
    </figure>
  );
}
