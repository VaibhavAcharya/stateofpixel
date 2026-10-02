import type { Element, ElementContent, Root, RootContent } from "hast";
import type { Link, Nodes as MdastNodes, Root as MdastRoot } from "mdast";
import rehypeParse from "rehype-parse";
import rehypeRemark from "rehype-remark";
import remarkGfm from "remark-gfm";
import remarkStringify from "remark-stringify";
import { unified } from "unified";
import type { ViteDevServer } from "vite";
import type * as ComparePage from "../src/components/compare/ComparePage";
import type * as DocsLayout from "../src/components/docs/DocsLayout";
import type * as Pricing from "../src/components/landing/Pricing";
import type * as Sections from "../src/components/landing/sections";
import type * as Compare from "../src/content/compare";
import type * as Docs from "../src/content/docs";
import type * as PageMetaModule from "../src/lib/pageMeta";

type HastNode = Root | RootContent;

const DROPPED = new Set([
  "button",
  "dialog",
  "form",
  "img",
  "input",
  "nav",
  "script",
  "select",
  "style",
  "svg",
  "textarea",
]);

const HEADINGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);

const LANGUAGES: Record<string, string> = {
  terminal: "sh",
  ts: "ts",
  tsx: "tsx",
  js: "js",
  mjs: "js",
  json: "json",
  yml: "yaml",
  yaml: "yaml",
};

export function markdownPath(path: string): string {
  return path === "/" ? "/index.md" : `${path}.md`;
}

function isElement(node: HastNode, tagName?: string): node is Element {
  return (
    node.type === "element" &&
    (tagName === undefined || node.tagName === tagName)
  );
}

function textOf(node: HastNode): string {
  if (node.type === "text") {
    return node.value;
  }
  return "children" in node
    ? (node.children as HastNode[]).map(textOf).join("")
    : "";
}

function findElement(node: HastNode, tagName: string): Element | undefined {
  if (isElement(node, tagName)) {
    return node;
  }
  if (!("children" in node)) {
    return undefined;
  }
  for (const child of node.children as HastNode[]) {
    const found = findElement(child, tagName);
    if (found !== undefined) {
      return found;
    }
  }
  return undefined;
}

function isDropped(node: ElementContent): boolean {
  if (node.type === "comment") {
    return true;
  }
  return (
    isElement(node) &&
    (DROPPED.has(node.tagName) ||
      node.properties.ariaHidden === "true" ||
      node.properties.hidden === true)
  );
}

function isBlockSpan(node: ElementContent): boolean {
  const className = isElement(node, "span") ? node.properties.className : [];
  return Array.isArray(className) && className.includes("block");
}

function unwrapAnchors(nodes: ElementContent[]): ElementContent[] {
  return nodes.flatMap((node) =>
    isElement(node, "a") && String(node.properties.href).startsWith("#")
      ? node.children
      : [node],
  );
}

function isLinkGroup(node: Element, children: ElementContent[]): boolean {
  return (
    node.tagName === "div" &&
    children.length > 1 &&
    children.every((child) => isElement(child, "a"))
  );
}

function clean(parent: Element) {
  const children = (
    HEADINGS.has(parent.tagName)
      ? unwrapAnchors(parent.children)
      : parent.children
  ).filter((child) => !isDropped(child));
  if (isLinkGroup(parent, children)) {
    parent.tagName = "ul";
    parent.children = children.map((child) => ({
      type: "element",
      tagName: "li",
      properties: {},
      children: [child],
    }));
  } else {
    parent.children = spaced(children);
  }
  for (const child of parent.children) {
    if (isElement(child)) {
      clean(child);
    }
  }
}

function spaced(children: ElementContent[]): ElementContent[] {
  return children.flatMap((child, index) => {
    const next = children[index + 1];
    if (next === undefined) {
      return [child];
    }
    if (isBlockSpan(child)) {
      const separator = /[.:?!]$/.test(textOf(child).trim()) ? " " : ": ";
      return [child, { type: "text", value: separator }];
    }
    if (isElement(child) && isElement(next)) {
      return [child, { type: "text", value: " " }];
    }
    return [child];
  });
}

