import { type ReactNode, useState } from "react";
import { HeroChecks } from "../landing/HeroArt";
import { PricingPlans } from "../landing/Pricing";
import {
  DISPLAY,
  HeroCentered,
  LEAD,
  PublicPage,
  WIDE,
} from "../landing/sections";
import { HeroPlayground } from "./HeroPlayground";
import {
  BillHero,
  DiffSliderArt,
  InkHero,
  StatsHero,
  TerminalHero,
} from "./heroes";
import {
  AgentsHero,
  HeroChecksLive,
  KeyboardSection,
  LabHero,
  PriceHero,
  SpeedHero,
  ZeroHero,
} from "./landing";
import { PricingReach } from "./surfaces";

const DOTTED = "border-dotted border-field-border/50";

type Surface = "Hero" | "Landing" | "Pricing";

type Experiment = {
  id: string;
  title: string;
  surface: Surface;
  kind: "New section" | "Improvement";
  problem: string;
  bet: string;
  measure: string;
  variants: [string, ReactNode][];
};

const OUTCOME_LEAD =
  "Every pull request gets a visual check. Your CI takes the screenshots, a person approves each change.";

const CURRENT = <HeroCentered key="current" />;

const EXPERIMENTS: Experiment[] = [
  {
    id: "H07",
    title: "Hero layout playground",
    surface: "Hero",
    kind: "Improvement",
    problem:
      "The shipped hero came from this playground. Size, weight, color and background still have room to move.",
    bet: "Trying layouts live finds the next combination worth testing faster than building each one. Copy settings gives the exact values to build.",
    measure: "Pick two or three settings, then run them as hero variants.",
    variants: [["Playground", <HeroPlayground key="a" />]],
  },
  {
    id: "L01",
    title: "Hero headline",
    surface: "Hero",
    kind: "Improvement",
    problem:
      "Outcome shipped. The other headlines lead with money or the modern angle and have not been tested against it.",
    bet: "A headline with a number or a sharp contrast may beat an outcome headline for visitors who are already comparing tools.",
    measure:
      "Start free clicks from the hero, per variant, over two weeks each.",
    variants: [
      ["Current", CURRENT],
      ["Price", <PriceHero key="b" art={<HeroChecks />} />],
      ["Speed", <SpeedHero key="c" art={<HeroChecksLive />} />],
      ["Agents", <AgentsHero key="d" art={<HeroChecksLive />} />],
      ["Zero", <ZeroHero key="e" art={<HeroChecks />} />],
      [
        "Contrast",
        <LabHero
          key="f"
          headline="The visual check that doesn't bill per screenshot."
          lead="Screenshots from your CI, diffs on a review page, and a GitHub check that turns green when you approve. Free up to 10 GB."
          art={<HeroChecks />}
        />,
      ],
    ],
  },
  {
    id: "H01",
    title: "Diff slider as the hero art",
    surface: "Hero",
    kind: "Improvement",
    problem:
      "The demo below the hero is large. A smaller diff next to the headline may show the product faster on short screens.",
    bet: "A draggable before and after with the diff overlay is the product in one gesture. Argos leads with a diff UI too.",
    measure: "Slider drags in the hero, then Start free clicks.",
    variants: [
      ["Current", CURRENT],
      [
        "Diff slider",
        <LabHero
          key="b"
          headline="Catch UI regressions before they merge."
          lead={OUTCOME_LEAD}
          art={<DiffSliderArt />}
        />,
      ],
    ],
  },
  {
    id: "H02",
    title: "One line in CI",
    surface: "Hero",
    kind: "Improvement",
    problem:
      "Competitors claim setup in 90 seconds or in seconds. We have no setup claim, and we should not invent a time.",
    bet: "Showing the one command and its real output proves how little setup there is without a number. The copy chip follows Meticulous's script tag pitch.",
    measure: "Copy clicks on the command, then first builds per install.",
    variants: [
      ["Current", CURRENT],
      ["Terminal", <TerminalHero key="b" />],
    ],
  },
  {
    id: "H03",
    title: "The bill as the hero art",
    surface: "Hero",
    kind: "Improvement",
    problem:
      "Price is our biggest difference, and the hero only says free up to 10 GB.",
    bet: "Putting the compare page bill card in the hero makes the saving the first thing seen, with no text to read.",
    measure: "Start free clicks from the hero, and scroll to pricing.",
    variants: [
      ["Current", CURRENT],
      ["Bill", <BillHero key="b" />],
    ],
  },
  {
    id: "H05",
    title: "Ink hero",
    surface: "Hero",
    kind: "Improvement",
    problem:
      "The page is light from top to bottom, so it reads as calm but not as fast or new.",
    bet: "A black hero band with the live check gives the first screen Linear's feel while the rest of the page stays light.",
    measure: "Bounce rate and Start free clicks from the hero.",
    variants: [
      ["Current", CURRENT],
      ["Ink", <InkHero key="b" />],
    ],
  },
  {
    id: "H06",
    title: "Numbers row",
    surface: "Hero",
    kind: "Improvement",
    problem:
      "We have no logos or customer counts for the proof row under the hero, which is where every competitor puts theirs.",
    bet: "Four facts we can back ($0, the median upload, zero browsers, the next cheapest bill) fill the proof slot honestly.",
    measure: "Scroll past the hero and Start free clicks.",
    variants: [
      ["Current", CURRENT],
      ["Numbers", <StatsHero key="b" />],
    ],
  },
  {
    id: "P01",
    title: "Plans in screenshots, not gigabytes",
    surface: "Pricing",
    kind: "Improvement",
    problem:
      "10 GB means nothing to a buyer. Every other tool prices in screenshots, so that is the unit they think in.",
    bet: "Each tier says how many screenshots it holds and what that month costs on Argos, Chromatic and Percy.",
    measure: "Free plan installs and Checkout clicks.",
    variants: [
      ["Current", <PricingPlans key="a" />],
      ["Reach", <PricingReach key="b" />],
    ],
  },
  {
    id: "L07",
    title: "Keyboard band",
    surface: "Landing",
    kind: "New section",
    problem:
      "Keyboard review is the one feature no competitor page mentions. The landing page only shows it in the demo and one speed figure.",
    bet: "A full-width ink band that plays a review by key gives the page a change of rhythm and sells speed without a claim.",
    measure: "Demo key presses after the band is seen.",
    variants: [["New", <KeyboardSection key="a" />]],
  },
];

