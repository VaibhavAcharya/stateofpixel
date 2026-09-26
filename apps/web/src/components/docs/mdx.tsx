import { Link } from "@tanstack/react-router";
import type { MDXComponents } from "mdx/types";
import { Children, type ReactNode } from "react";
import { findDoc } from "../../content/docs";
import { CodeBlock as Block, type Snippet } from "../CodeBlock";
import { Kbd } from "../ui";
import { Code, DocsPage, DocsPageLink, H2 } from "./DocsLayout";
import {
  CheckStatesTable,
  CliCommands,
  CliOptions,
  LimitsTable,
  ShortcutsTable,
} from "./generated";

function text(node: ReactNode): string {
  return Children.toArray(node)
    .map((child) =>
      typeof child === "string" || typeof child === "number"
        ? String(child)
        : typeof child === "object" && "props" in child
          ? text((child.props as { children?: ReactNode }).children)
          : "",
    )
    .join("");
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function Anchor({
  href = "",
  children,
}: {
  href?: string;
  children?: ReactNode;
}) {
  const [path = "", hash] = href.split("#");
  if (path === "/docs" || path.startsWith("/docs/")) {
    return (
      <DocsPageLink
        slug={path.slice("/docs/".length) || "quickstart"}
        hash={hash}
      >
        {children}
      </DocsPageLink>
    );
  }
  if (path === "/") {
    return (
      <Link to="/" hash={hash}>
        {children}
      </Link>
    );
  }
  return <a href={href}>{children}</a>;
}

export const docsComponents: MDXComponents = {
  h2: ({ children }) => <H2 id={slugify(text(children))}>{children}</H2>,
  a: Anchor,
  code: ({ children }) => <Code>{children}</Code>,
  kbd: ({ children }) => <Kbd>{children}</Kbd>,
  table: ({ children }) => (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full border-collapse text-sm [&_code]:whitespace-nowrap">
        {children}
      </table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-b border-border py-2 pr-4 text-left text-2xs font-medium text-muted">
      {children}
    </th>
  ),
  tr: ({ children }) => (
    <tr className="border-b border-border align-top">{children}</tr>
  ),
  td: ({ children }) => <td className="py-2 pr-4">{children}</td>,
  CodeBlock: ({ fileName, snippet }: { fileName: string; snippet: string }) => {
    const { code, lines } = JSON.parse(snippet) as Snippet;
    return <Block fileName={fileName} code={code} lines={lines} />;
  },
  CheckStatesTable,
  CliCommands,
  CliOptions,
  LimitsTable,
  ShortcutsTable,
};

export function DocsArticle({ slug }: { slug: string }) {
  const doc = findDoc(slug);
  if (doc === undefined) {
    return null;
  }
  const { default: Content, meta } = doc;
  return (
    <DocsPage title={meta.title} lead={meta.lead}>
      <Content components={docsComponents} />
    </DocsPage>
  );
}

export function docsHead(slug: string) {
  const meta = findDoc(slug)?.meta;
  return {
    meta:
      meta === undefined
        ? []
        : [
            { title: `${meta.title} - stateofpixel docs` },
            { name: "description", content: meta.description },
          ],
  };
}