function selectContent() {
  return (tree: Root) => {
    const content = findElement(tree, "article") ?? findElement(tree, "main");
    if (content === undefined) {
      throw new Error("The page has no <main> or <article>");
    }
    clean(content);
    tree.children = [content];
  };
}

function codeFigure(
  state: { all: (node: Element) => MdastNodes[] },
  node: Element,
) {
  const caption = node.children.find((child) => isElement(child, "figcaption"));
  const pre = findElement(node, "pre");
  if (caption === undefined || pre === undefined) {
    return state.all(node);
  }
  const fileName = textOf(caption).trim();
  const extension = fileName.split(".").pop() ?? fileName;
  return {
    type: "code" as const,
    lang: LANGUAGES[extension] ?? null,
    meta: fileName,
    value: textOf(pre).replace(/\n$/, ""),
  };
}

function absoluteLinks(
  node: MdastNodes,
  siteUrl: string,
  markdownPaths: Map<string, string>,
) {
  if (node.type === "link") {
    rewriteLink(node, siteUrl, markdownPaths);
  }
  if ("children" in node) {
    for (const child of node.children) {
      absoluteLinks(child, siteUrl, markdownPaths);
    }
  }
}

function rewriteLink(
  link: Link,
  siteUrl: string,
  markdownPaths: Map<string, string>,
) {
  if (link.url.startsWith(siteUrl)) {
    link.url = link.url.slice(siteUrl.length) || "/";
  }
  if (!link.url.startsWith("/")) {
    return;
  }
  const [path, hash] = link.url.split("#");
  const target = markdownPaths.get(path || "/") ?? path;
  link.url = `${siteUrl}${target}${hash === undefined ? "" : `#${hash}`}`;
}

function stringify(tree: MdastRoot): string {
  return unified()
    .use(remarkGfm)
    .use(remarkStringify, { bullet: "-", rule: "-" })
    .stringify(tree);
}

export async function htmlToMarkdown(
  html: string,
  siteUrl: string,
  markdownPaths: Map<string, string>,
): Promise<string> {
  const processor = unified()
    .use(rehypeParse)
    .use(selectContent)
    .use(rehypeRemark, {
      handlers: { figure: codeFigure as never },
    });
  const tree = (await processor.run(
    processor.parse(html),
  )) as unknown as MdastRoot;
  absoluteLinks(tree, siteUrl, markdownPaths);
  return stringify(tree);
}

function escapeCell(text: string): string {
  return text.replaceAll("|", "\\|").replaceAll("\n", " ");
}

function table(head: string[], rows: string[][]): string {
  return [
    `| ${head.map(escapeCell).join(" | ")} |`,
    `| ${head.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map(escapeCell).join(" | ")} |`),
  ].join("\n");
}

function titledList(items: [string, string][]): string {
  return items.map(([title, text]) => `- **${title}** ${text}`).join("\n");
}

function numbered(items: string[]): string {
  return items.map((item, index) => `${index + 1}. ${item}`).join("\n");
}

function questions(items: [string, string][]): string {
  return items
    .map(([question, answer]) => `### ${question}\n\n${answer}`)
    .join("\n\n");
}

function sections(parts: (string | false)[]): string {
  return `${parts.filter((part) => part !== false && part !== "").join("\n\n")}\n`;
}

type Modules = {
  pageMeta: typeof PageMetaModule;
  docsLayout: typeof DocsLayout;
  docs: typeof Docs;
  compare: typeof Compare;
  comparePage: typeof ComparePage;
  landing: typeof Sections;
  pricing: typeof Pricing;
};