const SHIPPED: [string, string][] = [
  ["H07", "Centered Outcome hero over the demo, on the pixel texture"],
  ["E01", "Start free in the header"],
  ["L03", "What 1,000 more screenshots cost"],
  ["L04", "Bill estimate with one slider"],
  ["L05", "Why it costs a fraction"],
  ["L06", "Fast because it does less"],
  ["L08", "Integrations grid"],
  ["L09", "Promises instead of don'ts"],
  ["L10", "Switch strip"],
  ["L11", "Start free final section"],
  ["C01", "Compare pages lead with the yearly saving"],
  ["D01", "Setup paths on the docs home"],
  ["D02", "Coding agent prompt on the docs home"],
];

const SURFACES: ("All" | Surface)[] = ["All", "Hero", "Landing", "Pricing"];

const FINDINGS: { title: string; items: [string, string][] }[] = [
  {
    title: "They have it, we don't",
    items: [
      [
        "Dollar comparison with named tools",
        "Argos shows Argos $510, Chromatic $807, Percy $8,999 on its home page. Shipped as L03, L04 and C01.",
      ],
      [
        "Integrations grid",
        "Chromatic, Percy, Argos, Lost Pixel and Applitools. Shipped as L08.",
      ],
      [
        "AI agent angle",
        "Chromatic, Percy, Argos, Meticulous and Applitools. D02 shipped, L01 Agents is open.",
      ],
      [
        "Live UI in the hero",
        "Linear renders real UI markup with CSS motion. Argos links a demo build. Our demo now sits in the hero.",
      ],
      [
        "Spend control",
        "Argos sells spend limits. Our plans cannot overrun at all. Shipped in L09.",
      ],
    ],
  },
  {
    title: "We have it, they don't",
    items: [
      [
        "No per-screenshot meter",
        "Every other free tier is 5,000 to 7,000 screenshots. Ours has no screenshot count.",
      ],
      [
        "Keyboard review",
        "No competitor page mentions keys. Not even Linear's current home page does. L07.",
      ],
      [
        "CI never blocked by us",
        "The upload warns and exits 0 when we are down. No one else leads with it.",
      ],
    ],
  },
  {
    title: "Stop saying",
    items: [
      [
        "No seats",
        "Chromatic, Argos and Percy all list unlimited users, per our own compare sources. The hero line not snapshots or seats spends words on a tie.",
      ],
    ],
  },
];

