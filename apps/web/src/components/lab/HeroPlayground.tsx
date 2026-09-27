import { ArrowRightIcon, CheckIcon, CopyIcon } from "@phosphor-icons/react/ssr";
import { type ReactNode, useState } from "react";
import { HeroChecks } from "../landing/HeroArt";
import { ReviewDemo } from "../landing/ReviewDemo";
import { WIDE } from "../landing/sections";
import { AuthButton } from "../SignIn";
import { buttonClass } from "../ui";
import { BillArt, CommandChip, DiffSliderArt, TerminalArt } from "./heroes";
import { HeroChecksLive, PriceLine } from "./landing";

const OPTIONS = {
  layout: ["Split", "Split reversed", "Centered", "Stacked"],
  size: ["S", "M", "L", "XL"],
  weight: ["500", "600", "700"],
  tracking: ["Normal", "Tight", "Tighter"],
  emphasis: ["None", "Muted", "Green", "Underline", "New line"],
  background: ["Surface", "Paper", "Ink", "Checker", "Pixels", "Dots", "Glow"],
  art: [
    "Live check",
    "Check",
    "Diff slider",
    "Bill",
    "Terminal",
    "Demo",
    "None",
  ],
  proof: ["Free line", "Price line", "Command", "None"],
  cta: ["Start free with GitHub", "Install the GitHub App", "Start free"],
} as const;

type Options = typeof OPTIONS;

type Config = { [Key in keyof Options]: Options[Key][number] } & {
  headline: string;
  phrase: string;
  lead: string;
};

const CURRENT: Config = {
  layout: "Centered",
  size: "S",
  weight: "600",
  tracking: "Tight",
  emphasis: "Muted",
  background: "Pixels",
  art: "Demo",
  proof: "Free line",
  cta: "Start free with GitHub",
  headline: "Catch UI regressions before they merge.",
  phrase: "before they merge.",
  lead: "Every pull request gets a visual check. Your CI takes the screenshots, a person approves each change.",
};

const PRESETS: [string, Config][] = [
  ["Current", CURRENT],
  [
    "Split",
    {
      ...CURRENT,
      layout: "Split",
      size: "M",
      emphasis: "None",
      background: "Surface",
      art: "Live check",
    },
  ],
  [
    "Linear",
    {
      ...CURRENT,
      size: "XL",
      tracking: "Tighter",
      background: "Ink",
      art: "Live check",
    },
  ],
  [
    "Loud price",
    {
      ...CURRENT,
      layout: "Split",
      size: "L",
      weight: "700",
      emphasis: "New line",
      art: "Bill",
      proof: "Price line",
    },
  ],
  [
    "Pixel",
    {
      ...CURRENT,
      layout: "Split reversed",
      size: "M",
      emphasis: "Underline",
      background: "Checker",
      art: "Diff slider",
    },
  ],
];

const SIZES: Record<Config["size"], string> = {
  S: "text-[clamp(36px,3.6vw,52px)] leading-[1.1]",
  M: "text-[clamp(40px,4.6vw,66px)] leading-[1.1]",
  L: "text-[clamp(48px,6vw,88px)] leading-[1.02]",
  XL: "text-[clamp(56px,8vw,124px)] leading-[0.95]",
};

const WEIGHTS: Record<Config["weight"], string> = {
  "500": "font-medium",
  "600": "font-semibold",
  "700": "font-bold",
};

const TRACKING: Record<Config["tracking"], string> = {
  Normal: "tracking-[-0.02em]",
  Tight: "tracking-[-0.045em]",
  Tighter: "tracking-[-0.065em]",
};

const BACKGROUNDS: Record<Config["background"], string> = {
  Surface: "bg-surface",
  Paper: "bg-bg",
  Ink: "bg-[#000] text-[#ededed]",
  Checker: "checker",
  Pixels: "pixel-texture bg-surface",
  Dots: "bg-surface bg-[radial-gradient(var(--color-border)_1px,transparent_1px)] bg-size-[16px_16px]",
  Glow: "bg-surface bg-[radial-gradient(60%_60%_at_70%_40%,#effbef,transparent)]",
};

