import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CaretDownIcon,
} from "@phosphor-icons/react/ssr";
import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { type ReactNode, useEffect, useState } from "react";
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "uiofcraft";
import { PublicPage, WIDE } from "../landing/sections";

export const DOCS_NAV = [
  {
    title: "Get started",
    pages: [
      { slug: "quickstart", label: "Quickstart" },
      { slug: "moving", label: "Moving from another tool" },
      {
        slug: "visual-regression-testing",
        label: "What is visual regression testing?",
      },
    ],
  },
  {
    title: "Capture",
    pages: [
      { slug: "playwright", label: "Playwright" },
      { slug: "storybook", label: "Storybook" },
      { slug: "cypress", label: "Cypress" },
      { slug: "any-screenshots", label: "Any screenshots" },
    ],
  },
  {
    title: "Run in CI",
    pages: [
      { slug: "other-ci", label: "Other CI" },
      { slug: "sharding", label: "Sharding" },
      { slug: "suites", label: "Suites" },
    ],
  },
  {
    title: "Review",
    pages: [
      { slug: "review", label: "Reviewing changes" },
      { slug: "checks", label: "The GitHub check" },
      { slug: "baselines", label: "Baselines" },
    ],
  },
  {
    title: "Guides",
    pages: [
      { slug: "stable-screenshots", label: "Stable screenshots" },
      { slug: "troubleshooting", label: "Troubleshooting" },
      { slug: "screenshots-fail-on-ci", label: "Screenshots that fail on CI" },
      { slug: "snapshots-in-git", label: "Playwright snapshots in git" },
      {
        slug: "storybook-without-chromatic",
        label: "Storybook without Chromatic",
      },
      { slug: "review-in-pull-requests", label: "Review in pull requests" },
    ],
  },
  {
    title: "Manage",
    pages: [
      { slug: "accounts", label: "Accounts and projects" },
      { slug: "billing", label: "Billing" },
      { slug: "security", label: "Security" },
      { slug: "self-hosting", label: "Self-hosting" },
    ],
  },
  {
    title: "Reference",
    pages: [
      { slug: "cli", label: "CLI" },
      { slug: "limits", label: "Limits and storage" },
    ],
  },
];

export const QUICKSTART = "quickstart";

export function docsPath(slug: string): string {
  return slug === QUICKSTART ? "/docs" : `/docs/${slug}`;
}

const PAGES = DOCS_NAV.flatMap((group) => group.pages);

function currentIndex(pathname: string): number {
  const slug = pathname.replace(/\/$/, "").split("/docs/")[1] ?? QUICKSTART;
  return PAGES.findIndex((page) => page.slug === slug);
}

export function DocsPageLink({
  slug,
  hash,
  className,
  children,
}: {
  slug: string;
  hash?: string;
  className?: string;
  children: ReactNode;
}) {
  return slug === QUICKSTART ? (
    <Link
      to="/docs"
      hash={hash}
      activeOptions={{ exact: true, includeHash: false }}
      className={className}
    >
      {children}
    </Link>
  ) : (
    <Link
      to="/docs/$slug"
      params={{ slug }}
      hash={hash}
      activeOptions={{ includeHash: false }}
      className={className}
    >
      {children}
    </Link>
  );
}

export function DocsLayout() {
  const { pathname } = useLocation();
  const current = PAGES[currentIndex(pathname)];
  return (
    <PublicPage>
      <div
        className={`${WIDE} grid grid-cols-[224px_minmax(0,1fr)] gap-12 max-lg:grid-cols-1 max-lg:gap-0 xl:gap-16`}
      >
        <nav
          aria-label="Docs"
          className="sticky top-16 -ml-2 max-h-[calc(100svh-4rem)] self-start overflow-y-auto py-10 pr-2 pl-2 max-lg:hidden"
        >
          <NavGroups />
        </nav>
        <Collapsible key={pathname} className="border-b lg:hidden">
          <CollapsibleTrigger className="group flex h-12 w-full cursor-pointer items-center gap-2 font-medium text-sm">
            <span className="text-muted-foreground">Docs</span>
            <span className="text-muted-foreground">/</span>
            {current?.label ?? "Menu"}
            <CaretDownIcon
              size={14}
              className="ml-auto text-muted-foreground transition-transform group-data-panel-open:rotate-180"
            />
          </CollapsibleTrigger>
          <CollapsiblePanel>
            <div className="pb-6">
              <NavGroups />
            </div>
          </CollapsiblePanel>
        </Collapsible>
        <Outlet />
      </div>
    </PublicPage>
  );
}