const MISSING: [string, string][] = [
  [
    "Logos and quotes",
    "Every competitor has them. We have none, and none should be made up. Ask the first teams for a line.",
  ],
  [
    "Setup time",
    "Chromatic says 90 seconds, Argos says seconds. Time a fresh install to the first check before we claim a number.",
  ],
  [
    "Public changelog",
    "Linear shows dated releases on its home page. The CLI changelog links to a private repo, so it needs its own page first.",
  ],
  [
    "Security page and status page",
    "Most competitors link SOC 2 and a status page. We have neither, so the page should not imply either.",
  ],
];

function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-xs bg-surface-2 px-1.5 py-0.5 text-2xs font-medium text-muted">
      {children}
    </span>
  );
}

function ExperimentCard({ experiment }: { experiment: Experiment }) {
  const [variant, setVariant] = useState(0);
  const labels = experiment.variants.map(([label]) => label);
  return (
    <article id={experiment.id} className="scroll-mt-20">
      <header className="flex flex-wrap items-center gap-3">
        <span className="mono text-sm text-muted">{experiment.id}</span>
        <h2 className="text-xl font-semibold tracking-[-0.025em]">
          {experiment.title}
        </h2>
        <Tag>{experiment.surface}</Tag>
        <Tag>{experiment.kind}</Tag>
      </header>
      <dl
        className={`mt-4 grid grid-cols-3 gap-6 border-t ${DOTTED} pt-4 text-sm max-lg:grid-cols-1 max-lg:gap-3`}
      >
        {(
          [
            ["Problem", experiment.problem],
            ["Bet", experiment.bet],
            ["Measure", experiment.measure],
          ] as const
        ).map(([label, text]) => (
          <div key={label}>
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="mt-1">{text}</dd>
          </div>
        ))}
      </dl>
      {labels.length > 1 && (
        <fieldset
          aria-label={`${experiment.title} variant`}
          className="mt-6 flex flex-wrap gap-1 self-start rounded-control bg-surface-2 p-0.5"
          style={{ width: "fit-content" }}
        >
          {labels.map((label, index) => (
            <button
              key={label}
              type="button"
              aria-pressed={variant === index}
              onClick={() => setVariant(index)}
              className={`h-7 rounded-sm px-3 text-xs font-medium transition-colors duration-100 ${
                variant === index
                  ? "bg-surface text-text shadow-[inset_0_0_0_1px_var(--color-border)]"
                  : "text-muted hover:text-text"
              }`}
            >
              {label}
            </button>
          ))}
        </fieldset>
      )}
      <div className="mt-4 overflow-hidden rounded-xl bg-surface ring-1 ring-border">
        {experiment.variants[variant]?.[1]}
      </div>
    </article>
  );
}

