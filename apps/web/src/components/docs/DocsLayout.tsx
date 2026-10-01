import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CaretDownIcon,
} from "@phosphor-icons/react/ssr";
import { Link, Outlet, useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { PublicPage, WIDE } from "../landing/sections";

export const DOCS_NAV = [
  {
    title: "Get started",
    pages: [
      { slug: "quickstart", label: "Quickstart" },
      { slug: "moving", label: "Moving from another tool" },
    ],
  },
  {
    title: "Capture",
    pages: [
      { slug: "playwright", label: "Playwright" },
      { slug: "storybook", label: "Storybook" },
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
        className={`${WIDE} grid grid-cols-[208px_minmax(0,1fr)] gap-16 max-lg:grid-cols-1 max-lg:gap-0`}
      >
        <nav aria-label="Docs" className="py-12 max-lg:hidden">
          <NavGroups />
        </nav>
        <details
          key={pathname}
          className="group border-b border-dotted border-field-border/50 lg:hidden"
        >
          <summary className="flex h-12 cursor-pointer list-none items-center gap-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
            <span className="text-muted">Docs</span>
            <span className="text-subtle">/</span>
            {current?.label ?? "Menu"}
            <CaretDownIcon
              size={14}
              className="ml-auto text-muted transition-transform group-open:rotate-180"
            />
          </summary>
          <div className="pb-6">
            <NavGroups />
          </div>
        </details>
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
          <p className="px-2 pb-1 text-xs font-medium text-muted">
            {group.title}
          </p>
          <ul>
            {group.pages.map((page) => (
              <li key={page.slug}>
                <DocsPageLink
                  slug={page.slug}
                  className="flex h-8 items-center rounded-sm px-2 text-sm text-muted transition-colors duration-100 hover:bg-hover hover:text-text data-[status=active]:bg-hover data-[status=active]:font-medium data-[status=active]:text-text"
                >
                  {page.label}
                </DocsPageLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div>
        <p className="px-2 pb-1 text-xs font-medium text-muted">For agents</p>
        <ul>
          {["/llms.txt", "/llms-full.txt"].map((path) => (
            <li key={path}>
              <a
                href={path}
                className="flex h-8 items-center rounded-sm px-2 font-mono text-[13px] text-muted transition-colors duration-100 hover:bg-hover hover:text-text"
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
  "text-base leading-6 [&_a]:text-link [&_a]:hover:underline [&_h2]:mt-12 [&_h2]:scroll-mt-24 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-balance [&_h3]:mt-8 [&_h3]:text-base [&_h3]:font-semibold [&_li]:mt-1.5 [&_ol]:mt-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_figure]:mt-4 [&_li>figure]:mt-3";

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
    <article className="max-w-[680px] min-w-0 pt-12 pb-24 max-sm:pt-8">
      <h1 className="text-[clamp(28px,3vw,36px)] leading-[1.15] font-semibold tracking-[-0.035em] text-balance">
        {title}
      </h1>
      <p className="mt-3 text-lg font-normal tracking-[-0.01em] text-muted">
        {lead}
      </p>
      <div className={`mt-8 ${PROSE}`}>{children}</div>
      <nav
        aria-label="Previous and next page"
        className="mt-16 grid grid-cols-2 gap-4 border-t border-dotted border-field-border/50 pt-6 max-sm:grid-cols-1"
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
      className={`flex flex-col gap-1 rounded-md p-3 ring-1 ring-border transition-colors duration-100 hover:bg-hover ${
        direction === "Next"
          ? "col-start-2 items-end text-right max-sm:col-start-1"
          : ""
      }`}
    >
      <span className="flex items-center gap-1 text-xs text-muted">
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
        className="text-text! no-underline! hover:no-underline!"
      >
        {children}
        <span
          aria-hidden
          className="ml-2 text-subtle opacity-0 transition-opacity duration-100 group-hover:opacity-100"
        >
          #
        </span>
      </a>
    </h2>
  );
}

export function Code({ children }: { children: ReactNode }) {
  return (
    <code className="mono rounded-xs bg-surface-2 px-1 py-0.5 wrap-break-word box-decoration-clone">
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
                className="border-b border-border py-2 pr-4 text-left text-2xs font-medium text-muted"
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
