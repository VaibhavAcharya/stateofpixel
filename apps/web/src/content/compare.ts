import type { PageMeta } from "../lib/pageMeta";

export const CHECKED = "27 September 2026";

export type Source = { label: string; url: string };

export type Cell = { text: string; sources: Source[] };

export const ROW_GROUPS = [
  {
    title: "Pricing",
    rows: {
      billing: "What you pay for",
      free: "Free plan",
      paid: "First paid plan",
      limit: "At the plan limit",
      seats: "Seats",
    },
  },
  {
    title: "Screenshots",
    rows: {
      renders: "Who takes them",
      compares: "Where they are compared",
      browsers: "Browsers",
      runners: "Test runners",
    },
  },
  {
    title: "Platform",
    rows: {
      git: "Git hosts",
      retention: "Build history",
      openSource: "Open source",
    },
  },
] as const;

type RowKeyOf<Group> = Group extends { rows: infer Rows } ? keyof Rows : never;

export type RowKey = RowKeyOf<(typeof ROW_GROUPS)[number]>;

export const OURS: Record<RowKey, string> = {
  billing: "Storage. Snapshots, builds and seats are free.",
  free: "10 GB stored. Snapshots are not charged.",
  paid: "$15 a month for 25 GB.",
  limit:
    "Warns at 80%. After 14 days over, new images are not stored and the check passes with a note.",
  seats: "None. Access comes from GitHub roles.",
  renders: "Your CI.",
  compares: "Your CI, before anything uploads.",
  browsers: "Whatever your CI runs.",
  runners: "Playwright, Storybook, or any tool that writes PNG files.",
  git: "GitHub.",
  retention:
    "Default branch builds kept. Pull request builds 60 days after close, 7 to 365 days.",
  openSource: "No. Closed source for now.",
};

export type Priced = "chromatic" | "argos" | "percy";

export type Competitor = {
  slug: "chromatic" | "argos" | "percy" | "lost-pixel";
  name: string;
  logo: string;
  meta: PageMeta;
  headline: string;
  lead: string;
  hook: string;
  status?: { label: string; value: string; source: Source }[];
  priced: Priced | null;
  theirFlow: string[];
  theirBill: string;
  cells: Partial<Record<RowKey, Cell>>;
  differences: [string, string][];
  ahead: [string, string][];
  switchSteps: [string, string][];
  faq: [string, string][];
};

const CHROMATIC_PRICING = {
  label: "Chromatic pricing",
  url: "https://www.chromatic.com/pricing",
};
const CHROMATIC_BILLING = {
  label: "Chromatic billing",
  url: "https://www.chromatic.com/docs/billing/",
};
const CHROMATIC_BROWSERS = {
  label: "Chromatic browsers",
  url: "https://www.chromatic.com/docs/browsers/",
};
const CHROMATIC_PLAYWRIGHT = {
  label: "Chromatic for Playwright",
  url: "https://www.chromatic.com/docs/playwright/",
};

const ARGOS_PRICING = {
  label: "Argos pricing",
  url: "https://argos-ci.com/pricing",
};
const ARGOS_FUNDAMENTALS = {
  label: "Argos platform fundamentals",
  url: "https://argos-ci.com/docs/learn/platform-fundamentals",
};

const PERCY_PRICING = {
  label: "Percy pricing",
  url: "https://www.browserstack.com/pricing?product=percy",
};
const PERCY_WORKFLOW = {
  label: "Percy SDK workflow",
  url: "https://www.browserstack.com/docs/percy/integrate/percy-sdk-workflow",
};

const LOST_PIXEL_PRICING = {
  label: "Lost Pixel pricing",
  url: "https://www.lost-pixel.com/pricing",
};
const LOST_PIXEL_README = {
  label: "Lost Pixel README",
  url: "https://github.com/lost-pixel/lost-pixel/blob/main/README.md",
};
const LOST_PIXEL_REPO = {
  label: "Lost Pixel repository",
  url: "https://github.com/lost-pixel/lost-pixel",
};