export async function loadLlmsModules(server: ViteDevServer): Promise<Modules> {
  const load = (path: string) => server.ssrLoadModule(path);
  return {
    pageMeta: (await load("/src/lib/pageMeta.ts")) as Modules["pageMeta"],
    docsLayout: (await load(
      "/src/components/docs/DocsLayout.tsx",
    )) as Modules["docsLayout"],
    docs: (await load("/src/content/docs/index.ts")) as Modules["docs"],
    compare: (await load("/src/content/compare.ts")) as Modules["compare"],
    comparePage: (await load(
      "/src/components/compare/ComparePage.tsx",
    )) as Modules["comparePage"],
    landing: (await load(
      "/src/components/landing/sections.tsx",
    )) as Modules["landing"],
    pricing: (await load(
      "/src/components/landing/Pricing.tsx",
    )) as Modules["pricing"],
  };
}

type Entry = { path: string; title: string; description: string };

type Section = { title: string; entries: Entry[] };

function llmsSections(modules: Modules): Section[] {
  const { PAGES } = modules.pageMeta;
  const { DOCS_NAV, docsPath } = modules.docsLayout;
  const { COMPARE_PAGE, COMPETITORS } = modules.compare;
  const navSlugs = new Set(
    DOCS_NAV.flatMap((group) => group.pages).map(({ slug }) => slug),
  );
  for (const slug of modules.docs.DOC_SLUGS) {
    if (!navSlugs.has(slug)) {
      throw new Error(`The docs page ${slug} is not in DOCS_NAV`);
    }
  }
  return [
    {
      title: "Product",
      entries: [{ ...PAGES.home, title: "stateofpixel" }],
    },
    ...DOCS_NAV.map((group) => ({
      title: `Docs: ${group.title}`,
      entries: group.pages.map(({ slug }) => {
        const meta = modules.docs.findDoc(slug)?.meta;
        if (meta === undefined) {
          throw new Error(`No docs page for ${slug}`);
        }
        return {
          path: docsPath(slug),
          title: meta.title,
          description: meta.description,
        };
      }),
    })),
    {
      title: "Compare",
      entries: [
        COMPARE_PAGE,
        ...COMPETITORS.map((competitor) => ({
          ...competitor.meta,
          title: `stateofpixel vs ${competitor.name}`,
        })),
      ],
    },
    {
      title: "Optional",
      entries: [PAGES.privacy, PAGES.terms, PAGES.refunds, PAGES.brand],
    },
  ];
}

function homeMarkdown(modules: Modules, link: (path: string) => string) {
  const { HOW_STEPS, ACCESS, PIPELINES, PROMISES, FAQ } = modules.landing;
  const { TIERS, monthlyPrice, formatPrice } = modules.pricing;
  const { COMPETITORS } = modules.compare;
  return sections([
    "# stateofpixel",
    `> ${summary(modules)}`,
    "## How it works",
    numbered(HOW_STEPS.map(([title, text]) => `**${title}.** ${text}`)),
    `Start with the [quickstart](${link("/docs")}).`,
    "## Access",
    table(["On GitHub", "On stateofpixel"], ACCESS),
    "## How it handles sharding, merges and outages",
    titledList(PIPELINES.map(([title, text]) => [`${title}.`, text])),
    "## Pricing",
    table(
      ["Storage", "Billed monthly", "Billed yearly"],
      TIERS.map((tier) => [
        tier.plan === "free"
          ? `${tier.gigabytes} GB, Free`
          : `${tier.gigabytes} GB`,
        `${formatPrice(monthlyPrice(tier, "monthly"))} a month`,
        `${formatPrice(monthlyPrice(tier, "yearly"))} a month`,
      ]),
    ),
    `See [Billing](${link("/docs/billing")}) and [Limits and storage](${link("/docs/limits")}).`,
    "## Promises",
    titledList(PROMISES),
    "## Questions",
    questions(FAQ),
    "## Compare",
    COMPETITORS.map(
      (competitor) =>
        `- [stateofpixel vs ${competitor.name}](${link(competitor.meta.path)})`,
    ).join("\n"),
  ]);
}