function NavGroups() {
  return (
    <div className="flex flex-col gap-6">
      {DOCS_NAV.map((group) => (
        <div key={group.title}>
          <p className="px-2 pb-1 text-xs font-medium text-muted-foreground">
            {group.title}
          </p>
          <ul>
            {group.pages.map((page) => (
              <li key={page.slug}>
                <DocsPageLink
                  slug={page.slug}
                  className="flex h-8 items-center rounded-md px-2 text-sm text-muted-foreground transition-colors duration-100 hover:bg-accent hover:text-foreground data-[status=active]:bg-accent data-[status=active]:font-medium data-[status=active]:text-foreground"
                >
                  {page.label}
                </DocsPageLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div>
        <p className="px-2 pb-1 text-xs font-medium text-muted-foreground">
          For agents
        </p>
        <ul>
          {["/llms.txt", "/llms-full.txt"].map((path) => (
            <li key={path}>
              <a
                href={path}
                className="flex h-8 items-center rounded-sm px-2 font-mono text-[13px] text-muted-foreground transition-colors duration-100 hover:bg-accent hover:text-foreground"
              >
                {path.slice(1)}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const PROSE =
  "text-[15px] leading-7 [&_a]:text-link [&_a]:hover:underline [&_h2]:mt-12 [&_h2]:scroll-mt-24 [&_h2]:font-heading [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-[-0.01em] [&_h2]:text-balance [&_h3]:mt-8 [&_h3]:font-heading [&_h3]:text-base [&_h3]:font-semibold [&_li]:mt-1.5 [&_ol]:mt-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_figure]:mt-4 [&_li>figure]:mt-3";

export function DocsPage({
  title,
  lead,
  children,
}: {
  title: string;
  lead: string;
  children: ReactNode;
}) {
  const { pathname } = useLocation();
  const index = currentIndex(pathname);
  const previous = index > 0 ? PAGES[index - 1] : undefined;
  const next = index >= 0 ? PAGES[index + 1] : undefined;
  return (
    <div className="grid min-w-0 gap-12 xl:grid-cols-[minmax(0,720px)_200px] xl:justify-between">
      <article className="min-w-0 max-w-[720px] pt-10 pb-24 max-sm:pt-8">
        <h1 className="text-balance font-heading font-semibold text-[clamp(2rem,3.5vw,2.75rem)] leading-[1.1] tracking-[-0.015em]">
          {title}
        </h1>
        <p className="mt-4 text-pretty text-lg text-muted-foreground">{lead}</p>
        <div className={`mt-10 border-t pt-2 ${PROSE}`}>{children}</div>
        <nav
          aria-label="Previous and next page"
          className="mt-16 grid grid-cols-2 gap-4 border-t border-border pt-6 max-sm:grid-cols-1"
        >
          {previous === undefined ? (
            <span />
          ) : (
            <PageLink
              slug={previous.slug}
              label={previous.label}
              direction="Previous"
            />
          )}
          {next !== undefined && (
            <PageLink slug={next.slug} label={next.label} direction="Next" />
          )}
        </nav>
      </article>
      <OnThisPage key={pathname} />
    </div>
  );
}

function OnThisPage() {
  const [headings, setHeadings] = useState<{ id: string; text: string }[]>([]);
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    const elements = [
      ...document.querySelectorAll<HTMLHeadingElement>("article h2[id]"),
    ];
    setHeadings(
      elements.map((element) => ({
        id: element.id,
        text: element.textContent?.replace(/#$/, "").trim() ?? "",
      })),
    );
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((entry) => entry.isIntersecting);
        if (visible) {
          setActive(visible.target.id);
        }
      },
      { rootMargin: "-80px 0px -70% 0px" },
    );
    for (const element of elements) {
      observer.observe(element);
    }
    return () => observer.disconnect();
  }, []);
  if (headings.length < 2) {
    return null;
  }
  return (
    <nav
      aria-label="On this page"
      className="sticky top-16 max-h-[calc(100svh-4rem)] self-start overflow-y-auto py-10 max-xl:hidden"
    >
      <p className="pb-2 font-medium text-xs">On this page</p>
      <ul className="border-l">
        {headings.map((heading) => (
          <li key={heading.id}>
            <a
              href={`#${heading.id}`}
              aria-current={active === heading.id ? "location" : undefined}
              className="-ml-px block border-transparent border-l py-1 pl-3 text-muted-foreground text-sm transition-colors hover:text-foreground aria-[current]:border-foreground aria-[current]:text-foreground"
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function PageLink({
  slug,
  label,
  direction,
}: {
  slug: string;
  label: string;
  direction: "Previous" | "Next";
}) {
  const Icon = direction === "Previous" ? ArrowLeftIcon : ArrowRightIcon;
  return (
    <DocsPageLink
      slug={slug}
      className={`flex flex-col gap-1 rounded-xl border bg-card p-4 shadow-xs/5 transition-colors duration-100 hover:bg-accent/50 ${
        direction === "Next"
          ? "col-start-2 items-end text-right max-sm:col-start-1"
          : ""
      }`}
    >
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        {direction === "Previous" && <Icon size={12} />}
        {direction}
        {direction === "Next" && <Icon size={12} />}
      </span>
      <span className="text-sm font-medium">{label}</span>
    </DocsPageLink>
  );
}

export function H2({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="group">
      <a
        href={`#${id}`}
        className="text-foreground! no-underline! hover:no-underline!"
      >
        {children}
        <span
          aria-hidden
          className="ml-2 text-muted-foreground opacity-0 transition-opacity duration-100 group-hover:opacity-100"
        >
          #
        </span>
      </a>
    </h2>
  );
}

export function Code({ children }: { children: ReactNode }) {
  return (
    <code className="mono rounded-xs bg-muted px-1 py-0.5 wrap-break-word box-decoration-clone">
      {children}
    </code>
  );
}

export function Table({
  head,
  rows,
  first = (value) => value,
}: {
  head: string[];
  rows: [string, ...ReactNode[]][];
  first?: (value: string) => ReactNode;
}) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full border-collapse text-sm [&_code]:whitespace-nowrap">
        <thead>
          <tr>
            {head.map((cell) => (
              <th
                key={cell}
                className="border-b border-border py-2 pr-4 text-left text-2xs font-medium text-muted-foreground"
              >
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([key, ...cells]) => (
            <tr key={key} className="border-b border-border align-top">
              <td className="py-2 pr-4">{first(key)}</td>
              {cells.map((cell, column) => (
                <td key={head[column + 1]} className="py-2 pr-4">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