const chromatic: Competitor = {
  slug: "chromatic",
  name: "Chromatic",
  logo: "/logos/compare/chromatic.png",
  meta: {
    path: "/compare/chromatic",
    title: "stateofpixel vs Chromatic",
    description:
      "Chromatic renders in its own cloud and bills per snapshot. stateofpixel reviews the screenshots from your CI and bills for storage.",
  },
  headline: "Keep your stories. Lose the snapshot bill.",
  lead: "Chromatic renders every story in its own browser cloud and bills each one. stateofpixel reviews the screenshots your CI already takes and bills only for the storage they use.",
  hook: "Renders in its own cloud and bills every story, browser and mode.",
  priced: "chromatic",
  theirFlow: [
    "Your CI builds Storybook or records a test archive",
    "The build uploads to Chromatic",
    "Chromatic's browsers render every story",
    "Chromatic compares and sets the check",
  ],
  theirBill: "Billed per snapshot",
  cells: {
    billing: {
      text: "Snapshots: tests x builds x browsers x modes. A TurboSnap copy costs a fifth of one.",
      sources: [
        CHROMATIC_BILLING,
        {
          label: "Chromatic TurboSnap",
          url: "https://www.chromatic.com/docs/turbosnap/",
        },
      ],
    },
    free: {
      text: "5,000 snapshots a month, Chrome only.",
      sources: [CHROMATIC_PRICING],
    },
    paid: {
      text: "Starter, $179 a month for 35,000 snapshots, then $0.008 each. Monthly billing only.",
      sources: [CHROMATIC_PRICING, CHROMATIC_BILLING],
    },
    limit: {
      text: "On Free, testing and review pause until next month. Paid plans bill the extra.",
      sources: [
        {
          label: "Chromatic free plan limit",
          url: "https://www.chromatic.com/docs/faq/free-plan-snapshot-limit/",
        },
        CHROMATIC_PRICING,
      ],
    },
    seats: {
      text: "Unlimited collaborators.",
      sources: [CHROMATIC_PRICING],
    },
    renders: {
      text: "Chromatic's Capture Cloud, from your Storybook or a test archive.",
      sources: [CHROMATIC_BROWSERS, CHROMATIC_PLAYWRIGHT],
    },
    compares: {
      text: "Chromatic's cloud.",
      sources: [CHROMATIC_PLAYWRIGHT],
    },
    browsers: {
      text: "Chrome, Firefox, Safari and Edge. Free is Chrome only.",
      sources: [CHROMATIC_PRICING, CHROMATIC_BROWSERS],
    },
    runners: {
      text: "Storybook, Playwright, Cypress and Vitest.",
      sources: [
        CHROMATIC_PLAYWRIGHT,
        {
          label: "Chromatic for Cypress",
          url: "https://www.chromatic.com/docs/cypress/",
        },
        {
          label: "Chromatic for Vitest",
          url: "https://www.chromatic.com/docs/vitest/",
        },
      ],
    },
    git: {
      text: "GitHub, GitLab and Bitbucket.",
      sources: [
        {
          label: "Chromatic access",
          url: "https://www.chromatic.com/docs/access/",
        },
      ],
    },
    retention: {
      text: "At least 12 months on every plan.",
      sources: [
        {
          label: "Chromatic build expiry",
          url: "https://www.chromatic.com/docs/faq/do-builds-expire/",
        },
      ],
    },
    openSource: {
      text: "The CLI is MIT licensed.",
      sources: [
        {
          label: "chromatic-cli license",
          url: "https://github.com/chromaui/chromatic-cli/blob/main/LICENSE",
        },
      ],
    },
  },
  differences: [
    [
      "One renderer",
      "Your tests already render in CI. We compare those pixels, so there is no second browser that disagrees with your test run.",
    ],
    [
      "Browsers and modes don't multiply the bill",
      "Chromatic bills tests x builds x browsers x modes. We bill for bytes stored, and an unchanged screenshot is one hash.",
    ],
    [
      "The free plan never stops CI",
      "Chromatic's free plan pauses testing and review for the rest of the month. Ours warns, waits 14 days, then passes the check with a note.",
    ],
  ],
  ahead: [
    [
      "Browsers you don't run",
      "Chromatic renders Safari, Firefox and Edge for you. With stateofpixel, your CI renders every browser you want to compare.",
    ],
    [
      "Storybook features",
      "Modes, accessibility tests, TurboSnap and a published Storybook. stateofpixel only compares the PNG files you give it.",
    ],
    [
      "GitLab and Bitbucket",
      "Chromatic links to both. stateofpixel works with GitHub only.",
    ],
    [
      "Threaded review comments",
      "Chromatic's UI Review has discussions on each change. stateofpixel has approve, and reject with an optional comment.",
    ],
  ],
  switchSteps: [
    [
      "Install the GitHub App",
      "Pick the repositories. On GitHub Actions there is no token to copy.",
    ],
    [
      "Replace the Chromatic step",
      "The capture uses the Playwright in your project, at each width you list.",
    ],
    [
      "Merge to main",
      "That build becomes the baseline. There is nothing to export from Chromatic.",
    ],
  ],
  faq: [
    [
      "Can I keep my Storybook stories as they are?",
      "Yes. stateofpixel storybook opens your built Storybook and captures every story at each width. A story named Button/Primary becomes the snapshot Button/Primary [chromium 1280].",
    ],
    [
      "Why is stateofpixel cheaper than Chromatic?",
      "Chromatic runs a browser for every snapshot. stateofpixel never runs a browser: your CI renders and compares, and our server stores the images that changed. Storage is the only cost we pass on.",
    ],
    [
      "What about Playwright tests on Chromatic?",
      "Import snapshot() from stateofpixel/playwright and add the reporter. The screenshot comes from your test's own browser, and the reporter uploads when the run ends.",
    ],
    [
      "Do I lose my Chromatic baselines?",
      "You start fresh. The first build on your default branch becomes the baseline, and pull requests compare against it from then on.",
    ],
  ],
};