function competitorMarkdown(
  modules: Modules,
  competitor: Compare.Competitor,
  link: (path: string) => string,
) {
  const { ROW_GROUPS, OURS, CHECKED } = modules.compare;
  const sources = new Map<string, Compare.Source>();
  const cite = (cell: Compare.Cell | undefined) => {
    if (cell === undefined) {
      return "Not found in their docs.";
    }
    for (const source of cell.sources) {
      sources.set(source.url, source);
    }
    return cell.text;
  };
  const rows = ROW_GROUPS.map((group) =>
    [
      `### ${group.title}`,
      table(
        ["", "stateofpixel", competitor.name],
        Object.entries(group.rows).map(([key, label]) => [
          label,
          OURS[key as Compare.RowKey],
          cite(competitor.cells[key as Compare.RowKey]),
        ]),
      ),
    ].join("\n\n"),
  );
  for (const item of competitor.status ?? []) {
    sources.set(item.source.url, item.source);
  }
  return sections([
    `# stateofpixel vs ${competitor.name}`,
    `> ${competitor.meta.description}`,
    `**${competitor.headline}** ${competitor.lead}`,
    `Facts about ${competitor.name} checked on ${CHECKED}.`,
    (competitor.status ?? [])
      .map((item) => `- **${item.label}:** ${item.value}`)
      .join("\n"),
    "## Where the screenshots come from",
    `${competitor.name}, ${competitor.theirBill.toLowerCase()}:`,
    numbered(competitor.theirFlow),
    "stateofpixel, billed per GB stored:",
    numbered(modules.comparePage.OUR_FLOW),
    "## Side by side",
    ...rows,
    "## What changes when you switch",
    titledList(
      competitor.differences.map(([title, text]) => [`${title}.`, text]),
    ),
    `## Where ${competitor.name} is ahead`,
    titledList(competitor.ahead.map(([title, text]) => [`${title}.`, text])),
    "## Switch in one pull request",
    numbered(
      competitor.switchSteps.map(([title, text]) => `**${title}.** ${text}`),
    ),
    `See [Moving from another tool](${link("/docs/moving")}).`,
    "## Questions",
    questions(competitor.faq),
    "## Sources",
    [...sources.values()]
      .map((source) => `- [${source.label}](${source.url})`)
      .join("\n"),
  ]);
}

function compareIndexMarkdown(
  modules: Modules,
  link: (path: string) => string,
) {
  const { COMPARE_PAGE, COMPETITORS, ROW_GROUPS, OURS, CHECKED } =
    modules.compare;
  return sections([
    `# ${COMPARE_PAGE.title}`,
    `> ${COMPARE_PAGE.description}`,
    `Facts checked on ${CHECKED}. Each comparison page lists its sources.`,
    ...ROW_GROUPS.map((group) =>
      [
        `## ${group.title}`,
        table(
          [
            "",
            "stateofpixel",
            ...COMPETITORS.map((competitor) => competitor.name),
          ],
          Object.entries(group.rows).map(([key, label]) => [
            label,
            OURS[key as Compare.RowKey],
            ...COMPETITORS.map(
              (competitor) =>
                competitor.cells[key as Compare.RowKey]?.text ??
                "Not found in their docs.",
            ),
          ]),
        ),
      ].join("\n\n"),
    ),
    "## Comparisons",
    COMPETITORS.map(
      (competitor) =>
        `- [stateofpixel vs ${competitor.name}](${link(competitor.meta.path)}): ${competitor.hook}`,
    ).join("\n"),
  ]);
}

function summary(modules: Modules): string {
  const { home } = modules.pageMeta.PAGES;
  return `${home.title} ${home.description}`;
}

function entryList(entries: Entry[], link: (path: string) => string): string {
  return entries
    .map(
      (entry) =>
        `- [${entry.title}](${link(entry.path)}): ${entry.description}`,
    )
    .join("\n");
}

