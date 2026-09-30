import { type StatusBuild, toStatus } from "@stateofpixel/backend/checkStatus";
import type { Id } from "@stateofpixel/backend/dataModel";
import {
  COMMANDS,
  type CommandSpec,
  ENVIRONMENT,
} from "../../../../../packages/cli/src/reference";
import { SHORTCUT_GROUPS } from "../ShortcutsDialog";
import { Kbd } from "../ui";
import { Code, Table } from "./DocsLayout";
import { facts } from "./facts";

function sentence(text: string): string {
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
}

export function LimitsTable() {
  return (
    <Table
      head={["Limit", "Value"]}
      rows={[
        ["Snapshots per build", facts.snapshotsPerBuild],
        ["Shards per build", facts.shardsPerBuild],
        ["Image size", facts.imageSize],
        ["Image dimensions", facts.imageDimensions],
        ["Snapshot name", facts.snapshotNameLength],
        ["Metadata per snapshot", facts.metadataSize],
        ["Time to finish a build", `${facts.buildExpiryMinutes} minutes`],
        ["Builds per account", facts.dailyBuilds],
        ["Uploads per account", facts.dailyUploads],
        ["Requests per token", facts.requestsPerMinute],
      ]}
    />
  );
}

const counts = {
  unchanged: 0,
  changed: 0,
  added: 0,
  removed: 0,
  failed: 0,
  pending: 0,
  approved: 0,
  rejected: 0,
};

const reviewed: StatusBuild = {
  status: "finalized",
  conclusion: "approved",
  counts: { ...counts, changed: 10, added: 2, approved: 12 },
  shardsTotal: 1,
  doneShardIndexes: [1],
  storageBlocked: false,
  baselineBuildId: "baseline" as Id<"builds">,
  autoApproved: false,
};

const CHECK_CASES: [string, StatusBuild][] = [
  [
    "Shards still uploading",
    {
      ...reviewed,
      status: "pending",
      shardsTotal: 4,
      doneShardIndexes: [1, 2],
    },
  ],
  [
    "Changes to review",
    {
      ...reviewed,
      conclusion: "changes",
      counts: { ...counts, changed: 10, added: 2, pending: 12 },
    },
  ],
  ["Nothing changed", { ...reviewed, conclusion: "no_changes", counts }],
  ["Every change approved", reviewed],
  [
    "First build of a suite",
    {
      ...reviewed,
      baselineBuildId: null,
      counts: { ...counts, added: 40, approved: 40 },
    },
  ],
  ["Default branch", { ...reviewed, autoApproved: true }],
  [
    "A change rejected",
    {
      ...reviewed,
      conclusion: "rejected",
      counts: { ...counts, changed: 12, rejected: 2, approved: 10 },
    },
  ],
  [
    `Not finished in ${facts.buildExpiryMinutes} minutes`,
    { ...reviewed, status: "expired" },
  ],
  ["Upload failed on CI", { ...reviewed, status: "error" }],
  [
    "Over the storage limit",
    { ...reviewed, conclusion: "changes", storageBlocked: true },
  ],
];

const STATE_LABELS = {
  pending: "Pending",
  success: "Success",
  failure: "Failure",
  error: "Error",
} as const;

export function CheckStatesTable() {
  return (
    <Table
      head={["Build", "Check", "Text"]}
      rows={CHECK_CASES.map(([label, build]) => {
        const { state, description } = toStatus(build);
        return [label, STATE_LABELS[state], description];
      })}
    />
  );
}

function command(name: CommandSpec["name"]): CommandSpec {
  const spec = COMMANDS.find((candidate) => candidate.name === name);
  if (spec === undefined) {
    throw new Error(`No CLI command ${name}`);
  }
  return spec;
}

export function CliCommands() {
  return (
    <Table
      first={(value) => <Code>{value}</Code>}
      head={["Command", "What it does"]}
      rows={COMMANDS.map((spec) => [
        [spec.name, ...spec.arguments.map((argument) => argument.name)].join(
          " ",
        ),
        sentence(spec.description),
      ])}
    />
  );
}

function formatDefault(
  value: NonNullable<CommandSpec["options"][number]["default"]>,
) {
  return Array.isArray(value) ? value.join(",") : String(value);
}

export function CliOptions({
  name,
  only,
}: {
  name: CommandSpec["name"];
  only?: string[];
}) {
  const options = command(name).options.filter(
    (option) =>
      only === undefined || only.includes(option.flags.split(" ")[0] ?? ""),
  );
  return (
    <Table
      first={(flags) => {
        const env = options.find((option) => option.flags === flags)?.env;
        return (
          <span className="flex flex-col items-start gap-1">
            <Code>{flags}</Code>
            {env !== undefined && (
              <span className="mono text-xs text-muted">{env}</span>
            )}
          </span>
        );
      }}
      head={["Flag", "Default", "What it does"]}
      rows={options.map((option) => [
        option.flags,
        option.default === undefined || option.default === false ? (
          ""
        ) : (
          <Code key="default">{formatDefault(option.default)}</Code>
        ),
        sentence(option.description),
      ])}
    />
  );
}

export function CliEnvironment() {
  return (
    <Table
      first={(value) => <Code>{value}</Code>}
      head={["Variable", "What it does"]}
      rows={ENVIRONMENT.map((variable) => [
        variable.name,
        sentence(variable.description),
      ])}
    />
  );
}

export function ShortcutsTable() {
  return (
    <Table
      head={["Action", "Keys"]}
      rows={SHORTCUT_GROUPS.flatMap((group) =>
        group.items.map(([action, keys]): [string, React.ReactNode] => [
          action,
          <span key="keys" className="inline-flex gap-1">
            {keys.map((key) => (
              <Kbd key={key}>{key}</Kbd>
            ))}
          </span>,
        ]),
      )}
    />
  );
}
