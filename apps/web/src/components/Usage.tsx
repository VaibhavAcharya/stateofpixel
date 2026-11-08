import { LockSimpleIcon } from "@phosphor-icons/react/ssr";
import { formatGigabytes } from "@stateofpixel/backend/storage";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Button,
  Dialog,
  DialogHeader,
  DialogPopup,
  DialogTitle,
  DialogTrigger,
  Input,
} from "uiofcraft";
import { api, type FunctionReturnType, useMutation } from "../lib/backend";
import { errorCode } from "../lib/errorCode";
import { formatBytes } from "../lib/format";
import { columnHelper, DataTable } from "./DataTable";
import { Field } from "./Settings";
import { listRowLinkClass } from "./ui";

export type UsageData = NonNullable<FunctionReturnType<typeof api.usage.get>>;

type UsageProject = UsageData["projects"][number] & {
  owner: string;
  canDelete: boolean;
};

export const USAGE_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;

const PARTS = [
  { key: "baselineBytes", label: "Baselines", color: "bg-approved" },
  { key: "prBytes", label: "PR-only images", color: "bg-changed" },
  { key: "diffBytes", label: "Diff images", color: "bg-muted-foreground" },
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
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground">
          <span className="truncate">{row.original.name}</span>
          <span className="text-xs">Archived</span>
          {row.original.canDelete && (
            <DeleteArchivedProject project={row.original} />
          )}
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
              className="shrink-0 text-muted-foreground"
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
    meta: { className: "w-20 text-right text-muted-foreground tabular-nums" },
    cell: ({ getValue }) => `${Math.round(getValue() * 100)}%`,
  }),
  ...PARTS.map((part) =>
    helper.accessor(part.key, {
      header: part.label,
      meta: {
        className:
          "w-32 text-right text-muted-foreground tabular-nums max-md:hidden",
      },
      cell: ({ getValue }) => formatBytes(getValue()),
    }),
  ),
  helper.accessor("prRetentionDays", {
    header: "PR-only kept",
    meta: {
      className:
        "w-28 text-right text-muted-foreground tabular-nums max-sm:hidden",
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
    totalBytes(usage.hidden),
  );
  const projects = usage.projects
    .map((project) => ({
      ...project,
      owner,
      canDelete: usage.canDeleteArchived,
      share: counted === 0 ? 0 : totalBytes(project) / counted,
    }))
    .sort((a, b) => totalBytes(b) - totalBytes(a));
  const unlimited = storage.plan === "unlimited";
  const barBytes = unlimited ? Math.max(1, counted) : storage.storageLimitBytes;

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-xl border bg-card p-5 shadow-xs/5">
        <p className="text-sm text-muted-foreground">
          <span className="text-2xl font-semibold text-foreground tabular-nums">
            {formatGigabytes(storage.storageBytes)}
          </span>{" "}
          {unlimited
            ? "stored"
            : `of ${formatGigabytes(storage.storageLimitBytes)} stored`}
        </p>
        <div
          role="img"
          aria-label="Storage by kind"
          className="mt-4 flex h-2 overflow-hidden rounded-full bg-muted"
        >
          {PARTS.map((part) => {
            const bytes = projects.reduce(
              (sum, project) => sum + project[part.key],
              usage.hidden[part.key],
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
        <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
          {PARTS.map((part) => (
            <li key={part.key} className="flex items-center gap-2">
              <span className={`size-2 rounded-full ${part.color}`} />
              {part.label}
              <span className="text-foreground tabular-nums">
                {formatBytes(
                  projects.reduce(
                    (sum, project) => sum + project[part.key],
                    usage.hidden[part.key],
                  ),
                )}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-muted-foreground">
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
      {usage.hidden.projects > 0 && (
        <p className="text-xs text-muted-foreground">
          {usage.hidden.projects === 1
            ? `1 project you cannot open on GitHub is not listed. It stores ${formatBytes(totalBytes(usage.hidden))}.`
            : `${usage.hidden.projects} projects you cannot open on GitHub are not listed. They store ${formatBytes(totalBytes(usage.hidden))}.`}
        </p>
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
      <div className="mt-1 flex justify-between text-xs text-muted-foreground tabular-nums">
        <span>{formatDay(days[0] ?? "")}</span>
        {daily.length > 0 && <span>Peak {formatBytes(max)}</span>}
        <span>{formatDay(days[days.length - 1] ?? "")}</span>
      </div>
    </section>
  );
}

const DELETE_ERRORS: Record<string, string> = {
  confirm_name_mismatch: "The name does not match.",
  not_found: "This project is no longer archived or was already deleted.",
};

function DeleteArchivedProject({ project }: { project: UsageProject }) {
  const removeArchived = useMutation(api.projects.removeArchived);
  const [open, setOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setOpen(false);
    setConfirmName("");
    setError(null);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? setOpen(true) : close())}
    >
      <DialogTrigger
        render={<Button variant="destructive-outline" size="sm" />}
      >
        Delete
      </DialogTrigger>
      <DialogPopup className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold tracking-[-0.01em]">
            Delete {project.name}
          </DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-3 px-6 pb-6"
          onSubmit={(event) => {
            event.preventDefault();
            removeArchived({
              login: project.owner,
              projectId: project.id,
              confirmName,
            })
              .then(close)
              .catch((reason: unknown) => {
                const code = errorCode(reason);
                setError(
                  (code !== null && DELETE_ERRORS[code]) ||
                    "Could not delete. Try again.",
                );
              });
          }}
        >
          <p className="text-sm text-muted-foreground">
            Deletes every build, review and token of this archived project right
            away. This cannot be undone.
          </p>
          <Field label={`Type ${project.name} to confirm`}>
            {(id) => (
              <Input
                id={id}
                value={confirmName}
                aria-invalid={error !== null}
                onChange={(event) => setConfirmName(event.target.value)}
                className="mono"
              />
            )}
          </Field>
          {error && (
            <p role="alert" className="text-xs text-rejected">
              {error}
            </p>
          )}
          <div>
            <Button
              type="submit"
              variant="destructive-outline"
              disabled={confirmName !== project.name}
            >
              Delete project
            </Button>
          </div>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