const argos: Competitor = {
  slug: "argos",
  name: "Argos",
  logo: "/logos/compare/argos.png",
  meta: {
    path: "/compare/argos",
    title: "stateofpixel vs Argos",
    description:
      "Both take screenshots in your CI. Argos compares on its servers and bills per screenshot. stateofpixel compares on your runner and bills for storage.",
  },
  headline: "Same idea as Argos. A different bill.",
  lead: "Both take screenshots in your CI. Argos compares them on its servers and counts every screenshot in a build. stateofpixel compares on your runner, uploads only images it has not seen, and bills for storage.",
  hook: "Screenshots from your CI, compared on its servers, billed per screenshot.",
  priced: "argos",
  theirFlow: [
    "Your tests take screenshots",
    "The SDK or CLI uploads the build",
    "Argos compares against the baseline",
    "Argos sets the commit status",
  ],
  theirBill: "Billed per screenshot",
  cells: {
    billing: {
      text: "Screenshots. Every snapshot stored for a build counts.",
      sources: [
        {
          label: "Argos pricing plans",
          url: "https://argos-ci.com/docs/learn/billing-and-subscription/pricing-plans",
        },
      ],
    },
    free: {
      text: "Hobby, 5,000 screenshots a month, for personal projects.",
      sources: [ARGOS_PRICING],
    },
    paid: {
      text: "Pro, $100 a month for 35,000, then $0.004 each, or $0.0015 for Storybook.",
      sources: [ARGOS_PRICING],
    },
    limit: {
      text: "Hobby and GitHub Marketplace plans pause uploads. Usage-based Pro bills the extra.",
      sources: [
        {
          label: "Argos spend management",
          url: "https://argos-ci.com/docs/learn/billing-and-subscription/spend-management",
        },
      ],
    },
    seats: {
      text: "No seat price. SSO is an add-on from $50 a month.",
      sources: [ARGOS_PRICING],
    },
    renders: {
      text: "Your CI, through an SDK or the CLI.",
      sources: [ARGOS_FUNDAMENTALS],
    },
    compares: {
      text: "Argos's servers, after upload, with odiff.",
      sources: [
        ARGOS_FUNDAMENTALS,
        {
          label: "How Argos detects differences",
          url: "https://argos-ci.com/docs/learn/platform-fundamentals/how-argos-detects-visual-differences",
        },
      ],
    },
    browsers: {
      text: "Whatever your CI runs.",
      sources: [ARGOS_FUNDAMENTALS],
    },
    runners: {
      text: "Playwright, Vitest, Storybook, Cypress, WebdriverIO, Puppeteer, or a folder.",
      sources: [
        {
          label: "Argos quickstart",
          url: "https://argos-ci.com/docs/quickstart",
        },
      ],
    },
    git: {
      text: "GitHub and GitLab.",
      sources: [
        {
          label: "Argos other Git providers",
          url: "https://argos-ci.com/docs/learn/integrations/other-git-providers",
        },
      ],
    },
    openSource: {
      text: "Yes, MIT licensed. Self-hosting is not documented.",
      sources: [
        {
          label: "Argos license",
          url: "https://github.com/argos-ci/argos/blob/main/LICENSE",
        },
      ],
    },
  },
  differences: [
    [
      "Unchanged screenshots are free",
      "Argos counts every snapshot stored for a build. We receive a hash for each screenshot and upload only the ones we have not seen.",
    ],
    [
      "The diff runs on your runner",
      "The CLI compares against the baseline before it uploads, so our server only stores bytes. That is why storage is the only line on the bill.",
    ],
    [
      "Free for teams, with no pause",
      "Argos Hobby is for personal projects and pauses uploads at 5,000 screenshots. Our free plan has no limit on reviewers, and CI keeps passing at the storage limit.",
    ],
  ],
  ahead: [
    [
      "Open source",
      "Argos is MIT licensed. stateofpixel is closed source for now.",
    ],
    ["GitLab", "Argos supports GitLab. stateofpixel works with GitHub only."],
    [
      "Flaky tests and PR comments",
      "Argos ranks tests by flakiness and comments on the pull request. stateofpixel has neither yet.",
    ],
    [
      "An SDK per framework",
      "Argos has SDKs for Cypress, WebdriverIO and Puppeteer. stateofpixel takes the PNG files they write.",
    ],
  ],
  switchSteps: [
    [
      "Install the GitHub App",
      "Pick the repositories. On GitHub Actions there is no token to copy.",
    ],
    [
      "Replace the upload step",
      "Point it at the same folder. Folder paths become snapshot names.",
    ],
    [
      "Merge to main",
      "That build becomes the baseline, and pull requests compare against it.",
    ],
  ],
  faq: [
    [
      "How is stateofpixel different from Argos?",
      "Both review screenshots from your CI. Argos compares them on its servers and bills per screenshot. stateofpixel compares on your runner, uploads only new images and bills for the storage they use.",
    ],
    [
      "Does sharding work the same way?",
      "Yes. Each shard uploads its part, and the check reports once. Use --shard 2/4, or --shard auto with a finalize step.",
    ],
    [
      "I use the Argos Playwright SDK. What changes?",
      "Replace argosScreenshot() with snapshot() from stateofpixel/playwright, and the Argos reporter with stateofpixel/playwright.",
    ],
    [
      "What happens at the storage limit?",
      "The CLI warns at 80%. After 14 days over the limit, new images are not stored and the check passes with a note, so CI keeps passing.",
    ],
  ],
};

