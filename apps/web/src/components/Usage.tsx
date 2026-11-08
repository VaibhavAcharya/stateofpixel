import { LockSimpleIcon } from "@phosphor-icons/react/ssr";
import { formatGigabytes } from "@stateofpixel/backend/storage";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Button,
  Card,
  CardFrame,
  CardFrameAction,
  CardFrameFooter,
  CardFrameHeader,
  CardFrameTitle,
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
import { listRowLinkClass, ProjectMark } from "./ui";

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
          className={`flex min-w-0 items-center gap-2.5 font-medium ${listRowLinkClass}`}
        >
          <ProjectMark
            name={`${row.original.owner}/${row.original.name}`}
            size={20}
          />
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
    meta: { className: "w-36 text-right tabular-nums" },
    cell: ({ row }) => {
      const total = totalBytes(row.original);
      return (
        <span className="flex flex-col items-end gap-1.5">
          {formatBytes(total)}
          <span
            aria-hidden
            className="flex h-1 w-24 overflow-hidden rounded-full bg-muted"
          >
            {PARTS.map((part) => (
              <span
                key={part.key}
                className={part.color}
                style={{
                  width: `${total === 0 ? 0 : (row.original[part.key] / total) * 100 * row.original.share}%`,
                }}
              />
            ))}
          </span>
        </span>
      );
    },
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

  const partBytes = PARTS.map((part) => ({
    ...part,
    bytes: projects.reduce(
      (sum, project) => sum + project[part.key],
      usage.hidden[part.key],
    ),
  }));
  const used = unlimited
    ? null
    : storage.storageBytes / storage.storageLimitBytes;

  return (
    <div className="flex flex-col gap-6">
      <CardFrame>
        <CardFrameHeader className="py-3">
          <CardFrameTitle>Storage</CardFrameTitle>
          {used !== null && (
            <CardFrameAction>
              <span className="text-muted-foreground text-xs tabular-nums">
                {Math.round(used * 100)}% of the plan
              </span>
            </CardFrameAction>
          )}
        </CardFrameHeader>
        <Card className="overflow-hidden">
          <div className="grid divide-y lg:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))] lg:divide-x lg:divide-y-0">
            <div className="flex flex-col gap-4 p-5">
              <p className="text-muted-foreground text-sm">
                <span className="font-heading font-semibold text-4xl text-foreground tracking-[-0.02em] tabular-nums">
                  {formatGigabytes(storage.storageBytes)}
                </span>{" "}
                {unlimited
                  ? "stored"
                  : `of ${formatGigabytes(storage.storageLimitBytes)} stored`}
              </p>
              <div
                role="img"
                aria-label="Storage by kind"
                className="flex h-2 overflow-hidden rounded-full bg-muted"
              >
                {partBytes.map((part) => (
                  <span
                    key={part.key}
                    className={part.color}
                    style={{
                      width: `${Math.min(100, (part.bytes / barBytes) * 100)}%`,
                    }}
                  />
                ))}
              </div>
            </div>
            {partBytes.map((part) => (
              <div key={part.key} className="flex flex-col gap-1 p-5">
                <span className="flex items-center gap-2 text-muted-foreground text-sm">
                  <span className={`size-2 rounded-full ${part.color}`} />
                  {part.label}
                </span>
                <span className="font-heading font-semibold text-2xl tabular-nums">
                  {formatBytes(part.bytes)}
                </span>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {counted === 0
                    ? "Nothing counted yet"
                    : `${Math.round((part.bytes / counted) * 100)}% of counted`}
                </span>
              </div>
            ))}
          </div>
        </Card>
        <CardFrameFooter className="py-3 text-muted-foreground text-xs">
          {usage.countedOn === null
            ? "The split by kind and project is counted once a day and shows here after the first count."
            : `The split by kind and project is counted once a day, last on ${formatDay(usage.countedOn)}. Each image counts once, for the project that used it first.`}
        </CardFrameFooter>
      </CardFrame>
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
    <CardFrame>
      <CardFrameHeader className="py-3">
        <CardFrameTitle>Storage, last {USAGE_DAYS} days</CardFrameTitle>
        {daily.length > 0 && (
          <CardFrameAction>
            <span className="text-muted-foreground text-xs tabular-nums">
              Peak {formatBytes(max)}
            </span>
          </CardFrameAction>
        )}
      </CardFrameHeader>
      <Card className="p-5">
        <div className="flex h-36 items-end gap-px border-b">
          {days.map((day, index) => {
            const bytes = bytesByDay.get(day);
            return (
              <span
                key={day}
                title={`${formatDay(day)}: ${
                  bytes === undefined ? "not counted" : formatBytes(bytes)
                }`}
                className={`flex-1 rounded-t-xs transition-colors ${
                  index === days.length - 1
                    ? "bg-link"
                    : "bg-link/40 hover:bg-link"
                }`}
                style={{ height: `${((bytes ?? 0) / max) * 100}%` }}
              />
            );
          })}
        </div>
        <div className="mt-2 flex justify-between text-muted-foreground text-xs tabular-nums">
          <span>{formatDay(days[0] ?? "")}</span>
          <span>{formatDay(days[days.length - 1] ?? "")}</span>
        </div>
      </Card>
    </CardFrame>
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
