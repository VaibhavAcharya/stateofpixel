import { DownloadSimpleIcon } from "@phosphor-icons/react/ssr";
import { createFileRoute } from "@tanstack/react-router";
import { PublicPage } from "../components/landing/sections";
import { LeadCopy } from "../components/ui";
import { PAGES, pageMeta } from "../lib/pageMeta";

export const Route = createFileRoute("/brand")({
  head: () => ({
    meta: [{ title: "Brand / stateofpixel" }, ...pageMeta(PAGES.brand)],
  }),
  component: Brand,
});

const SECTION = "mx-auto max-w-[1448px] px-6 py-24 max-sm:px-4 max-sm:py-12";
const DOTTED = "border-dotted border-field-border/50";

const ASSETS = [
  { file: "stateofpixel-mark", label: "Mark", dark: false },
  { file: "stateofpixel-mark-inverse", label: "Mark, inverse", dark: true },
  { file: "stateofpixel-wordmark", label: "Wordmark", dark: false },
  {
    file: "stateofpixel-wordmark-inverse",
    label: "Wordmark, inverse",
    dark: true,
  },
];

const USAGE: [string, string][] = [
  [
    "Write the name in lowercase.",
    "stateofpixel, one word, also at the start of a sentence.",
  ],
  [
    "Match the background.",
    "Use the ink logo on light backgrounds and the inverse logo on dark ones.",
  ],
  [
    "Leave the logo as it is.",
    "Don't recolor, rotate, stretch or outline it, and don't add shadows.",
  ],
  [
    "Give it room.",
    "Keep clear space of at least a quarter of the mark's width on every side.",
  ],
];

const COLORS = [
  { name: "Ink", hex: "#171717", use: "Tile on light backgrounds, text" },
  { name: "Paper", hex: "#fafafa", use: "Pixels on the ink tile, page" },
  { name: "Ink on dark", hex: "#ededed", use: "Tile on dark backgrounds" },
  { name: "Black", hex: "#000000", use: "Pixels on the inverse tile" },
];

const TYPE = [
  {
    name: "IBM Plex Sans",
    use: "Interface, headings and the wordmark, in SemiBold",
    url: "https://github.com/IBM/plex",
    className: "font-sans",
  },
  {
    name: "Lilex",
    use: "Code, hashes and numbers in tables",
    url: "https://github.com/mishamyrt/Lilex",
    className: "font-mono",
  },
];

function Brand() {
  return (
    <PublicPage>
      <section className={`${SECTION} pb-12`}>
        <LeadCopy title="Brand." className="max-w-[720px]">
          The stateofpixel logo, colors and type. Download what you need.
        </LeadCopy>
        <div className="mt-12 grid grid-cols-2 gap-4 max-md:grid-cols-1">
          {ASSETS.map((asset) => (
            <AssetCard key={asset.file} {...asset} />
          ))}
        </div>
      </section>

      <section className={SECTION}>
        <LeadCopy title="Usage." className="max-w-[720px]">
          A few rules keep the logo readable wherever it shows up.
        </LeadCopy>
        <ul className={`mt-12 border-t ${DOTTED}`}>
          {USAGE.map(([title, text]) => (
            <li
              key={title}
              className={`grid grid-cols-[minmax(0,420px)_1fr] gap-x-8 border-b ${DOTTED} py-5 max-md:grid-cols-1`}
            >
              <span className="text-xl font-semibold tracking-[-0.025em]">
                {title}
              </span>
              <span className="text-sm text-muted md:pt-1.5">{text}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-y border-border bg-bg">
        <div className={SECTION}>
          <LeadCopy title="Colors." className="max-w-[720px]">
            The logo uses ink and paper only. Color in the product is kept for
            status and the diff highlight.
          </LeadCopy>
          <ul className="mt-12 grid grid-cols-4 gap-4 max-lg:grid-cols-2 max-sm:grid-cols-1">
            {COLORS.map((color) => (
              <li
                key={color.hex}
                className="overflow-hidden rounded-lg bg-surface ring-1 ring-border"
              >
                <div
                  className="h-24 shadow-[inset_0_-1px_0_var(--color-border)]"
                  style={{ backgroundColor: color.hex }}
                />
                <div className="p-4">
                  <p className="text-sm font-medium">{color.name}</p>
                  <p className="mono mt-1 text-xs text-muted">{color.hex}</p>
                  <p className="mt-2 text-xs text-muted">{color.use}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={SECTION}>
        <LeadCopy title="Type." className="max-w-[720px]">
          Two open source families, one sans and one mono.
        </LeadCopy>
        <ul className={`mt-12 border-t ${DOTTED}`}>
          {TYPE.map((family) => (
            <li
              key={family.name}
              className={`grid grid-cols-[minmax(0,420px)_1fr] items-baseline gap-x-8 border-b ${DOTTED} py-5 max-md:grid-cols-1`}
            >
              <span
                className={`${family.className} text-2xl font-semibold tracking-[-0.025em]`}
              >
                {family.name}
              </span>
              <span className="text-sm text-muted">
                {family.use}.{" "}
                <a href={family.url} className="text-link hover:underline">
                  Source
                </a>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </PublicPage>
  );
}

function AssetCard({
  file,
  label,
  dark,
}: {
  file: string;
  label: string;
  dark: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-xl ring-1 ring-border">
      <div
        className={`flex h-56 items-center justify-center ${dark ? "bg-black" : "bg-white"}`}
      >
        <img
          src={`/brand/${file}.svg`}
          alt={`stateofpixel ${label.toLowerCase()}`}
          className={file.includes("wordmark") ? "h-10" : "h-16"}
        />
      </div>
      <div className="flex h-12 items-center gap-2 border-t border-border bg-surface px-4">
        <span className="text-sm font-medium">{label}</span>
        <span className="ml-auto flex gap-1">
          {["svg", "png"].map((format) => (
            <a
              key={format}
              href={`/brand/${file}.${format}`}
              download
              data-umami-event="Brand download"
              data-umami-event-file={`${file}.${format}`}
              className="inline-flex h-7 items-center gap-1.5 rounded-sm px-2 text-xs text-muted uppercase hover:bg-hover hover:text-text"
            >
              <DownloadSimpleIcon size={12} />
              {format}
            </a>
          ))}
        </span>
      </div>
    </div>
  );
}