function Headline({ config, ink }: { config: Config; ink: boolean }) {
  const { headline, phrase, emphasis } = config;
  const at = phrase === "" ? -1 : headline.indexOf(phrase);
  if (emphasis === "None" || at < 0) {
    return <>{headline}</>;
  }
  const before = headline.slice(0, at);
  const after = headline.slice(at + phrase.length);
  const styled: Record<Exclude<Config["emphasis"], "None">, ReactNode> = {
    Muted: (
      <span className={ink ? "text-[#a1a1a1]" : "text-muted"}>{phrase}</span>
    ),
    Green: <span className="text-approved">{phrase}</span>,
    Underline: (
      <span className="underline decoration-changed decoration-[0.08em] underline-offset-[0.12em]">
        {phrase}
      </span>
    ),
    "New line": (
      <>
        <br />
        <span className={ink ? "text-[#a1a1a1]" : "text-muted"}>{phrase}</span>
      </>
    ),
  };
  return (
    <>
      {before}
      {styled[emphasis]}
      {after}
    </>
  );
}

function Art({ art }: { art: Config["art"] }) {
  switch (art) {
    case "Live check":
      return <HeroChecksLive />;
    case "Check":
      return <HeroChecks />;
    case "Diff slider":
      return <DiffSliderArt />;
    case "Bill":
      return <BillArt />;
    case "Terminal":
      return <TerminalArt />;
    default:
      return null;
  }
}

function Proof({ proof, ink }: { proof: Config["proof"]; ink: boolean }) {
  switch (proof) {
    case "Free line":
      return (
        <p className={`mt-4 text-xs ${ink ? "text-[#a1a1a1]" : "text-muted"}`}>
          Free up to 10 GB. No card. Playwright, Storybook or any folder of
          PNGs.
        </p>
      );
    case "Price line":
      return <PriceLine />;
    case "Command":
      return <CommandChip />;
    default:
      return null;
  }
}