function keyFacts(modules: Modules, link: (path: string) => string): string[] {
  const { HOW_STEPS, PROMISES } = modules.landing;
  const { TIERS, monthlyPrice, formatPrice } = modules.pricing;
  const [free, smallest] = TIERS;
  if (free === undefined || smallest === undefined) {
    throw new Error("Pricing needs a free and a paid tier");
  }
  return [
    numbered(HOW_STEPS.map(([title, text]) => `**${title}.** ${text}`)),
    titledList(PROMISES),
    `Free up to ${free.gigabytes} GB of stored images. Paid plans start at ${formatPrice(monthlyPrice(smallest, "monthly"))} a month for ${smallest.gigabytes} GB. See [Billing](${link("/docs/billing")}).`,
  ];
}

function llmsTxt(
  modules: Modules,
  sectionList: Section[],
  link: (path: string) => string,
): string {
  const lead = modules.docs.findDoc("quickstart")?.meta.lead;
  return sections([
    "# stateofpixel",
    `> ${summary(modules)}`,
    lead ?? false,
    ...keyFacts(modules, link),
    `Every page below is also on the site as HTML, at the same address without \`.md\`. [llms-full.txt](${modules.pageMeta.SITE_URL}/llms-full.txt) has every docs page in one file.`,
    ...sectionList.map((section) =>
      [`## ${section.title}`, entryList(section.entries, link)].join("\n\n"),
    ),
  ]);
}

function docsIndex(sectionList: Section[], link: (path: string) => string) {
  return sections([
    "## All docs",
    ...sectionList
      .filter((section) => section.title.startsWith("Docs: "))
      .map((section) =>
        [
          `### ${section.title.slice("Docs: ".length)}`,
          entryList(section.entries, link),
        ].join("\n\n"),
      ),
  ]);
}

export async function buildLlmsFiles(
  modules: Modules,
  renderHtml: (path: string) => Promise<string>,
): Promise<Map<string, string>> {
  const { SITE_URL } = modules.pageMeta;
  const sectionList = llmsSections(modules);
  const entries = sectionList.flatMap((section) => section.entries);
  const markdownPaths = new Map(
    entries.map((entry) => [entry.path, markdownPath(entry.path)]),
  );
  const link = (path: string) =>
    `${SITE_URL}${markdownPaths.get(path) ?? path}`;
  const { COMPARE_PAGE, COMPETITORS } = modules.compare;
  const { docsPath, QUICKSTART } = modules.docsLayout;

  const files = new Map<string, string>();
  for (const entry of entries) {
    const competitor = COMPETITORS.find(
      (item) => item.meta.path === entry.path,
    );
    const markdown =
      entry.path === "/"
        ? homeMarkdown(modules, link)
        : entry.path === COMPARE_PAGE.path
          ? compareIndexMarkdown(modules, link)
          : competitor !== undefined
            ? competitorMarkdown(modules, competitor, link)
            : await htmlToMarkdown(
                await renderHtml(entry.path),
                SITE_URL,
                markdownPaths,
              );
    files.set(
      markdownPath(entry.path),
      entry.path === docsPath(QUICKSTART)
        ? `${withTitle(markdown, entry.title)}\n${docsIndex(sectionList, link)}`
        : withTitle(markdown, entry.title),
    );
  }
  files.set("/llms.txt", llmsTxt(modules, sectionList, link));
  const docsPaths = sectionList
    .filter((section) => section.title.startsWith("Docs: "))
    .flatMap((section) => section.entries)
    .map((entry) => markdownPath(entry.path));
  files.set(
    "/llms-full.txt",
    docsPaths.map((path) => files.get(path)).join("\n---\n\n"),
  );
  return files;
}

function withTitle(markdown: string, title: string): string {
  return markdown.startsWith("# ") ? markdown : `# ${title}\n\n${markdown}`;
}

export function contentType(path: string): string {
  return path.endsWith(".md")
    ? "text/markdown; charset=utf-8"
    : "text/plain; charset=utf-8";
}
