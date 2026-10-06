import { facts } from "../components/docs/facts";
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
  free: `${facts.freeStorage} stored. Snapshots are not charged.`,
  paid: "$15 a month for 25 GB.",
  limit: `Warns at ${facts.storageWarning}. After ${facts.graceDays} days over, new images are not stored and the check passes with a note.`,
  seats: "None. Access comes from GitHub roles.",
  renders: "Your CI.",
  compares: "Your CI. Only the images upload.",
  browsers: "Whatever your CI runs.",
  runners: "Playwright, Storybook, or any tool that writes PNG files.",
  git: "GitHub.",
  retention: `Default branch builds kept. Pull request builds ${facts.retentionDays} days after close, ${facts.minRetentionDays} to ${facts.maxRetentionDays} days.`,
  openSource: "Yes, MIT licensed.",
};

export type Priced = "chromatic" | "argos" | "percy" | "happo";

export type Competitor = {
  slug:
    | "chromatic"
    | "argos"
    | "percy"
    | "applitools"
    | "happo"
    | "lost-pixel"
    | "backstopjs";
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
      `Chromatic's free plan pauses testing and review for the rest of the month. Ours warns, waits ${facts.graceDays} days, then passes the check with a note.`,
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
      "Chromatic's UI Review has discussions on each change. stateofpixel has a list of comments on each snapshot, next to approve and reject.",
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
      "The CLI compares with the baseline on your runner and uploads the diff image, so our server only stores bytes. That is why storage is the only line on the bill.",
    ],
    [
      "Free for teams, with no pause",
      "Argos Hobby is for personal projects and pauses uploads at 5,000 screenshots. Our free plan has no limit on reviewers, and CI keeps passing at the storage limit.",
    ],
  ],
  ahead: [
    ["GitLab", "Argos supports GitLab. stateofpixel works with GitHub only."],
    [
      "Flaky tests and PR comments",
      "Argos ranks tests by flakiness and comments on the pull request. stateofpixel marks a snapshot that looks flaky on the review page, and reports on the pull request through its check only.",
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
      `The CLI warns at ${facts.storageWarning}. After ${facts.graceDays} days over the limit, new images are not stored and the check passes with a note, so CI keeps passing.`,
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
      text: "GitHub, GitLab and Bitbucket.",
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
      "GitLab and Bitbucket",
      "Percy supports both. stateofpixel works with GitHub only.",
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
      `Percy bills per screenshot after the included amount. stateofpixel bills for storage, with ${facts.freeStorage} free. The calculator on this page compares both for your suite.`,
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

const APPLITOOLS_PRICING = {
  label: "Applitools pricing",
  url: "https://applitools.com/pricing/",
};
const APPLITOOLS_GRID = {
  label: "Applitools Ultrafast Grid",
  url: "https://applitools.com/docs/eyes/concepts/test-execution/ultrafast-grid",
};
const APPLITOOLS_TERMS = {
  label: "Applitools subscription agreement",
  url: "https://applitools.com/legal/ssa-20231115/",
};

const applitools: Competitor = {
  slug: "applitools",
  name: "Applitools",
  logo: "/logos/compare/applitools.png",
  meta: {
    path: "/compare/applitools",
    title: "stateofpixel vs Applitools",
    description:
      "Applitools renders your tests in its own browser grid and bills per checkpoint, yearly. stateofpixel reviews the screenshots from your CI and bills for storage.",
  },
  headline: "Visual review without a yearly contract.",
  lead: `Applitools renders your tests again in its own browser grid, and its first plan is $667 a month, billed yearly. stateofpixel reviews the screenshots your CI already takes, free up to ${facts.freeStorage}.`,
  hook: "Renders in its own grid. Plans start at $667 a month, billed yearly.",
  priced: null,
  theirFlow: [
    "Your tests run with the Eyes SDK",
    "The SDK uploads the DOM and resources",
    "The Ultrafast Grid renders each browser",
    "Visual AI compares and sets the check",
  ],
  theirBill: "Billed per checkpoint, yearly",
  cells: {
    billing: {
      text: "Checkpoints a month, counted per page or per component.",
      sources: [APPLITOOLS_PRICING],
    },
    free: {
      text: "A 14-day trial. No free plan is listed.",
      sources: [
        APPLITOOLS_PRICING,
        {
          label: "Applitools FAQ",
          url: "https://applitools.com/applitools-faq/",
        },
      ],
    },
    paid: {
      text: "Starter, $667 a month billed yearly, for 1,000 page or 100,000 component checkpoints. Higher plans are priced by sales.",
      sources: [APPLITOOLS_PRICING],
    },
    limit: {
      text: "Admins get an email. The contract allows throttling, overage fees, or ending the contract after three months over.",
      sources: [
        {
          label: "Applitools account usage",
          url: "https://applitools.com/docs/eyes/concepts/applitools-test-manager/admin/admin-account-view",
        },
        APPLITOOLS_TERMS,
      ],
    },
    seats: {
      text: "Unlimited users.",
      sources: [APPLITOOLS_PRICING],
    },
    renders: {
      text: "Applitools' Ultrafast Grid, from the DOM your test captures.",
      sources: [APPLITOOLS_GRID],
    },
    compares: {
      text: "Applitools' cloud, with Visual AI.",
      sources: [APPLITOOLS_GRID],
    },
    browsers: {
      text: "Chrome, Firefox, Safari, Edge and Internet Explorer, plus emulated Android and simulated iOS devices.",
      sources: [
        {
          label: "Applitools browsers and devices",
          url: "https://applitools.com/docs/eyes/concepts/test-execution/ultrafast-grid-devices-browsers",
        },
      ],
    },
    runners: {
      text: "Playwright, Cypress, Selenium, Storybook, Appium, WebdriverIO and more.",
      sources: [
        {
          label: "Applitools Eyes docs",
          url: "https://applitools.com/docs/eyes",
        },
      ],
    },
    git: {
      text: "GitHub, GitLab, Bitbucket and Azure DevOps.",
      sources: [
        {
          label: "Applitools GitHub integration",
          url: "https://applitools.com/docs/eyes/integrations/source-control/github",
        },
        {
          label: "Applitools Bitbucket integration",
          url: "https://applitools.com/docs/eyes/integrations/source-control/bitbucket",
        },
      ],
    },
    retention: {
      text: "6 months on Starter, 12 months on Enterprise.",
      sources: [APPLITOOLS_TERMS],
    },
    openSource: {
      text: "No. The SDKs use a proprietary license.",
      sources: [
        {
          label: "Eyes Python SDK license",
          url: "https://github.com/applitools/eyes.sdk.python/blob/master/LICENSE",
        },
        {
          label: "@applitools/eyes-playwright on npm",
          url: "https://www.npmjs.com/package/@applitools/eyes-playwright",
        },
      ],
    },
  },
  differences: [
    [
      "One renderer",
      "The Ultrafast Grid renders the DOM your test captured again, in Applitools' browsers. We compare the pixels your test saw.",
    ],
    [
      "Every price is on the page",
      "Applitools lists Starter and sends the other plans to sales. Our plans start free, bill monthly or yearly, and all of them are on the pricing page.",
    ],
    [
      "Open source",
      "The Applitools SDKs use a proprietary license. stateofpixel, server included, is MIT licensed and can run on your own Netlify site.",
    ],
  ],
  ahead: [
    [
      "Visual AI match levels",
      "Layout and Ignore Colors match levels skip content or color changes, for a whole image or a region. stateofpixel compares pixels with a color threshold.",
    ],
    [
      "Root cause analysis",
      "Eyes stores the DOM and CSS with each checkpoint and shows which ones changed. stateofpixel stores the images and their metadata.",
    ],
    [
      "Browsers you don't run",
      "Applitools renders Safari, Edge and mobile devices for you. With stateofpixel, your CI renders every browser you want to compare.",
    ],
    [
      "GitLab, Bitbucket and Azure DevOps",
      "Applitools works with all three. stateofpixel works with GitHub only.",
    ],
  ],
  switchSteps: [
    [
      "Install the GitHub App",
      "Pick the repositories. On GitHub Actions there is no token to copy.",
    ],
    [
      "Replace the Eyes step",
      "Storybook stories are captured at each width you list. In Playwright tests, replace eyes.check() with snapshot().",
    ],
    [
      "Merge to main",
      "That build becomes the baseline. There is nothing to export from Applitools.",
    ],
  ],
  faq: [
    [
      "Does Applitools have a free plan?",
      `Applitools lists a 14-day trial. stateofpixel is free up to ${facts.freeStorage} stored, with no time limit.`,
    ],
    [
      "Does stateofpixel use AI to compare?",
      "No. It compares pixels and ignores color differences under a threshold you set per project or per run. Most noise is fixed where the screenshot is taken, see Stable screenshots in the docs.",
    ],
    [
      "Can I keep Cypress or Selenium tests?",
      "Yes. Save screenshots to a folder and run stateofpixel upload on it. Cypress has its own guide in the docs.",
    ],
    [
      "Do I lose my Applitools baselines?",
      "You start fresh. The first build on your default branch becomes the baseline, and pull requests compare against it from then on.",
    ],
  ],
};

const HAPPO_PRICING = {
  label: "Happo pricing",
  url: "https://happo.io/pricing",
};
const HAPPO_GETTING_STARTED = {
  label: "Happo getting started",
  url: "https://docs.happo.io/docs/getting-started",
};
const HAPPO_BROWSERS = {
  label: "Happo browsers",
  url: "https://docs.happo.io/docs/browsers",
};

const happo: Competitor = {
  slug: "happo",
  name: "Happo",
  logo: "/logos/compare/happo.png",
  meta: {
    path: "/compare/happo",
    title: "stateofpixel vs Happo",
    description:
      "Happo renders every snapshot in every browser on its own workers and bills each one. stateofpixel reviews the screenshots from your CI and bills for storage.",
  },
  headline: "Stop paying per browser.",
  lead: "Happo renders every snapshot in every browser on its own workers and bills each one. stateofpixel reviews the screenshots your CI already takes and bills only for the storage they use.",
  hook: "Renders in its own browsers and bills every snapshot in every browser.",
  priced: "happo",
  theirFlow: [
    "Your CI builds and uploads the suite",
    "Happo's workers render every snapshot",
    "Happo compares with the baseline report",
    "You review on Happo and it sets the status",
  ],
  theirBill: "Billed per snapshot",
  cells: {
    billing: {
      text: "Snapshots a month. One snapshot is one variant in one browser.",
      sources: [HAPPO_PRICING],
    },
    free: {
      text: "5,000 snapshots a month, Chrome only.",
      sources: [HAPPO_PRICING],
    },
    paid: {
      text: "Starter, $149 a month for 50,000 snapshots in Chrome and Firefox, then $0.006 each.",
      sources: [HAPPO_PRICING],
    },
    limit: {
      text: "On Free, the account pauses until the next cycle. Paid plans bill the extra.",
      sources: [HAPPO_PRICING],
    },
    seats: {
      text: "Unlimited users.",
      sources: [HAPPO_PRICING],
    },
    renders: {
      text: "Happo's browser workers, from the suite the CLI uploads.",
      sources: [HAPPO_GETTING_STARTED],
    },
    compares: {
      text: "Happo's service.",
      sources: [
        HAPPO_GETTING_STARTED,
        {
          label: "Happo reviewing diffs",
          url: "https://docs.happo.io/docs/reviewing-diffs",
        },
      ],
    },
    browsers: {
      text: "Chrome, Firefox, Edge, Safari and iOS Safari, by plan. Safari starts on Growth, $399 a month.",
      sources: [HAPPO_BROWSERS, HAPPO_PRICING],
    },
    runners: {
      text: "Storybook, Cypress, Playwright, page URLs, or a custom bundle.",
      sources: [HAPPO_GETTING_STARTED],
    },
    git: {
      text: "GitHub, GitLab, Bitbucket and Azure DevOps.",
      sources: [
        {
          label: "Happo continuous integration",
          url: "https://docs.happo.io/docs/continuous-integration",
        },
      ],
    },
    openSource: {
      text: "The happo client is MIT licensed. The service is not open source.",
      sources: [
        { label: "happo on npm", url: "https://www.npmjs.com/package/happo" },
        {
          label: "Happo client repository",
          url: "https://github.com/happo/happo",
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
      "Browsers don't multiply the bill",
      "Happo counts one snapshot per variant per browser. We bill for bytes stored, and an unchanged screenshot is one hash.",
    ],
    [
      "The free plan never stops CI",
      `Happo pauses a free account at its quota until the next cycle. Ours warns, waits ${facts.graceDays} days, then passes the check with a note.`,
    ],
  ],
  ahead: [
    [
      "Safari, iOS and Edge",
      "Happo renders them on its own machines. With stateofpixel, your CI renders every browser you want to compare.",
    ],
    [
      "Accessibility checks",
      "Happo runs axe-core as a target on every plan. stateofpixel only compares screenshots.",
    ],
    [
      "GitLab, Bitbucket and Azure DevOps",
      "Happo reports to all three. stateofpixel works with GitHub only.",
    ],
  ],
  switchSteps: [
    [
      "Install the GitHub App",
      "Pick the repositories. On GitHub Actions there is no token to copy.",
    ],
    [
      "Replace the Happo step",
      "Storybook stories are captured at each width you list. For Cypress or Playwright, upload the screenshots your tests write.",
    ],
    [
      "Merge to main",
      "That build becomes the baseline. There is nothing to export from Happo.",
    ],
  ],
  faq: [
    [
      "Can I keep my Storybook stories as they are?",
      "Yes. stateofpixel storybook opens your built Storybook and captures every story at each width. A story named Button/Primary becomes the snapshot Button/Primary [chromium 1280].",
    ],
    [
      "Why is stateofpixel cheaper than Happo?",
      "Happo renders every snapshot in every browser on its own machines. stateofpixel never runs a browser: your CI renders and compares, and our server stores the images that changed.",
    ],
    [
      "Do I lose my Happo baselines?",
      "You start fresh. The first build on your default branch becomes the baseline, and pull requests compare against it from then on.",
    ],
  ],
};

const BACKSTOP_README = {
  label: "BackstopJS README",
  url: "https://github.com/garris/BackstopJS/blob/master/README.md",
};
const BACKSTOP_NPM = {
  label: "backstopjs on npm",
  url: "https://www.npmjs.com/package/backstopjs",
};

const backstopjs: Competitor = {
  slug: "backstopjs",
  name: "BackstopJS",
  logo: "/logos/compare/backstopjs.png",
  meta: {
    path: "/compare/backstopjs",
    title: "stateofpixel vs BackstopJS",
    description:
      "BackstopJS compares screenshots on your machine and writes an HTML report. stateofpixel keeps the baselines and asks for review on the pull request.",
  },
  headline: "Keep the visual tests. Get a review page.",
  lead: "BackstopJS compares screenshots on the machine that runs it and writes an HTML report there. stateofpixel takes the screenshots in your CI, keeps the baselines and asks for review on the pull request.",
  hook: "Runs on your machine. Last release in September 2024.",
  status: [
    {
      label: "Last release",
      value: "6.3.25, 7 September 2024",
      source: BACKSTOP_NPM,
    },
    {
      label: "Open issues",
      value: "517 on 5 October 2026",
      source: {
        label: "BackstopJS issues",
        url: "https://github.com/garris/BackstopJS/issues",
      },
    },
  ],
  priced: null,
  theirFlow: [
    "Puppeteer or Playwright captures on your machine",
    "Resemble.js compares locally",
    "An HTML report opens on that machine",
    "backstop approve copies the new images to the references",
  ],
  theirBill: "Free, you run it",
  cells: {
    billing: {
      text: "Nothing. It is MIT licensed software you run yourself.",
      sources: [BACKSTOP_NPM],
    },
    renders: {
      text: "Your machine or CI, with Puppeteer or Playwright, optionally in its Docker image.",
      sources: [BACKSTOP_README],
    },
    compares: {
      text: "Your machine or CI, with Resemble.js.",
      sources: [
        BACKSTOP_README,
        {
          label: "BackstopJS package.json",
          url: "https://github.com/garris/BackstopJS/blob/master/package.json",
        },
      ],
    },
    browsers: {
      text: "Chrome through Puppeteer, or Chromium, Firefox and WebKit through Playwright.",
      sources: [BACKSTOP_README],
    },
    runners: {
      text: "Scenarios in backstop.json: URLs, selectors and interactions, plus custom scripts.",
      sources: [BACKSTOP_README],
    },
    git: {
      text: "No integration. CI gets a JUnit report.",
      sources: [BACKSTOP_README],
    },
    retention: {
      text: "Reference images stay in a folder you keep, in or out of source control.",
      sources: [BACKSTOP_README],
    },
    openSource: {
      text: "Yes, MIT licensed.",
      sources: [
        {
          label: "BackstopJS license",
          url: "https://github.com/garris/BackstopJS/blob/master/LICENSE",
        },
      ],
    },
  },
  differences: [
    [
      "A review page on the pull request",
      "BackstopJS writes its report on the machine that ran it, and backstop approve copies the new images over the references. We set a GitHub check and show every change on one page that anyone with write access can approve.",
    ],
    [
      "Baselines out of your repository",
      "BackstopJS keeps reference images in a folder you store yourself. We pick the baseline from your git history, so two pull requests never conflict over an image.",
    ],
    [
      "Maintained",
      "BackstopJS's last npm release was 6.3.25, in September 2024. stateofpixel is in active development.",
    ],
  ],
  ahead: [
    [
      "Offline, with no service",
      "BackstopJS captures, compares and reports on your machine, with no account anywhere.",
    ],
    [
      "Scenarios without test code",
      "backstop.json drives clicks, hovers and key presses on a list of URLs. stateofpixel needs a test runner or Storybook to take the screenshots.",
    ],
    [
      "Compare two environments",
      "A referenceUrl compares one site with another, like production with staging. stateofpixel compares builds of the same repository.",
    ],
  ],
  switchSteps: [
    [
      "Install the GitHub App",
      "Pick the repositories. On GitHub Actions there is no token to copy.",
    ],
    [
      "Move scenarios to Playwright",
      "Each scenario becomes a test that visits the URL and calls snapshot(). The reporter uploads when the run ends.",
    ],
    [
      "Delete the reference images",
      "Remove backstop_data/bitmaps_reference. The first build on your default branch becomes the baseline.",
    ],
  ],
  faq: [
    [
      "Is BackstopJS still maintained?",
      "Its last npm release, 6.3.25, came out on 7 September 2024. The repository had 517 open issues on 5 October 2026.",
    ],
    [
      "Can I keep backstop.json?",
      "No. stateofpixel does not run scenarios. Take the screenshots with Playwright, or any tool that writes PNG files, and upload the folder.",
    ],
    [
      "Do I need to commit reference images?",
      "No. stateofpixel stores the images and picks each baseline from your git history.",
    ],
  ],
};

export const COMPETITORS: Competitor[] = [
  chromatic,
  argos,
  percy,
  applitools,
  happo,
  lostPixel,
  backstopjs,
];

export const COMPARE_PAGE: PageMeta = {
  path: "/compare",
  title: "Compare",
  description:
    "How stateofpixel compares with Chromatic, Argos, Percy, Applitools, Happo, Lost Pixel and BackstopJS, with a source for every fact.",
};

export function findCompetitor(slug: string): Competitor | undefined {
  return COMPETITORS.find((competitor) => competitor.slug === slug);
}