function PlaygroundHero({ config }: { config: Config }) {
  const ink = config.background === "Ink";
  const centered = config.layout === "Centered";
  const split = config.layout === "Split" || config.layout === "Split reversed";
  const demo = config.art === "Demo";
  const art = demo ? null : <Art art={config.art} />;
  const text = (
    <div className={centered ? "mx-auto text-center" : ""}>
      <h1
        className={`${SIZES[config.size]} ${WEIGHTS[config.weight]} ${TRACKING[config.tracking]} text-balance ${centered ? "mx-auto max-w-[20ch]" : "max-w-[16ch]"}`}
      >
        <Headline config={config} ink={ink} />
      </h1>
      <p
        className={`mt-6 max-w-[640px] text-2xl font-[450] tracking-[-0.035em] text-balance max-sm:text-xl ${centered ? "mx-auto" : ""} ${ink ? "text-[#a1a1a1]" : "text-muted"}`}
      >
        {config.lead}
      </p>
      <div
        className={`mt-8 flex flex-wrap items-center gap-3 ${centered ? "justify-center" : ""}`}
      >
        {ink ? (
          <span className="inline-flex h-8 items-center rounded-control bg-[#ededed] px-3 text-sm font-medium text-[#0a0a0a]">
            {config.cta}
          </span>
        ) : (
          <AuthButton label={config.cta} />
        )}
        <span
          className={
            ink
              ? "inline-flex h-8 items-center gap-1.5 rounded-control px-3 text-sm font-medium text-[#a1a1a1] ring-1 ring-[#2e2e2e]"
              : buttonClass("secondary")
          }
        >
          Try the review page
          <ArrowRightIcon size={14} />
        </span>
      </div>
      <div className={centered ? "flex justify-center" : ""}>
        <Proof proof={config.proof} ink={ink} />
      </div>
    </div>
  );
  return (
    <section className={BACKGROUNDS[config.background]}>
      <div className={`${WIDE} pt-24 pb-16 max-sm:pt-12`}>
        {split ? (
          <div
            className={`grid items-center gap-12 max-lg:grid-cols-1 ${config.layout === "Split" ? "grid-cols-[minmax(0,1fr)_auto]" : "grid-cols-[auto_minmax(0,1fr)]"}`}
          >
            {config.layout === "Split reversed" && art && (
              <div aria-hidden className="text-text max-lg:hidden">
                {art}
              </div>
            )}
            {text}
            {config.layout === "Split" && art && (
              <div aria-hidden className="text-text max-lg:hidden">
                {art}
              </div>
            )}
          </div>
        ) : (
          <>
            {text}
            {art && (
              <div
                aria-hidden
                className={`mt-16 flex text-text ${centered ? "justify-center" : ""}`}
              >
                {art}
              </div>
            )}
          </>
        )}
        {demo && (
          <div className="checker mt-16 rounded-xl p-12 text-text ring-1 ring-border max-md:p-3">
            <div className="mx-auto max-w-[1180px]">
              <ReviewDemo />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

const LABELS: Record<keyof Options, string> = {
  layout: "Layout",
  size: "Headline size",
  weight: "Weight",
  tracking: "Tracking",
  emphasis: "Emphasis",
  background: "Background",
  art: "Art",
  proof: "Under the buttons",
  cta: "Button",
};

function Choice<Key extends keyof Options>({
  name,
  value,
  onChange,
}: {
  name: Key;
  value: Options[Key][number];
  onChange: (value: Options[Key][number]) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-muted">{LABELS[name]}</span>
      <fieldset
        aria-label={LABELS[name]}
        className="flex w-fit flex-wrap gap-1 rounded-control bg-surface-2 p-0.5"
      >
        {OPTIONS[name].map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={value === option}
            onClick={() => onChange(option)}
            className={`h-7 rounded-sm px-2.5 text-xs font-medium whitespace-nowrap transition-colors duration-100 ${
              value === option
                ? "bg-surface text-text shadow-[inset_0_0_0_1px_var(--color-border)]"
                : "text-muted hover:text-text"
            }`}
          >
            {option}
          </button>
        ))}
      </fieldset>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs text-muted">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 rounded-md bg-surface px-2.5 text-sm shadow-[inset_0_0_0_1px_var(--color-field-border)] outline-none focus:shadow-field-focus"
      />
    </label>
  );
}

export function HeroPlayground() {
  const [config, setConfig] = useState(CURRENT);
  const [copied, setCopied] = useState(false);
  const set = <Key extends keyof Config>(key: Key, value: Config[Key]) =>
    setConfig((current) => ({ ...current, [key]: value }));
  return (
    <div>
      <div className="flex flex-col gap-5 border-b border-border bg-bg p-6 max-sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-2 text-xs text-muted">Presets</span>
          {PRESETS.map(([name, preset]) => (
            <button
              key={name}
              type="button"
              onClick={() => setConfig(preset)}
              className={buttonClass("secondary", "sm")}
            >
              {name}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              navigator.clipboard
                .writeText(JSON.stringify(config, null, 2))
                .then(() => {
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 2000);
                });
            }}
            className={`${buttonClass("ghost", "sm")} ml-auto`}
          >
            {copied ? <CheckIcon size={12} /> : <CopyIcon size={12} />}
            {copied ? "Copied" : "Copy settings"}
          </button>
        </div>
        <div className="grid grid-cols-3 gap-4 max-lg:grid-cols-1">
          <TextField
            label="Headline"
            value={config.headline}
            onChange={(value) => set("headline", value)}
          />
          <TextField
            label="Emphasized phrase"
            value={config.phrase}
            onChange={(value) => set("phrase", value)}
          />
          <TextField
            label="Lead"
            value={config.lead}
            onChange={(value) => set("lead", value)}
          />
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-4">
          {(Object.keys(OPTIONS) as (keyof Options)[]).map((name) => (
            <Choice
              key={name}
              name={name}
              value={config[name]}
              onChange={(value) => set(name, value as Config[typeof name])}
            />
          ))}
        </div>
      </div>
      <PlaygroundHero config={config} />
    </div>
  );
}