const percy: Competitor = {
  slug: "percy",
  name: "Percy",
  logo: "/logos/compare/percy.png",
  meta: {
    path: "/compare/percy",
    title: "stateofpixel vs Percy",
    description:
      "Percy renders your DOM again in BrowserStack's browsers and bills per screenshot. stateofpixel reviews the pixels from your own test run.",
  },
  headline: "Review the pixels your tests drew.",
  lead: "Percy sends your DOM to BrowserStack and renders it again at every browser and width. stateofpixel reviews the screenshots from your own test run, and bills for storage, not screenshots.",
  hook: "Renders your DOM again in its own browsers, billed per screenshot.",
  priced: "percy",
  theirFlow: [
    "Your tests capture the DOM",
    "The SDK uploads the DOM and assets",
    "Percy renders each browser and width",
    "Percy compares and sets the check",
  ],
  theirBill: "Billed per screenshot",
  cells: {
    billing: {
      text: "Screenshots: pages x browsers x widths.",
      sources: [PERCY_PRICING],
    },
    free: {
      text: "5,000 screenshots a month.",
      sources: [PERCY_PRICING],
    },
    paid: {
      text: "Desktop, $249 a month for 10,000, or $199 billed yearly, then $0.036 each.",
      sources: [PERCY_PRICING],
    },
    limit: {
      text: "Paid plans keep running and bill each extra screenshot.",
      sources: [PERCY_PRICING],
    },
    seats: {
      text: "Unlimited users. SSO is in the Enterprise add-on.",
      sources: [PERCY_PRICING],
    },
    renders: {
      text: "Percy, from a DOM snapshot of your page.",
      sources: [PERCY_WORKFLOW],
    },
    compares: {
      text: "Percy's cloud.",
      sources: [PERCY_WORKFLOW],
    },
    browsers: {
      text: "Chrome, Firefox, Edge and Safari. Mobile on a higher plan.",
      sources: [
        {
          label: "Percy cross-browser",
          url: "https://www.browserstack.com/docs/percy/project-settings/cross-browser",
        },
        PERCY_PRICING,
      ],
    },
    runners: {
      text: "SDKs for Playwright, Cypress, Selenium, Puppeteer, Storybook and more.",
      sources: [
        {
          label: "Percy SDKs",
          url: "https://www.browserstack.com/docs/percy/integrate/percy-with-browserstack-sdk",
        },
      ],
    },
    git: {
      text: "GitHub, GitLab, Bitbucket and Azure DevOps.",
      sources: [
        {
          label: "Percy source control",
          url: "https://www.browserstack.com/docs/percy/integrations/source-control/overview",
        },
      ],
    },
    retention: {
      text: "30 days on Free, 12 months on paid plans.",
      sources: [PERCY_PRICING],
    },
    openSource: {
      text: "The CLI and SDKs are MIT licensed.",
      sources: [
        {
          label: "@percy/cli package",
          url: "https://github.com/percy/cli/blob/master/packages/cli/package.json",
        },
      ],
    },
  },
  differences: [
    [
      "What you test is what you review",
      "Percy renders your DOM a second time, outside your test run. We compare the pixels your own browser produced.",
    ],
    [
      "No login to set up twice",
      "Percy loads your assets again when it renders, so pages behind a login can need extra setup. Your CI already has access.",
    ],
    [
      "No per screenshot price",
      "Percy counts each page at each browser and width, and extra screenshots cost $0.036. We bill for storage, and an unchanged screenshot is one hash.",
    ],
  ],
  ahead: [
    [
      "Many browsers and real devices",
      "Percy renders Chrome, Firefox, Edge and Safari, and mobile on its higher plan. stateofpixel compares what your CI renders.",
    ],
    [
      "AI review",
      "Percy's Visual Review Agent highlights meaningful changes on paid plans. stateofpixel compares pixels with a color threshold.",
    ],
    [
      "GitLab, Bitbucket and Azure DevOps",
      "Percy supports all of them. stateofpixel works with GitHub only.",
    ],
    [
      "Selenium in any language",
      "Percy has SDKs for Java, Ruby, Python and .NET. stateofpixel takes the PNG files those tests write.",
    ],
  ],
  switchSteps: [
    [
      "Install the GitHub App",
      "Pick the repositories. On GitHub Actions there is no token to copy.",
    ],
    [
      "Swap percySnapshot() for snapshot()",
      "Import it from stateofpixel/playwright and add the reporter. It waits for fonts and disables animations.",
    ],
    [
      "Merge to main",
      "That build becomes the baseline, and pull requests compare against it.",
    ],
  ],
  faq: [
    [
      "Why compare screenshots from my own CI?",
      "They are the pixels your tests saw. There is no second render with different fonts, timing or network, so a diff is a change in your app, not in the renderer.",
    ],
    [
      "Can I still test several browsers?",
      "Yes. Run Playwright projects for Chromium, Firefox and WebKit. Each browser is its own snapshot, named like Checkout [firefox 1280].",
    ],
    [
      "I upload a folder of images with percy upload. What changes?",
      "Run npx stateofpixel upload on the same folder. Folder paths become snapshot names.",
    ],
    [
      "How much does stateofpixel cost compared with Percy?",
      "Percy bills per screenshot after the included amount. stateofpixel bills for storage, with 10 GB free. The calculator on this page compares both for your suite.",
    ],
  ],
};

