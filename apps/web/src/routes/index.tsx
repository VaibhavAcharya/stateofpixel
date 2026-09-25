import playfairCss from "@fontsource-variable/playfair-display/index.css?url";
import {
  CameraIcon,
  CheckCircleIcon,
  CloudArrowUpIcon,
} from "@phosphor-icons/react/ssr";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CodeBlock } from "../components/CodeBlock";
import { AuthButton } from "../components/SignIn";
import {
  buttonClass,
  DIFF_ICONS,
  type Icon,
  Kbd,
  Pill,
  REVIEW_ICONS,
  Wordmark,
} from "../components/ui";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        name: "description",
        content:
          "Visual regression testing that runs in your CI. Review pixel diffs, set GitHub checks, pay only for storage.",
      },
    ],
    links: [{ rel: "stylesheet", href: playfairCss }],
  }),
  component: Home,
});

const SNIPPET = `permissions:
  id-token: write

steps:
  - run: npx playwright test
  - run: npx stateofpixel upload screenshots`;

const STEPS: { icon: Icon; title: string; text: string }[] = [
  {
    icon: CameraIcon,
    title: "Capture in your CI",
    text: "Playwright, Storybook or any folder of PNGs. Screenshots render on your runners, next to your tests.",
  },
  {
    icon: CloudArrowUpIcon,
    title: "Upload what changed",
    text: "The CLI diffs against the baseline and uploads only new images. Unchanged pixels never leave CI.",
  },
  {
    icon: CheckCircleIcon,
    title: "Review and merge",
    text: "Approve changes with the keyboard. The GitHub check turns green when every change is approved.",
  },
];

const PRICING: [string, string][] = [
  ["No per-snapshot fees", "Capture every state of every component."],
  ["No per-seat fees", "The whole team can review."],
  ["Storage only", "A generous free tier, then pay for what you keep."],
];

