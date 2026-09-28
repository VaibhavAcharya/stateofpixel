import {
  CheckIcon,
  CopyIcon,
  FolderSimpleIcon,
  TerminalWindowIcon,
} from "@phosphor-icons/react/ssr";
import { type ReactNode, useState } from "react";
import { SITE_URL } from "../../lib/pageMeta";
import { buttonClass } from "../ui";
import { DocsPageLink } from "./DocsLayout";

const PATHS: { title: string; text: string; icon: ReactNode; slug: string }[] =
  [
    {
      title: "Playwright",
      text: "Add the reporter. It uploads when the run ends.",
      icon: <img src="/logos/playwright.svg" alt="" width={20} height={20} />,
      slug: "playwright",
    },
    {
      title: "Storybook",
      text: "One command captures every story at each width.",
      icon: <img src="/logos/storybook.svg" alt="" width={20} height={20} />,
      slug: "storybook",
    },
    {
      title: "Any screenshots",
      text: "Point the CLI at a folder of PNG files.",
      icon: <FolderSimpleIcon size={20} className="text-muted" />,
      slug: "any-screenshots",
    },
    {
      title: "Try it locally",
      text: "Compare two folders. No account needed.",
      icon: <TerminalWindowIcon size={20} className="text-muted" />,
      slug: "cli",
    },
  ];

export function SetupPaths() {
  return (
    <div className="mt-4 grid grid-cols-2 gap-3 max-sm:grid-cols-1">
      {PATHS.map((path) => (
        <DocsPageLink
          key={path.slug}
          slug={path.slug}
          className="flex flex-col gap-3 rounded-lg bg-surface p-5 text-text! ring-1 ring-border hover:bg-hover hover:no-underline!"
        >
          <span className="flex size-9 items-center justify-center rounded-md bg-surface-2">
            {path.icon}
          </span>
          <span>
            <span className="block text-base font-medium">{path.title}</span>
            <span className="block text-sm text-muted">{path.text}</span>
          </span>
        </DocsPageLink>
      ))}
    </div>
  );
}

const AGENT_PROMPT = `Add visual regression testing to this repository with stateofpixel.
Read ${SITE_URL}/llms.txt, then the quickstart it links, and follow it:
1. Find where the tests write screenshots, or set up Playwright or Storybook capture.
2. Add the upload step to the GitHub Actions workflow with id-token: write and fetch-depth: 0.
3. Run it on pushes to main and on pull requests.
Do not add a secret. Tell me which command takes the screenshots.`;

export function AgentPrompt() {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-4 overflow-hidden rounded-md bg-surface-2 ring-1 ring-border">
      <div className="flex h-10 items-center gap-2 border-b border-border px-3 text-xs">
        <span className="font-medium">Set it up with your coding agent</span>
        <button
          type="button"
          data-umami-event="Copy agent prompt"
          onClick={() => {
            navigator.clipboard.writeText(AGENT_PROMPT).then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 2000);
            });
          }}
          className={`${buttonClass("ghost", "sm")} ml-auto`}
        >
          {copied ? <CheckIcon size={12} /> : <CopyIcon size={12} />}
          {copied ? "Copied" : "Copy prompt"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-[1.8] whitespace-pre-wrap">
        {AGENT_PROMPT}
      </pre>
    </div>
  );
}
