import { CheckIcon, CopyIcon } from "@phosphor-icons/react/ssr";
import { useEffect, useState } from "react";
import { Button } from "uiofcraft";

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
    <figure className="min-w-0 overflow-hidden rounded-xl border bg-card shadow-xs/5">
      <figcaption className="flex h-10 items-center justify-between border-b bg-muted/72 pr-1.5 pl-4 text-muted-foreground text-xs">
        <span className="mono">{fileName}</span>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={copied ? "Copied" : "Copy code"}
          data-umami-event="Copy code"
          data-umami-event-file={fileName}
          onClick={() => {
            void navigator.clipboard
              .writeText(code)
              .then(() => setCopied(true));
          }}
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
        </Button>
      </figcaption>
      <pre className="overflow-x-auto p-4 font-mono text-[0.8125rem] leading-[1.7]">
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
