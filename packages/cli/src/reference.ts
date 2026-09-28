export const ENV = {
  buildName: "STATEOFPIXEL_BUILD_NAME",
  shard: "STATEOFPIXEL_SHARD",
  nonce: "STATEOFPIXEL_NONCE",
  baselineBranch: "STATEOFPIXEL_BASELINE_BRANCH",
  token: "STATEOFPIXEL_TOKEN",
  dir: "STATEOFPIXEL_DIR",
} as const;

export const ENVIRONMENT: { name: string; description: string }[] = [
  {
    name: ENV.token,
    description: "project token, for CI other than GitHub Actions",
  },
  {
    name: ENV.dir,
    description:
      "folder that snapshot() writes to and the Playwright reporter uploads, stateofpixel-screenshots by default",
  },
  {
    name: "CI",
    description: "the Playwright reporter uploads only when it is set",
  },
];

export type OptionSpec = {
  flags: string;
  description: string;
  default?: string | number | boolean | number[];
  env?: string;
};

export type CommandSpec = {
  name: "compare" | "upload" | "storybook" | "finalize";
  description: string;
  arguments: { name: string; description: string }[];
  options: OptionSpec[];
};

const buildOptions = (dryRun: string): OptionSpec[] => [
  {
    flags: "--build-name <name>",
    description: "separate builds of one project, like storybook",
    env: ENV.buildName,
  },
  {
    flags: "--shard <i/n>",
    description: "this shard and the shard count, or auto with a finalize step",
    env: ENV.shard,
  },
  {
    flags: "--nonce <id>",
    description: "shared by every shard of one build",
    env: ENV.nonce,
  },
  {
    flags: "--baseline-branch <branch>",
    description: "branch to compare against",
    env: ENV.baselineBranch,
  },
  {
    flags: "--subset",
    description: "only some snapshots ran, do not mark others removed",
    default: false,
  },
  {
    flags: "--threshold <number>",
    description:
      "color difference threshold, 0 to 1, overrides project settings",
  },
  {
    flags: "--strict",
    description:
      "fail instead of skipping on an outage, a rate limit or a fork",
    default: false,
  },
  { flags: "--dry-run", description: dryRun, default: false },
];

export const COMMANDS: CommandSpec[] = [
  {
    name: "upload",
    description:
      "Upload a folder of screenshots and compare it with the baseline",
    arguments: [{ name: "<dir>", description: "folder with screenshots" }],
    options: buildOptions("hash and print the plan, upload nothing"),
  },
  {
    name: "storybook",
    description: "Capture every story of a built Storybook, then upload",
    arguments: [
      { name: "<static-dir>", description: "the output of storybook build" },
    ],
    options: [
      {
        flags: "--viewports <widths>",
        description: "comma separated viewport widths",
        default: [1280],
      },
      {
        flags: "--include <glob>",
        description: "only stories whose title/name match",
      },
      {
        flags: "--exclude <glob>",
        description: "skip stories whose title/name match",
      },
      {
        flags: "--wait-for-selector <selector>",
        description: "wait for this before each screenshot",
        default: "#storybook-root > *",
      },
      {
        flags: "--delay <ms>",
        description: "wait this long before each screenshot",
        default: 0,
      },
      ...buildOptions("capture and print the plan, upload nothing"),
    ],
  },
  {
    name: "finalize",
    description: "Finish a build whose shards ran with --shard auto",
    arguments: [],
    options: [
      {
        flags: "--build-name <name>",
        description: "the build name the shards used",
        env: ENV.buildName,
      },
      {
        flags: "--nonce <id>",
        description: "the nonce the shards used",
        env: ENV.nonce,
      },
      {
        flags: "--baseline-branch <branch>",
        description: "branch to compare against, for --skip-if-empty",
        env: ENV.baselineBranch,
      },
      {
        flags: "--skip-if-empty",
        description: "create a build with no changes when no shard ran",
        default: false,
      },
      {
        flags: "--strict",
        description:
          "fail instead of skipping on an outage, a rate limit or a fork",
        default: false,
      },
    ],
  },
  {
    name: "compare",
    description: "Compare a folder of screenshots against a baseline folder",
    arguments: [
      { name: "<dir>", description: "folder with new screenshots" },
      {
        name: "<baseline-dir>",
        description: "folder with baseline screenshots",
      },
    ],
    options: [
      {
        flags: "--out <dir>",
        description: "report folder",
        default: "stateofpixel-report",
      },
      {
        flags: "--threshold <number>",
        description: "color difference threshold, 0 to 1",
        default: 0.1,
      },
      {
        flags: "--include-aa",
        description: "count anti-aliased pixels as changes",
        default: false,
      },
    ],
  },
];
