import { LockSimpleIcon } from "@phosphor-icons/react/ssr";
import { formatGigabytes } from "@stateofpixel/backend/storage";
import { Link } from "@tanstack/react-router";
import type { api, FunctionReturnType } from "../lib/backend";
import { formatBytes } from "../lib/format";
import { columnHelper, DataTable } from "./DataTable";
import { listRowLinkClass } from "./ui";

export type UsageData = NonNullable<FunctionReturnType<typeof api.usage.get>>;

type UsageProject = UsageData["projects"][number] & { owner: string };

export const USAGE_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;

const PARTS = [
  { key: "baselineBytes", label: "Baselines", color: "bg-approved" },
  { key: "prBytes", label: "PR-only images", color: "bg-changed" },
  { key: "diffBytes", label: "Diff images", color: "bg-subtle" },
] as const;

function formatDay(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  });
}

function totalBytes(row: Pick<UsageProject, (typeof PARTS)[number]["key"]>) {
  return row.baselineBytes + row.prBytes + row.diffBytes;
}

const helper = columnHelper<UsageProject & { share: number }>();

const columns = helper.columns([
  helper.accessor("name", {
    header: "Project",
    cell: ({ row }) =>
      row.original.archived ? (
        <span className="flex min-w-0 items-center gap-2 text-muted">
          <span className="truncate">{row.original.name}</span>
          <span className="text-xs">Archived</span>
        </span>
      ) : (
        <Link
          to="/$owner/$repo/settings"
          params={{ owner: row.original.owner, repo: row.original.name }}
          className={`flex min-w-0 items-center gap-2 font-medium ${listRowLinkClass}`}
        >
          <span className="truncate">{row.original.name}</span>
          {row.original.private && (
            <LockSimpleIcon
              size={12}
              aria-label="Private"
              className="shrink-0 text-muted"
            />
          )}
        </Link>
      ),
  }),
  helper.display({
    id: "storage",
    header: "Storage",
    meta: { className: "w-28 text-right tabular-nums" },
    cell: ({ row }) => formatBytes(totalBytes(row.original)),
  }),
  helper.accessor("share", {
    header: "Share",
    meta: { className: "w-20 text-right text-muted tabular-nums" },
    cell: ({ getValue }) => `${Math.round(getValue() * 100)}%`,
  }),
  ...PARTS.map((part) =>
    helper.accessor(part.key, {
      header: part.label,
      meta: {
        className: "w-32 text-right text-muted tabular-nums max-md:hidden",
      },
      cell: ({ getValue }) => formatBytes(getValue()),
    }),
  ),
  helper.accessor("prRetentionDays", {
    header: "PR-only kept",
    meta: {
      className: "w-28 text-right text-muted tabular-nums max-sm:hidden",
    },
    cell: ({ getValue }) => `${getValue()} days`,
  }),
]);

export function UsageView({
  owner,
  usage,
  today,
}: {
  owner: string;
  usage: UsageData;
  today: number;
}) {
  const { storage } = usage;
  const counted = usage.projects.reduce(
    (sum, project) => sum + totalBytes(project),
    0,
  );
  const projects = usage.projects
    .map((project) => ({
      ...project,
      owner,
      share: counted === 0 ? 0 : totalBytes(project) / counted,
    }))
    .sort((a, b) => totalBytes(b) - totalBytes(a));
  const unlimited = storage.plan === "unlimited";
  const barBytes = unlimited ? Math.max(1, counted) : storage.storageLimitBytes;

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-lg bg-surface p-5 ring-1 ring-border">
        <p className="text-sm text-muted">
          <span className="text-2xl font-semibold text-text tabular-nums">
            {formatGigabytes(storage.storageBytes)}
          </span>{" "}
          {unlimited
            ? "stored"
            : `of ${formatGigabytes(storage.storageLimitBytes)} stored`}
        </p>
        <div
          role="img"
          aria-label="Storage by kind"
          className="mt-4 flex h-2 overflow-hidden rounded-full bg-surface-2"
        >
          {PARTS.map((part) => {
            const bytes = projects.reduce(
              (sum, project) => sum + project[part.key],
              0,
            );
            return (
              <span
                key={part.key}
                className={part.color}
                style={{
                  width: `${Math.min(100, (bytes / barBytes) * 100)}%`,
                }}
              />
            );
          })}
        </div>
        <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted">
          {PARTS.map((part) => (
            <li key={part.key} className="flex items-center gap-2">
              <span className={`size-2 rounded-full ${part.color}`} />
              {part.label}
              <span className="text-text tabular-nums">
                {formatBytes(
                  projects.reduce((sum, project) => sum + project[part.key], 0),
                )}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-muted">
          {usage.countedOn === null
            ? "The split by kind and project is counted once a day and shows here after the first count."
            : `The split by kind and project is counted once a day, last on ${formatDay(usage.countedOn)}. Each image counts once, for the project that used it first.`}
        </p>
      </section>
      <DailyChart daily={usage.daily} today={today} />
      {projects.length > 0 && (
        <DataTable
          columns={columns}
          data={projects}
          getRowId={(project) => project.name}
          sorting={[]}
        />
      )}
    </div>
  );
}

function DailyChart({
  daily,
  today,
}: {
  daily: UsageData["daily"];
  today: number;
}) {
  const bytesByDay = new Map(daily.map((entry) => [entry.day, entry.bytes]));
  const days = Array.from({ length: USAGE_DAYS }, (_, index) =>
    new Date(today - (USAGE_DAYS - 1 - index) * DAY_MS)
      .toISOString()
      .slice(0, 10),
  );
  const max = Math.max(1, ...daily.map((entry) => entry.bytes));
  return (
    <section>
      <h2 className="text-sm font-medium">Storage, last {USAGE_DAYS} days</h2>
      <div className="mt-3 flex h-32 items-end gap-px border-b border-border">
        {days.map((day) => {
          const bytes = bytesByDay.get(day);
          return (
            <span
              key={day}
              title={`${formatDay(day)}: ${
                bytes === undefined ? "not counted" : formatBytes(bytes)
              }`}
              className="flex-1 rounded-t-xs bg-link"
              style={{ height: `${((bytes ?? 0) / max) * 100}%` }}
            />
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-xs text-muted tabular-nums">
        <span>{formatDay(days[0] ?? "")}</span>
        {daily.length > 0 && <span>Peak {formatBytes(max)}</span>}
        <span>{formatDay(days[days.length - 1] ?? "")}</span>
      </div>
    </section>
  );
}