function Home() {
  return (
    <div className="min-h-dvh bg-surface">
      <header className="sticky top-0 z-10 bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1448px] items-center gap-4 px-6 max-sm:px-4">
          <Link to="/" aria-label="stateofpixel home">
            <Wordmark />
          </Link>
          <nav className="ml-auto flex items-center gap-2">
            <AuthButton label="Sign in" />
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto flex max-w-[1448px] flex-col items-center px-6 pt-24 pb-16 text-center max-sm:px-4 max-sm:pt-12">
          <p className="max-w-[680px] text-2xl font-[450] tracking-[-0.035em] text-balance text-muted max-sm:text-xl">
            <strong className="font-semibold text-text">
              Catch visual changes before they ship.
            </strong>{" "}
            Render screenshots in your own CI, review every pixel diff here, and
            merge on a green check.
          </p>
          <div className="mt-8 flex items-center gap-3">
            <AuthButton label="Get started" />
            <a href="#how" className={buttonClass("ghost")}>
              How it works
            </a>
          </div>
        </section>

        <section className="mx-auto max-w-[1448px] px-6 max-sm:px-4">
          <ProductArt />
        </section>

        <section
          id="how"
          className="mx-auto max-w-[1448px] scroll-mt-16 px-6 py-24 max-sm:px-4 max-sm:py-12"
        >
          <p className="max-w-[720px] text-2xl font-[450] tracking-[-0.035em] text-balance text-muted max-sm:text-xl">
            <strong className="font-semibold text-text">
              Your CI does the rendering.
            </strong>{" "}
            We store the images, keep the baselines and set the check.
          </p>
          <div className="mt-12 grid grid-cols-3 gap-x-12 gap-y-10 max-md:grid-cols-1">
            {STEPS.map(({ icon: StepIcon, title, text }) => (
              <div key={title}>
                <StepIcon size={20} className="text-text" />
                <h3 className="mt-4 text-lg font-semibold tracking-[-0.01em]">
                  {title}
                </h3>
                <p className="mt-2 max-w-[36ch] text-sm leading-6 text-muted">
                  {text}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-y border-border bg-bg">
          <div className="mx-auto grid max-w-[1448px] grid-cols-2 items-center gap-12 px-6 py-24 max-md:grid-cols-1 max-sm:px-4 max-sm:py-12">
            <p className="max-w-[520px] text-2xl font-[450] tracking-[-0.035em] text-balance text-muted max-sm:text-xl">
              <strong className="font-semibold text-text">
                Two lines in your workflow.
              </strong>{" "}
              GitHub Actions signs in with OIDC, so there is no token to copy.
            </p>
            <CodeBlock fileName=".github/workflows/visual.yml" code={SNIPPET} />
          </div>
        </section>

        <section className="mx-auto max-w-[1448px] px-6 py-24 max-sm:px-4 max-sm:py-12">
          <p className="max-w-[720px] text-2xl font-[450] tracking-[-0.035em] text-balance text-muted max-sm:text-xl">
            <strong className="font-semibold text-text">
              Pay for storage, nothing else.
            </strong>{" "}
            Storage is the only cost that grows for us, so it is the only thing
            we bill.
          </p>
          <dl className="mt-12 grid grid-cols-3 border-t border-dotted border-field-border/50 max-md:grid-cols-1">
            {PRICING.map(([title, text]) => (
              <div
                key={title}
                className="border-dotted border-field-border/50 py-6 pr-6 md:not-last:border-r md:not-first:pl-6 max-md:border-b"
              >
                <dt className="text-base font-medium">{title}</dt>
                <dd className="mt-1 text-sm text-muted">{text}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mx-auto max-w-[1448px] px-6 pt-12 pb-24 max-sm:px-4 max-sm:pb-12">
          <p className="font-display text-[clamp(40px,4.6vw,66px)] leading-[1.13] tracking-[-0.05em] text-balance">
            Every pixel, reviewed.
            <br />
            <span className="text-[#85877f]">Nothing ships by surprise.</span>
          </p>
          <div className="mt-10">
            <AuthButton label="Get started with GitHub" />
          </div>
        </section>
      </main>

      <footer className="border-t border-dotted border-field-border/50">
        <div className="mx-auto flex h-16 max-w-[1448px] items-center px-6 text-xs text-muted max-sm:px-4">
          <Wordmark />
          <span className="ml-auto">Visual regression testing for GitHub</span>
        </div>
      </footer>
    </div>
  );
}

function ProductArt() {
  const rows: {
    name: string;
    variant: string;
    percent: string;
    state: "pending" | "approved";
    selected?: boolean;
  }[] = [
    {
      name: "Button/",
      variant: "Primary",
      percent: "1.42%",
      state: "pending",
      selected: true,
    },
    { name: "Card/", variant: "Default", percent: "0.44%", state: "approved" },
    {
      name: "Header/",
      variant: "Default",
      percent: "0.12%",
      state: "approved",
    },
    { name: "Pricing/", variant: "Plans", percent: "10.26%", state: "pending" },
    { name: "Form/", variant: "Sign in", percent: "0.41%", state: "pending" },
  ];
  const Changed = DIFF_ICONS.changed;

  return (
    <div
      aria-hidden
      className="checker overflow-hidden rounded-xl p-12 ring-1 ring-border max-md:p-4"
    >
      <div className="mx-auto flex max-w-[1080px] flex-col overflow-hidden rounded-lg bg-surface text-left shadow-[0_8px_32px_#11151a18,0_1px_4px_#11151a0a] ring-1 ring-border">
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <span className="text-lg font-semibold tracking-[-0.01em]">
            <span className="text-muted">#412</span> Rounder buttons
          </span>
          <Pill tone="pending" icon={REVIEW_ICONS.pending}>
            3 to review
          </Pill>
          <span className="ml-auto flex gap-2 max-sm:hidden">
            <span className={buttonClass("danger")}>Reject build</span>
            <span className={buttonClass("primary")}>Approve all</span>
          </span>
        </div>
        <div className="flex">
          <div className="w-[240px] shrink-0 border-r border-border p-2 max-md:hidden">
            <div className="flex h-7 items-center gap-1.5 px-2 text-xs font-medium text-muted">
              <Changed size={12} weight="bold" className="text-changed" />
              Changed
              <span className="ml-auto font-normal">5</span>
            </div>
            {rows.map((row) => {
              const StateIcon = REVIEW_ICONS[row.state];
              return (
                <div
                  key={row.name + row.variant}
                  className={`relative flex h-8 items-center gap-2 rounded-sm px-2 text-sm ${row.selected ? "bg-hover before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-link" : ""}`}
                >
                  <StateIcon
                    size={14}
                    weight={row.state === "approved" ? "bold" : "regular"}
                    className={
                      row.state === "approved"
                        ? "text-approved"
                        : "text-pending"
                    }
                  />
                  <span className="min-w-0 flex-1 truncate">
                    <span className="text-muted">{row.name}</span>
                    {row.variant}
                  </span>
                  <span className="text-xs text-muted tabular-nums">
                    {row.percent}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="grid flex-1 grid-cols-2 gap-4 bg-canvas p-4 max-sm:grid-cols-1">
              <MockShot label="Baseline #405" radius={6} />
              <MockShot label="New #412" radius={16} diff />
            </div>
            <div className="flex h-14 items-center gap-2 border-t border-border px-4">
              <span className="text-xs text-muted max-sm:hidden">
                Waiting for review
              </span>
              <span className="ml-auto flex gap-2">
                <span className={buttonClass("danger")}>
                  Reject <Kbd>r</Kbd>
                </span>
                <span className={buttonClass("primary")}>
                  Approve <Kbd inverted>a</Kbd>
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const DIFF_OUTLINE = "outline-2 outline-offset-1 outline-diff/70 outline-solid";

function MockShot({
  label,
  radius,
  diff = false,
}: {
  label: string;
  radius: number;
  diff?: boolean;
}) {
  return (
    <figure>
      <figcaption className="h-6 text-xs text-muted">{label}</figcaption>
      <div className="relative flex aspect-[16/10] flex-col gap-3 bg-white p-[8%] text-[#111827] outline-1 outline-border outline-solid">
        <div className="h-2.5 w-2/5 rounded-full bg-[#e5e7eb]" />
        <div className="h-2 w-3/4 rounded-full bg-[#f3f4f6]" />
        <div className="h-2 w-3/5 rounded-full bg-[#f3f4f6]" />
        <div className="mt-auto flex gap-2">
          <span
            className={`h-8 w-24 bg-[#111827] ${diff ? DIFF_OUTLINE : ""}`}
            style={{ borderRadius: radius }}
          />
          <span
            className={`h-8 w-20 border border-[#d1d5db] ${diff ? DIFF_OUTLINE : ""}`}
            style={{ borderRadius: radius }}
          />
        </div>
      </div>
    </figure>
  );
}