function Findings() {
  return (
    <section className={`${WIDE} pb-16`}>
      <div className="grid grid-cols-3 gap-8 max-lg:grid-cols-1">
        {FINDINGS.map((group) => (
          <div key={group.title}>
            <h2 className="text-lg font-semibold">{group.title}</h2>
            <ul className={`mt-4 border-t ${DOTTED}`}>
              {group.items.map(([title, text]) => (
                <li key={title} className={`border-b ${DOTTED} py-4`}>
                  <span className="block text-base font-medium">{title}</span>
                  <span className="mt-1 block text-sm text-muted">{text}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function Shipped() {
  return (
    <section className={`${WIDE} pt-24 max-sm:pt-12`}>
      <h2 className="text-lg font-semibold">Shipped</h2>
      <p className="mt-1 text-sm text-muted">
        Live on the site, so no longer in the lab.
      </p>
      <ul
        className={`mt-6 grid grid-cols-2 gap-x-8 border-t ${DOTTED} max-md:grid-cols-1`}
      >
        {SHIPPED.map(([id, title]) => (
          <li key={id} className={`flex gap-3 border-b ${DOTTED} py-3 text-sm`}>
            <span className="mono text-muted">{id}</span>
            {title}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Missing() {
  return (
    <section className={`${WIDE} py-24 max-sm:py-12`}>
      <h2 className="text-lg font-semibold">Needs real content first</h2>
      <p className="mt-1 text-sm text-muted">
        Gaps we should not fill with made-up copy.
      </p>
      <ul
        className={`mt-6 grid grid-cols-2 gap-x-8 border-t ${DOTTED} max-md:grid-cols-1`}
      >
        {MISSING.map(([title, text]) => (
          <li key={title} className={`border-b ${DOTTED} py-4`}>
            <span className="block text-base font-medium">{title}</span>
            <span className="mt-1 block text-sm text-muted">{text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Lab() {
  const [surface, setSurface] = useState<"All" | Surface>("All");
  const shown = EXPERIMENTS.filter(
    (experiment) => surface === "All" || experiment.surface === surface,
  );
  return (
    <PublicPage>
      <section className={`${WIDE} pt-24 pb-16 max-sm:pt-12`}>
        <h1 className={`${DISPLAY} max-w-[18ch]`}>Lab.</h1>
        <p className={`${LEAD} mt-6 max-w-[760px]`}>
          {EXPERIMENTS.length} open experiments for the hero, landing page and
          pricing. Each one names the problem, the bet and what to measure.
          Nothing here is live.
        </p>
        <p className="mt-4 text-xs text-muted">
          Research from the live pages of Chromatic, Percy, Argos, Lost Pixel,
          Happo, Meticulous, Applitools and Linear on 27 September 2026.
        </p>
      </section>
      <Findings />
      <div className="sticky top-16 z-[5] border-y border-border bg-surface/90 backdrop-blur">
        <div className={`${WIDE} flex h-12 items-center gap-4 overflow-x-auto`}>
          <fieldset
            aria-label="Surface"
            className="flex gap-1 rounded-control bg-surface-2 p-0.5"
          >
            {SURFACES.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={surface === value}
                onClick={() => setSurface(value)}
                className={`h-7 rounded-sm px-3 text-xs font-medium whitespace-nowrap transition-colors duration-100 ${
                  surface === value
                    ? "bg-surface text-text shadow-[inset_0_0_0_1px_var(--color-border)]"
                    : "text-muted hover:text-text"
                }`}
              >
                {value}
              </button>
            ))}
          </fieldset>
          <nav className="flex gap-3 text-xs text-muted">
            {shown.map((experiment) => (
              <a
                key={experiment.id}
                href={`#${experiment.id}`}
                className="mono whitespace-nowrap hover:text-text"
              >
                {experiment.id}
              </a>
            ))}
          </nav>
        </div>
      </div>
      <div className={`${WIDE} flex flex-col gap-24 pt-16 max-sm:gap-12`}>
        {shown.map((experiment) => (
          <ExperimentCard key={experiment.id} experiment={experiment} />
        ))}
      </div>
      <Shipped />
      <Missing />
    </PublicPage>
  );
}