const lostPixel: Competitor = {
  slug: "lost-pixel",
  name: "Lost Pixel",
  logo: "/logos/compare/lost-pixel.png",
  meta: {
    path: "/compare/lost-pixel",
    title: "stateofpixel vs Lost Pixel",
    description:
      "Lost Pixel is shutting down. stateofpixel takes the same screenshots in your CI, keeps the baselines and sets the GitHub status.",
  },
  headline: "Lost Pixel is closing. Your screenshots can move today.",
  lead: "The Lost Pixel team joined Figma and archived the repository. stateofpixel takes the same screenshots in your CI, keeps the baselines for you and sets the GitHub status.",
  hook: "Shutting down. The team joined Figma and the repository is archived.",
  status: [
    {
      label: "Announced",
      value: "Joining Figma, 22 April 2026",
      source: {
        label: "The Lost Pixel team is joining Figma",
        url: "https://lost-pixel.com/blog/lost-pixel-team-is-joining-figma",
      },
    },
    {
      label: "Last release",
      value: "v3.22.0, 14 November 2024",
      source: {
        label: "Lost Pixel releases",
        url: "https://github.com/lost-pixel/lost-pixel/releases",
      },
    },
    {
      label: "Repository",
      value: "Archived",
      source: LOST_PIXEL_REPO,
    },
  ],
  priced: null,
  theirFlow: [
    "The Lost Pixel image captures in your CI",
    "It compares in your CI",
    "Baselines are committed to git",
    "Or the Platform, which is shutting down",
  ],
  theirBill: "Platform billed per screenshot",
  cells: {
    billing: {
      text: "Screenshots a month.",
      sources: [LOST_PIXEL_PRICING],
    },
    free: {
      text: "7,000 screenshots a month.",
      sources: [LOST_PIXEL_PRICING],
    },
    paid: {
      text: "Startup, $100 a month for 40,000, then $0.006 each.",
      sources: [LOST_PIXEL_PRICING],
    },
    seats: {
      text: "Unlimited collaborators on Free.",
      sources: [LOST_PIXEL_PRICING],
    },
    renders: {
      text: "Your CI, in the Lost Pixel Docker image with Playwright.",
      sources: [
        {
          label: "Lost Pixel action.yml",
          url: "https://github.com/lost-pixel/lost-pixel/blob/main/action.yml",
        },
      ],
    },
    compares: {
      text: "Your CI, with pixelmatch by default.",
      sources: [
        {
          label: "Lost Pixel config.ts",
          url: "https://github.com/lost-pixel/lost-pixel/blob/main/src/config.ts",
        },
      ],
    },
    browsers: {
      text: "Chromium, Firefox and WebKit.",
      sources: [
        {
          label: "Lost Pixel schemas.ts",
          url: "https://github.com/lost-pixel/lost-pixel/blob/main/src/schemas.ts",
        },
      ],
    },
    runners: {
      text: "Storybook, Ladle, Histoire, page URLs, or a folder.",
      sources: [LOST_PIXEL_README],
    },
    git: {
      text: "GitHub.",
      sources: [
        {
          label: "Lost Pixel Platform setup",
          url: "https://github.com/lost-pixel/lost-pixel/blob/main/docs/setup/lost-pixel-platform.md",
        },
      ],
    },
    openSource: {
      text: "The engine is MIT licensed and archived. The review UI is Platform only.",
      sources: [LOST_PIXEL_REPO, LOST_PIXEL_README],
    },
  },
  differences: [
    [
      "Maintained",
      "Lost Pixel's last release was in November 2024. stateofpixel is in active development and reviews its own pull requests.",
    ],
    [
      "Baselines out of your repository",
      "Lost Pixel's open source mode commits baseline PNGs to git and has no review page. We pick the baseline from your git history and show every change on one page.",
    ],
    [
      "A bill that follows storage",
      "Lost Pixel Platform billed per screenshot. We bill for storage, and an unchanged screenshot is one hash.",
    ],
  ],
  ahead: [
    [
      "Offline, with no service",
      "The Lost Pixel engine is MIT licensed. It can keep comparing against baselines committed to your repository, with no account anywhere.",
    ],
  ],
  switchSteps: [
    [
      "Install the GitHub App",
      "Pick the repositories. On GitHub Actions there is no token to copy.",
    ],
    [
      "Replace the Lost Pixel step",
      "Storybook stories are captured at each width you list. For custom shots, upload the folder your tests write.",
    ],
    [
      "Delete .lostpixel/baseline",
      "If you committed baselines, remove them. The first build on your default branch becomes the baseline.",
    ],
  ],
  faq: [
    [
      "Is Lost Pixel shutting down?",
      "Yes. On 22 April 2026 the team announced they are joining Figma and sunsetting Lost Pixel. The GitHub repository is archived.",
    ],
    [
      "Can I keep my Storybook, Ladle or Histoire setup?",
      "Storybook works directly with stateofpixel storybook. For Ladle, Histoire or pages, save screenshots with Playwright and upload the folder.",
    ],
    [
      "Do I need to commit baselines?",
      "No. stateofpixel stores the images and picks each baseline from your git history. Delete .lostpixel/baseline from your repository after you switch.",
    ],
  ],
};

export const COMPETITORS: Competitor[] = [chromatic, argos, percy, lostPixel];

export const COMPARE_PAGE: PageMeta = {
  path: "/compare",
  title: "Compare",
  description:
    "How stateofpixel compares with Chromatic, Argos, Percy and Lost Pixel, with a source for every fact.",
};

export function findCompetitor(slug: string): Competitor | undefined {
  return COMPETITORS.find((competitor) => competitor.slug === slug);
}
